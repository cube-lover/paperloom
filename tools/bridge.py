#!/usr/bin/env python3
"""Optional loopback-only PDF bridge. Python 3.10+, standard library only.
External parser/translator CLIs must be installed separately. No shell invocation.
"""
from __future__ import annotations
import argparse
import base64
import binascii
import hmac
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import threading
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_PDF = 80 * 1024 * 1024
MAX_BODY = 112 * 1024 * 1024
GATE = threading.BoundedSemaphore(1)
LANGUAGES = {'auto': 'en', '简体中文': 'zh', '中文': 'zh', 'English': 'en', '英语': 'en', '日本語': 'ja', '日语': 'ja'}


def command_for(template: list[str], values: dict[str, str]) -> list[str]:
    if not isinstance(template, list) or not template or any(not isinstance(x, str) for x in template):
        raise ValueError('Command must be a non-empty JSON string array')
    output = []
    for token in template:
        for key, value in values.items():
            token = token.replace('{' + key + '}', value)
        output.append(token)
    return output


def tei_to_markdown(xml: str) -> str:
    """Convert GROBID TEI structures without claiming OCR or page-level geometry."""
    if len(xml) > 20 * 1024 * 1024 or '<!DOCTYPE' in xml.upper() or '<!ENTITY' in xml.upper():
        raise ValueError('Unexpected or oversized TEI document')
    root = ET.fromstring(xml)
    text = lambda el: ' '.join(''.join(el.itertext()).split()) if el is not None else ''
    lines = []
    title = root.find('.//{*}titleStmt/{*}title')
    if text(title): lines.extend(['# ' + text(title), ''])
    abstract = root.find('.//{*}abstract')
    if text(abstract): lines.extend(['## Abstract', '', text(abstract), ''])

    def visit(element, depth=2):
        for child in element:
            tag = child.tag.rsplit('}', 1)[-1]
            if tag == 'div':
                visit(child, min(depth + 1, 6))
            elif tag == 'head':
                number = child.get('n', '')
                lines.extend(['#' * min(depth, 6) + ' ' + (number + ' ' if number else '') + text(child), ''])
            elif tag in {'p', 'formula', 'figure', 'note', 'table'}:
                value = text(child)
                if value: lines.extend([value, ''])
            else:
                visit(child, depth)
    body = root.find('.//{*}text/{*}body')
    if body is not None: visit(body)
    bibliography = root.find('.//{*}listBibl')
    if bibliography is not None:
        lines.extend(['## References', ''])
        for index, ref in enumerate(bibliography, 1):
            if text(ref): lines.extend([f'[{index}] ' + text(ref), ''])
    return '\n'.join(lines).strip()


def grobid_parse(pdf: bytes, config: dict) -> dict:
    url = str(config.get('grobidURL', 'http://127.0.0.1:8070')).rstrip('/')
    parsed = urllib.parse.urlparse(url)
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('GROBID URL must not embed credentials or query parameters')
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in {'localhost', '127.0.0.1', '::1'}):
        raise ValueError('GROBID requires HTTPS or a loopback HTTP address')
    boundary = 'PaperLoom' + secrets.token_hex(12)
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="input"; filename="input.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode()
            + pdf + f'\r\n--{boundary}--\r\n'.encode())
    request = urllib.request.Request(url + '/api/processFulltextDocument', data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}', 'Accept': 'application/xml'})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({})) if parsed.hostname in {'localhost', '127.0.0.1', '::1'} else urllib.request.build_opener()
    with opener.open(request, timeout=min(int(config.get('timeout', 240)), 240)) as response:
        raw = response.read(20 * 1024 * 1024 + 1)
    if len(raw) > 20 * 1024 * 1024: raise ValueError('GROBID output exceeds size limit')
    return {'text': tei_to_markdown(raw.decode('utf-8')), 'parser': 'grobid', 'imagesEmbedded': False}


def process_pdf(config: dict, action: str, payload: dict) -> dict:
    if action not in {'parse', 'pdf'}:
        raise ValueError('Unknown action')
    encoded = payload.get('pdfBase64', '')
    if not isinstance(encoded, str):
        raise ValueError('pdfBase64 must be a string')
    try:
        pdf = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError('Invalid PDF base64') from exc
    if not pdf.startswith(b'%PDF-') or len(pdf) > MAX_PDF:
        raise ValueError('Expected a PDF under 80 MB')
    if action == 'parse' and config.get('parserBackend') == 'grobid':
        return grobid_parse(pdf, config)
    work_root = Path(config['workDir']).resolve()
    work_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='job-', dir=work_root) as folder:
        root = Path(folder)
        input_path = root / 'input.pdf'
        out = root / 'output'
        out.mkdir()
        input_path.write_bytes(pdf)
        lang = lambda value: LANGUAGES.get(str(value), str(value).lower())
        source = lang(payload.get('sourceLang', 'en'))
        target = lang(payload.get('targetLang', 'zh'))
        if any(not x.replace('-', '').isalpha() or len(x) > 12 for x in [source, target]):
            raise ValueError('Expected language codes such as en, zh, ja')
        args = command_for(config['parseCommand' if action == 'parse' else 'pdfCommand'], {
            'input': str(input_path), 'output': str(out), 'source': source, 'target': target,
        })
        # Command templates are local administrator configuration, never supplied over HTTP.
        # Do not return subprocess output: upstream CLIs may log sensitive provider configuration.
        try:
            result = subprocess.run(args, cwd=root, shell=False, stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL, timeout=int(config.get('timeout', 240)),
                                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except FileNotFoundError as exc:
            raise ValueError('Configured CLI not found; install it and use an absolute executable path') from exc
        except subprocess.TimeoutExpired as exc:
            raise ValueError('CLI timed out; try fewer pages or a faster model') from exc
        if result.returncode != 0:
            raise ValueError(f'CLI exited with code {result.returncode}; verify its configuration separately')
        if action == 'parse':
            candidates = sorted(out.rglob('*.md'))
            if not candidates:
                raise ValueError('Parser produced no Markdown file')
            # MinerU may emit multiple variants; select the most substantial document rather than duplicate them.
            chosen = max(candidates, key=lambda p: p.stat().st_size)
            if chosen.stat().st_size > 12 * 1024 * 1024:
                raise ValueError('Markdown exceeds size limit')
            return {'text': chosen.read_text(encoding='utf-8'), 'parser': 'local-cli', 'imagesEmbedded': False}
        candidates = sorted(out.rglob('*.pdf'))
        if not candidates:
            raise ValueError('Translator produced no PDF file')
        if sum(p.stat().st_size for p in candidates) > MAX_PDF:
            raise ValueError('Output PDFs exceed total size limit')
        return {'files': [{'name': p.name, 'base64': base64.b64encode(p.read_bytes()).decode('ascii')} for p in candidates]}


def make_handler(config: dict):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'PaperLoomBridge/0.1'

        def log_message(self, *args):
            pass  # No request headers, tokens, document content or CLI output in logs.

        def answer(self, status, data):
            # Drain small rejected/health bodies before close to avoid a TCP reset on Windows.
            if not getattr(self, 'body_read', False):
                try:
                    size = int(self.headers.get('Content-Length', '0'))
                    if 0 < size <= 8192:
                        self.connection.settimeout(1)
                        self.rfile.read(size)
                except (ValueError, OSError):
                    pass
                self.body_read = True
            body = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_POST(self):
            origin = self.headers.get('Origin')
            if origin and origin != 'chrome://paperloom':
                return self.answer(403, {'error': 'Browser origins are not accepted'})
            expected = 'Bearer ' + config['token']
            if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), expected.encode()):
                return self.answer(401, {'error': 'Authentication required'})
            if self.path == '/v1/health':
                return self.answer(200, {'ok': True, 'version': '0.1.0'})
            if self.path not in {'/v1/parse', '/v1/pdf'}:
                return self.answer(404, {'error': 'Unknown endpoint'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                return self.answer(400, {'error': 'Invalid content length'})
            if size <= 0 or size > MAX_BODY:
                return self.answer(413, {'error': 'Request exceeds size limit'})
            if not GATE.acquire(blocking=False):
                return self.answer(429, {'error': 'Another document is being processed'})
            try:
                self.connection.settimeout(30)
                raw = self.rfile.read(size)
                self.body_read = True
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise ValueError('Expected a JSON object')
                self.answer(200, process_pdf(config, self.path.rsplit('/', 1)[-1], payload))
            except (ValueError, KeyError, OSError, ET.ParseError) as exc:
                # Only our own sanitized ValueError messages are useful to clients.
                self.answer(400, {'error': str(exc) if type(exc) is ValueError else 'Local processing error; check configuration and disk access'})
            finally:
                GATE.release()
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=Path(__file__).resolve().parent / '.local' / 'bridge.json')
    parser.add_argument('--init', action='store_true', help='Write a private local config with a random token; do not print it')
    args = parser.parse_args()
    if args.init:
        if args.config.exists():
            raise SystemExit('Config already exists; leaving it unchanged')
        args.config.parent.mkdir(parents=True, exist_ok=True)
        config = {'host': '127.0.0.1', 'port': 8767, 'token': secrets.token_urlsafe(32),
                  'workDir': str(args.config.parent / 'work'), 'timeout': 240,
                  'parserBackend': 'cli', 'grobidURL': 'http://127.0.0.1:8070',
                  'parseCommand': ['mineru', '-p', '{input}', '-o', '{output}'],
                  'pdfCommand': ['pdf2zh', '{input}', '-o', '{output}', '-li', '{source}', '-lo', '{target}']}
        args.config.write_text(json.dumps(config, indent=2), encoding='utf-8')
        os.chmod(args.config, 0o600)
        print('Local config created. Copy its token into PaperLoom settings; keep the file private.')
        return
    config = json.loads(args.config.read_text(encoding='utf-8'))
    if config.get('host', '127.0.0.1') != '127.0.0.1' or len(config.get('token', '')) < 24:
        raise SystemExit('Bridge requires host 127.0.0.1 and a token of at least 24 characters')
    server = ThreadingHTTPServer(('127.0.0.1', int(config.get('port', 8767))), make_handler(config))
    print(f'PaperLoom local bridge ready on port {server.server_port}. External CLIs are configured separately.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
