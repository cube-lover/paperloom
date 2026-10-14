const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'validation');
fs.mkdirSync(out, { recursive: true });
const result = { timestamp: new Date().toISOString(), version: require('../package.json').version, node: process.version, realZoteroRuntimeTested: false, realProviderQualityTested: false, stages: [] };
const commands = [
  ['syntax', process.execPath, ['scripts/check.cjs']],
  ['javascript', process.execPath, ['--test', '--test-reporter=tap', ...fs.readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.cjs')).sort().map(f => 'tests/' + f)]],
  ['bridge', 'python', ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py']],
  ['build', process.execPath, ['scripts/build.cjs']]
];
for (const [name, bin, args] of commands) {
  const run = spawnSync(bin, args, { cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  const output = (run.stdout || '') + (run.stderr || '');
  fs.writeFileSync(path.join(out, name + '.txt'), output, 'utf8');
  const stage = { name, passed: run.status === 0 };
  if (name === 'javascript') stage.tests = Number(output.match(/# tests (\d+)/)?.[1] || 0);
  if (name === 'bridge') stage.tests = Number(output.match(/Ran (\d+) tests/)?.[1] || 0);
  result.stages.push(stage); console.log(name + ': ' + (stage.passed ? 'PASS' : 'FAIL') + (stage.tests ? ` (${stage.tests} tests)` : ''));
  if (!stage.passed) { console.error(output); break; }
}
result.passed = result.stages.length === commands.length && result.stages.every(x => x.passed);
result.totalTests = result.stages.reduce((sum, s) => sum + (s.tests || 0), 0);
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result, null, 2) + '\n');
process.exitCode = result.passed ? 0 : 1;
