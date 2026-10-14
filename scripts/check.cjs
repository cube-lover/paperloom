const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
for (const file of walk(path.join(root, 'addon')).filter(x => x.endsWith('.js'))) new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'addon/manifest.json'), 'utf8'));
if (manifest.applications.zotero.id !== 'paperloom@local.research') throw new Error('Unexpected addon ID');
const python = spawnSync('python', ['-c', 'import pathlib,xml.etree.ElementTree as E; [E.parse(p) for p in pathlib.Path("addon").rglob("*.xhtml")]; E.parse("addon/content/icon.svg"); print("XML verified")'], { cwd: root, encoding: 'utf8' });
if (python.status) { console.error(python.stderr); process.exit(python.status || 1); }
for (const file of walk(path.join(root, 'addon')).filter(x => x.endsWith('.js'))) {
  if (/\.(?:innerHTML|outerHTML)\s*=|\.insertAdjacentHTML\s*\(/.test(fs.readFileSync(file, 'utf8'))) throw new Error('UI should use textContent: ' + file);
}
console.log('JavaScript syntax, manifest, safe-rendering and XML checks passed.');
