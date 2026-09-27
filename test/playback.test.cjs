const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={AbortSignal,setTimeout};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../runtime/shared-core.js'),'utf8'),context);
const S=context.PetShared;
test('small event pools exhaust every candidate before repeating',()=>{
  for(const count of [1,3,5]){
    const pick=S.createPoolPicker(),pool=Array.from({length:count},(_,i)=>'event-'+i);let current='';
    for(let cycle=0;cycle<20;cycle++){
      const round=[];
      for(let i=0;i<count;i++){const next=pick(pool,current);if(count>1)assert.notEqual(next,current);round.push(next);current=next;}
      assert.equal(new Set(round).size,count);
    }
    assert.equal(pick(['replacement'],current),'replacement');
  }
});
test('all default animation files are referenced, available in menus and daily categories are reachable',async()=>{
  const {readAllConfig}=await import('../config.mjs');
  const a=readAllConfig({defaultFile:path.join(__dirname,'../assets/config.jsonc'),userFile:path.join(__dirname,'absent.json'),petDir:path.join(__dirname,'absent')}).main.animations;
  const menu=S.buildMenuTree(a),names=[];const visit=nodes=>{for(const n of nodes)n.children?visit(n.children):names.push(n.anim);};visit(menu);
  const files=fs.readdirSync(path.join(__dirname,'../assets/webm')).filter(f=>f.endsWith('.webm')).map(f=>f.slice(0,-5));
  assert.deepEqual([...new Set(names)].sort(),files.sort());
  let seed=42;const math=Object.create(Math);math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const isolated={Math:math};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../runtime/shared-core.js'),'utf8'),isolated);
  for(let trial=0;trial<20;trial++){
    const pick=isolated.PetShared.createActionPicker(),seen=new Set();let current='';
    for(let i=0;i<1000;i++){current=pick(a.categories,a.idle,'left',current).name;seen.add(current);}
    assert.deepEqual([...seen].sort(),a.categories.flatMap(c=>c.actions).sort());
  }
});
test('random action rotation excludes recent actions, zero weights and mirrored text',()=>{
  const picker=S.createActionPicker();
  const cats=[{id:'a',weight:1,actions:Array.from({length:30},(_,i)=>'a'+i)},{id:'off',weight:0,actions:['off']},{id:'text',weight:100,noMirror:true,actions:['text']}];
  const history=[];let current='';
  for(let i=0;i<120;i++){
    current=picker(cats,['idle'],'right',current).name;
    assert.ok(!history.slice(-16).includes(current));assert.ok(current.startsWith('a'));
    history.push(current);
  }
  assert.equal(picker([{id:'off',weight:0,actions:['off']}],['idle'],'left',current).name,'idle');
});
test('CRS monitor rows survive transport and render as separate bubble lines',async()=>{
  const input={ok:true,provider:'CRS',kind:'proxy',format:'monitor',rows:['今日 $1.0000','请求 2'],percent:10};
  context.fetch=async()=>({ok:true,json:async()=>input});
  const state=await S.fetchBalanceState('http://local.test');
  assert.equal(S.balancePercent(state),10);
  assert.deepEqual(Array.from(S.balanceBubbleView(state),r=>r.text),['CRS','今日 $1.0000','请求 2']);
});
