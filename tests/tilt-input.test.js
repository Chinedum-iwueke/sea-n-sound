import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TiltInput} from '../mobile/tilt-input.mjs';
import {Rhythm} from '../server/rhythm.js';
const gravity=degrees=>({x:0,y:-Math.cos(degrees*Math.PI/180),z:-Math.sin(degrees*Math.PI/180)});
const settle=(tilt,degrees,count=60)=>{let result;for(let i=0;i<count;i++)result=tilt.update(gravity(degrees));return result;};
test('calibrates chest, inclined and flat poses; gentle rocking has both directions',()=>{
 for(const rest of [0,35,90,175]){
  const tilt=new TiltInput();assert.equal(tilt.update(gravity(rest)).calibrating,true);
  assert.ok(Math.abs(settle(tilt,rest).value)<1e-8);
  assert.ok(settle(tilt,rest+8).value>0.6);
  assert.ok(settle(tilt,rest-8).value<-.6);
  assert.equal(settle(tilt,rest+25).value,1);
  tilt.reset();assert.ok(Math.abs(settle(tilt,rest+25).value)<1e-8);
 }
});
test('stationary noise, sideways placement and acceleration spikes do not invent rocking',()=>{
 const tilt=new TiltInput();settle(tilt,0);
 for(let i=0;i<300;i++)assert.equal(Math.abs(tilt.update(gravity(Math.sin(i)*.3)).value),0);
 assert.equal(tilt.update({x:NaN,y:0,z:0}),null);
 assert.equal(tilt.update({x:0,y:-2,z:0}),null);
 assert.equal(new TiltInput().update({x:1,y:0,z:0}),null);
});
test('gentle body tilt streams earn one shared cue; opposite rocking does not',()=>{
 for(const opposite of [false,true]){
  const rhythm=new Rhythm(),a=new TiltInput(),b=new TiltInput();settle(a,0);settle(b,30);
  rhythm.seats.A.connected=rhythm.seats.B.connected=true;
  for(let t=0;t<16000;t+=33){
   const pitch=7*Math.sin(2*Math.PI*t/2200);
   rhythm.input('A',a.update(gravity(pitch)).value,true,t);
   rhythm.input('B',b.update(gravity(30+(opposite?-pitch:pitch))).value,true,t);
   rhythm.tick(t);
  }
  assert.equal(rhythm.synced,!opposite);assert.equal(rhythm.syncEvent,opposite?0:1);
  // Sensors keep reporting even when the person stops at a tilted position.
  const heldA=a.update(gravity(7)).value,heldB=b.update(gravity(37)).value;
  for(let t=16000;t<22000;t+=33){rhythm.input('A',heldA,true,t);rhythm.input('B',heldB,true,t);rhythm.tick(t);}
  assert.equal(rhythm.synced,false);assert.equal(rhythm.syncEvent,opposite?0:1);
 }
});
