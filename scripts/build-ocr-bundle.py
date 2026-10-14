#!/usr/bin/env python3
"""Build the offline OCR runtime bundle for PaperLoom (Windows x64).

Produces dist/paperloom-ocr-runtime-win-x64-<version>.zip containing:
  python/          embedded CPython (python.org embeddable zip)
  deps/            every wheel unpacked and merged (single sys.path entry,
                   which is what tools/ocr-image.py expects from --runtime)
  models/          det.onnx / rec.onnx / cls.onnx (PP-OCRv4 mobile, Apache-2.0)
  manifest.json    versions, source URLs, sizes and sha256 for auditing

Pruned aggressively: no __pycache__, no tests/docs/include trees, no bundled
model copies inside rapidocr (we ship the models separately and pass explicit
paths), no dist-info licenses payloads.
"""
from __future__ import annotations
import argparse, hashlib, json, os, pathlib, shutil, subprocess, sys, urllib.request, zipfile

PY_CANDIDATES = ['3.12.10', '3.12.11', '3.12.9', '3.12.8', '3.12.7']
# Pinned to the versions the validated local runtime uses. Without
# --ignore-installed pip skips anything already present in the build interpreter.
REQUIREMENTS = ['rapidocr==3.10.0', 'onnxruntime==1.31.0']
PRUNE_DIRS = {'__pycache__', 'tests', 'test', 'docs', 'doc', 'include', 'examples',
              'sample', 'samples', 'data', 'benchmarks'}
PRUNE_SUFFIX = ('.pyc', '.pyo', '.pdb', '.lib', '.exp', '.a', '.pyi')
PRUNE_NAMES = {'RECORD.jws', 'RECORD.p7s'}
KEEP_DIST_INFO = True


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def wheel_name_parts(filename: str) -> tuple[str, str]:
    stem = filename[:-4] if filename.endswith('.whl') else filename
    bits = stem.split('-')
    return bits[0].replace('_', '-'), bits[1]


_PYPI_CACHE: dict[tuple[str, str], dict] = {}


def pypi_file(name: str, version: str, filename: str) -> dict:
    """Authoritative URL + sha256 for a wheel, straight from the PyPI JSON API."""
    key = (name, version)
    if key not in _PYPI_CACHE:
        try:
            url = f'https://pypi.org/pypi/{name}/{version}/json'
            with urllib.request.urlopen(url, timeout=60) as r:
                _PYPI_CACHE[key] = json.loads(r.read().decode('utf-8'))
        except Exception as exc:  # offline build still works, just without URLs
            print(f'  note: PyPI lookup failed for {name}=={version}: {exc}')
            _PYPI_CACHE[key] = {}
    for entry in _PYPI_CACHE[key].get('urls', []):
        if entry.get('filename') == filename:
            return {'url': entry.get('url', ''), 'sha256': entry.get('digests', {}).get('sha256', '')}
    return {}


def fetch(url: str, dest: pathlib.Path) -> pathlib.Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f'  download {url}', flush=True)
    tmp = dest.with_suffix(dest.suffix + '.part')
    with urllib.request.urlopen(url, timeout=120) as src, tmp.open('wb') as out:
        shutil.copyfileobj(src, out, 1 << 20)
    tmp.replace(dest)
    return dest


def head_ok(url: str) -> bool:
    try:
        req = urllib.request.Request(url, method='HEAD')
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200 and int(r.headers.get('Content-Length') or 0) > 1_000_000
    except Exception:
        return False


def prune(rel: pathlib.PurePosixPath) -> bool:
    parts = set(rel.parts[:-1])
    if parts & PRUNE_DIRS:
        return True
    if rel.name in PRUNE_NAMES:
        return True
    if rel.suffix.lower() in PRUNE_SUFFIX:
        return True
    # rapidocr ships its own model copies (~31MB); the bundle passes explicit
    # model paths, so those copies are dead weight.
    if rel.parts[:2] == ('rapidocr', 'models'):
        return True
    return False


def unpack(wheel: pathlib.Path, target: pathlib.Path, stats: dict) -> None:
    with zipfile.ZipFile(wheel) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            rel = pathlib.PurePosixPath(info.filename)
            if prune(rel):
                stats['pruned'] += 1
                continue
            out = target.joinpath(*rel.parts)
            out.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, out.open('wb') as dst:
                shutil.copyfileobj(src, dst, 1 << 20)
            stats['files'] += 1
            stats['bytes'] += info.file_size


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default='1.0.0')
    ap.add_argument('--python', default=r'D:/Backup/Downloads/python312/python.exe', help='interpreter used to download wheels')
    ap.add_argument('--cache', default='.local/ocr-bundle-cache')
    ap.add_argument('--out', default='dist')
    ap.add_argument('--root', default='.local/ocr-bundle-build')
    args = ap.parse_args()

    root = pathlib.Path(args.root).resolve()
    cache = pathlib.Path(args.cache).resolve()
    outdir = pathlib.Path(args.out).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(root, ignore_errors=True)
    (root / 'deps').mkdir(parents=True)

    # 1) embedded interpreter
    py_url = py_ver = None
    for candidate in PY_CANDIDATES:
        url = f'https://www.python.org/ftp/python/{candidate}/python-{candidate}-embed-amd64.zip'
        if head_ok(url):
            py_url, py_ver = url, candidate
            break
    if not py_url:
        print('no embeddable python found for', PY_CANDIDATES)
        return 2
    print(f'python embeddable: {py_ver}')
    py_zip = fetch(py_url, cache / f'python-{py_ver}-embed-amd64.zip')
    shutil.unpack_archive(str(py_zip), str(root / 'python'))
    # keep the interpreter able to import from deps/ without site customisation
    pth = next((root / 'python').glob('python*._pth'), None)
    if pth:
        text = pth.read_text(encoding='utf-8')
        if 'import site' not in text:
            pth.write_text(text.rstrip('\r\n') + '\nimport site\n', encoding='utf-8')

    # 2) wheels
    print('resolving wheels via pip download ...')
    wheel_dir = cache / 'wheels'
    subprocess.run([args.python, '-m', 'pip', 'download', '--quiet', '--no-cache-dir',
                    '--only-binary=:all:', '--platform', 'win_amd64',
                    '--python-version', '312', '--implementation', 'cp',
                    '--dest', str(wheel_dir), *REQUIREMENTS], check=True)
    wheels = []
    stats = {'files': 0, 'bytes': 0, 'pruned': 0}
    for whl in sorted(wheel_dir.glob('*.whl')):
        name, version = wheel_name_parts(whl.name)
        source = pypi_file(name, version, whl.name)
        unpack(whl, root / 'deps', stats)
        digest = sha256(whl)
        if source.get('sha256') and source['sha256'] != digest:
            print(f'  WARNING sha256 mismatch vs PyPI for {whl.name}')
        wheels.append({'name': name, 'version': version, 'file': whl.name,
                       'url': source.get('url', ''), 'sha256': digest,
                       'pypi_sha256': source.get('sha256', ''), 'bytes': whl.stat().st_size})
    print(f'  wheels: {len(wheels)}  unpacked files: {stats["files"]}  '
          f'pruned: {stats["pruned"]}  size: {stats["bytes"] / 1048576:.1f} MB')

    # 3) models
    models = {'det': ('ch_PP-OCRv4_det_infer.onnx', 'det.onnx'),
              'rec': ('ch_PP-OCRv4_rec_infer.onnx', 'rec.onnx'),
              'cls': ('ch_ppocr_mobile_v2.0_cls_infer.onnx', 'cls.onnx')}
    (root / 'models').mkdir(parents=True, exist_ok=True)
    for kind, (src, dst) in models.items():
        source = pathlib.Path('addon/models') / src
        if not source.exists():
            print('missing model', source)
            return 3
        shutil.copyfile(source, root / 'models' / dst)

    manifest = {
        'kind': 'paperloom-ocr-runtime', 'platform': 'win-x64', 'version': args.version,
        'python': {'version': py_ver, 'url': py_url, 'sha256': sha256(py_zip), 'bytes': py_zip.stat().st_size},
        'wheels': wheels,
        'models': {kind: {'file': f'{kind}.onnx', 'sha256': sha256(root / 'models' / f'{kind}.onnx'),
                          'bytes': (root / 'models' / f'{kind}.onnx').stat().st_size} for kind in models},
        'unpacked': {'files': stats['files'], 'bytes': stats['bytes']},
    }
    (root / 'manifest.json').write_text(json.dumps(manifest, indent=1), encoding='utf-8')

    # 4) zip it
    target = outdir / f'paperloom-ocr-runtime-win-x64-{args.version}.zip'
    total = 0
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for path in sorted(root.rglob('*')):
            if path.is_file():
                z.write(path, path.relative_to(root).as_posix())
                total += path.stat().st_size
    digest = sha256(target)
    outdir.joinpath(target.name + '.sha256').write_text(f'{digest}  {target.name}\n', encoding='utf-8')
    print(f'bundle: {target}  {target.stat().st_size / 1048576:.1f} MB '
          f'(raw {total / 1048576:.1f} MB)  sha256 {digest}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
