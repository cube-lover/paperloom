import base64
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer

SPEC = importlib.util.spec_from_file_location('bridge', Path(__file__).resolve().parents[1] / 'tools' / 'bridge.py')
bridge = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1] / '.local' / 'tests'
        root.mkdir(parents=True, exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=root)
        self.root = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def test_argv_keeps_paths_and_metacharacters_as_single_arguments(self):
        command = bridge.command_for(['tool', '{input}', '--output', '{output}'], {'input': 'A B & C.pdf', 'output': 'X Y'})
        self.assertEqual(command, ['tool', 'A B & C.pdf', '--output', 'X Y'])
        with self.assertRaises(ValueError): bridge.command_for('shell command', {})

    def test_invalid_pdf_rejected_before_cli(self):
        for payload in [{'pdfBase64': '@@@'}, {'pdfBase64': base64.b64encode(b'not a pdf').decode()}, {'pdfBase64': []}]:
            with self.assertRaises(ValueError): bridge.process_pdf({}, 'parse', payload)

    def test_local_cli_contract_returns_markdown_and_cleans_temporary_files(self):
        script = self.root / 'fake_cli.py'
        script.write_text('import pathlib,sys\np=pathlib.Path(sys.argv[1]);p.mkdir(exist_ok=True);(p/"output.md").write_text("# Title\\n\\nBody",encoding="utf-8")', encoding='utf-8')
        config = {'workDir': str(self.root / 'work'), 'parseCommand': [sys.executable, str(script), '{output}']}
        result = bridge.process_pdf(config, 'parse', {'pdfBase64': base64.b64encode(b'%PDF-1.4\nfixture').decode()})
        self.assertIn('# Title', result['text'])
        self.assertEqual(list((self.root / 'work').iterdir()), [])

    def test_cli_failure_response_omits_sensitive_output(self):
        script = self.root / 'fake_fail.py'
        script.write_text('import sys\nprint("secret-must-not-escape");sys.exit(9)', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'code 9') as caught:
            bridge.process_pdf({'workDir': str(self.root / 'work'), 'pdfCommand': [sys.executable, str(script)]}, 'pdf', {'pdfBase64': base64.b64encode(b'%PDF-1.4 fixture').decode()})
        self.assertNotIn('secret-must-not-escape', str(caught.exception))

    def test_tei_preserves_title_abstract_sections_and_references(self):
        xml = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Sample paper</title></titleStmt></fileDesc><profileDesc><abstract><p>Abstract text</p></abstract></profileDesc></teiHeader><text><body><div><head n="1">Methods</head><p>A value of 2.3 eV <ref>[1]</ref>.</p></div></body><back><listBibl><biblStruct>Reference text</biblStruct></listBibl></back></text></TEI>'
        md = bridge.tei_to_markdown(xml)
        for expected in ['# Sample paper', '## Abstract', 'Methods', '2.3 eV', '## References', '[1] Reference text']:
            self.assertIn(expected, md)

    def test_tei_entities_rejected(self):
        with self.assertRaises(ValueError): bridge.tei_to_markdown('<!DOCTYPE x [<!ENTITY b "xx">]><TEI/>')

    def test_loopback_http_auth_origin_and_health(self):
        token = 'local-unit-test-token-not-a-secret'
        handler = bridge.make_handler({'token': token})
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        def cleanup():
            server.shutdown(); server.server_close(); thread.join(timeout=2)
        self.addCleanup(cleanup)
        url = f'http://127.0.0.1:{server.server_port}/v1/health'
        def request(headers):
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            return opener.open(urllib.request.Request(url, data=b'{}', headers=headers), timeout=3)
        with self.assertRaises(urllib.error.HTTPError) as error: request({})
        self.assertEqual(error.exception.code, 401)
        with self.assertRaises(urllib.error.HTTPError) as error: request({'Authorization': 'Bearer ' + token, 'Origin': 'https://example.org'})
        self.assertEqual(error.exception.code, 403)
        with request({'Authorization': 'Bearer ' + token}) as response:
            self.assertTrue(json.load(response)['ok'])


if __name__ == '__main__':
    unittest.main()
