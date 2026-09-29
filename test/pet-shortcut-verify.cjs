const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { dialog, shell } = require('electron');
const { createPetShortcut, offerFirstRunShortcut } = require('../pet-shortcut.cjs');

module.exports = async function verify(settings) {
  if (process.platform !== 'win32') return;
  const directory = path.join(process.env.PET_TEST_DATA_DIR, "shortcut space ' 中文");
  fs.mkdirSync(directory);
  const original = dialog.showOpenDialog;
  const run = code => settings.webContents.executeJavaScript(code);
  async function click() {
    await run(`document.querySelector('#createPetShortcut').click()`);
    for (let i = 0; i < 100; i++) {
      if (await run(`!document.querySelector('#createPetShortcut').disabled`)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail('Shortcut creation did not finish');
  }
  try {
    assert.equal(await run(`document.querySelector('#basicPanel').lastElementChild.id`), 'petShortcutSection');
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    await click();
    assert.match(await run(`document.querySelector('#petShortcutResult').textContent`), /已取消/);
    assert.equal(fs.readdirSync(directory).length, 0);
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
    await run(`document.querySelector('#replySeconds').value='23';document.querySelector('#replySeconds').dispatchEvent(new Event('input',{bubbles:true}));`);
    await click();
    assert.match(await run(`document.querySelector('#petShortcutResult').textContent`), /已创建/);
    const first = path.join(directory, 'pet-with-u.lnk');
    const link = shell.readShortcutLink(first), bytes = fs.readFileSync(first);
    assert.match(link.target, /wscript\.exe$/i);
    assert.ok(link.args.includes('normal'));
    assert.equal(link.icon, path.resolve(__dirname, '../build/icon.ico'));
    assert.equal(link.iconIndex, 0);
    await click();
    assert.ok(fs.existsSync(path.join(directory, 'pet-with-u (2).lnk')));
    assert.deepEqual(fs.readFileSync(first), bytes, 'An existing shortcut must remain untouched');
    const preview = createPetShortcut({ directory, development: true, shell });
    assert.match(shell.readShortcutLink(preview.file).args, / dev /);
    const packaged = createPetShortcut({ directory, packaged: true, shell });
    assert.equal(shell.readShortcutLink(packaged.file).target, process.execPath);
    assert.equal(shell.readShortcutLink(packaged.file).args, '');
    assert.equal(shell.readShortcutLink(packaged.file).icon, process.execPath);
    const onboardingStore = new (require('../settings-store.cjs').SettingsStore)(path.join(directory, 'onboarding'));
    const firstRun = await offerFirstRunShortcut({
      store: onboardingStore, parent: settings,
      dialog: { showMessageBox: async () => ({ response: 0 }) },
      createShortcut: () => run(`api('/pet-shortcut','POST')`),
    });
    assert.ok(firstRun.ok);
    assert.equal(shell.readShortcutLink(firstRun.file).icon, link.icon);
    assert.equal(shell.readShortcutLink(firstRun.file).args, link.args);
    assert.deepEqual(await offerFirstRunShortcut({ store: onboardingStore }), { skipped: true });
    // Exercise the real Windows shortcut launch with a harmless fixture, never the daily pet.
    const fixture = path.join(directory, 'fixture root');
    fs.mkdirSync(path.join(fixture, 'build'), { recursive: true });
    fs.mkdirSync(path.join(fixture, 'scripts'));
    fs.copyFileSync(path.resolve(__dirname, '../launcher.vbs'), path.join(fixture, 'launcher.vbs'));
    fs.copyFileSync(link.icon, path.join(fixture, 'build/icon.ico'));
    for (const development of [false, true]) {
      const marker = path.join(fixture, development ? 'dev-started' : 'normal-started');
      fs.writeFileSync(path.join(fixture, development ? 'scripts/dev.cjs' : 'launch.cjs'), `require('node:fs').writeFileSync(${JSON.stringify(marker)},'started');`);
      const created = createPetShortcut({ directory, root: fixture, development, shell });
      assert.equal(await shell.openPath(created.file), '');
      for (let i = 0; i < 100 && !fs.existsSync(marker); i++) await new Promise(resolve => setTimeout(resolve, 50));
      assert.ok(fs.existsSync(marker), 'Double-click launch must reach the selected source entry');
    }
    fs.copyFileSync(path.resolve(__dirname,'../build/codex-withu.ico'),path.join(fixture,'build/codex-withu.ico'));
    const jointMarker=path.join(fixture,'joint-started');
    fs.writeFileSync(path.join(fixture,'launch.cjs'),`if(process.argv.includes('--launch-client'))require('node:fs').writeFileSync(${JSON.stringify(jointMarker)},'started');`);
    const joint=await require('../client-launcher.cjs').createClientLauncherWithDialogs({
      dataDir:process.env.PET_TEST_DATA_DIR,root:fixture,desktop:directory,parent:settings,
      discover:()=>[{kind:'appId',appId:'Fixture.Package!App'}],
      dialog:{showMessageBox:async()=>({response:0}),showOpenDialog:async()=>({canceled:false,filePaths:[directory]})},
    });
    assert.equal(path.basename(joint.file),'Codex withu.lnk');
    const jointLink=shell.readShortcutLink(joint.file);
    assert.ok(jointLink.args.includes(' client '));assert.equal(jointLink.icon,path.join(fixture,'build/codex-withu.ico'));
    assert.equal(await shell.openPath(joint.file),'');
    for(let i=0;i<100&&!fs.existsSync(jointMarker);i++)await new Promise(resolve=>setTimeout(resolve,50));
    assert.ok(fs.existsSync(jointMarker),'Joint shortcut reaches the client entry without launching daily apps');
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path.join(directory, 'missing')] });
    await click();
    assert.match(await run(`document.querySelector('#petShortcutResult').textContent`), /创建失败/);
    await run(`document.querySelector('#petShortcutResult').textContent=''`);
    await run(`document.querySelector('#petShortcutSection').scrollIntoView({block:'center'})`);
    settings.show();settings.webContents.invalidate();
    await new Promise(resolve => setTimeout(resolve, 500));
    fs.writeFileSync(path.resolve(__dirname, '../qa-output/shortcut-settings.png'), (await settings.webContents.capturePage().catch(error=>{throw new Error('Shortcut settings capture: '+error.message);})).toPNG());
  } finally {
    dialog.showOpenDialog = original;
  }
};
