// The same authoritative transition may arrive in many 30 Hz state messages.
export class SyncCueGate {
 constructor(){this.lastKey=null;}
 consume(state){
  if(!state.synced||!Number.isInteger(state.syncEvent)||state.syncEvent<1)return false;
  const key=`${state.epoch}:${state.syncEvent}`;
  if(key===this.lastKey)return false;
  this.lastKey=key;return true;
 }
}
export function verticalPosition(start,dy,travel=104){return Math.max(-1,Math.min(1,start-dy/travel));}
export function pivotOffset(width,height){return {x:(149/420-0.5)*width,y:(295/370-0.5)*height};}
