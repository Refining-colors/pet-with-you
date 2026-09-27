const {cleanTitle}=require('./thread-metadata.cjs');
const STATES = { UserPromptSubmit: 'thinking', PreToolUse: 'working', PostToolUse: 'result', PermissionRequest: 'waiting', PreCompact: 'result', PostCompact: 'thinking', Stop: 'success' };
class TaskState {
  constructor(clock = Date.now) { this.clock = clock; this.sessions = new Map(); this.ts = clock(); this.completedTurns=0;this.completedSessions=new Set(); }
  accept(event) {
    if (!event || typeof event.session_id !== 'string' || event.session_id.length > 200) return false;
    const name = event.hook_event_name;
    if (['Interrupt', 'SessionEnd'].includes(name)) {
      this.sessions.delete(event.session_id);
      this.ts = Math.max(this.ts + 1, this.clock());
      return true;
    }
    let state = STATES[name];
    if (!state) return false;
    if(name==='Stop'){
      if(!this.completedSessions.has(event.session_id)){if(!event.recovered)this.completedTurns++;this.completedSessions.add(event.session_id);}
    }else this.completedSessions.delete(event.session_id);
    if (name === 'PostToolUse' && event.tool_failed === true) state = 'error';
    if (name === 'PreToolUse' && /request_user_input|ask_user_question/.test(event.tool_name || '')) state = 'waiting';
    const ts = Math.max(this.ts + 1, this.clock());
    const previous=this.sessions.get(event.session_id);
    const title=cleanTitle(event.title)||previous?.title||'';
    const tool=typeof event.tool_name==='string'?event.tool_name:'';
    const activity=state==='working'?(/apply_patch|edit|write_file/.test(tool)?'修改文件':/exec_command|shell|command/.test(tool)?'执行命令':/search|browse|fetch/.test(tool)?'检索资料':'使用工具'):'';
    this.sessions.set(event.session_id, { state, ts, task: null,sessionId:event.session_id,title,activity });
    this.ts = ts;
    return true;
  }
  snapshot() {
    const now = this.clock();
    const priority = { waiting: 60, error: 50, working: 40, thinking: 30, result: 25, success: 20 };
    for (const [id, v] of this.sessions) {
      if (now - v.ts > (v.state === 'success' || v.state === 'error' ? 12000 : 86400000)) {
        this.sessions.delete(id);
        this.ts = Math.max(this.ts + 1, now);
      }
    }
    const best = [...this.sessions.values()].sort((a,b) => priority[b.state]-priority[a.state] || b.ts-a.ts)[0];
    const counts={};for(const v of this.sessions.values())counts[v.state]=(counts[v.state]||0)+1;
    const activeCount=['waiting','working','thinking','result'].reduce((n,k)=>n+(counts[k]||0),0);
    const label={waiting:'等待确认',error:'工具出错',working:'执行工具',thinking:'思考中',result:'整理结果',success:'回合完成'};
    const task=this.sessions.size>1?`已知 ${activeCount} 个任务进行中\n${label[best?.state]||'空闲'}`:null;
    const items=[...this.sessions.values()].sort((a,b)=>priority[b.state]-priority[a.state]||b.ts-a.ts).map(v=>({sessionId:v.sessionId,title:v.title||'当前对话',state:v.state,activity:v.activity||label[v.state]}));
    const extra={counts,activeCount,trackedCount:this.sessions.size,items,completedTurns:this.completedTurns};
    return best ? { ...best,task,ts:Math.max(best.ts,this.ts),...extra } : {state:null,task:null,ts:this.ts,...extra};
  }
}
module.exports = { TaskState };
