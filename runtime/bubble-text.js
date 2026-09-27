'use strict';
window.PetBubbleText={
  set(element,value){
    const source=String(value??'');element.replaceChildren();
    let fenced=false;
    const lines=source.split('\n');
    lines.forEach((line,index)=>{
      if(index)element.append(document.createTextNode('\n'));
      const fence=/^\s*(```|~~~)/.test(line);
      if(fence||fenced||line.includes('`')){
        element.append(document.createTextNode(line));if(fence)fenced=!fenced;return;
      }
      // Correct the glyph only at conversational Chinese endings; preserve the actual text.
      const marks=/(?<=[\u3400-\u9fff\u3001\u3002\uff01\uff1f\uff09])[~\uff5e\u301c]+(?=[\s!！?？。…，、；;：:]|$)/gu;
      let offset=0;
      for(const match of line.matchAll(marks)){
        element.append(document.createTextNode(line.slice(offset,match.index)));
        const span=document.createElement('span');span.className='tone-mark';span.textContent=match[0];element.append(span);offset=match.index+match[0].length;
      }
      element.append(document.createTextNode(line.slice(offset)));
    });
  }
};
