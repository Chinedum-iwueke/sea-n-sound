import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TiltInput,motionGravity} from '../mobile/tilt-input.mjs';
import {Rhythm} from '../server/rhythm.js';
const gravity=degrees=>({x:0,y:-Math.cos(degrees*Math.PI/180),z:Math.sin(degrees*Math.PI/180)});
const settle=(tilt,degrees,count=60)=>{let result;for(let i=0;i<count;i++)result=tilt.update(gravity(degrees));return result;};
test('upright chest is centre; bow moves forward and standing returns exactly to centre',()=>{
 for(const rest of [0,8,-8]){
  const tilt=new TiltInput();assert.equal(tilt.update(gravity(rest)).calibrating,true);
  assert.equal(settle(tilt,rest).value,0);
  assert.ok(settle(tilt,rest+10).value>.48);
  assert.equal(settle(tilt,rest+25).value,1);
  assert.equal(settle(tilt,rest).value,0);
  assert.equal(settle(tilt,rest-8).value,0);
 }
});
test('calibration waits for still upright placement rather than accepting a moving bow or flat phone',()=>{
 const tilt=new TiltInput();
 for(let i=0;i<90;i++)assert.equal(tilt.update(gravity(8+6*Math.sin(i/4))).calibrating,true);
 assert.equal(tilt.rest,null);assert.equal(settle(tilt,0).value,0);
 const flat=new TiltInput();assert.equal(settle(flat,70),null);assert.equal(flat.rest,null);
 assert.equal(new TiltInput().update({x:1,y:0,z:0}),null);
});
test('fused gravity removes linear chest acceleration and rejects missing sensor fields',()=>{
 for(const degrees of [0,10,20]){
  const g=gravity(degrees),linear={x:1.2,y:-2,z:3};
  const total=Object.fromEntries(['x','y','z'].map(axis=>[axis,g[axis]*9.80665+linear[axis]]));
  const recovered=motionGravity({acceleration:linear,accelerationIncludingGravity:total});
  for(const axis of ['x','y','z'])assert.ok(Math.abs(recovered[axis]-g[axis])<1e-10);
 }
 assert.equal(motionGravity({acceleration:null}),null);
});
test('upright noise stays still and abrupt sensor changes have bounded travel',()=>{
 const tilt=new TiltInput();settle(tilt,0);
 for(let i=0;i<300;i++)assert.equal(tilt.update(gravity(Math.sin(i)*1)).value,0);
 let previous=0;
 for(let i=0;i<30;i++){const next=tilt.update(gravity(22)).value;assert.ok(next-previous<=33/450+1e-8);previous=next;}
 assert.equal(tilt.update({x:NaN,y:0,z:0}),null);
});
test('matched bow-and-stand cycles synchronise; opposite cycles and stationary reporting do not',()=>{
 for(const opposite of [false,true]){
  const rhythm=new Rhythm(),a=new TiltInput(),b=new TiltInput();settle(a,0);settle(b,8);
  rhythm.seats.A.connected=rhythm.seats.B.connected=true;
  for(let t=0;t<18000;t+=33){
   const phase=2*Math.PI*t/2800;
   const bowA=7*(1-Math.cos(phase)),bowB=7*(1-Math.cos(phase+(opposite?Math.PI:0)));
   rhythm.input('A',a.update(gravity(bowA)).value,true,t);
   rhythm.input('B',b.update(gravity(8+bowB)).value,true,t);rhythm.tick(t);
  }
  assert.equal(rhythm.synced,!opposite);assert.equal(rhythm.syncEvent,opposite?0:1);
  for(let t=18000;t<24000;t+=33){rhythm.input('A',a.update(gravity(0)).value,true,t);rhythm.input('B',b.update(gravity(8)).value,true,t);rhythm.tick(t);}
  assert.equal(rhythm.synced,false);assert.equal(rhythm.syncEvent,opposite?0:1);
 }
});
