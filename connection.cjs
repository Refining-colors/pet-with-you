const path=require('node:path');
const {CodexClient}=require('./codex-client.cjs');
const {installHooks}=require('./install-hooks.cjs');
async function inspectConnection(){
  const c=new CodexClient(__dirname,true);
  try{
    await c.start();
    const r=await c.request('hooks/list',{cwds:[path.dirname(__dirname)]});
    const {marker,command}=require('./hook-command.cjs').hookCommand();
    const hooks=(r.data||[]).flatMap(d=>d.hooks||[]).filter(h=>h.command?.replaceAll('\\','/').includes(marker));
    return {hookCommand:command,installed:hooks.length,ready:hooks.length===9&&hooks.every(h=>h.enabled&&['trusted','managed'].includes(h.trustStatus)),needsReview:hooks.filter(h=>!['trusted','managed'].includes(h.trustStatus)).length,disabled:hooks.filter(h=>!h.enabled).length,errors:(r.data||[]).flatMap(d=>d.errors||[]).map(e=>e.message)};
  }finally{c.close();}
}
function createConnectionCheck(inspect=inspectConnection,now=Date.now){
  let revision=0,cached,expires=0,flight;
  function invalidate(){revision++;cached=undefined;expires=0;flight=undefined;}
  function read({fresh=false}={}){
    if(fresh)invalidate();
    if(cached&&now()<expires)return Promise.resolve(cached);
    if(flight)return flight;
    const ticket=revision;
    const pending=Promise.resolve().then(inspect).then(value=>{
      // A manual check or mode change supersedes an older background request.
      if(ticket===revision){cached=value;expires=now()+(value.ready?15000:5000);}
      return value;
    }).finally(()=>{if(flight===pending)flight=undefined;});
    flight=pending;return pending;
  }
  return {read,invalidate};
}
module.exports={inspectConnection,installHooks,createConnectionCheck};
