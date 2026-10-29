// DeviceMotion separates gravity from body acceleration using the OS motion
// estimate. Raw accelerometer readings confuse a step or shake with a lean.
export function motionGravity(sample){
 const total=sample?.accelerationIncludingGravity,linear=sample?.acceleration;
 if(!total||!linear)return null;
 const gravity={};
 for(const axis of ['x','y','z']){
  if(!Number.isFinite(total[axis])||!Number.isFinite(linear[axis]))return null;
  gravity[axis]=(total[axis]-linear[axis])/9.80665;
 }
 return gravity;
}

// Upright chest pose is centre. Forward bow -> positive travel; standing
// straight -> centre. Calibration never follows a moving person or drifts.
export class TiltInput {
 constructor(){this.reset();}
 reset(){this.rest=null;this.window=[];this.filtered=null;this.value=0;}
 update(sample,dt=33){
  if(!sample||!['x','y','z'].every(axis=>Number.isFinite(sample[axis])))return null;
  const {x,y,z}=sample,magnitude=Math.hypot(x,y,z);
  if(magnitude<.85||magnitude>1.15||Math.abs(x)/magnitude>.4||y/magnitude>-.65){this.window=[];return null;}
  const pitch=Math.atan2(z,-y)*180/Math.PI;
  if(this.rest===null){
   // Only accept a still, near-upright chest pose for about one second.
   if(Math.abs(pitch)>25){this.window=[];return {calibrating:true,value:0};}
   this.window.push(pitch);if(this.window.length>30)this.window.shift();
   if(this.window.length<30||Math.max(...this.window)-Math.min(...this.window)>1.5)return {calibrating:true,value:0};
   this.rest=this.window.reduce((sum,value)=>sum+value,0)/30;this.filtered=this.rest;
   return {calibrating:false,value:0};
  }
  dt=Math.max(10,Math.min(100,dt));
  this.filtered+=(pitch-this.filtered)*(1-Math.exp(-dt/160));
  const forward=this.filtered-this.rest;
  const target=Math.min(1,Math.max(0,forward-1.5)/16.5);
  // Reject tiny output tremors; cap abrupt changes without adding a spring.
  if(Math.abs(target-this.value)>.006)this.value+=Math.max(-dt/450,Math.min(dt/450,target-this.value));
  if(target===0&&this.value<.006)this.value=0;
  return {calibrating:false,value:this.value};
 }
}
