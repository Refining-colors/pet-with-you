const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('unattended source installation exits promptly when Node is missing', { skip: process.platform !== 'win32' }, () => {
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env, PATH: path.join(process.env.WINDIR, 'System32') };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path' && key !== 'PATH') delete env[key];
  const result = spawnSync(process.env.ComSpec, ['/d', '/c', 'Install-Pet.cmd --no-shortcut'], { cwd: root, env, input: '', encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Please install Node.js/);
  assert.doesNotMatch(result.stdout, /Press any key/);
});

test('desktop shortcut resolves its moved source folder and preserves the tray icon', { skip: process.platform !== 'win32' }, t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "pet shortcut ' 移动目录-"));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.mkdirSync(path.join(folder, 'scripts')); fs.mkdirSync(path.join(folder, 'build'));
  for (const file of ['scripts/create-shortcut.ps1', 'launcher.vbs', 'build/icon.ico']) fs.copyFileSync(path.join(root, file), path.join(folder, file));
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(folder, 'scripts/create-shortcut.ps1'), '-DestinationDirectory', folder], { windowsHide: true });
  const literal = value => "'" + value.replaceAll("'", "''") + "'";
  const command = "$s=(New-Object -ComObject WScript.Shell).CreateShortcut(" + literal(path.join(folder, 'pet-with-u.lnk')) + "); [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; @{target=$s.TargetPath;arguments=$s.Arguments;working=$s.WorkingDirectory;icon=$s.IconLocation}|ConvertTo-Json -Compress";
  const link = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true }).replace(/^\uFEFF/, ''));
  assert.match(link.target, /wscript\.exe$/i);
  assert.ok(link.arguments.includes(path.join(folder, 'launcher.vbs')));
  assert.equal(link.working, folder);
  assert.ok(link.icon.startsWith(path.join(folder, 'build/icon.ico')));
  const original=fs.readFileSync(path.join(folder,'pet-with-u.lnk'));
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(folder, 'scripts/create-shortcut.ps1'), '-DestinationDirectory', folder], { windowsHide: true });
  assert.deepEqual(fs.readFileSync(path.join(folder,'pet-with-u.lnk')),original,'reinstall must preserve an existing shortcut');
  assert.ok(fs.existsSync(path.join(folder,'pet-with-u (2).lnk')));
});

test('packaged hooks use the bundled command helper, while source hooks use the selected Node', () => {
  const { hookCommand } = require('../hook-command.cjs');
  const installed = hookCommand({ root: path.join('space path', 'resources', 'app'), packaged: true });
  assert.match(installed.marker, /resources\/app\/hook\.cmd$/);
  assert.equal(installed.command, '"' + installed.marker + '"');
  const source = hookCommand({ root, packaged: false, executable: 'C:/fixture node/node.exe' });
  assert.ok(source.command.startsWith('"C:/fixture node/node.exe" '));
  assert.match(source.marker, /hook\.cjs$/);
});

for(const name of ['icon.ico','codex-withu.ico'])test(name+' includes common Windows sizes with PNG frames', () => {
  const bytes = fs.readFileSync(path.join(root, 'build',name));
  assert.equal(bytes.readUInt16LE(2), 1);
  const count = bytes.readUInt16LE(4), sizes = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16, size = bytes[offset] || 256;
    assert.equal(size, bytes[offset + 1] || 256); sizes.push(size);
    const start = bytes.readUInt32LE(offset + 12);
    assert.equal(bytes.subarray(start + 1, start + 4).toString(), 'PNG');
  }
  assert.deepEqual(sizes, [16, 24, 32, 48, 64, 128, 256]);
});
