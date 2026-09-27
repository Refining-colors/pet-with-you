const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const MAX_READ=2*1024*1024;
function eventMetadata(record){
  const p=record?.payload||{},at=Date.parse(record?.timestamp);if(!Number.isFinite(at))return null;
  let event,tool;
  if(record.type==='event_msg'){
    event={task_started:'UserPromptSubmit',task_complete:'Stop',task_aborted:'Interrupt',turn_aborted:'Interrupt',approval_request:'PermissionRequest'}[p.type];
  }else if(record.type==='response_item'){
    if(['function_call','custom_tool_call'].includes(p.type)){event='PreToolUse';tool=typeof p.name==='string'?p.name:'';}
    else if(['function_call_output','custom_tool_call_output'].includes(p.type))event='PostToolUse';
    else if(p.type==='reasoning')event='UserPromptSubmit';
  }
  return event?{hook_event_name:event,at,...(tool?{tool_name:tool}:{})}:null;
}
class SessionMonitor{
  constructor({root=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions'),onEvent,onError=()=>{},clock=Date.now}){
    Object.assign(this,{root,onEvent,onError,clock});this.activatedAt=clock();this.metadata=new (require('./thread-metadata.cjs').ThreadMetadata)(path.dirname(root));this.files=new Map();this.seen=new Map();this.active=false;this.generation=0;this.lastEvent=null;this.lastScan=0;
  }
  setEnabled(value){if(value===this.active)return;this.active=value;this.activatedAt=this.clock();this.generation++;this.files.clear();this.seen.clear();this.lastEvent=null;this.lastScan=0;clearInterval(this.timer);if(value){void this.poll();this.timer=setInterval(()=>void this.poll(),1000);this.timer.unref?.();}}
  status(){return {enabled:this.active,lastEvent:this.lastEvent,trackedFiles:this.files.size};}
  async discover(){
    const found=[];
    const walk=async(dir,depth)=>{if(depth>4)return;let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
      for(const e of entries){const file=path.join(dir,e.name);if(e.isDirectory())await walk(file,depth+1);else if(e.isFile()&&/^rollout-.*\.jsonl$/.test(e.name)){const stat=await fs.stat(file);if(this.clock()-stat.mtimeMs<86400000)found.push({file,mtime:stat.mtimeMs});}}
    };await walk(this.root,0);return found.sort((a,b)=>b.mtime-a.mtime).slice(0,128);
  }
  async read(file,state){
    const handle=await fs.open(file,'r');
    try{
      const stat=await handle.stat();let fresh=!state;
      if(!state){
        const head=Buffer.alloc(65536),r=await handle.read(head,0,head.length,0);
        let meta;try{meta=JSON.parse(head.subarray(0,r.bytesRead).toString('utf8').split('\n')[0]);}catch{return null;}
        const p=meta.payload||{};
        if(meta.type!=='session_meta'||typeof p.id!=='string'||!(p.source==='vscode'||/desktop/i.test(p.originator||'')))return null;
        state={id:p.id,offset:Math.max(0,stat.size-MAX_READ),carry:Buffer.alloc(0),lastAt:0,ended:false};
      }
      if(stat.size<state.offset){state.offset=0;state.carry=Buffer.alloc(0);}
      const start=state.offset,length=Math.min(MAX_READ,stat.size-start);if(!length)return state;
      const buffer=Buffer.alloc(length),r=await handle.read(buffer,0,length,start);state.offset+=r.bytesRead;
      let data=Buffer.concat([state.carry,buffer.subarray(0,r.bytesRead)]);
      if(fresh&&start>0){const first=data.indexOf(10);data=first>=0?data.subarray(first+1):Buffer.alloc(0);}
      const end=data.lastIndexOf(10);state.carry=end<0?data:data.subarray(end+1);if(state.carry.length>MAX_READ)state.carry=Buffer.alloc(0);
      if(end<0)return state;
      let latest;
      for(const line of data.subarray(0,end).toString('utf8').split('\n')){
        try{const e=eventMetadata(JSON.parse(line));if(e&&e.at>=state.lastAt){state.lastAt=e.at;latest=e;}}catch{}
      }
      if(latest){
        state.ended=['Stop','Interrupt'].includes(latest.hook_event_name);
        const age=this.clock()-latest.at;
        // A completion recovered on connection is display history, not a new turn.
        if(age>=-60000&&age<(state.ended?12000:900000))state.event={session_id:state.id,...latest,recovered:fresh&&state.ended&&latest.at<this.activatedAt};
      }
      return state;
    }finally{await handle.close();}
  }
  async poll(){
    if(!this.active||this.busy)return;this.busy=true;const generation=this.generation;
    try{
      if(!this.lastScan||this.clock()-this.lastScan>=15000){
        const files=await this.discover();if(generation!==this.generation)return;
        for(const {file} of files)if(!this.files.has(file))this.files.set(file,null);
        this.lastScan=this.clock();
      }
      for(const [file,old] of this.files){
        let state;try{state=await this.read(file,old);}catch(e){if(e.code!=='ENOENT')throw e;this.files.delete(file);continue;}
        if(generation!==this.generation)return;
        if(!state){this.files.delete(file);continue;}this.files.set(file,state);
        if(state.event){const event=state.event;delete state.event;if(event.at>=(this.seen.get(event.session_id)||0)){this.seen.set(event.session_id,event.at);this.onEvent({...event,title:this.metadata.title(event.session_id)});if(!this.lastEvent||event.at>=this.lastEvent.at)this.lastEvent={event:event.hook_event_name,at:event.at};}}
        if(!state.ended&&state.lastAt&&this.clock()-state.lastAt>=900000){state.ended=true;if(state.lastAt>=(this.seen.get(state.id)||0))this.onEvent({session_id:state.id,hook_event_name:'SessionEnd',at:this.clock()});}
        if(state.lastAt&&this.clock()-state.lastAt>86400000)this.files.delete(file);
      }
    }catch(e){if(generation===this.generation)this.onError(e);}finally{this.busy=false;}
  }
  close(){this.setEnabled(false);}
}
module.exports={SessionMonitor,eventMetadata};
