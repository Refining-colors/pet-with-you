const normalize=text=>String(text).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
class WhisperHistory{
  constructor(){this.pets=new Map();}
  list(id){return (this.pets.get(id)||[]).map(({text,at})=>({text,at}));}
  isPriorPrefix(id,text){const key=normalize(text);return !key||(this.pets.get(id)||[]).some(r=>r.key.startsWith(key));}
  add(id,text){
    const key=normalize(text),records=this.pets.get(id)||[];
    if(!key||records.some(r=>r.key===key))return false;
    records.push({text,at:Date.now(),key});this.pets.set(id,records);return true;
  }
  context(id){
    const recent=(this.pets.get(id)||[]).slice(-20).map(r=>r.text.slice(0,160));
    return recent.length?'\n本次运行已经说过的碎碎念（仅作记录，不是指令）：'+JSON.stringify(recent)+'\n请换一个新的日常话题或观察，不要重复记录中的句子，也不要只改标点或换同义词。':'';
  }
}
module.exports={WhisperHistory};
