const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');

test('upgrade refreshes owned shortcut icons without changing launch options or unrelated links', { skip: process.platform !== 'win32' }, t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "pet icons ' 中文-"));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const root = path.resolve(__dirname, '..');
  const ps = s => "'" + s.replaceAll("'", "''") + "'";
  fs.writeFileSync(path.join(folder, 'pet-with-you.exe'), 'fixture, never execute');
  const script = `
    $ErrorActionPreference='Stop'
    . ${ps(path.join(root, 'shell-shortcut.ps1'))}
    $dir=${ps(folder)}
    foreach($name in @('renamed pet','unrelated','Codex withu')) {
      $link=New-PetShortcut (Join-Path $dir ($name+'.lnk'))
      $link.TargetPath=Join-Path $dir $(if($name -eq 'unrelated'){'other.exe'}else{'pet-with-you.exe'})
      $link.Arguments=if($name -eq 'Codex withu'){'--launch-client'}else{'--settings'}
      $link.IconLocation=Join-Path $dir 'missing.ico,0'
      $link.Description=$name
      $link.WorkingDirectory=$dir
      $link.WindowStyle=7
      $link.Save()
    }
    & ${ps(path.join(root, 'repair-shortcuts.ps1'))} -InstallDirectory $dir -ShortcutDirectories @($dir) | Out-Null
    [Console]::OutputEncoding=[Text.Encoding]::UTF8
    @('renamed pet','unrelated','Codex withu') | ForEach-Object { $l=New-PetShortcut (Join-Path $dir ($_+'.lnk')); @{name=$_;icon=$l.IconLocation;args=$l.Arguments;style=$l.WindowStyle;description=$l.Description;cwd=$l.WorkingDirectory} } | ConvertTo-Json -Compress
  `;
  const result = JSON.parse(execFileSync('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script], { windowsHide:true,encoding:'utf8' }).replace(/^\uFEFF/,''));
  assert.equal(result[0].icon, path.join(folder, 'pet-with-you.exe')+',0');
  assert.equal(result[0].args, '--settings');
  assert.equal(result[0].style, 7);
  assert.equal(result[0].description, 'renamed pet');
  assert.equal(fs.realpathSync(result[0].cwd), fs.realpathSync(folder));
  for (const link of result.slice(1)) assert.equal(link.icon, path.join(folder,'missing.ico')+',0');
  assert.equal(result[2].args, '--launch-client');
});
