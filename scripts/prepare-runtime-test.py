"""Prepare an isolated Zotero profile and a test-only XPI. Does not touch the live profile."""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / '.runtime-test'
PROFILE = TEST / 'profile'
DATA = TEST / 'data'
for folder in [PROFILE / 'extensions', DATA]:
    folder.mkdir(parents=True, exist_ok=True)

# A valid two-page PDF with independent text streams.
texts = ['The measured band gap is 2.3 eV. See reference [1].', 'Methods: We use density functional theory.']
objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>']
for i, text in enumerate(texts):
    stream = f'BT /F1 12 Tf 40 740 Td ({text}) Tj ET'.encode('ascii')
    objects += [f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents {4 + i*2} 0 R >>'.encode(),
                f'<< /Length {len(stream)} >>\nstream\n'.encode() + stream + b'\nendstream']
objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
pdf = bytearray(b'%PDF-1.4\n'); offsets = [0]
for i, obj in enumerate(objects, 1):
    offsets.append(len(pdf)); pdf += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
xref = len(pdf)
pdf += f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
for off in offsets[1:]: pdf += f'{off:010d} 00000 n \n'.encode()
pdf += f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
(TEST / 'sample.pdf').write_bytes(pdf)
prefs = {
    'extensions.zotero.useDataDir': True, 'extensions.zotero.dataDir': str(DATA),
    'extensions.zotero.sync.autoSync': False, 'extensions.zotero.firstRun2': False,
    'extensions.autoDisableScopes': 0, 'extensions.enabledScopes': 15,
    'app.update.auto': False,
}
(PROFILE / 'user.js').write_text('\n'.join(f'user_pref({json.dumps(k)}, {json.dumps(v)});' for k, v in prefs.items()), encoding='utf-8')
with zipfile.ZipFile(PROFILE / 'extensions' / 'paperloom@local.research.xpi', 'w', zipfile.ZIP_DEFLATED) as z:
    for p in (ROOT / 'addon').rglob('*'):
        if not p.is_file(): continue
        content = p.read_text(encoding='utf-8') if p.suffix == '.js' else None
        if p.name == 'bootstrap.js':
            content = content.replace('  for (let win of Zotero.getMainWindows()) Zotero.PaperLoom.addWindow(win);',
                '  for (let win of Zotero.getMainWindows()) Zotero.PaperLoom.addWindow(win);\n' +
                '  appScope.RUNTIME_ROOT = ' + json.dumps(TEST.as_posix()) + ';\n' +
                "  Services.scriptloader.loadSubScript(rootURI + 'runtime-selftest.js', appScope);")
            content += '\nvar testOriginalStartup = startup;\nstartup = async function(args) { try { await testOriginalStartup(args); } catch(e) { await IOUtils.writeUTF8(' + json.dumps((TEST / 'startup-error.json').as_posix()) + ', JSON.stringify({error:String(e),stack:e.stack})); throw e; } };\n'
        z.writestr(p.relative_to(ROOT / 'addon').as_posix(), content.encode('utf-8') if content is not None else p.read_bytes())
    z.write(ROOT / 'scripts/runtime-selftest.js', 'runtime-selftest.js')
print('Isolated profile prepared:', PROFILE)
