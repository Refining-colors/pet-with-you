const fs=require('node:fs'),path=require('node:path');
const cleanTitle=value=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,160):'';
class ThreadMetadata{
  constructor(home){this.home=home;this.cache=new Map();}
  title(id){
    const cached=this.cache.get(id);if(cached&&Date.now()-cached.at<5000)return cached.title;
    let title='';
    // Read only the title column; never select prompts, previews, tokens or credentials.
    try{
      const name=fs.readdirSync(this.home).filter(n=>/^state_\d+\.sqlite$/.test(n)).sort((a,b)=>Number(b.match(/\d+/)[0])-Number(a.match(/\d+/)[0]))[0];
      if(name){const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(this.home,name),{readOnly:true});try{db.exec('PRAGMA busy_timeout=50');try{title=cleanTitle(db.prepare("SELECT COALESCE(NULLIF(name, ''), title) AS title FROM threads WHERE id = ?").get(id)?.title);}catch{title=cleanTitle(db.prepare('SELECT title FROM threads WHERE id = ?').get(id)?.title);}}finally{db.close();}}
    }catch{}
    if(!title){
      let fd;try{
        fd=fs.openSync(path.join(this.home,'session_index.jsonl'),'r');const size=fs.fstatSync(fd).size,start=Math.max(0,size-2097152),buffer=Buffer.alloc(size-start);fs.readSync(fd,buffer,0,buffer.length,start);
        const lines=buffer.toString('utf8').split('\n');if(start)lines.shift();for(const line of lines){try{const item=JSON.parse(line);if(item.id===id)title=cleanTitle(item.thread_name);}catch{}}
      }catch{}finally{if(fd!==undefined)fs.closeSync(fd);}
    }
    this.cache.set(id,{title,at:Date.now()});if(this.cache.size>256)this.cache.delete(this.cache.keys().next().value);return title;
  }
}
module.exports={ThreadMetadata,cleanTitle};
