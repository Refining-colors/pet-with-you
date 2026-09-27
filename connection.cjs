const path=require('node:path');
const {CodexClient}=require('./codex-client.cjs');
const {installHooks}=require('./install-hooks.cjs');
async function inspectConnection(){
  const c=new CodexClient(__dirname,true);
  try{
    await c.start();
    const r=await c.request('hooks/list',{cwds:[path.dirname(__dirname)]});
    const {marker}=require('./hook-command.cjs').hookCommand();
    const hooks=(r.data||[]).flatMap(d=>d.hooks||[]).filter(h=>h.command?.replaceAll('\\','/').includes(marker));
    return {installed:hooks.length,ready:hooks.length===9&&hooks.every(h=>h.enabled&&['trusted','managed'].includes(h.trustStatus)),needsReview:hooks.filter(h=>!['trusted','managed'].includes(h.trustStatus)).length,disabled:hooks.filter(h=>!h.enabled).length,errors:(r.data||[]).flatMap(d=>d.errors||[]).map(e=>e.message)};
  }finally{c.close();}
}
module.exports={inspectConnection,installHooks};
