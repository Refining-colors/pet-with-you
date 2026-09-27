const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('automatic whisper waits its interval, honors probability and skips occupied bubbles',()=>{
  let scheduled,calls=0;
  class PetSprite{}
  const context={PetSprite,window:{petPreferences:{chatReady:true,autoWhisperProbability:50},setInterval(fn,ms){scheduled={fn,ms};return 1;}},document:{hidden:false},Math:Object.create(Math)};
  context.Math.random=()=>0.49;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../runtime/events.js'),'utf8'),context);
  const s=new PetSprite();Object.assign(s,{pet:{whisperEnabled:true,eventsRefreshSec:{whisper:120}},whisperLoopTimer:null,ac:new AbortController(),dragState:{active:false},showWhisperFromMenu(automatic){assert.equal(automatic,true);calls++;}});
  s.startWhisperLoop();assert.equal(calls,0);assert.equal(scheduled.ms,120000);
  scheduled.fn();assert.equal(calls,1);
  context.Math.random=()=>0.50;scheduled.fn();assert.equal(calls,1);
  context.window.petPreferences.autoWhisperProbability=0;scheduled.fn();assert.equal(calls,1);
  context.window.petPreferences.autoWhisperProbability=100;scheduled.fn();assert.equal(calls,2);
  for(const key of ['workOn','whisperOn','whisperRequest','explicitQuota','bubbleOn','errorNotice','chatOpen','menuOpen','manualPlaying','bubbleHover','bubbleSelecting']){
    s[key]=true;scheduled.fn();assert.equal(calls,2,key);s[key]=false;
  }
  s.dragState.active=true;scheduled.fn();assert.equal(calls,2);s.dragState.active=false;
  context.document.hidden=true;scheduled.fn();assert.equal(calls,2);context.document.hidden=false;
  context.window.petPreferences.chatReady=false;scheduled.fn();assert.equal(calls,2);context.window.petPreferences.chatReady=true;
  s.pet.whisperEnabled=false;scheduled.fn();assert.equal(calls,2);s.pet.whisperEnabled=true;
  s.ac.abort();scheduled.fn();assert.equal(calls,2);
});
