const assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
module.exports=async({service,openSettings,getSettings})=>{
  let window=getSettings();
  const run=source=>window.webContents.executeJavaScript(source);
  async function reopen(){
    openSettings();window=getSettings();
    for(let i=0;i<80;i++){await sleep(100);if(!window.webContents.isLoadingMainFrame()&&await run('!!window.PetSettingsAutosave&&!document.body.inert'))return;}
    assert.fail('settings did not finish loading');
  }
  async function close(){window.close();for(let i=0;i<80&&!window.isDestroyed();i++)await sleep(100);assert.equal(window.isDestroyed(),true,'settings must finish saving before closing');}
  const request=async route=>(await fetch(service.base+route)).json();
  // Start a fresh page so previous visual fixtures do not count as user drafts.
  await run('window.PetSettingsAutosave.flush()');await close();await reopen();
  await run(`(()=>{
    window.edit=(id,value)=>{const input=document.getElementById(id);if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
    if(document.querySelector('#sourceDialog').open)document.querySelector('#chooseSourceLater').click();
    selectTab('basic');edit('alwaysOnTop',false);edit('quotaAfterTurn',true);edit('quotaMode','permanent');edit('quotaSeconds','37');edit('replySeconds','29');edit('apiWhisperInterval','321');edit('apiWhisperProbability','73');edit('collision',true);
    const name=document.querySelector('#pets input[type=text]');name.value='Autosaved pet';name.dispatchEvent(new Event('change',{bubbles:true}));
    edit('apiProfileName','Autosave API');edit('apiBaseUrl','https://autosave.example.test/v1');edit('apiModel','test-model');edit('apiKey','autosave-private-fixture');
    edit('proxyProfileName','Autosave query');edit('proxyName','Fixture query');edit('proxyEndpoint','https://autosave.example.test/balance');edit('credential','manual');edit('proxyKey','query-private-fixture');edit('valuePath','data.balance');
    edit('disableEventResponse',true);edit('notify',false);edit('chatSource','api');edit('quotaSource','proxy');
    window.dispatchEvent(new Event('focus'));
  })()`);
  await sleep(100);
  assert.equal(await run("document.getElementById('replySeconds').value"),'29','focus must not overwrite drafts');
  await close();
  assert.equal(service.preferences.value.replySeconds,29);assert.equal(service.preferences.value.quotaSeconds,37);
  assert.equal(service.preferences.value.quotaAfterTurn,true);
  assert.equal(service.preferences.value.disableEventResponse,true);
  assert.equal(service.preferences.value.alwaysOnTop,false);assert.equal(service.preferences.value.autoWhisperProbability,73);
  assert.equal(service.preferences.value.followClientStart,undefined);assert.equal(service.preferences.value.chatSource,'api');
  const config=(await request('/config')).main;
  assert.equal(config.eventsRefreshSec.whisper,321);assert.equal(config.pets[0].name,'Autosaved pet');assert.equal(config.physics.petCollision,true);assert.equal(config.notificationsEnabled,false);
  assert.equal((await request('/api/settings')).model,'test-model');assert.equal((await request('/quota/settings')).proxy.keyPreview,'query-p…');
  assert.equal((await request('/api/profiles')).some(p=>p.name==='Autosave API'),false,'auto apply must not create library entries');
  assert.equal((await request('/quota/profiles')).some(p=>p.name==='Autosave query'),false);
  await reopen();
  assert.equal(await run("document.getElementById('apiKey').value"),'********');assert.equal(await run("document.getElementById('proxyKey').value"),'********');
  await run(`(()=>{for(const [id,value] of [['apiModel','updated-model'],['proxyName','Updated query']]){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}const input=document.getElementById('advanced');input.value='{invalid';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  window.close();await sleep(500);
  assert.equal(window.isDestroyed(),false,'invalid draft must keep settings open');
  assert.equal(await run("document.getElementById('advanced').value"),'{invalid');
  assert.equal(await run("document.getElementById('autosaveStatus').classList.contains('save-error')"),true);
  assert.equal((await request('/api/settings')).model,'test-model','validate JSON before other writes');
  await run(`(()=>{const input=document.getElementById('advanced');input.value=JSON.stringify(main);input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await close();
  assert.equal((await request('/api/settings')).model,'updated-model');assert.equal((await request('/api/settings')).configured,true);
  assert.equal((await request('/quota/settings')).proxy.keyPreview,'query-p…','masked credential must survive edits');
  await reopen();
  await run(`(()=>{const input=document.getElementById('apiBaseUrl');input.value='invalid-url';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  window.close();await sleep(500);assert.equal(window.isDestroyed(),false,'server validation failure must keep settings open');
  assert.equal(await run("document.getElementById('apiBaseUrl').value"),'invalid-url');
  await run(`document.getElementById('clearApi').click()`);await sleep(200);await close();
  assert.equal((await request('/api/settings')).configured,false,'clear must not be undone by a stale autosave draft');
  await reopen();
  await run(`(()=>{const input=document.getElementById('whisperStreaming');input.click();})()`);
  const expected=await run("document.getElementById('whisperStreaming').checked");await close();
  assert.equal(service.preferences.value.whisperStreaming,expected,'close must wait for immediate handlers');
  await reopen();
  await run(`(()=>{selectTab('basic');const input=document.querySelector('#pets input[type=text]');input.scrollIntoView();input.focus();input.select();})()`);
  await window.webContents.insertText('Typed before close');
  await close();
  assert.equal((await request('/config')).main.pets[0].name,'Typed before close','closing must commit the active text input');
  await reopen();
  await run(`(()=>{const input=document.getElementById('quotaSeconds');input.value='48';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  require('electron').app.once('will-quit',()=>{assert.equal(service.preferences.value.quotaSeconds,48,'normal app quit must flush settings before stopping the server');});
};
