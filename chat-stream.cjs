const {issue}=require('./diagnostics.cjs');
async function readChatStream(response,onText){
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer='',data=[],text='',bytes=0,finished=false;
  const event=()=>{
    if(!data.length)return;
    const payload=data.join('\n');data=[];
    if(payload==='[DONE]'){finished=true;return;}
    let value;try{value=JSON.parse(payload);}catch{throw issue('invalid-json');}
    if(value.error)throw issue('upstream');
    const choice=value.choices?.find(c=>c.index===0)||value.choices?.[0];
    if(typeof choice?.delta?.content==='string'){text+=choice.delta.content;onText(text);}
    if(choice?.finish_reason)finished=true;
  };
  const lines=()=>{let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at).replace(/\r$/,'');buffer=buffer.slice(at+1);if(!line)event();else if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));}};
  try{
    while(!finished){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1048576)throw issue('response-large');buffer+=decoder.decode(value,{stream:true});lines();}
    if(!finished){buffer+=decoder.decode()+'\n\n';lines();}
    if(!finished)throw issue('upstream');
    if(!text.trim())throw issue('empty-reply');
    return text.trim();
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
module.exports={readChatStream};
