import React,{useEffect,useRef,useState} from 'react';
import {SafeAreaView,ScrollView,View,Text,TextInput,Pressable,StyleSheet,Animated,PanResponder,AppState,Vibration,Platform,useWindowDimensions} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Accelerometer} from 'expo-sensors';
import {TiltInput} from './tilt-input.mjs';
import * as Haptics from 'expo-haptics';
import Svg,{Path,Ellipse,Circle} from 'react-native-svg';
import {SyncCueGate,verticalPosition,pivotOffset} from './sync-cue.mjs';

// One noticeable system pulse per authoritative synchrony transition.
// On iOS this is about 400 ms and avoids the easily missed Light impact.
function syncFeedback(){
 if(Platform.OS==='ios'){
  try{Vibration.vibrate();return;}catch{}
 }
 Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>Vibration.vibrate(100));
}
function Seat({angle,width}){
 const height=width*370/420, pivot=pivotOffset(width,height);
 return <View style={{width,height}} pointerEvents="none">
  <Svg viewBox="0 0 420 370" width={width} height={height}>
   <Ellipse cx="215" cy="340" rx="155" ry="12" fill="#52766a" opacity=".2"/>
   <Path d="M70 325Q215 307 352 325L365 343H60Z" fill="#889c8e"/>
   <Path d="M149 295Q205 329 299 293M149 307Q218 343 315 305" fill="none" stroke="#52665a" strokeWidth="12"/>
  </Svg>
  <Animated.View style={[StyleSheet.absoluteFill,{transform:[{translateX:pivot.x},{translateY:pivot.y},{rotate:angle.interpolate({inputRange:[-1,1],outputRange:['13deg','-13deg']})},{translateX:-pivot.x},{translateY:-pivot.y}]}]}>
   <Svg viewBox="0 0 420 370" width={width} height={height}>
    <Path d="M149 295Q166 278 173 249" fill="none" stroke="#52665a" strokeWidth="13"/>
    <Path d="M85 60L190 70Q204 179 240 201Q284 222 348 215L350 246Q242 299 169 247Q106 201 85 60Z" fill="#b9ad8d" stroke="#e6deca" strokeWidth="12"/>
    {Array.from({length:17},(_,i)=><Path key={i} d={`M${94+i*3.7} ${76+i*9.7}Q${187+i*1.8} ${89+i*11} ${195+i*8.8} ${80+i*10.3}`} stroke="#7e7963" strokeWidth="3" fill="none"/>)}
    <Path d="M85 61Q101 207 173 252Q248 299 351 233" fill="none" stroke="#52665a" strokeWidth="10"/>
   </Svg>
  </Animated.View>
  <Svg style={StyleSheet.absoluteFill} viewBox="0 0 420 370" width={width} height={height}>
   <Circle cx="149" cy="295" r="18" fill="#b1b7a6" stroke="#52665a" strokeWidth="5"/>
   <Circle cx="149" cy="295" r="7" fill="#596d63"/>
  </Svg>
 </View>;
}
function Light({mix,individual,synced}){
 const colour=mix.interpolate({inputRange:[0,1],outputRange:[individual,'#dcf4a1']});
 return <View style={s.lightZone} accessibilityLabel={synced?'Shared rhythm light':'Individual rhythm light'}>
  <Animated.View style={[s.glowOuter,{backgroundColor:colour}]}/>
  <Animated.View style={[s.glowInner,{backgroundColor:colour}]}/>
  <Animated.View style={[s.light,{backgroundColor:colour,shadowColor:synced?'#c7ef74':individual}]}/>
 </View>;
}
export default function App(){
 const {width:screenWidth}=useWindowDimensions();
 const [config,setConfig]=useState(null),[host,setHost]=useState(''),[seat,setSeat]=useState('A');
 const [status,setStatus]=useState('Choose a seat, then tap Join the sea.'),[synced,setSynced]=useState(false),[ready,setReady]=useState(false);
 const [mode,setMode]=useState('tilt'),[motionStatus,setMotionStatus]=useState('Hold still to set your resting position.'),[calibration,setCalibration]=useState(0),[foreground,setForeground]=useState(AppState.currentState==='active');
 const socket=useRef(null),token=useRef(`phone-${Date.now()}-${Math.random().toString(36).slice(2)}`);
 const angle=useRef(new Animated.Value(0)).current,lightMix=useRef(new Animated.Value(0)).current;
 const touching=useRef(false);
 const position=useRef(0),start=useRef(0),epoch=useRef(null),cue=useRef(new SyncCueGate());
 const seatWidth=Math.min(310,screenWidth-116);
 const send=m=>{if(socket.current?.readyState===1)socket.current.send(JSON.stringify(m));};
 const stop=()=>{
  send({type:'input',x:position.current,active:false});
  Animated.timing(angle,{toValue:0,duration:450,useNativeDriver:true}).start();position.current=0;
 };
 const move=value=>{position.current=value;angle.setValue(value);send({type:'input',x:value,active:true});};
 useEffect(()=>{Animated.timing(lightMix,{toValue:synced?1:0,duration:600,useNativeDriver:false}).start();},[synced]);
 useEffect(()=>{let mounted=true;AsyncStorage.multiGet(['config','token']).then(async values=>{
  if(!mounted)return;token.current=values[1][1]||token.current;await AsyncStorage.setItem('token',token.current);
  if(values[0][1]){try{const c=JSON.parse(values[0][1]);setHost(c.host);setSeat(c.seat);setConfig(c);}catch{setStatus('Enter the laptop address to reconnect.');}}
 }).catch(()=>setStatus('Enter the laptop address to begin.'));return()=>{mounted=false;};},[]);
 useEffect(()=>{
  if(!config)return;let disposed=false,retry,deadline;
  function connect(){
   if(disposed)return;setReady(false);setStatus('Connecting to the laptop…');
   const ws=new WebSocket(config.host.replace(/^http/,'ws'));socket.current=ws;
   deadline=setTimeout(()=>{if(!disposed)ws.close();},7000);
   ws.onopen=()=>ws.send(JSON.stringify({type:'join',role:config.seat,token:token.current}));
   ws.onmessage=e=>{
    if(disposed)return;let m;try{m=JSON.parse(e.data);}catch{return;}
    if(m.type==='unpaired'){disposed=true;clearTimeout(deadline);stop();setConfig(null);setReady(false);setSynced(false);setStatus('Ready for the next pair.');AsyncStorage.removeItem('config');return;}
    if(m.type==='error'){clearTimeout(deadline);setStatus(m.message);setReady(false);return;}
    if(m.type==='joined'){clearTimeout(deadline);setReady(true);setStatus('Connected · your seat is ready');return;}
    if(m.type!=='state')return;
    if(epoch.current!==null&&epoch.current!==m.epoch)stop();epoch.current=m.epoch;setSynced(m.synced);
    if(cue.current.consume(m)){syncFeedback();send({type:'cueAck',event:m.syncEvent});}
   };
   ws.onclose=()=>{clearTimeout(deadline);if(disposed)return;setReady(false);setSynced(false);stop();setStatus('Connection lost · check the laptop address and Wi-Fi');retry=setTimeout(connect,1800);};
   ws.onerror=()=>ws.close();
  }
  connect();
  const listener=AppState.addEventListener('change',state=>{if(state!=='active')stop();});
  return()=>{disposed=true;clearTimeout(retry);clearTimeout(deadline);listener.remove();socket.current?.close();};
 },[config]);
 // Sensor ownership follows the screen, app lifecycle and control mode.
 // A new subscription always calibrates before sending movement.
 useEffect(()=>{
  if(!config||mode!=='tilt'||!foreground)return;
  let disposed=false,subscription,watchdog,lastSample=Date.now();const tilt=new TiltInput();
  stop();setMotionStatus('Hold still for a moment to set your resting position.');
  async function begin(){
   try{
    if(!await Accelerometer.isAvailableAsync())throw new Error('unavailable');
    const permission=await Accelerometer.requestPermissionsAsync();
    if(permission.status!=='granted')throw new Error('permission');
    if(disposed)return;
    Accelerometer.setUpdateInterval(33);
    subscription=Accelerometer.addListener(sample=>{
     if(disposed)return;lastSample=Date.now();const result=tilt.update(sample);
     if(!result){stop();setMotionStatus('Keep the phone upright or flat, and move gently.');return;}
     if(result.calibrating){setMotionStatus('Hold still for a moment to set your resting position.');return;}
     setMotionStatus('Tilt ready · gently rock your body back and forth.');move(result.value);
    });
    watchdog=setInterval(()=>{if(Date.now()-lastSample>1000){stop();setMotionStatus('Motion paused · tap Set resting position to retry.');}},1000);
   }catch{
    if(!disposed){stop();setMotionStatus('Tilt unavailable. Use the handle, or enable motion access in Settings.');setMode('touch');}
   }
  }
  begin();return()=>{disposed=true;subscription?.remove();clearInterval(watchdog);if(!touching.current)stop();};
 },[config,mode,foreground,calibration]);
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>listener.remove();},[]);
 const responder=PanResponder.create({
  onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:()=>true,
  onPanResponderGrant:()=>{touching.current=true;setMode('touch');angle.stopAnimation();start.current=position.current;},
  onPanResponderMove:(_,g)=>move(verticalPosition(start.current,g.dy,84)),
  onPanResponderRelease:()=>{touching.current=false;stop();},onPanResponderTerminate:()=>{touching.current=false;stop();}
 });
 const join=async()=>{
  const normalized=host.trim().replace(/\/$/,'');
  if(!/^https?:\/\/[a-zA-Z0-9.\-]+(?::\d+)?$/.test(normalized)){setStatus('Enter the laptop address, for example http://192.168.1.10:8787');return;}
  const c={host:normalized,seat};await AsyncStorage.setItem('config',JSON.stringify(c));epoch.current=null;setStatus('Connecting to the laptop…');setConfig(c);
 };
 const change=()=>{stop();setConfig(null);setReady(false);setSynced(false);setStatus('Choose a seat, then tap Join the sea.');AsyncStorage.removeItem('config');};
 return <SafeAreaView style={s.page}>
  <View style={s.header}><Text style={s.brand}>Sea’N’Sound</Text><Text style={s.small}>{config?`SEAT ${config.seat}`:'BY THE SEA'}</Text></View>
  {!config?<View style={s.setup}>
   <Text style={s.title}>Meet at the shore.</Text><Text style={s.body}>Join the laptop on the same Wi-Fi.</Text>
   <Text style={s.label}>Laptop address</Text><TextInput style={s.input} value={host} onChangeText={setHost} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.10:8787" accessibilityLabel="Laptop server address"/>
   <View style={s.row}>{['A','B'].map(id=><Pressable accessibilityRole="button" accessibilityState={{selected:seat===id}} key={id} onPress={()=>setSeat(id)} style={[s.button,s.seatButton,seat===id&&s.selected]}><Text style={seat===id?s.selectedText:s.buttonText}>Seat {id}</Text></Pressable>)}</View>
   <Pressable accessibilityRole="button" style={[s.button,s.join]} onPress={join}><Text style={s.selectedText}>Join the sea</Text></Pressable><Text style={s.body}>{status}</Text>
  </View>:<ScrollView contentContainerStyle={{flexGrow:1}}>
   <View pointerEvents="none" style={s.horizon}/>
   <Text style={s.kicker}>A MOMENT BY THE SEA</Text><Text style={s.title}>Find your rhythm.</Text>
   <Text style={s.instruction}>{mode==='tilt'?'Hold the phone against your chest, screen facing out. Gently rock forward and back.':'Slide the handle up and down to rock.'}</Text>
   <View style={s.controlRow}>{['tilt','touch'].map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:mode===value}} onPress={()=>{stop();setMode(value);}} style={[s.modeButton,mode===value&&s.selected]}><Text style={mode===value?s.selectedText:s.buttonText}>{value==='tilt'?'Body tilt':'Touch handle'}</Text></Pressable>)}</View>
   <Pressable accessibilityRole="button" onPress={()=>{stop();setMode('tilt');setCalibration(c=>c+1);}} style={s.calibrate}><Text style={s.footerText}>Set resting position</Text></Pressable>
   <Text style={s.motionStatus}>{mode==='tilt'||motionStatus.startsWith('Tilt unavailable')?motionStatus:'Touch mode · tap Body tilt to rock with your body.'}</Text>
   <View style={s.lightWrap}><Light mix={lightMix} individual={config.seat==='A'?'#f3a57c':'#9fb6f1'} synced={synced}/><Text style={s.rhythmText}>{synced?'In a shared rhythm':`Your own rhythm · Seat ${config.seat}`}</Text></View>
   <View style={s.scene}>
    <Seat angle={angle} width={seatWidth}/>
    <View style={s.sliderArea} {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`Seat ${config.seat} rocking handle. Slide up and down.`} accessibilityActions={[{name:'increment',label:'Rock back'},{name:'decrement',label:'Rock forward'}]} onAccessibilityAction={e=>{setMode('touch');angle.stopAnimation();move(Math.max(-1,Math.min(1,position.current+(e.nativeEvent.actionName==='increment'?0.35:-0.35))));}}>
     <Text style={s.arrow}>↑</Text><View style={s.track}><View style={s.centerMark}/><Animated.View style={[s.handle,{transform:[{translateY:angle.interpolate({inputRange:[-1,1],outputRange:[84,-84]})}]}]}><View style={s.grip}/><View style={s.grip}/><View style={s.grip}/></Animated.View></View><Text style={s.arrow}>↓</Text>
    </View>
   </View>
   <Text style={s.dragHint}>{mode==='tilt'?'BODY TILT · YOUR MOVEMENT':'UP & DOWN · YOUR MOVEMENT'}</Text>
   <Text accessibilityLiveRegion="polite" style={[s.status,!ready&&s.offline]}>{status}</Text>
   <View style={s.footer}><Pressable accessibilityRole="button" onPress={change} style={s.footerButton}><Text style={s.footerText}>Change connection</Text></Pressable><Pressable accessibilityRole="button" onPress={syncFeedback} style={s.footerButton}><Text style={s.footerText}>Test vibration</Text></Pressable></View>
  </ScrollView>}
 </SafeAreaView>;
}
const s=StyleSheet.create({
 controlRow:{flexDirection:'row',justifyContent:'center',gap:8},modeButton:{paddingHorizontal:18,paddingVertical:11,borderRadius:22,backgroundColor:'#f0efe3'},calibrate:{alignSelf:'center',padding:10,minHeight:44,justifyContent:'center'},motionStatus:{textAlign:'center',fontSize:12,lineHeight:17,paddingHorizontal:22,color:'#294f49',minHeight:34},page:{flex:1,backgroundColor:'#dce8df'},header:{paddingHorizontal:22,paddingTop:12,paddingBottom:8,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontFamily:'Georgia',fontSize:24,color:'#183f40'},small:{fontSize:10,color:'#365c58',letterSpacing:2},setup:{padding:26,gap:16},title:{fontFamily:'Georgia',fontSize:30,color:'#183f40',textAlign:'center',marginVertical:8},body:{color:'#294f49',fontSize:15,textAlign:'center',lineHeight:22},label:{color:'#294f49',fontSize:14},input:{padding:16,borderWidth:1,borderColor:'#78958b',borderRadius:12,backgroundColor:'#f5f3e8',fontSize:16},row:{flexDirection:'row',gap:12},button:{padding:18,backgroundColor:'#f0efe3',borderRadius:24,alignItems:'center',borderWidth:1,borderColor:'#718e82'},seatButton:{flex:1},selected:{backgroundColor:'#285951'},selectedText:{color:'#fffdf1',fontSize:16},buttonText:{color:'#285951',fontSize:16},join:{backgroundColor:'#285951'},kicker:{textAlign:'center',letterSpacing:3,fontSize:10,color:'#365c58',marginTop:4},instruction:{textAlign:'center',color:'#294f49',paddingHorizontal:16,paddingBottom:4,fontSize:16,lineHeight:23},horizon:{position:'absolute',top:'47%',left:0,right:0,bottom:0,backgroundColor:'#aacbc2',borderTopWidth:1,borderColor:'#739c95'},lightWrap:{alignItems:'center',marginTop:4},lightZone:{height:88,width:144,alignItems:'center',justifyContent:'center'},glowOuter:{position:'absolute',width:128,height:104,borderRadius:64,opacity:0.16},glowInner:{position:'absolute',width:96,height:88,borderRadius:48,opacity:0.27},light:{height:66,width:66,borderRadius:33,borderWidth:3,borderColor:'#fffdf0',shadowOpacity:0.8,shadowRadius:21,shadowOffset:{width:0,height:0}},rhythmText:{color:'#214c45',fontSize:16,fontWeight:'600',marginTop:-2},scene:{flex:1,minHeight:210,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:2,paddingLeft:8,paddingRight:10},sliderArea:{width:78,height:246,alignItems:'center',justifyContent:'center'},arrow:{fontSize:25,color:'#2b5a53',height:30,lineHeight:30},track:{height:216,width:18,borderRadius:12,backgroundColor:'#729e92',borderWidth:1,borderColor:'#5e8a7e',alignItems:'center',justifyContent:'center'},centerMark:{position:'absolute',height:2,width:32,backgroundColor:'#edf0da'},handle:{position:'absolute',width:58,height:46,borderRadius:23,backgroundColor:'#faf7e8',borderWidth:2,borderColor:'#3f7366',alignItems:'center',justifyContent:'center',gap:3,shadowColor:'#234d45',shadowOpacity:0.22,shadowRadius:8,shadowOffset:{width:0,height:3}},grip:{width:20,height:2,borderRadius:1,backgroundColor:'#638478'},dragHint:{textAlign:'center',letterSpacing:2,fontSize:9,color:'#2d5e52',paddingVertical:6},status:{textAlign:'center',fontSize:12,color:'#214e43',paddingHorizontal:20,paddingVertical:8,minHeight:34},offline:{color:'#7a4938'},footer:{flexDirection:'row',justifyContent:'center',gap:12,paddingBottom:6},footerButton:{paddingHorizontal:12,paddingVertical:13,minHeight:44},footerText:{fontSize:12,color:'#254f45',textDecorationLine:'underline'}
});
