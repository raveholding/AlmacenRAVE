/* ===================================================================================================
   V26.43 · CENTRO DE OPERACIONES VIVO — SVB R2AVE (sólo demo raveV3)
   · Escenario 2.5D propio en <canvas> (la CSP del sistema no admite librerías 3D externas): instalación tecnológica con
     coordinación central, estaciones individuales, sala de monitoreo, análisis, comunicaciones, laboratorio/hangar,
     descanso, pasarela elevada, columnas, pantallas holográficas gigantes, suelo reflectante y luces rojo/cian.
   · Los cuatro integrantes DE CUERPO COMPLETO, dibujados y animados en tiempo real con los colores y rasgos de la imagen
     oficial: R2AVE (humanoide con capucha, cráneo, cuernos y ojos rojos) camina y trabaja; M2ARGOTH (Cane Corso robótico)
     camina con marcha de cuatro patas, se sienta, se acuesta y olfatea; T2ULUZ (drone) vuela en altura con sombra en el piso;
     S2HAKIRA (perra holográfica) acompaña, mueve la cola, pulsa y se desmaterializa.
   · Comportamientos autónomos con navegación, aceleración, giro suave y separación (sin teletransportes).
   · REGLA DE VERDAD: cada actividad se rotula «Real» (viene de un dato o una operación del sistema: alertas, consultas,
     pedidos de compra, ajustes de R2AVE) o «Simulación» (animación ambiental). Una animación nunca es una operación.
   · Sólo lee datos. Se pausa fuera de la pantalla y con «reducir movimiento»; si algo falla, CI.safe lo ataja.
   =================================================================================================== */
(function(){'use strict';if(typeof CI==='undefined'||!CI||!CI.safe||!CI.r2)return;
const safe=CI.safe;const E=v=>typeof esc==='function'?esc(v):String(v);const $m=c=>typeof money==='function'?money(c):String(c);
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}};
const W=24,D=16,CX=W/2,CY=D/2;
/* ---------- escenario: estaciones y obstáculos (unidades = metros aproximados de la escena, no del local) ---------- */
const ST={
 coord:{n:'Centro de coordinación',x:12,y:8.2,r:2.1,c:'#ff3b3b'},
 r2:{n:'Estación de R2AVE',x:6,y:4,r:1.1,c:'#ff3b3b',face:[0,1]},
 mon:{n:'Sala de monitoreo',x:18.5,y:3.6,r:1.3,c:'#ff5a3c',face:[0,1]},
 ana:{n:'Área de análisis',x:5.2,y:12,r:1.1,c:'#36e3d2'},
 lab:{n:'Laboratorio y hangar del drone',x:19,y:12.2,r:1.2,c:'#ff8a3d'},
 com:{n:'Centro de comunicaciones',x:12,y:2.3,r:0.8,c:'#4aa8ff'},
 rest:{n:'Zona de descanso',x:2.4,y:7.6,r:1.0,c:'#36e3d2'}};
const PILLARS=[[1,1],[23,1],[1,15],[23,15],[9,1],[15,1]];
const OBST=Object.entries(ST).filter(([k])=>k!=='coord').map(([k,s])=>({k,x:s.x,y:s.y,r:s.r})).concat(PILLARS.map(p=>({k:'pil',x:p[0],y:p[1],r:0.45})));
const SPOT={/* lugares de trabajo frente a cada estación */
 r2:[6,5.5],mon:[18.5,5.2],ana:[6.6,12.6],lab:[17.6,12.8],com:[12,3.6],rest:[3.6,8.6],coord:[12,10.6]};
/* ---------- integrantes: parámetros de movimiento y estado ---------- */
const mk=(k,x,y,sp)=>({k,x,y,z:0,vx:0,vy:0,a:0,ph:0,sp,st:'idle',t:0,tgt:null,act:'',real:false,pose:'stand',wag:0,alpha:1,sit:0,talk:0,point:0,work:0,beam:0,hp:0});
const CH={r2ave:mk('r2ave',6,5.6,1.35),m2argoth:mk('m2argoth',8,6.5,2.1),s2hakira:mk('s2hakira',7.2,6.2,1.7),t2uluz:mk('t2uluz',18,12.6,2.8)};
CH.t2uluz.z=0.35;
const NAME={r2ave:'R2AVE',m2argoth:'M2ARGOTH',s2hakira:'S2HAKIRA',t2uluz:'T2ULUZ'};
const COL={r2ave:'#ff3b3b',m2argoth:'#ff4d3d',s2hakira:'#5ee0d0',t2uluz:'#ff6a3d'};
const TXT={r2ave:'#ff8a7f',m2argoth:'#ff9a8c',s2hakira:'#5ee0d0',t2uluz:'#ffa27a'};/* colores de texto legibles sobre fondo oscuro */
const V={th:-0.45,zoom:1,panX:0,panY:0,follow:'',focus:'',drag:null,last:0,acc:0,raf:0,seen:false,fps:0,real:{},sum:'',sumAt:0,events:{chat:0,adj:0}};
CI.vivo={CH,ST,V};
/* ---------- datos reales que mueven a los personajes (sólo lectura) ---------- */
function realData(){return safe(()=>{const d=CI.data();const al=CI.r2.alerts();const imp=al.filter(a=>a.pri==='critica'||a.pri==='importante');
 const po=(S.pOrders||[]).filter(o=>o.estado==='Solicitada').length;const adj=(S.audit||[]).filter(a=>a.action==='R2AVE_AJUSTE');const lastAdj=adj.length?adj[adj.length-1]:null;
 return{tot:d.tot,n:d.n,low:d.lowAll.length,neg:d.negAll.length,imp:imp.length,crit:al.filter(a=>a.pri==='critica').length,opp:al.filter(a=>a.pri==='oportunidad').length,po,chat:(CI.st.chat||[]).length,lastAdj};},{tot:0,n:0,low:0,neg:0,imp:0,crit:0,opp:0,po:0,chat:0,lastAdj:null},'datos vivos');}
/* ---------- navegación: aceleración, giro suave, separación y rodeo de obstáculos ---------- */
function steer(c,tx,ty,dt,fly){const dx=tx-c.x,dy=ty-c.y;const dist=Math.hypot(dx,dy);let ax=0,ay=0;
 if(dist>0.05){const want=c.sp*Math.min(1,dist/1.3);ax=dx/dist*want;ay=dy/dist*want;}
 if(!fly){OBST.forEach(o=>{const ox=c.x-o.x,oy=c.y-o.y,od=Math.hypot(ox,oy),lim=o.r+0.55;if(od<lim+0.6&&od>0.001){const f=(lim+0.6-od)/(lim+0.6)*c.sp*1.6;ax+=ox/od*f;ay+=oy/od*f;
   /* rodeo: empujón lateral para no quedarse trabado de frente */const cr=dx*oy-dy*ox;ax+=(cr>0?-oy:oy)/od*f*0.6;ay+=(cr>0?ox:-ox)/od*f*0.6;}});
  Object.values(CH).forEach(o=>{if(o===c||o.k==='t2uluz')return;const ox=c.x-o.x,oy=c.y-o.y,od=Math.hypot(ox,oy);if(od<0.9&&od>0.001){ax+=ox/od*(0.9-od)*3;ay+=oy/od*(0.9-od)*3;}});}
 const k=Math.min(1,dt*3.2);c.vx+=(ax-c.vx)*k;c.vy+=(ay-c.vy)*k;c.x+=c.vx*dt;c.y+=c.vy*dt;
 c.x=Math.min(W-0.6,Math.max(0.6,c.x));c.y=Math.min(D-0.6,Math.max(0.6,c.y));
 const sp=Math.hypot(c.vx,c.vy);if(sp>0.08){const ta=Math.atan2(c.vy,c.vx);let da=ta-c.a;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;c.a+=da*Math.min(1,dt*6);}
 c.ph+=sp*dt*(c.k==='r2ave'?3.2:4.6);return dist;}
const near=(c,x,y,r)=>Math.hypot(c.x-x,c.y-y)<(r||0.35);
const setAct=(c,txt,real)=>{c.act=txt;c.real=!!real;};
/* ---------- comportamientos ---------- */
const rnd=(a,b)=>a+Math.random()*(b-a);
function brainR2(c,R,dt){c.t-=dt;
 if(R.chat>V.events.chat){V.events.chat=R.chat;c.st='answer';c.tgt=SPOT.coord;c.t=9;setAct(c,'Respondiendo tu consulta',true);}
 if(R.lastAdj&&R.lastAdj.ts>V.events.adj){V.events.adj=R.lastAdj.ts;if(V.events.adjInit){c.st='adjust';c.tgt=SPOT.r2;c.t=10;setAct(c,'Corrección de stock registrada (auditoría)',true);}}
 V.events.adjInit=1;
 if(c.t<=0){const opts=[['work','r2','Analizando información en su estación'],['coord','coord','Coordinando al equipo'],['inspect','mon','Inspeccionando la sala de monitoreo'],['inspect','ana','Revisando el área de análisis'],['inspect','lab','Inspeccionando el laboratorio'],['inspect','com','Revisando comunicaciones']];
  const o=opts[Math.floor(Math.random()*opts.length)];c.st=o[0];c.tgt=SPOT[o[1]];c.t=rnd(9,15);setAct(c,o[2],false);
  if(R.imp&&Math.random()<0.5){c.st='inspect';c.tgt=SPOT.mon;setAct(c,'Revisando '+R.imp+' alerta(s) con M2ARGOTH',true);}}
 const dd=steer(c,c.tgt?c.tgt[0]:c.x,c.tgt?c.tgt[1]:c.y,dt);const arrived=dd<0.3;
 c.work+=((arrived&&(c.st==='work'||c.st==='adjust'))?1:-1)*dt*3;c.point+=((arrived&&(c.st==='coord'||c.st==='inspect'||c.st==='answer'))?1:-1)*dt*3;c.talk=(arrived&&c.st==='answer')?1:Math.max(0,c.talk-dt);
 c.work=Math.min(1,Math.max(0,c.work));c.point=Math.min(1,Math.max(0,c.point));
 if(arrived){const fx=c.st==='coord'||c.st==='answer'?ST.coord:(c.st==='inspect'?ST[Object.keys(SPOT).find(k=>SPOT[k]===c.tgt)]||ST.coord:ST.r2);if(fx){const ta=Math.atan2(fx.y-c.y,fx.x-c.x);let da=ta-c.a;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;c.a+=da*Math.min(1,dt*4);}}}
function brainM2(c,R,dt){c.t-=dt;const r2=CH.r2ave;
 if(R.imp){if(c.st!=='guard'){c.st='guard';c.t=rnd(12,20);}setAct(c,'Vigilando '+R.imp+' alerta(s) en el monitoreo',true);const dd=steer(c,SPOT.mon[0]+0.9,SPOT.mon[1]+0.6,dt);c.pose=dd<0.3?'sit':'walk';
  if(c.t<=0&&Math.hypot(r2.vx,r2.vy)>0.3){c.st='follow';c.t=rnd(8,12);}if(c.st==='guard')return;}
 if(c.t<=0){const r=Math.random();if(r<0.45){c.st='follow';c.t=rnd(10,16);}else if(r<0.75){c.st='patrol';c.t=rnd(10,14);c.tgt=[rnd(2,22),rnd(2,14)];}else{c.st='rest';c.t=rnd(8,12);c.tgt=[SPOT.rest[0]+0.8,SPOT.rest[1]-0.4];}}
 let dd;if(c.st==='follow'){const ca=Math.cos(r2.a),sa=Math.sin(r2.a);const bx=r2.x-ca*1.4+sa*0.7,by=r2.y-sa*1.4-ca*0.7;dd=steer(c,bx,by,dt);setAct(c,'Acompañando a R2AVE',false);}
 else if(c.st==='patrol'){dd=steer(c,c.tgt[0],c.tgt[1],dt);if(dd<0.4)c.tgt=[rnd(2,22),rnd(2,14)];setAct(c,'Patrullando el centro',false);}
 else{dd=steer(c,c.tgt[0],c.tgt[1],dt);setAct(c,'Descansando cerca de la zona de descanso',false);}
 const moving=Math.hypot(c.vx,c.vy)>0.18;c.pose=moving?'walk':(c.st==='rest'&&dd<0.4?'lie':(c.st==='patrol'&&Math.sin(V.last/700)>0.6?'sniff':'sit'));}
function brainS2(c,R,dt){c.t-=dt;const r2=CH.r2ave,m2=CH.m2argoth;
 if(c.t<=0){c.st=Math.random()<0.25&&Math.hypot(m2.x-c.x,m2.y-c.y)<6?'greet':'follow';c.t=c.st==='greet'?rnd(5,7):rnd(10,18);}
 let dd;if(c.st==='greet'){const ta=Math.atan2(m2.y-c.y,m2.x-c.x);dd=steer(c,m2.x-Math.cos(ta)*1.1,m2.y-Math.sin(ta)*1.1,dt);if(dd<0.4){let da=ta-c.a;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;c.a+=da*Math.min(1,dt*4);c.wag=1;}setAct(c,'Jugando con M2ARGOTH',false);}
 else{const ca=Math.cos(r2.a),sa=Math.sin(r2.a);dd=steer(c,r2.x-ca*0.6-sa*1.0,r2.y-sa*0.6+ca*1.0,dt);setAct(c,R.opp?'Junto a R2AVE · '+R.opp+' oportunidad(es) para revisar':'Acompañando a R2AVE',!!R.opp);}
 const moving=Math.hypot(c.vx,c.vy)>0.15;c.pose=moving?'walk':'sit';
 /* pulso holográfico y desmaterialización parcial ocasional */
 c.hp=(c.hp+dt*1.4)%1;const fl=Math.sin(V.last/900)+Math.sin(V.last/337);c.alpha=fl>1.75?0.35:0.92;}
function brainT2(c,R,dt){c.t-=dt;const r2=CH.r2ave;
 if(c.t<=0){if(R.po&&Math.random()<0.5){c.st='recep';c.t=rnd(9,13);}else{const r=Math.random();c.st=r<0.35?'project':r<0.65?'scan':r<0.8?'land':'tour';c.t=rnd(8,13);c.tgt=c.st==='scan'?[rnd(3,21),rnd(3,13)]:null;}}
 let tx,ty,tz=2.2;
 if(c.st==='project'){tx=r2.x+0.6;ty=r2.y-0.5;tz=2.4;setAct(c,'Proyectando datos para R2AVE',false);}
 else if(c.st==='recep'){tx=SPOT.lab[0];ty=SPOT.lab[1]-1;tz=1.8;setAct(c,R.po+' pedido(s) de compra esperan recepción',true);}
 else if(c.st==='land'){tx=ST.lab.x;ty=ST.lab.y;tz=Math.abs(c.x-tx)+Math.abs(c.y-ty)<0.4?0.35:2;setAct(c,tz<1?'Aterrizado en su plataforma (carga)':'Volviendo al hangar',false);}
 else if(c.st==='tour'){const tt=V.last/4000;tx=CX+Math.cos(tt)*8;ty=CY+Math.sin(tt)*5;tz=3;setAct(c,'Recorriendo la instalación',false);}
 else{if(!c.tgt||Math.hypot(c.tgt[0]-c.x,c.tgt[1]-c.y)<0.5)c.tgt=[rnd(3,21),rnd(3,13)];tx=c.tgt[0];ty=c.tgt[1];tz=2.6;setAct(c,'Inspeccionando sectores',false);}
 steer(c,tx,ty,dt,true);const hov=Math.sin(V.last/420)*0.08;c.z+=((tz+hov)-c.z)*Math.min(1,dt*1.5);c.beam+=((c.st==='project'&&Math.hypot(tx-c.x,ty-c.y)<0.6?1:0)-c.beam)*Math.min(1,dt*3);}
/* reunión de coordinación ambiental (cada tanto los cuatro se juntan en el centro) */
function meeting(dt){V.meet=(V.meet||0)+dt;if(V.meet>75&&V.meet<84){const r2=CH.r2ave;if(r2.st!=='answer'){r2.st='coord';r2.tgt=SPOT.coord;r2.t=Math.max(r2.t,2);setAct(r2,'Reunión de coordinación con el equipo',false);}}if(V.meet>=84)V.meet=0;}
function tick(dt){const R=realData();V.real=R;brainR2(CH.r2ave,R,dt);brainM2(CH.m2argoth,R,dt);brainS2(CH.s2hakira,R,dt);brainT2(CH.t2uluz,R,dt);meeting(dt);
 const r2=CH.r2ave;r2.pose=Math.hypot(r2.vx,r2.vy)>0.12?'walk':'stand';Object.values(CH).forEach(c=>{c.wag=Math.max(0,c.wag-dt*0.4);});}
CI.vivo.tick=tick;
/* ---------- proyección: cámara orbital isométrica con zoom, paneo y seguimiento ---------- */
function cam(cv){const w=cv.clientWidth,h=cv.clientHeight;const C=Math.cos(V.th),Sn=Math.sin(V.th);
 const base=Math.min(w/(W*0.95+D*0.95),h/(W*0.55+D*0.55+4))*1.08;const k=base*V.zoom;
 let fx=CX,fy=CY,fz=0;if(V.follow&&CH[V.follow]){fx=CH[V.follow].x;fy=CH[V.follow].y;fz=V.follow==='t2uluz'?CH.t2uluz.z:0.9;}else if(V.focus&&ST[V.focus]){fx=ST[V.focus].x;fy=ST[V.focus].y;}
 V.cfx=(V.cfx==null?fx:V.cfx+(fx-V.cfx)*0.08);V.cfy=(V.cfy==null?fy:V.cfy+(fy-V.cfy)*0.08);V.cfz=(V.cfz==null?fz:V.cfz+(fz-V.cfz)*0.08);
 const P=(x,y,z)=>{const u=(x-V.cfx)*C-(y-V.cfy)*Sn,v=(x-V.cfx)*Sn+(y-V.cfy)*C;return[w/2+V.panX+(u-v)*0.866*k,h*0.56+V.panY+(u+v)*0.5*k-((z||0)-V.cfz)*k];};
 const depth=(x,y)=>{const u=(x-V.cfx)*C-(y-V.cfy)*Sn,v=(x-V.cfx)*Sn+(y-V.cfy)*C;return u+v;};
 return{P,depth,k,w,h};}
/* ---------- primitivas ---------- */
function shade(hex,f){const n=parseInt(String(hex).slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const t=f<0?0:255,p=Math.abs(f);r=Math.round((t-r)*p+r);g=Math.round((t-g)*p+g);b=Math.round((t-b)*p+b);return'rgb('+r+','+g+','+b+')';}
function poly(ctx,pts,fill,stroke,lw){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}}
function box(ctx,G,x,y,w,d,z0,h,c,em){const P=G.P;const cs=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]];const b=cs.map(p=>P(p[0],p[1],z0)),t=cs.map(p=>P(p[0],p[1],z0+h));
 const faces=[0,1,2,3].map(i=>{const j=(i+1)%4;const mx=(cs[i][0]+cs[j][0])/2,my=(cs[i][1]+cs[j][1])/2;return{i,j,dp:G.depth(mx,my)};}).sort((a,b2)=>a.dp-b2.dp);
 faces.forEach((f,n)=>poly(ctx,[b[f.i],b[f.j],t[f.j],t[f.i]],shade(c,n%2?-0.45:-0.25),'rgba(0,0,0,.35)'));poly(ctx,t,shade(c,0.08),em||'rgba(255,255,255,.06)',em?1.5:1);return t;}
function disc(ctx,G,x,y,z,r,fill,stroke,lw,n){const P=G.P;const pts=[];n=n||28;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;pts.push(P(x+Math.cos(a)*r,y+Math.sin(a)*r,z));}poly(ctx,pts,fill,stroke,lw);return pts;}
function glow(ctx,x,y,r,col,a){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col.replace('A',a));g.addColorStop(1,col.replace('A',0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();}
const RED='rgba(255,48,48,A)',CYAN='rgba(70,230,215,A)',ORANGE='rgba(255,140,60,A)',BLUE='rgba(80,160,255,A)';
/* ---------- personajes de cuerpo completo (pantalla; u = px por metro de escena) ---------- */
function screenDir(G,c){const a=G.P(c.x,c.y,0),b=G.P(c.x+Math.cos(c.a),c.y+Math.sin(c.a),0);return{fx:b[0]>=a[0]?1:-1,front:b[1]>=a[1]};}
function drawR2(ctx,x0,y0,u,c,dir,t){const walk=c.pose==='walk'?1:0;const sw=Math.sin(c.ph)*0.55*walk;const f=dir.fx;
 ctx.save();ctx.translate(x0,y0);ctx.scale(f,1);
 /* piernas articuladas */const leg=(s,dk)=>{const hip=[0.1*u*s,-0.98*u];const ka=sw*s,kn=[hip[0]+Math.sin(ka)*0.48*u,hip[1]+Math.cos(ka)*0.48*u];const sa=ka-Math.max(0,-sw*s)*0.9,ft=[kn[0]+Math.sin(sa)*0.48*u,kn[1]+Math.cos(sa)*0.48*u];
  ctx.strokeStyle=dk?'#121216':'#26262c';ctx.lineWidth=0.13*u;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(hip[0],hip[1]);ctx.lineTo(kn[0],kn[1]);ctx.lineTo(ft[0],ft[1]);ctx.stroke();
  ctx.fillStyle='#ff3030';ctx.beginPath();ctx.arc(kn[0],kn[1],0.04*u,0,7);ctx.fill();ctx.fillStyle='#3a3a42';ctx.beginPath();ctx.ellipse(ft[0]+0.07*u,ft[1],0.12*u,0.045*u,0,0,7);ctx.fill();};
 leg(-1,true);leg(1,false);
 /* túnica rasgada con humo rojo */const sway=Math.sin(c.ph*0.5)*0.05*u*walk+Math.sin(t/700)*0.02*u;
 const g=ctx.createLinearGradient(0,-1.7*u,0,-0.3*u);g.addColorStop(0,'#1a1a1e');g.addColorStop(1,'#0b0b0d');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-0.3*u,-1.62*u);ctx.lineTo(0.3*u,-1.62*u);
 const hem=[0.42,0.3,0.36,0.22,0.3,0.12,0.2,0.02,0.1,-0.1,0.02,-0.2,-0.08,-0.32,-0.16,-0.42];ctx.lineTo(0.44*u+sway,-0.42*u);for(let i=0;i<hem.length;i+=2)ctx.lineTo(hem[i]*u+sway,(-0.42+((i/2)%2?0.12:0))*u);ctx.lineTo(-0.44*u+sway,-0.42*u);ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(255,40,40,.55)';ctx.lineWidth=1.2;ctx.stroke();
 ctx.strokeStyle='rgba(255,40,40,.22)';ctx.lineWidth=0.05*u;for(let i=0;i<3;i++){const ox=(i-1)*0.25*u;ctx.beginPath();ctx.moveTo(ox,-0.5*u);ctx.quadraticCurveTo(ox+Math.sin(t/500+i)*0.25*u,-0.3*u,ox+Math.sin(t/400+i*2)*0.3*u,-0.05*u);ctx.stroke();}
 /* pecho con placa R2AVE */ctx.fillStyle='#2b2b31';ctx.fillRect(-0.16*u,-1.5*u,0.32*u,0.36*u);ctx.fillStyle='#ff3030';ctx.fillRect(-0.12*u,-1.26*u,0.24*u,0.035*u);
 /* brazos: caminar, trabajar en el panel, señalar, gesticular al hablar */
 const arm=(s,back)=>{const sh=[0.27*u*s,-1.52*u];let a1=-sw*s*0.8,a2=0.2;
  if(s>0&&c.work>0.01){a1=-1.2*c.work+Math.sin(t/180)*0.15*c.work;a2=-0.6*c.work;}
  if(s>0&&c.point>0.01){a1=-2.1*c.point;a2=0.05;}
  if(s<0&&c.talk>0.01){a1=-0.9+Math.sin(t/220)*0.4;a2=-0.8;}
  const el=[sh[0]+Math.sin(a1)*0.4*u*(s>0?1:1),sh[1]+Math.cos(a1)*0.4*u],hd=[el[0]+Math.sin(a1+a2)*0.38*u,el[1]+Math.cos(a1+a2)*0.38*u];
  ctx.strokeStyle=back?'#111114':'#1d1d22';ctx.lineWidth=0.14*u;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(sh[0],sh[1]);ctx.lineTo(el[0],el[1]);ctx.lineTo(hd[0],hd[1]);ctx.stroke();
  ctx.strokeStyle='#b9b9c0';ctx.lineWidth=0.025*u;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(hd[0],hd[1]);ctx.lineTo(hd[0]+Math.sin(a1+a2+i*0.3)*0.12*u,hd[1]+Math.cos(a1+a2+i*0.3)*0.12*u);ctx.stroke();}
  if(s>0&&c.point>0.5){glow(ctx,hd[0],hd[1],0.25*u,RED,0.5*c.point);}};
 arm(-1,true);arm(1,false);
 /* capucha, cráneo, cuernos y ojos rojos */const hx=0.02*u,hy=-1.86*u;
 ctx.fillStyle='#141417';ctx.beginPath();ctx.moveTo(hx-0.34*u,hy+0.32*u);ctx.quadraticCurveTo(hx-0.36*u,hy-0.34*u,hx,hy-0.42*u);ctx.quadraticCurveTo(hx+0.36*u,hy-0.34*u,hx+0.34*u,hy+0.32*u);ctx.closePath();ctx.fill();
 if(dir.front){const sg=ctx.createRadialGradient(hx+0.04*u,hy,0.02*u,hx,hy,0.22*u);sg.addColorStop(0,'#9a9aa3');sg.addColorStop(1,'#3d3d44');ctx.fillStyle=sg;ctx.beginPath();ctx.ellipse(hx+0.03*u,hy,0.16*u,0.2*u,0,0,7);ctx.fill();
  ctx.fillStyle='#1a1a1e';ctx.fillRect(hx-0.06*u,hy+0.1*u,0.2*u,0.07*u);ctx.strokeStyle='#8c8c95';ctx.lineWidth=0.012*u;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(hx-0.05*u+i*0.045*u,hy+0.1*u);ctx.lineTo(hx-0.05*u+i*0.045*u,hy+0.17*u);ctx.stroke();}
  ctx.save();ctx.shadowColor='#ff2020';ctx.shadowBlur=0.25*u;ctx.fillStyle='#ff2a2a';ctx.beginPath();ctx.arc(hx-0.03*u,hy-0.02*u,0.035*u,0,7);ctx.arc(hx+0.11*u,hy-0.02*u,0.035*u,0,7);ctx.fill();ctx.restore();}
 const horn=s=>{ctx.strokeStyle='#c9ccd4';ctx.lineWidth=0.06*u;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(hx+s*0.17*u,hy-0.26*u);ctx.quadraticCurveTo(hx+s*0.36*u,hy-0.42*u,hx+s*0.27*u,hy-0.62*u);ctx.stroke();ctx.strokeStyle='#5c5e66';ctx.lineWidth=0.02*u;ctx.stroke();};horn(-1);horn(1);
 ctx.restore();}
function drawDog(ctx,x0,y0,u,c,dir,t,holo){const f=dir.fx;const walk=c.pose==='walk'?1:0;const sit=c.pose==='sit',lie=c.pose==='lie',sniff=c.pose==='sniff';
 const body=holo?{L:0.9,H:0.3,leg:0.42}:{L:1.0,H:0.4,leg:0.4};const s=holo?0.95:1.08;u*=s;
 ctx.save();ctx.translate(x0,y0);ctx.scale(f,1);
 if(holo){ctx.globalAlpha=c.alpha;}
 const legH=lie?0.1:body.leg;const by=-(legH+body.H/2)*u;const tilt=sit?-0.42:0;
 const fill=holo?'rgba(70,230,215,.45)':'#17171b',edge=holo?'rgba(150,255,245,.95)':'#3b3b44',accent=holo?'rgba(150,255,245,.7)':'#c4202a';
 /* patas: marcha diagonal (delantera cercana con trasera lejana) */
 const legDraw=(xo,phase,far,rear)=>{let a=Math.sin(c.ph+phase)*0.5*walk;let len=body.leg*u;let hipY=by+body.H*0.3*u;
  if(rear&&sit){ctx.strokeStyle=far?shade('#202026',0):'#1c1c21';if(holo)ctx.strokeStyle=edge;ctx.lineWidth=0.12*u;ctx.beginPath();ctx.moveTo(xo*u,by+0.2*u);ctx.lineTo(xo*u+0.18*u,-0.06*u);ctx.lineTo(xo*u-0.05*u,-0.02*u);ctx.stroke();return;}
  if(lie){ctx.strokeStyle=holo?edge:'#1c1c21';ctx.lineWidth=0.1*u;ctx.beginPath();ctx.moveTo(xo*u,by);ctx.lineTo(xo*u+(rear?-0.1:0.32)*u,-0.03*u);ctx.stroke();return;}
  const kn=[xo*u+Math.sin(a)*len*0.5,hipY+Math.cos(a)*len*0.5],pw=[kn[0]+Math.sin(a*(rear?1.4:0.4))*len*0.5,kn[1]+len*0.5*Math.cos(a*0.4)];
  ctx.strokeStyle=holo?(far?'rgba(120,240,230,.5)':edge):(far?'#101013':'#1e1e23');ctx.lineWidth=(far?0.1:0.12)*u;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(xo*u,hipY);ctx.lineTo(kn[0],kn[1]);ctx.lineTo(pw[0],Math.min(pw[1],0));ctx.stroke();
  if(!holo&&!far){ctx.fillStyle=accent;ctx.fillRect(kn[0]-0.05*u,kn[1]-0.08*u,0.1*u,0.12*u);}
  ctx.fillStyle=holo?edge:'#26262c';ctx.beginPath();ctx.ellipse(pw[0]+0.04*u,Math.min(pw[1],0),0.07*u,0.035*u,0,0,7);ctx.fill();};
 legDraw(0.36,Math.PI,true,false);legDraw(-0.34,0,true,true);
 /* cola */const wag=Math.sin(t/(c.wag>0.2?90:260))*(c.wag>0.2?0.6:0.25);ctx.strokeStyle=holo?edge:'#1e1e23';ctx.lineWidth=(holo?0.09:0.07)*u;ctx.lineCap='round';ctx.beginPath();
 const tx=-body.L/2*u,ty=by-body.H*0.2*u+(sit?0.2*u:0);ctx.moveTo(tx,ty);if(holo){ctx.quadraticCurveTo(tx-0.35*u,ty-0.1*u+wag*0.2*u,tx-0.42*u,ty-0.4*u+wag*0.15*u);}else ctx.lineTo(tx-0.16*u,ty-0.14*u+wag*0.08*u);ctx.stroke();
 /* torso con armadura (M2ARGOTH) u holograma (S2HAKIRA) */
 ctx.save();ctx.translate(0,by);ctx.rotate(tilt);if(holo){ctx.shadowColor='#5ee0d0';ctx.shadowBlur=0.4*u;}ctx.fillStyle=fill;ctx.strokeStyle=edge;ctx.lineWidth=holo?1.6:1;
 ctx.beginPath();ctx.ellipse(0,0,body.L/2*u,body.H/2*u,0,0,7);ctx.fill();ctx.stroke();
 if(!holo){ctx.fillStyle='#b81d26';ctx.beginPath();ctx.ellipse(0.28*u,-0.02*u,0.2*u,0.15*u,0.2,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(-0.3*u,-0.04*u,0.17*u,0.13*u,-0.2,0,7);ctx.fill();
  ctx.fillStyle='#8f151c';for(let i=0;i<6;i++){const xx=-0.32*u+i*0.12*u;ctx.beginPath();ctx.moveTo(xx,-body.H/2*u+0.02*u);ctx.lineTo(xx+0.05*u,-body.H/2*u-0.1*u);ctx.lineTo(xx+0.1*u,-body.H/2*u+0.02*u);ctx.fill();}
  ctx.strokeStyle='#4a4a52';ctx.lineWidth=0.012*u;ctx.beginPath();ctx.moveTo(-0.4*u,0.05*u);ctx.lineTo(0.4*u,0.05*u);ctx.stroke();}
 else{ctx.save();ctx.clip();ctx.strokeStyle='rgba(180,255,250,.25)';ctx.lineWidth=1;for(let yy=-body.H*u;yy<body.H*u;yy+=3){ctx.beginPath();ctx.moveTo(-body.L*u,yy+((t/40)%3));ctx.lineTo(body.L*u,yy+((t/40)%3));ctx.stroke();}ctx.restore();}
 ctx.restore();
 legDraw(0.3,0,false,false);legDraw(-0.3,Math.PI,false,true);
 /* cabeza: hocico cuadrado de Cane Corso u hocico fino de la perra, orejas, ojos */
 const hx=body.L/2*u+0.05*u,hy=by-body.H*0.55*u+(sit?-0.22*u:0)+(sniff?0.3*u:0)+(lie?0.08*u:0)+Math.sin(t/600)*0.01*u;
 ctx.fillStyle=fill;ctx.strokeStyle=edge;ctx.lineWidth=holo?1.6:1;
 ctx.beginPath();ctx.moveTo(hx-0.12*u,hy+0.12*u);ctx.lineTo(hx-0.08*u,hy-0.12*u);ctx.lineTo(hx+0.14*u,hy-0.12*u);ctx.lineTo(hx+(holo?0.32:0.3)*u,hy-0.02*u);ctx.lineTo(hx+(holo?0.32:0.3)*u,hy+(holo?0.05:0.1)*u);ctx.lineTo(hx+0.1*u,hy+0.14*u);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.moveTo(hx-0.04*u,hy-0.11*u);ctx.lineTo(hx-0.0*u,hy-(holo?0.33:0.3)*u);ctx.lineTo(hx+0.06*u,hy-0.11*u);ctx.closePath();ctx.fill();ctx.stroke();
 if(!holo){ctx.fillStyle='#b81d26';ctx.fillRect(hx-0.06*u,hy-0.09*u,0.16*u,0.04*u);ctx.fillStyle='#0b0b0d';ctx.fillRect(hx+0.22*u,hy+0.02*u,0.08*u,0.05*u);}
 ctx.save();ctx.shadowColor=holo?'#7ff6ea':'#ff2020';ctx.shadowBlur=0.3*u;ctx.fillStyle=holo?'#d8fffb':'#ff2a2a';ctx.beginPath();ctx.arc(hx+0.1*u,hy-0.04*u,0.035*u,0,7);ctx.fill();ctx.restore();
 ctx.restore();
 if(holo&&(sit||lie)){ctx.save();ctx.globalAlpha=0.5+0.4*Math.sin(c.hp*Math.PI*2);ctx.strokeStyle='#5ee0d0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x0,y0,0.5*u*(0.8+c.hp*0.4),0.16*u*(0.8+c.hp*0.4),0,0,7);ctx.stroke();ctx.restore();}}
function drawDrone(ctx,x0,y0,u,c,dir,t,gy){/* sombra en el piso según altura */ctx.save();ctx.globalAlpha=Math.max(0.12,0.5-c.z*0.1);ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(x0,gy,0.45*u*(1+c.z*0.08),0.16*u*(1+c.z*0.08),0,0,7);ctx.fill();ctx.restore();
 const f=dir.fx;ctx.save();ctx.translate(x0,y0);
 /* rotores (giran) */const rot=t/30;[[-0.55,0.02],[0.55,0.02]].forEach(([rx,ry],i)=>{ctx.fillStyle='#16161a';ctx.beginPath();ctx.ellipse(rx*u,ry*u,0.2*u,0.09*u,0,0,7);ctx.fill();ctx.strokeStyle='#e0632f';ctx.lineWidth=1.5;ctx.stroke();
  ctx.strokeStyle='rgba(220,220,230,.35)';ctx.lineWidth=0.02*u;ctx.beginPath();ctx.ellipse(rx*u,ry*u-0.06*u,0.22*u*Math.abs(Math.cos(rot+i)),0.04*u,0,0,7);ctx.stroke();});
 /* cuerpo y domo rojo y negro */const g=ctx.createLinearGradient(0,-0.5*u,0,0.2*u);g.addColorStop(0,'#2a2a30');g.addColorStop(1,'#0e0e11');ctx.fillStyle=g;
 ctx.beginPath();ctx.moveTo(-0.38*u,-0.05*u);ctx.lineTo(0.38*u,-0.05*u);ctx.lineTo(0.3*u,0.18*u);ctx.lineTo(-0.3*u,0.18*u);ctx.closePath();ctx.fill();
 ctx.fillStyle='#16161a';ctx.beginPath();ctx.arc(0,-0.05*u,0.38*u,Math.PI,0);ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(0,-0.05*u,0.38*u,Math.PI,0);ctx.clip();ctx.fillStyle='#a31822';[[-0.3,-0.22,0.18,0.1],[0.02,-0.3,0.2,0.12],[-0.12,-0.4,0.22,0.07],[0.2,-0.15,0.14,0.09]].forEach(r=>ctx.fillRect(r[0]*u,r[1]*u,r[2]*u,r[3]*u));ctx.fillStyle='#c22630';ctx.fillRect(-0.4*u,-0.1*u,0.8*u,0.045*u);ctx.restore();
 ctx.strokeStyle='#e0632f';ctx.lineWidth=0.02*u;ctx.beginPath();ctx.moveTo(-0.3*u,0.08*u);ctx.lineTo(-0.1*u,0.08*u);ctx.moveTo(0.12*u,0.12*u);ctx.lineTo(0.28*u,0.04*u);ctx.stroke();
 ctx.strokeStyle='#55555e';ctx.lineWidth=0.02*u;ctx.beginPath();ctx.moveTo(0.25*u*f,-0.3*u);ctx.lineTo(0.38*u*f,-0.58*u);ctx.stroke();
 ctx.save();ctx.shadowColor='#ff2020';ctx.shadowBlur=0.35*u;ctx.fillStyle='#ff3030';ctx.beginPath();ctx.arc(0.18*u*f,-0.18*u,0.06*u,0,7);ctx.fill();ctx.restore();
 if(Math.floor(t/400)%2){ctx.fillStyle='#ffa040';ctx.beginPath();ctx.arc(-0.26*u*f,0.1*u,0.025*u,0,7);ctx.fill();}
 ctx.restore();}
CI.vivo.drawChar=(ctx,k,x0,y0,u,c,dir,t,gy)=>safe(()=>{if(k==='r2ave')drawR2(ctx,x0,y0,u,c,dir,t);else if(k==='m2argoth')drawDog(ctx,x0,y0,u,c,dir,t,false);else if(k==='s2hakira')drawDog(ctx,x0,y0,u,c,dir,t,true);else drawDrone(ctx,x0,y0,u,c,dir,t,gy==null?y0:gy);},null,'personaje');
/* ---------- escena ---------- */
function draw(cv,t){const ctx=cv.getContext&&cv.getContext('2d');if(!ctx)return false;const dpr=Math.min(2,window.devicePixelRatio||1);const w=cv.clientWidth||600,h=cv.clientHeight||420;
 if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);
 const G=cam(cv),P=G.P,u=G.k;const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#07080b');bg.addColorStop(1,'#12090b');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 /* piso reflectante con grilla y franjas de luz */const fl=[P(0,0),P(W,0),P(W,D),P(0,D)];const fg=ctx.createLinearGradient(fl[0][0],fl[0][1],fl[2][0],fl[2][1]);fg.addColorStop(0,'#15161b');fg.addColorStop(0.5,'#1c1d24');fg.addColorStop(1,'#111216');poly(ctx,fl,fg,'rgba(255,60,60,.6)',2);
 ctx.strokeStyle='rgba(120,140,170,.07)';ctx.lineWidth=1;for(let x=1;x<W;x++){const a=P(x,0),b=P(x,D);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}for(let y=1;y<D;y++){const a=P(0,y),b=P(W,y);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
 ctx.save();ctx.globalCompositeOperation='lighter';[[0,0,W,0],[0,D,W,D],[0,0,0,D],[W,0,W,D]].forEach(([x1,y1,x2,y2],i)=>{const a=P(x1,y1,0.02),b=P(x2,y2,0.02);ctx.strokeStyle=i%2?'rgba(70,230,215,.35)':'rgba(255,48,48,.4)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();});
 /* pasillos de circulación iluminados */[[3,9.8,21,9.8],[12,4,12,13.5]].forEach(([x1,y1,x2,y2])=>{const a=P(x1,y1,0.01),b=P(x2,y2,0.01);ctx.strokeStyle='rgba(80,160,255,.18)';ctx.lineWidth=0.5*u;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();});ctx.restore();
 /* plataforma central de coordinación con anillos holográficos */const co=ST.coord;disc(ctx,G,co.x,co.y,0.02,2.3,'#1b1c22','rgba(255,48,48,.8)',2);disc(ctx,G,co.x,co.y,0.3,1.9,'#22232b','rgba(255,90,90,.5)',1.5);
 ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<3;i++){const r=0.8+i*0.35+Math.sin(t/900+i)*0.05;disc(ctx,G,co.x,co.y,1.4+i*0.45+Math.sin(t/700+i)*0.06,r,null,'rgba(70,230,215,'+(0.5-i*0.12)+')',2);}
 const hc=P(co.x,co.y,2.2);glow(ctx,hc[0],hc[1],2.4*u,CYAN,0.25);const pc=P(co.x,co.y,0.3);glow(ctx,pc[0],pc[1],2.2*u,RED,0.18);ctx.restore();
 /* objetos ordenados por profundidad */const items=[];
 const station=(k,fn)=>items.push({d:G.depth(ST[k].x,ST[k].y),fn});
 station('r2',()=>{const s=ST.r2;box(ctx,G,s.x-0.9,s.y-0.4,1.8,0.8,0,0.8,'#2a2b33','rgba(255,48,48,.8)');screen(s.x,s.y-0.2,1.6,1.0,1.0,RED,'ANÁLISIS');});
 station('mon',()=>{const s=ST.mon;box(ctx,G,s.x-1.3,s.y-0.5,2.6,0.6,0,2.0,'#1f2027','rgba(255,90,60,.7)');for(let i=0;i<3;i++)for(let j=0;j<2;j++){const a=P(s.x-1.15+i*0.82,s.y+0.11,0.35+j*0.8),b=P(s.x-0.45+i*0.82,s.y+0.11,0.35+j*0.8),c2=P(s.x-0.45+i*0.82,s.y+0.11,1.0+j*0.8),d2=P(s.x-1.15+i*0.82,s.y+0.11,1.0+j*0.8);poly(ctx,[a,b,c2,d2],(V.real.imp&&(i+j+Math.floor(t/500))%3===0)?'rgba(255,60,50,.55)':'rgba(255,90,60,.22)','rgba(255,120,90,.5)');}});
 station('ana',()=>{const s=ST.ana;disc(ctx,G,s.x,s.y,0.02,0.95,'#20222a','rgba(70,230,215,.7)',2);box(ctx,G,s.x-0.5,s.y-0.5,1,1,0,0.75,'#25272f','rgba(70,230,215,.6)');ctx.save();ctx.globalCompositeOperation='lighter';const top=P(s.x,s.y,0.8),tip=P(s.x,s.y,1.9);
  const gr=ctx.createLinearGradient(top[0],top[1],tip[0],tip[1]);gr.addColorStop(0,'rgba(70,230,215,.45)');gr.addColorStop(1,'rgba(70,230,215,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(top[0]-0.45*u,top[1]);ctx.lineTo(top[0]+0.45*u,top[1]);ctx.lineTo(tip[0]+0.25*u,tip[1]);ctx.lineTo(tip[0]-0.25*u,tip[1]);ctx.closePath();ctx.fill();
  for(let i=0;i<5;i++){const a=t/1200+i*1.25;const p=P(s.x+Math.cos(a)*0.35,s.y+Math.sin(a)*0.35,1.1+i*0.15);ctx.fillStyle='rgba(150,255,245,.8)';ctx.fillRect(p[0]-2,p[1]-2,4,4);}ctx.restore();});
 station('lab',()=>{const s=ST.lab;disc(ctx,G,s.x,s.y,0.02,1.2,'#1c1d23','rgba(255,140,60,.8)',2);disc(ctx,G,s.x,s.y,0.12,0.8,'#26272f','rgba(255,140,60,.5)',1.5);box(ctx,G,s.x+1.1,s.y-1.2,0.7,1.4,0,1.1,'#25262e','rgba(255,140,60,.6)');
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2+t/1500;const p=P(s.x+Math.cos(a)*1.05,s.y+Math.sin(a)*1.05,0.05);ctx.fillStyle=Math.floor(t/300+i)%2?'#ffa040':'#5a2a10';ctx.beginPath();ctx.arc(p[0],p[1],2.5,0,7);ctx.fill();}});
 station('com',()=>{const s=ST.com;box(ctx,G,s.x-0.4,s.y-0.4,0.8,0.8,0,0.5,'#23242c','rgba(80,160,255,.7)');const a=P(s.x,s.y,0.5),b=P(s.x,s.y,2.6);ctx.strokeStyle='#5b6070';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<3;i++){const r=((t/900+i/3)%1)*1.6;ctx.strokeStyle='rgba(80,160,255,'+(0.5*(1-r/1.6))+')';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(b[0],b[1],r*u*0.6,r*u*0.25,0,0,7);ctx.stroke();}glow(ctx,b[0],b[1],0.6*u,BLUE,0.5);ctx.restore();});
 station('rest',()=>{const s=ST.rest;box(ctx,G,s.x-0.8,s.y-0.35,1.6,0.7,0,0.45,'#2b2530','rgba(70,230,215,.45)');box(ctx,G,s.x-0.8,s.y+0.45,1.6,0.3,0,0.3,'#231f28',null);const p=P(s.x+1.1,s.y-0.6,0);ctx.fillStyle='#1d3b33';ctx.beginPath();ctx.arc(p[0],p[1]-0.5*u,0.3*u,0,7);ctx.fill();});
 PILLARS.forEach(([x,y])=>items.push({d:G.depth(x,y),fn:()=>{box(ctx,G,x-0.3,y-0.3,0.6,0.6,0,3.4,'#202128','rgba(255,48,48,.5)');const a=P(x+0.3,y+0.3,0.2),b=P(x+0.3,y+0.3,3.2);ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='rgba(255,48,48,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.restore();}}));
 /* pasarela superior con baranda */items.push({d:G.depth(12,0.9)-0.5,fn:()=>{box(ctx,G,3,0.4,18,1.2,2.6,0.12,'#2a2b33','rgba(255,48,48,.6)');for(let x=3.4;x<21;x+=1.4){const a=P(x,1.6,2.72),b=P(x,1.6,3.3);ctx.strokeStyle='rgba(255,90,90,.45)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
  const r1=P(3,1.6,3.3),r2=P(21,1.6,3.3);ctx.strokeStyle='rgba(255,90,90,.7)';ctx.beginPath();ctx.moveTo(r1[0],r1[1]);ctx.lineTo(r2[0],r2[1]);ctx.stroke();[4,12,20].forEach(x=>box(ctx,G,x-0.15,0.85,0.3,0.3,0,2.6,'#1d1e24',null));}});
 /* pantallas holográficas gigantes con DATOS REALES */const R=V.real||{};
 const giant=(x,y,z,ww,hh,col,tt,val,sub)=>items.push({d:G.depth(x,y)-0.3,fn:()=>{screen(x,y,ww,hh,z,col,tt,val,sub);}});
 giant(4.5,0.9,3.6,3,1.5,RED,'VENTAS DE HOY',$m(R.tot||0),(R.n||0)+' venta(s) · dato real');
 giant(12,0.9,3.8,3.4,1.6,CYAN,'ALERTAS',String((R.crit||0)+(R.imp||0)),(R.crit||0)+' crítica(s) · '+(R.low||0)+' stock bajo · dato real');
 giant(19.5,0.9,3.6,3,1.5,ORANGE,'COMPRAS',String(R.po||0),'pedido(s) esperando recepción · dato real');
 function screen(x,y,ww,hh,z,col,tt,val,sub){const a=P(x-ww/2,y,z),b=P(x+ww/2,y,z),c2=P(x+ww/2,y,z+hh),d2=P(x-ww/2,y,z+hh);ctx.save();ctx.globalCompositeOperation='lighter';poly(ctx,[a,b,c2,d2],col.replace('A',0.1),col.replace('A',0.7),1.5);
  for(let i=1;i<6;i++){const p1=P(x-ww/2,y,z+hh*i/6),p2=P(x+ww/2,y,z+hh*i/6);ctx.strokeStyle=col.replace('A',0.08);ctx.beginPath();ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.stroke();}ctx.restore();
  const m=P(x,y,z+hh/2);const fs=Math.max(9,Math.min(18,u*0.32));ctx.textAlign='center';ctx.fillStyle='#f2f6ff';ctx.font='700 '+(fs*0.75)+'px sans-serif';ctx.fillText(tt,m[0],m[1]-fs*0.9);
  if(val!=null){ctx.font='800 '+(fs*1.3)+'px sans-serif';ctx.fillText(val,m[0],m[1]+fs*0.4);}if(sub){ctx.font='500 '+(fs*0.6)+'px sans-serif';ctx.fillStyle='#c8d2e6';ctx.fillText(sub,m[0],m[1]+fs*1.25);}}
 /* integrantes de cuerpo completo (con reflejo en el piso) */const lab=[];
 Object.values(CH).forEach(c=>{items.push({d:G.depth(c.x,c.y)+0.01,fn:()=>{const g=P(c.x,c.y,0),p=P(c.x,c.y,c.z),dir=screenDir(G,c),sc=Math.max(0.6,u*1.2);
  ctx.save();ctx.globalAlpha=0.35;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(g[0],g[1],(c.k==='r2ave'?0.42:0.55)*sc,0.16*sc,0,0,7);ctx.fill();ctx.restore();
  if(V.quality!=='baja'&&c.k!=='t2uluz'){ctx.save();ctx.translate(g[0],g[1]);ctx.scale(1,-0.45);ctx.translate(-g[0],-g[1]);ctx.globalAlpha=0.13;CI.vivo.drawChar(ctx,c.k,g[0],g[1],sc,c,dir,t);ctx.restore();}
  ctx.save();ctx.globalCompositeOperation='lighter';glow(ctx,p[0],p[1]-(c.k==='r2ave'?1.2:0.4)*sc,(c.k==='r2ave'?1.3:0.9)*sc,c.k==='s2hakira'?CYAN:(c.k==='t2uluz'?ORANGE:RED),c.k==='s2hakira'?0.22:0.14);ctx.restore();
  if(c.k==='t2uluz'&&c.beam>0.05){const r2=CH.r2ave,tp=P(r2.x,r2.y,1.9);ctx.save();ctx.globalCompositeOperation='lighter';const gr=ctx.createLinearGradient(p[0],p[1],tp[0],tp[1]);gr.addColorStop(0,'rgba(255,140,60,'+(0.5*c.beam)+')');gr.addColorStop(1,'rgba(70,230,215,'+(0.25*c.beam)+')');ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(tp[0]-0.7*u,tp[1]-0.4*u);ctx.lineTo(tp[0]+0.7*u,tp[1]-0.4*u);ctx.closePath();ctx.fill();ctx.restore();}
  CI.vivo.drawChar(ctx,c.k,p[0],p[1],sc,c,dir,t,g[1]);
  const top=c.k==='r2ave'?2.7:(c.k==='t2uluz'?0.95:1.3);lab.push({c,x:p[0],y:p[1]-top*sc,base:p[1]});}});});
 items.sort((a,b)=>a.d-b.d).forEach(it=>safe(it.fn,null,'escena'));
 /* partículas discretas */ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<26;i++){const px=(i*7.3+t/2600*(1+i%3))%W,py=(i*3.1)%D,pz=((t/3000+i*0.37)%1)*3.5;const p=P(px,py,pz);ctx.fillStyle=i%3?'rgba(255,70,60,.5)':'rgba(70,230,215,.5)';ctx.fillRect(p[0],p[1],2,2);}ctx.restore();
 /* nombres y actividad: «Real» (dato del sistema) o «Simulación» (animación) */
 V.hits=[];const placed=[];lab.sort((a,b)=>b.y-a.y).forEach(L=>{const c=L.c;const fs=Math.max(10,Math.min(13,u*0.28));ctx.font='800 '+fs+'px sans-serif';const t1=NAME[c.k];const t2=(c.real?'● Real: ':'○ Simulación: ')+c.act;
  ctx.font='600 '+(fs-2)+'px sans-serif';const w2=Math.min(ctx.measureText(t2).width,u*6.5);ctx.font='800 '+fs+'px sans-serif';const w1=ctx.measureText(t1).width;const bw=Math.max(w1,w2)+14,bh=fs*2.6;
  const bx=L.x-bw/2;let by=L.y-bh;for(let i=0;i<8;i++){const o=placed.find(o=>bx<o.x+o.w+3&&bx+bw+3>o.x&&by<o.y+o.h+3&&by+bh+3>o.y);if(!o)break;by=o.y-bh-4;}placed.push({x:bx,y:by,w:bw,h:bh});
  if(by<L.y-bh-2){ctx.strokeStyle=COL[c.k];ctx.globalAlpha=0.6;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L.x,by+bh);ctx.lineTo(L.x,L.y-2);ctx.stroke();ctx.globalAlpha=1;}ctx.fillStyle='rgba(8,8,11,.82)';ctx.strokeStyle=COL[c.k];ctx.lineWidth=V.follow===c.k?2.5:1.2;if(!c.real)ctx.setLineDash([4,3]);ctx.beginPath();ctx.roundRect?ctx.roundRect(bx,by,bw,bh,7):ctx.rect(bx,by,bw,bh);ctx.fill();ctx.stroke();ctx.setLineDash([]);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffffff';ctx.fillText(t1,L.x,by+fs*0.8);ctx.font=(c.real?'700 ':'italic 500 ')+(fs-2)+'px sans-serif';ctx.fillStyle=c.real?'#ffd2cc':'#c8d0dc';
  let tx2=t2;while(ctx.measureText(tx2).width>u*6.5&&tx2.length>8)tx2=tx2.slice(0,-2);if(tx2!==t2)tx2=tx2.slice(0,-1)+'…';ctx.fillText(tx2,L.x,by+fs*1.85);ctx.textBaseline='alphabetic';
  V.hits.push({k:c.k,x0:L.x-Math.max(bw/2,0.7*u),x1:L.x+Math.max(bw/2,0.7*u),y0:by,y1:L.base+0.2*u});});
 return true;}
CI.vivo.draw=cv=>safe(()=>draw(cv,performance.now()),false,'escena viva');
/* ---------- bucle: ~30 cuadros por segundo, sólo con la escena visible; se detiene con «reducir movimiento» ---------- */
function frame(ts){V.raf=0;const cv=document.querySelector('.ci-root canvas.vv-cv');if(!cv)return;
 const vis=!document.hidden&&V.seen;if(!vis){V.last=ts;return;}
 const dt=Math.min(0.05,Math.max(0,(ts-(V.last||ts))/1000));V.last=ts;V.acc+=dt;
 if(V.acc>=1/30){safe(()=>tick(V.acc),null,'comportamiento');V.acc=0;if(!CI.vivo.draw(cv))return;V.fps=V.fps*0.9+(dt>0?1/dt:0)*0.1;summary(false);}
 V.raf=requestAnimationFrame(frame);}
function start(){if(V.raf)return;if(reduced()){const cv=document.querySelector('.ci-root canvas.vv-cv');if(cv){safe(()=>tick(0.03),null,'comportamiento');CI.vivo.draw(cv);summary(true);}return;}V.last=0;V.raf=requestAnimationFrame(frame);}
CI.vivo.start=start;CI.vivo.stop=()=>{if(V.raf)cancelAnimationFrame(V.raf);V.raf=0;};
function summary(force){const now0=performance.now();if(!force&&now0-V.sumAt<4000)return;V.sumAt=now0;const s=Object.values(CH).map(c=>NAME[c.k]+': '+c.act+(c.real?' (real)':' (simulación)')).join('. ');const el=document.querySelector('.ci-root .vv-sum');if(el&&el.textContent!==s)el.textContent=s;
 const tb=document.querySelector('.ci-root #vv-tab tbody');if(tb)tb.innerHTML=Object.values(CH).map(c=>`<tr><td><b style="color:${TXT[c.k]}">${NAME[c.k]}</b></td><td>${E(zoneOf(c))}</td><td>${E(c.act)}</td><td>${c.real?'<b>Real</b> (dato del sistema)':'Simulación (animación ambiental)'}</td></tr>`).join('');}
function zoneOf(c){let best='Pasillos de circulación',bd=1e9;Object.values(ST).forEach(s=>{const d0=Math.hypot(s.x-c.x,s.y-c.y);if(d0<bd&&d0<s.r+2){bd=d0;best=s.n;}});return c.k==='t2uluz'&&c.z>1?best+' (volando)':best;}
/* ---------- panel ---------- */
function css(){if(document.getElementById('vv-style'))return;const s=document.createElement('style');s.id='vv-style';s.textContent=`
.ci-root .vv{padding:0;overflow:hidden;margin-bottom:12px;position:relative}
.ci-root .vv-bar{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;padding:.6rem .7rem;border-bottom:1px solid var(--ci-ln)}
.ci-root .vv-bar h2{font:800 1.12rem Georgia,serif;margin:0 auto 0 0;min-width:200px}
.ci-root canvas.vv-cv{display:block;width:100%;height:560px;touch-action:none;cursor:grab;background:#07080b}
@media (max-width:700px){.ci-root canvas.vv-cv{height:430px}}
.ci-root .vv-note{font-size:.8rem;color:var(--ci-mut);padding:.4rem .8rem;margin:0;border-top:1px solid var(--ci-ln)}
.ci-root .vv-legend{display:flex;gap:.8rem;flex-wrap:wrap;font-size:.8rem;padding:.4rem .8rem}
.ci-root .vv-real{border:1.5px solid #ff8a7f;border-radius:6px;padding:0 .35rem;color:#ffd2cc;font-weight:700}
.ci-root .vv-sim{border:1.5px dashed #c8d0dc;border-radius:6px;padding:0 .35rem;color:#c8d0dc;font-style:italic}
.ci-root .vv-sel{min-height:44px;border-radius:12px;background:var(--ci-pan2);color:var(--ci-tx);border:1px solid var(--ci-ln);padding:0 .5rem}
`;document.head.appendChild(s);}
function html(){css();const sel=k=>`<button class="ci-btn ${V.follow===k?'on':''}" data-act="vvFollow" data-id="${k}" aria-pressed="${V.follow===k}" style="border-color:${COL[k]}">${NAME[k]}</button>`;
 return`<section class="ci-pan vv" aria-label="Centro de operaciones vivo SVB R2AVE"><div class="vv-bar"><h2>Centro de operaciones · SVB R2AVE</h2>
  <button class="ci-btn" data-act="vvView" aria-label="Vista general">Vista general</button><button class="ci-btn" data-act="vvOrbit" data-id="-1" aria-label="Girar la cámara a la izquierda">⟲</button><button class="ci-btn" data-act="vvOrbit" data-id="1" aria-label="Girar la cámara a la derecha">⟳</button>
  <button class="ci-btn" data-act="vvZoom" data-id="1" aria-label="Acercar">＋</button><button class="ci-btn" data-act="vvZoom" data-id="-1" aria-label="Alejar">－</button>
  <label class="ci-sr" for="vv-focus">Enfocar una estación</label><select id="vv-focus" class="vv-sel" data-vvfocus><option value="">Enfocar estación…</option>${Object.entries(ST).map(([k,s])=>`<option value="${k}" ${V.focus===k?'selected':''}>${E(s.n)}</option>`).join('')}</select>
  <span style="flex-basis:100%;height:0"></span><span class="ci-mut" style="font-size:.82rem">Seguir:</span>${['r2ave','m2argoth','t2uluz','s2hakira'].map(sel).join('')}</div>
  <canvas class="vv-cv" aria-hidden="true"></canvas><p class="ci-sr vv-sum" aria-live="polite"></p>
  <div class="vv-legend"><span><span class="vv-real">● Real</span> actividad que viene de un dato u operación del sistema</span><span><span class="vv-sim">○ Simulación</span> animación ambiental: no es una operación</span></div>
  <details style="padding:0 .8rem"><summary>Qué está haciendo cada integrante (alternativa al dibujo)</summary><div class="tw"><table class="ci-tb" id="vv-tab" data-nosort><thead><tr><th>Integrante</th><th>Dónde</th><th>Actividad</th><th>Tipo</th></tr></thead><tbody></tbody></table></div></details>
  <p class="vv-note">Escena 2.5D dibujada en tiempo real en el navegador (sin librerías externas: la política de seguridad del sistema no las permite). Los cuatro integrantes se dibujan de cuerpo completo con los rasgos y colores de la imagen oficial; no son modelos 3D con esqueleto. Arrastrá para girar la cámara (con zoom, para mover), tocá un integrante para seguirlo.</p></section>`;}
function bind(){const cv=document.querySelector('.ci-root canvas.vv-cv');if(!cv||cv._vv)return;cv._vv=1;
 try{const io=new IntersectionObserver(e=>{V.seen=e.some(x=>x.isIntersecting);if(V.seen)start();},{threshold:0.05});io.observe(cv);}catch(e){V.seen=true;}
 let d=null;cv.addEventListener('pointerdown',ev=>{d={x:ev.clientX,y:ev.clientY,th:V.th,px:V.panX,py:V.panY,m:false};cv.setPointerCapture&&cv.setPointerCapture(ev.pointerId);});
 cv.addEventListener('pointermove',ev=>{if(!d)return;const dx=ev.clientX-d.x,dy=ev.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>5)d.m=true;if(!d.m)return;
  if(V.zoom>1.25&&!ev.shiftKey){V.panX=d.px+dx;V.panY=d.py+dy;}else V.th=d.th+dx*0.008;if(reduced())CI.vivo.draw(cv);});
 cv.addEventListener('pointerup',ev=>{if(d&&!d.m){const b=cv.getBoundingClientRect();const x=ev.clientX-b.left,y=ev.clientY-b.top;const h=(V.hits||[]).find(h=>x>=h.x0&&x<=h.x1&&y>=h.y0&&y<=h.y1);if(h)A.vvFollow({dataset:{id:h.k}});}d=null;});
 cv.addEventListener('wheel',ev=>{ev.preventDefault();V.zoom=Math.min(4,Math.max(0.7,V.zoom*(ev.deltaY<0?1.12:1/1.12)));if(reduced())CI.vivo.draw(cv);},{passive:false});
 const fs=document.querySelector('.ci-root [data-vvfocus]');if(fs)fs.addEventListener('change',()=>{V.focus=fs.value;V.follow='';if(V.focus)V.zoom=Math.max(V.zoom,1.6);V.panX=V.panY=0;if(reduced())CI.vivo.draw(cv);});
 start();summary(true);}
const act=(n,fn)=>{A[n]=(el,e)=>safe(()=>fn(el,e),null,n);};
const redraw=()=>{const cv=document.querySelector('.ci-root canvas.vv-cv');if(cv&&reduced())CI.vivo.draw(cv);};
act('vvView',()=>{V.follow='';V.focus='';V.zoom=1;V.panX=V.panY=0;V.th=-0.45;const fs=document.querySelector('.ci-root [data-vvfocus]');if(fs)fs.value='';redraw();});
act('vvOrbit',el=>{V.th+=(+el.dataset.id||1)*Math.PI/8;redraw();});
act('vvZoom',el=>{V.zoom=Math.min(4,Math.max(0.7,V.zoom*((+el.dataset.id)>0?1.3:1/1.3)));redraw();});
/* seguir a un integrante: la cámara se acerca y lo muestra de cuerpo completo */
act('vvFollow',el=>{const k=CH[el.dataset.id]?el.dataset.id:'';V.follow=V.follow===k?'':k;V.focus='';V.panX=V.panY=0;V.zoom=V.follow?2.9:1;
 document.querySelectorAll('.ci-root [data-act=vvFollow]').forEach(b=>{b.classList.toggle('on',b.dataset.id===V.follow);b.setAttribute('aria-pressed',b.dataset.id===V.follow);});redraw();});
/* registro como primer panel del Centro: el equipo vivo es la representación principal; las fichas quedan plegadas */
CI.ext=(CI.ext||[]).filter(x=>x.id!=='vivo');CI.ext.unshift({id:'vivo',pos:'top',html:()=>html(),after:()=>bind()});
CI.r2.cardsFolded=true;
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&V.seen)start();});
window.addEventListener('hashchange',()=>{if(!/#panel\/centro/.test(location.hash))CI.vivo.stop();});
})();
