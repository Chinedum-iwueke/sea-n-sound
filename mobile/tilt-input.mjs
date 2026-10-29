// Gravity-based pitch around the phone's short edge. Calibration makes a
// chest-held, upright or face-up phone share the same comfortable rest point.
export class TiltInput {
 constructor(){this.reset();}
 reset(){this.gravity=null;this.rest=null;this.samples=0;this.sum={y:0,z:0};}
 update({x,y,z}){
  if(![x,y,z].every(Number.isFinite))return null;
  const magnitude=Math.hypot(x,y,z);
  if(magnitude<0.65||magnitude>1.35)return null;
  if(!this.gravity)this.gravity={x,y,z};
  else for(const axis of ['x','y','z'])this.gravity[axis]+=0.2*({x,y,z}[axis]-this.gravity[axis]);
  const g=this.gravity,projection=Math.hypot(g.y,g.z);
  if(projection<0.45)return null; // Sideways placement has no reliable pitch.
  if(!this.rest){
   this.sum.y+=g.y/projection;this.sum.z+=g.z/projection;
   if(++this.samples<20)return {calibrating:true,value:0};
   this.rest={y:this.sum.y/20,z:this.sum.z/20};
  }
  const radians=Math.atan2(this.rest.y*g.z-this.rest.z*g.y,this.rest.y*g.y+this.rest.z*g.z);
  const degrees=radians*180/Math.PI;
  // Half a degree of rest noise is ignored; twelve degrees reaches full travel.
  const value=Math.sign(degrees)*Math.min(1,Math.max(0,Math.abs(degrees)-0.5)/11.5);
  return {calibrating:false,value};
 }
}
