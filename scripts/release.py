"""Create a source + installer bundle from an explicit allowlist; excludes user/test profiles."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
report = json.loads((root / 'validation/report.json').read_text(encoding='utf-8'))
if not report.get('passed') or report.get('version') != version:
    raise SystemExit('Run npm run validate successfully before making a release')
allowed_files = ['package.json', 'package-lock.json', '.gitignore', 'README.md', 'LICENSE', 'FEATURE-MATRIX.md', 'VALIDATION.md', 'CHANGELOG.md']
paths = [root / name for name in allowed_files]
for folder in ['addon', 'tools', 'scripts', 'tests', 'examples', 'validation']:
    paths.extend(p for p in (root / folder).rglob('*') if p.is_file() and not any(part in {'__pycache__', '.local', 'node_modules'} for part in p.relative_to(root).parts) and p.suffix != '.pyc')
paths += [root / 'dist' / f'paperloom-{version}.xpi', root / 'dist' / f'paperloom-{version}.xpi.sha256']
output = root / 'dist' / f'paperloom-{version}-source.zip'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(set(paths)):
        name = 'paperloom/' + p.relative_to(root).as_posix()
        info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, p.read_bytes())
digest = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix(output.suffix + '.sha256').write_text(digest + '  ' + output.name + '\n', encoding='ascii')
print('Created', output.name, output.stat().st_size, 'bytes')
print('Excluded: existing Zotero profiles, test runtime, provider credentials, node_modules and reference source')
