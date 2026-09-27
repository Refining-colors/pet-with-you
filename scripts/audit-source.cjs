const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { files, directories } = require('../export-source.cjs');
const candidates = new Set(files);
function walk(directory) {
  for (const item of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const name = directory + '/' + item.name;
    if (item.isSymbolicLink()) throw new Error('Source export contains a symlink: ' + name);
    if (item.isDirectory()) walk(name); else candidates.add(name);
  }
}
for (const directory of directories) walk(directory);
const forbidden = /(^|\/)(?:\.local|\.npm-cache|node_modules|qa-output|media-output|dist|release)(?:\/|$)|(?:^|\/)(?:auth\.json|config\.toml|connection\.json|memory\.json|preferences\.json|api-settings\.json(?:\.profiles.*)?|quota\.json(?:\.profiles.*)?|\.env(?:\..*)?)$/i;
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['access-token', /\b(?:github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{32,})\b/],
  ['credential-url', /https?:\/\/[^\s/"'<>]+:[^\s/"'<>]+@/],
];
const personalPath = new RegExp('[A-Z]:[\\\\/]+Users[\\\\/]+' + os.userInfo().username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\\\/]', 'i');
let failures = 0;
function inspect(name, bytes) {
  if (forbidden.test(name)) { console.error('Excluded data in source: ' + name); failures++; }
  if (/\.(?:webm|png|ttf|ico|jpg|gif)$/i.test(name)) return;
  let text = bytes.toString('utf8');
  if (name.endsWith('test/independent.test.cjs')) text = text.replaceAll('https://' + 'user:secret@' + 'example.test/v1', 'fixture-url');
  for (const [label, expression] of patterns) if (expression.test(text)) { console.error(label + ': ' + name); failures++; }
  if (personalPath.test(text)) { console.error('personal-path: ' + name); failures++; }
}
for (const name of candidates) inspect(name, fs.readFileSync(path.join(root, name)));
let historyBlobs = 0;
if (fs.existsSync(path.join(root, '.git'))) {
  const listed = execFileSync('git', ['rev-list', '--objects', '--all'], { cwd: root, encoding: 'utf8' });
  const objects = listed.trim().split('\n').filter(line => line.includes(' ')).map(line => ({ oid: line.slice(0, 40), name: line.slice(41) }));
  const types = execFileSync('git', ['cat-file', '--batch-check=%(objecttype)'], { cwd: root, input: objects.map(o => o.oid).join('\n') + '\n', encoding: 'utf8' }).trim().split('\n');
  const blobs = objects.filter((_, index) => types[index] === 'blob');
  const data = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: blobs.map(o => o.oid).join('\n') + '\n', maxBuffer: 256 * 1024 * 1024 });
  let offset = 0;
  for (const blob of blobs) {
    const newline = data.indexOf(10, offset), size = Number(data.subarray(offset, newline).toString().split(' ')[2]);
    offset = newline + 1;
    inspect('history/' + blob.name, data.subarray(offset, offset + size));
    offset += size + 1; historyBlobs++;
  }
}
console.log(JSON.stringify({ sourceFiles: candidates.size, historyBlobs, failures, scope: 'Patterns and file selection; screenshots and resource licenses require separate review.' }));
process.exitCode = failures ? 1 : 0;
