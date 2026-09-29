const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {WindowObserver}=require('../window-observer.cjs');

test('window observer reconnects on failure or silence without reporting client exit',t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const children=[],states=[];let failures=0,time=0;
  const observer=new WindowObserver({now:()=>time,onState:s=>states.push(s),onDisconnect:()=>failures++,spawnProcess:()=>{
    const child=new EventEmitter();child.stdout=new PassThrough();child.kill=()=>{child.killed=true;};children.push(child);return child;
  }});
  observer.start();observer.start();assert.equal(children.length,1);
  children[0].stdout.write('{"clientRunning":true}\n');assert.equal(states.length,1);
  children[0].emit('error',new Error('fixture'));children[0].emit('exit',1);
  assert.equal(failures,1);assert.equal(children[0].killed,true);
  t.mock.timers.tick(500);assert.equal(children.length,2);
  children[0].stdout.write('{"clientRunning":false}\n');assert.equal(states.length,1,'old helper ignored');
  children[1].stdout.write('{}\nnot-json\nnull\n');assert.equal(states.length,1,'invalid samples cannot fake client exit or health');
  time=16000;t.mock.timers.tick(1000);assert.equal(failures,2);assert.equal(children[1].killed,true);
  t.mock.timers.tick(1000);assert.equal(children.length,3);
  children[2].stdout.write('{"clientRunning":true}\n');assert.equal(states.length,2);
  observer.close();assert.equal(children[2].killed,true);
  children[2].emit('exit',0);t.mock.timers.tick(30000);
  assert.equal(children.length,3);assert.equal(failures,2);
});
