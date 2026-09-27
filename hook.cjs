// Forward only lifecycle metadata. Never forward prompt, tool arguments, or outputs.
const fs=require('node:fs');
const path=require('node:path');
let input='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{input+=chunk;if(input.length>1048576)process.exit(0);});
process.stdin.on('end',async()=>{
  try{
    const e=JSON.parse(input);
    const root=require('./project.cjs').dataDirectory();
    const {base}=JSON.parse(fs.readFileSync(path.join(root,'connection.json'),'utf8'));
    const url=new URL(base);if(url.hostname!=='127.0.0.1'||url.protocol!=='http:')return;
    const response=e.tool_response;
    const tool_failed=!!(response&&typeof response==='object'&&(response.isError===true||(Number.isFinite(response.exit_code)&&response.exit_code!==0)));
    await fetch(base+'/hook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:e.session_id,hook_event_name:e.hook_event_name,tool_name:e.tool_name,turn_id:e.turn_id,tool_failed}),signal:AbortSignal.timeout(700)});
  }catch{/* A closed companion must never block the task. */}
});
setTimeout(()=>process.exit(0),1200).unref();
