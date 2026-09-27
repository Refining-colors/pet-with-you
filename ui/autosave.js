(() => {
  const dirty=new Set(), pending=new Set();
  let flushing=null;
  const status=document.createElement('p');status.id='autosaveStatus';status.setAttribute('role','status');
  status.textContent='修改后关闭设置即可自动保存并应用。';
  document.querySelector('.settings-tabs').after(status);
  const preferenceIds=['disableEventResponse','alwaysOnTop','fullscreenMode','clickAction','actionSpeed','autostart','snapMode','followClientStart','followClientClose','replySeconds','quotaAfterTurn','quotaMode','quotaSeconds','chatSource','autoWhisperProbability','disableRoaming','ignoreAccountTimeouts','taskBasicFeedback','taskNativeFeedback','whisperStreaming'];
  const apiIds=['apiProfileName','apiBaseUrl','apiModel','apiKey'];
  const proxyIds=['proxyProfileName','proxyName','proxyEndpoint','credential','envName','proxyKey','authHeader','bearer','quotaFormat','valuePath','totalPath','quotaScale','quotaUnit','clientCredential'];
  const configSelector='#pets input,#clientPets input,#categories input,[data-whisper-pet],#collision,#notify,#interval,#apiWhisperInterval';
  const mark=key=>{dirty.add(key);status.textContent='有修改待应用，关闭设置时会自动保存。';status.classList.remove('save-error');};
  function changed(event){
    const input=event.target,id=input.id;
    if(input.matches(configSelector)){
      if(id==='collision')main.physics.petCollision=input.checked;
      if(id==='notify')main.notificationsEnabled=input.checked;
      if(id==='interval'||id==='apiWhisperInterval')main.eventsRefreshSec.whisper=Number(input.value);
      dirty.delete('advanced');mark('config');
    }else if(id==='advanced'){dirty.delete('config');mark('advanced');}
    else if(input.name==='replyMode')mark('pref:replyMode');
    else if(id==='apiWhisperProbability')mark('pref:autoWhisperProbability');
    else if(preferenceIds.includes(id))mark('pref:'+id);
    else if(apiIds.includes(id))mark('api');
    else if(proxyIds.includes(id))mark('proxy');
    else if(['appearanceFont','feedbackFont','quotaSource'].includes(id))mark(id);
  }
  document.addEventListener('input',changed);
  document.addEventListener('change',changed);
  // Capture removals before render detaches the clicked button.
  document.addEventListener('click',event=>{if(event.target.closest('#add,#pets button')){dirty.delete('advanced');mark('config');}},true);

  // Await complete handlers (including their UI updates), not just the network request.
  for(const element of document.querySelectorAll('button,input,select'))for(const name of ['onclick','onchange']){
    const handler=element[name];if(!handler)continue;
    element[name]=function(...args){
      const result=handler.apply(this,args);
      if(result?.then){const task=Promise.resolve(result);pending.add(task);task.then(()=>pending.delete(task),()=>pending.delete(task));}
      return result;
    };
  }
  const saveButtons=['save','saveAdvanced','saveApi','saveProxy','savePreferences','saveLifecycle','saveClientLifecycle','saveClientPets','saveAutoWhisper','saveApiAutoWhisper','saveReply','saveQuotaBubble','saveChatSource','saveQuota','saveAppearance','saveFeedbackFont'];
  for(const id of saveButtons)$('#'+id).hidden=true;

  function number(id,min,max){
    const input=$('#'+id),value=Number(input.value);
    if(!input.value.trim()||!Number.isFinite(value)||value<min||value>max){input.focus();throw new Error((input.closest('label')?.textContent.trim()||'数值')+'：请填写 '+min+' 到 '+max+' 之间的数值。');}
    return value;
  }
  function reveal(input){
    if(!input)return;
    selectTab(input.closest('#gptPanel')?'gpt':'basic');
    for(let node=input.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
    input.scrollIntoView({block:'center'});input.focus();
  }
  async function flush(){
    document.activeElement?.blur();
    document.body.inert=true;
    try{
      await Promise.allSettled(settingsLoads);
      while(pending.size)await Promise.allSettled([...pending]);
      await orderSaving;
      if(!dirty.size)return true;
      status.textContent='正在自动保存…';
      const plan=[],prefs={},prefKeys=[...dirty].filter(key=>key.startsWith('pref:'));
      if(dirty.has('moduleOrder')){
        prefs.moduleOrder=Object.fromEntries(['basic','gpt'].map(tab=>[tab,modules($('#'+tab+'Panel')).map(element=>element.id)]));
        prefKeys.push('moduleOrder');
      }
      for(const key of prefKeys){
        if(key==='moduleOrder')continue;
        const id=key.slice(5),input=$('#'+id);
        prefs[id]=id==='replyMode'?document.querySelector('[name=replyMode]:checked').value:input.type==='checkbox'?input.checked:input.value;
        if(['replySeconds','quotaSeconds'].includes(id))prefs[id]=number(id,1,3600);
        if(id==='autoWhisperProbability')prefs[id]=number(id,0,100);
        if(id==='actionSpeed')prefs[id]=number(id,.5,2);
        if(id==='chatSource')prefs.chatSourceChosen=true;
      }
      if(dirty.has('config')||dirty.has('advanced')){
        let value;
        if(dirty.has('advanced')){
          try{value=JSON.parse($('#advanced').value);}catch{throw new Error('高级配置不是有效的 JSON，请检查后再关闭。');}
        }else{
          value=structuredClone(main);
          value.eventsRefreshSec.whisper=number('interval',60,86400);
          value.physics.petCollision=$('#collision').checked;value.notificationsEnabled=$('#notify').checked;
        }
        plan.push({keys:['config','advanced'],run:async()=>{const saved=await api('/config','PUT',value);main=saved.main;}});
      }
      if(dirty.has('api')){
        const value={profileName:$('#apiProfileName').value,baseUrl:$('#apiBaseUrl').value.trim(),model:$('#apiModel').value.trim(),apiKey:enteredSecret($('#apiKey'))};
        plan.push({keys:['api'],run:async()=>{fillApiSettings(await api('/api/settings','PUT',value));}});
      }
      if(dirty.has('proxy')){
        const endpoint=$('#proxyEndpoint').value.trim();
        if(!endpoint)throw new Error('请填写额度查询网址；需要清除配置时请使用“一键清除”。');
        const proxy={endpoint,name:$('#proxyName').value,credential:$('#credential').value,envName:$('#envName').value.trim(),key:enteredSecret($('#proxyKey')),profileName:$('#proxyProfileName').value,header:$('#authHeader').value,bearer:$('#bearer').checked,format:$('#quotaFormat').value,valuePath:$('#valuePath').value.trim(),totalPath:$('#totalPath').value.trim(),scale:number('quotaScale',Number.MIN_VALUE,Number.MAX_VALUE),unit:$('#quotaUnit').value};
        const selected=$('#quotaSource').value;
        plan.push({keys:['proxy'],run:async()=>{fillQuota(await api('/quota/settings','PUT',{selected,proxy}));}});
      }
      if(dirty.has('quotaSource')){
        const selected=$('#quotaSource').value;
        plan.push({keys:['quotaSource'],run:()=>api('/quota/settings','PUT',{selected,selectedOnly:true})});
      }
      for(const id of ['appearanceFont','feedbackFont'])if(dirty.has(id)){
        const family=$('#'+id).value,value={family,source:appearance?.customFonts?.some(f=>f.id===family)?'file':'system',...(id==='feedbackFont'?{target:'feedback'}:{})};
        plan.push({keys:[id],run:async()=>{appearance=await api('/appearance','PUT',value);}});
      }
      if(prefKeys.length)plan.push({keys:prefKeys,run:()=>api('/preferences','PUT',prefs)});
      for(const step of plan){await step.run();for(const key of step.keys)dirty.delete(key);}
      status.textContent='所有修改已自动保存。';status.classList.remove('save-error');return true;
    }catch(error){
      status.textContent='自动保存未完成：'+error.message+' 修改仍保留在此窗口，请检查后重新关闭。';status.classList.add('save-error');
      document.body.inert=false;
      const key=[...dirty][0];
      reveal(key==='advanced'?$('#advanced'):key==='api'?$('#apiBaseUrl'):key==='proxy'?$('#proxyEndpoint'):key?.startsWith('pref:')?$('#'+key.slice(5)):null);
      status.scrollIntoView({block:'center'});return false;
    }finally{document.body.inert=false;}
  }
  window.PetSettingsAutosave={
    get dirty(){return dirty.size>0||pending.size>0||!!flushing;},
    mark,
    clear(key){dirty.delete(key);},
    flush(){if(!flushing)flushing=flush().finally(()=>{flushing=null;});return flushing;}
  };
  // Initial fetches populate controls without creating drafts.
  Promise.allSettled(settingsLoads).then(()=>{document.body.inert=false;});
})();
