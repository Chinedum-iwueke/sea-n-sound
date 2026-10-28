import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
test('local session pairs, protects controls, restores assignment and releases visitors',async()=>{
 const child=spawn(process.execPath,['server/index.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'18787'},stdio:['ignore','pipe','pipe']});const sockets=[];
 try{
 const key=await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>reject(new Error('Server did not start')),5000);child.stdout.on('data',d=>{out+=d;const match=out.match(/facilitator#([a-f0-9]+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});child.once('error',reject);});
 async function open(role,token='visitor-token-123',adminKey){const ws=new WebSocket('ws://localhost:18787');sockets.push(ws);const inbox=[];ws.on('message',d=>inbox.push(JSON.parse(d)));await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',role,token,key:adminKey}));return {ws,inbox};}
 async function wait(c,predicate){const end=Date.now()+3000;while(Date.now()<end){const i=c.inbox.findIndex(predicate);if(i>=0)return c.inbox.splice(i,1)[0];await new Promise(r=>setTimeout(r,15));}throw new Error('Expected session event missing');}
 const display=await open('display');const a=await open('A');await wait(a,m=>m.type==='joined');const b=await open('B','second-token-123');await wait(b,m=>m.type==='joined');
 const duplicate=await open('A','wrong-token-123');assert.match((await wait(duplicate,m=>m.type==='error')).message,/paired/);
 const before=await wait(display,m=>m.type==='state'&&m.seats.A.connected&&m.seats.B.connected);display.ws.send(JSON.stringify({type:'reset'}));const after=await wait(display,m=>m.type==='state');assert.equal(after.epoch,before.epoch);
 a.ws.send(JSON.stringify({type:'input',x:.7,active:true}));await wait(display,m=>m.type==='state'&&m.seats.A.x===.7&&m.seats.B.x===0);
 a.ws.close();await wait(display,m=>m.type==='state'&&!m.seats.A.connected);const restored=await open('A');await wait(restored,m=>m.type==='joined');
 const admin=await open('admin','unused-token-123',key);await wait(admin,m=>m.type==='state');admin.ws.send(JSON.stringify({type:'reset'}));const reset=await wait(admin,m=>m.type==='state'&&m.epoch>before.epoch);assert.equal(reset.seats.A.connected,true);assert.equal(reset.seats.A.x,0);

 // Exercise cue delivery and acknowledgments over real sockets on this isolated
 // test session; never drive either of the exhibition's actual phones.
 const started=Date.now();
 while(Date.now()-started<4800){const x=Math.sin((Date.now()-started)/1000*2*Math.PI);for(const client of [restored,b])client.ws.send(JSON.stringify({type:'input',x,active:true}));await new Promise(r=>setTimeout(r,30));}
 const together=await wait(admin,m=>m.type==='state'&&m.synced&&m.syncEvent===1);
 for(const client of [restored,b])client.ws.send(JSON.stringify({type:'cueAck',event:together.syncEvent}));
 await wait(admin,m=>m.type==='state'&&m.seats.A.cueReceived===1&&m.seats.B.cueReceived===1);
 admin.ws.send(JSON.stringify({type:'release'}));await wait(restored,m=>m.type==='unpaired');await wait(b,m=>m.type==='unpaired');const next=await open('A','new-visitor-123');await wait(next,m=>m.type==='joined');
 const response=await fetch('http://localhost:18787/');assert.equal(response.status,200);assert.match(await response.text(),/Sea’N’Sound/);
 }finally{for(const ws of sockets)ws.terminate();child.kill();}
});
