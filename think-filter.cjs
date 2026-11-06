'use strict';
// 一些 OpenAI 兼容服务会把推理过程直接写进正文（<think>…</think> 或 <thinking>…</thinking>）。
// 桌宠只需要给人看的正文，这里在流式和非流式两条路径上统一去掉思考块。
const OPEN_TAG=/<(think|thinking)\b[^>]*>/i;
const COMPLETE=/<(think|thinking)\b[^>]*>[\s\S]*?<\/\1>/gi;
const PARTIAL=/<[^<>]*$/;
function stripThink(value){
  let text=String(value??'');
  text=text.replace(COMPLETE,'');
  const open=OPEN_TAG.exec(text);
  if(open)text=text.slice(0,open.index);
  const tail=PARTIAL.exec(text);
  if(tail&&['<think','<thinking'].some(tag=>tag.startsWith(tail[0].toLowerCase())))text=text.slice(0,tail.index);
  return text.replace(/^[\s\u3000]+/,'');
}
module.exports={stripThink};
