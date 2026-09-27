'use strict';
window.PetWhisperStream={
  async read(response,onText){
    if(!response.headers?.get('content-type')?.includes('application/x-ndjson'))return response.json();
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',final=null,bytes=0;
    const fail=()=>{const e=new Error('Incomplete whisper response');e.name='PetStreamError';return e;};
    const lines=()=>{
      let at;
      while((at=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,at).trim();buffer=buffer.slice(at+1);if(!line)continue;
        let value;try{value=JSON.parse(line);}catch{throw fail();}
        if(value.type==='text'&&typeof value.text==='string')onText(value.text);
        else if(value.type==='done')final=value;
      }
    };
    try{
      while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4194304)throw fail();buffer+=decoder.decode(value,{stream:true});lines();}
      buffer+=decoder.decode()+'\n';lines();if(!final)throw fail();return final;
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
};
