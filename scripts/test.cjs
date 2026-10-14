const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.cjs')).sort().map(name => path.join('tests', name));
const run = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
process.exitCode = run.status ?? 1;
