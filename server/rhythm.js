// Rehearsal defaults: forgiving pace/timing, with a genuine shared phase.
export const defaults = {holdMs:2000, phaseMs:320, periodTolerance:0.40, idleMs:900, graceMs:650};
export class Rhythm {
 constructor(){this.settings={...defaults};this.reset();}
 reset(){
  this.seats={A:this.empty(),B:this.empty()};
  this.epoch=(this.epoch??Date.now())+1;
  this.syncEvent=0;
  this.clearMatch();
 }
 clearMatch(){this.synced=false;this.qualifiedMs=0;this.badSince=null;this.lastTick=null;}
 empty(){return {connected:false,x:0,lastInputX:0,active:false,lastMove:0,direction:0,anchor:0,turns:[],cueReceived:0};}
 input(id,x,active,now){
  const s=this.seats[id];x=Math.max(-1,Math.min(1,x));s.active=active;
  if(!active){s.direction=0;s.turns=[];s.anchor=s.x;return;}
  const delta=x-s.lastInputX;s.lastInputX=x;s.x=x;if(Math.abs(delta)>0.003)s.lastMove=now;
  // Hysteresis rejects finger tremors instead of creating artificial cycles.
  if(!s.direction){if(Math.abs(x-s.anchor)>0.055){s.direction=Math.sign(x-s.anchor);s.anchor=x;}}
  else if((x-s.anchor)*s.direction>0)s.anchor=x;
  else if(Math.abs(x-s.anchor)>0.055){s.direction*=-1;s.anchor=x;s.turns.push({time:now,dir:s.direction});s.turns=s.turns.slice(-8);}
 }
 tick(now){
  const dt=this.lastTick===null?0:Math.max(0,Math.min(100,now-this.lastTick));this.lastTick=now;
  const [a,b]=Object.values(this.seats);
  for(const s of [a,b]){if(now-s.lastMove>this.settings.idleMs){s.active=false;s.direction=0;s.turns=[];s.anchor=s.lastInputX;}if(!s.active)s.x*=0.82;}
  const period=s=>s.turns.length>=3?s.turns.at(-1).time-s.turns.at(-3).time:null;
  const pa=period(a),pb=period(b),ta=a.turns.at(-1),tb=b.turns.at(-1);
  const bothActive=a.connected&&b.connected&&a.active&&b.active;
  if(!bothActive){this.synced=false;this.qualifiedMs=0;this.badSince=null;return this.snapshot();}
  const pace=bothActive&&pa&&pb&&Math.abs(pa-pb)/Math.max(pa,pb)<=this.settings.periodTolerance;
  // A relative cap keeps a half-cycle (opposite-phase) rhythm outside tolerance,
  // including at faster paces where a fixed 320 ms window would be too wide.
  const phase=pa&&pb?Math.min(this.settings.phaseMs,Math.min(pa,pb)*0.24):0;
  const gap=ta&&tb?Math.abs(ta.time-tb.time):Infinity;
  const matched=!!(pace&&ta.dir===tb.dir&&gap<=phase);
  // One thumb may turn slightly before the other. Simultaneous reversals in
  // opposite directions are NOT pending alignment and must leave synchrony.
  const pending=!!(pace&&this.qualifiedMs>0&&ta.dir!==tb.dir&&gap>Math.min(pa,pb)*0.25&&now-Math.max(ta.time,tb.time)<=phase);
  if(matched||pending){
   this.badSince=null;this.qualifiedMs+=dt;
   if(!this.synced&&matched&&this.qualifiedMs>=this.settings.holdMs){this.synced=true;this.syncEvent++;}
  }else{
   if(this.badSince===null)this.badSince=now;
   // Brief mismatch pauses qualification, rather than deleting all progress.
   if(now-this.badSince>=this.settings.graceMs){this.synced=false;this.qualifiedMs=0;}
  }
  return this.snapshot();
 }
 snapshot(){return {seats:this.seats,synced:this.synced,syncEvent:this.syncEvent,epoch:this.epoch,settings:this.settings};}
}
