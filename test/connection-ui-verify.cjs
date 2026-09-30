const assert = require('node:assert/strict');

module.exports = async function verify(settings) {
  const result = await settings.webContents.executeJavaScript(`(async()=>{
    const originalApi=api,originalLoad=loadPreferences;
    const checks={};
    const ready={ready:true,lastHook:{event:'Stop'},monitor:{}};
    try{
      loadPreferences=async()=>{};
      let calls=[];api=async(route)=>{calls.push(route);return ready;};
      $('#hooksGuide').open=false;await $('#reviewHooks').onclick();
      checks.guide=$('#hooksGuide').open&&calls.length===0;
      checks.icon=$('#hooksGuide img').getAttribute('src')==='hooks-review-icon.png';
      await $('#recheckHooks').onclick();checks.fresh=calls.includes('/connection?fresh=1')&&!calls.includes('/connect');
      showConnection({configured:true,inspectionError:'fixture runtime unavailable',hookCommand:'fixture/resources/app/hook.cmd'});
      checks.runtime=$('#connectionStatus strong').textContent.includes('配置已写入')&&$('#hookCommand').textContent.endsWith('hook.cmd');
      showConnection({needsReview:2,installed:3});
      checks.pending=$('#connectionStatus strong').textContent.includes('等待 Hooks 信任');
      showConnection(ready);
      checks.persist=!$('#reviewHooks').hidden&&!!$('#clientSection .connection-next-step');
      checks.bold=$('#connectionStatus strong').textContent.includes('已收到 Hook');
      let releasePoll;
      api=()=>new Promise(resolve=>{releasePoll=resolve;});
      const oldPoll=connectionStatus();
      api=async()=>ready;
      const click=$('#connect').onclick();
      checks.busy=$('#connect').disabled&&$('#connectionStatus').getAttribute('aria-busy')==='true'&&$('#connectionNotice').textContent.includes('正在');
      releasePoll({needsReview:99,installed:99});
      await oldPoll;await click;
      checks.complete=!$('#connect').disabled&&$('#connectionNotice').textContent.includes('检查完成')&&$('#connectionStatus strong').textContent.includes('已收到 Hook');
      api=async()=>{throw Error('fixture offline');};
      await $('#connect').onclick();
      checks.error=$('#connectionNotice').textContent.includes('fixture offline')&&!$('#connect').disabled&&$('#connectionStatus strong').textContent.includes('已收到 Hook')&&!$('#reviewHooks').hidden;
      showConnection({ready:true});
      checks.waiting=$('#connectionStatus strong').textContent.includes('等待事件');
    }finally{api=originalApi;loadPreferences=originalLoad;}
    return checks;
  })()`);
  for (const [name, passed] of Object.entries(result)) assert.equal(passed, true, 'Connection UI: ' + name);
};
