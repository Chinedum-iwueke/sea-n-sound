import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {networkInterfaces} from 'node:os';
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {Rhythm,defaults} from './rhythm.js';
const rhythm=new Rhythm(), clients=new Map(), claims=new Map();
const adminKey=randomBytes(12).toString('hex');
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://local').pathname;const file=path==='/'||path==='/facilitator'||path==='/phone'?'index.html':path.slice(1);if(!['index.html','app.js','style.css','seat.svg'].includes(file)){res.writeHead(404).end();return;}const body=await readFile(new URL('../public/'+file,import.meta.url));res.setHeader('Content-Type',{'html':'text/html','js':'text/javascript','css':'text/css','svg':'image/svg+xml'}[file.split('.').pop()]);res.end(body);}catch{res.writeHead(404).end();}});
const wss=new WebSocketServer({server,maxPayload:4096});
const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
wss.on('connection',ws=>{ws.alive=true;ws.on('pong',()=>ws.alive=true);ws.on('message',raw=>{try{const m=JSON.parse(raw);if(m.type==='join'){
 const role=m.role;if(role==='display'||role==='admin'){if(role==='admin'&&m.key!==adminKey)return send(ws,{type:'error',message:'Facilitator key is incorrect.'});clients.set(ws,{role});return send(ws,{type:'state',...rhythm.snapshot()});}
 if(!['A','B'].includes(role)||typeof m.token!=='string'||m.token.length<8||m.token.length>100)return;
 const claim=claims.get(role);if(claim&&claim.token!==m.token)return send(ws,{type:'error',message:'This seat is paired. Ask the facilitator to release it.'});
 if(claim?.ws&&claim.ws!==ws)claim.ws.close();claims.set(role,{token:m.token,ws});clients.set(ws,{role});rhythm.seats[role].connected=true;send(ws,{type:'joined',seat:role});
 }else {const c=clients.get(ws);if(!c)return;if(m.type==='input'&&['A','B'].includes(c.role)&&claims.get(c.role)?.ws===ws&&Number.isFinite(m.x)&&typeof m.active==='boolean')rhythm.input(c.role,m.x,m.active,performance.now());
 if(['A','B'].includes(c.role)&&m.type==='cueAck'&&m.event===rhythm.syncEvent&&rhythm.synced)rhythm.seats[c.role].cueReceived=m.event;
 if(c.role==='admin'&&m.type==='reset'){rhythm.reset();for(const id of ['A','B'])rhythm.seats[id].connected=!!claims.get(id)?.ws;}
 if(c.role==='admin'&&m.type==='release'){for(const c of claims.values()){if(c.ws){send(c.ws,{type:'unpaired'});c.ws.close();}}claims.clear();rhythm.reset();}
 if(c.role==='admin'&&m.type==='settings'){for(const [k,min,max] of [['phaseMs',60,500],['periodTolerance',0.05,0.5],['graceMs',100,1200],['idleMs',200,1500]])if(Number.isFinite(m[k]))rhythm.settings[k]=Math.min(max,Math.max(min,m[k]));rhythm.clearMatch();}
 }}catch{send(ws,{type:'error',message:'Invalid message.'});}});ws.on('close',()=>{const c=clients.get(ws);clients.delete(ws);if(c&&claims.get(c.role)?.ws===ws){claims.get(c.role).ws=null;Object.assign(rhythm.seats[c.role],rhythm.empty());}});ws.on('error',()=>{});});
setInterval(()=>{const state={type:'state',...rhythm.tick(performance.now())};for(const ws of clients.keys())send(ws,state);},33);
setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},2000);
server.listen(Number(process.env.PORT)||8787,'0.0.0.0',()=>{const port=server.address().port;console.log(`Display: http://localhost:${port}`);console.log(`Facilitator: http://localhost:${port}/facilitator#${adminKey}`);for(const list of Object.values(networkInterfaces()))for(const i of list||[])if(i.family==='IPv4'&&!i.internal)console.log(`Phone server: http://${i.address}:${port}`);});
