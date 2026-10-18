/* ================= NUBE (Supabase) · cliente =================
   Este módulo conecta el sistema con la base de Vincular Business en Supabase. Es OPCIONAL: sin URL y clave publicable el sistema
   funciona igual, sólo en este equipo (demo). Reglas:
   · En el archivo sólo van la URL del proyecto y la clave PUBLICABLE (sb_publishable_…). Jamás una clave secreta.
   · Cuenta = correo + contraseña de Supabase Auth. La contraseña además abre la llave de cifrado (AES-256-GCM) de los datos:
     el servidor guarda la llave "envuelta" y no la puede abrir.
   · Datos personales (clientes, DNI, PIN) viajan cifrados con esa llave. Productos, ventas y caja viajan en claro porque el
     servidor suma el stock y valida reglas (por eso el stock se manda como movimientos, no como número).
   · Sin internet se sigue vendiendo: todo queda en el equipo (cifrado) y se sube solo al volver la conexión. */
const CLOUD=(()=>{const c=(typeof window!=='undefined'&&window.RAVE_CLOUD)||{};const ok=!!(c.url&&c.key&&/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(String(c.url).replace(/\/$/,''))&&!/__/.test(c.url+c.key)&&!/service_role/i.test(c.key)&&!/^sb_secret_/.test(c.key));
 return{on:ok,url:ok?String(c.url).replace(/\/$/,''):'',key:ok?c.key:'',slug:String(c.slug||'').toLowerCase()};})();
const cl={ses:null,uid:'',email:'',rol:'',nombre:'',comercio:null,slug:'',dek:null,dekRaw:null,dev:'',snum:0,fp:{},base:{},outStock:[],cursor:null,rejects:[],
 online:false,busy:false,lastOk:0,lastErr:'',pending:0,timer:null,adopted:false,clubPriv:null,pubSnap:null,team:[],cajaNo:0,ready:false,recoveryShown:false,loaded:false};
const te=new TextEncoder(),td=new TextDecoder();
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const ALF='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(n,group){let o='';const r=rnd(n);for(let i=0;i<n;i++){o+=ALF[r[i]%ALF.length];if(group&&(i+1)%group===0&&i<n-1)o+='-';}return o;}
const normCode=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
/* ---------- cifrado ---------- */
async function kdfKey(pass,salt,iter){const k=await crypto.subtle.importKey('raw',te.encode(String(pass).normalize('NFC')),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function wrapDek(raw,pass){const salt=rnd(16),iv=rnd(12),it=200000;const k=await kdfKey(pass,salt,it);const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,raw));
 return{kdf:{alg:'PBKDF2-SHA256',iter:it,salt:b64(salt)},wrap:{iv:b64(iv),ct:b64(ct)}};}
async function unwrapDek(rec,pass){const it=+rec.kdf.iter;if(!(it>=100000&&it<=2000000))throw new Error('llave inválida');const k=await kdfKey(pass,unb64(rec.kdf.salt),it);
 return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(rec.wrap.iv)},k,unb64(rec.wrap.ct)));}
const dekKey=raw=>crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
async function sealJ(obj,key,aad){const iv=rnd(12);const p={name:'AES-GCM',iv};if(aad)p.additionalData=te.encode(aad);return{iv:b64(iv),ct:b64(new Uint8Array(await crypto.subtle.encrypt(p,key,te.encode(JSON.stringify(obj)))))};}
async function openJ(box,key,aad){const p={name:'AES-GCM',iv:unb64(box.iv)};if(aad)p.additionalData=te.encode(aad);return JSON.parse(td.decode(await crypto.subtle.decrypt(p,key,unb64(box.ct))));}
/* hash rápido (no criptográfico) para saber si un registro cambió */
function cyrb(str){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
 h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36);}
function canon(o){if(o===null||typeof o!=='object')return JSON.stringify(o===undefined?null:o);if(Array.isArray(o))return'['+o.map(canon).join(',')+']';
 return'{'+Object.keys(o).filter(k=>o[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canon(o[k])).join(',')+'}';}
/* ---------- almacenamiento local (IndexedDB, misma base que el sistema) ---------- */
async function kvGet(k){try{const db=await idb();return await new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null);});}catch(e){return null;}}
async function kvPut(k,v){try{const db=await idb();await new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});return true;}catch(e){return false;}}
async function kvDel(k){try{const db=await idb();db.transaction('kv','readwrite').objectStore('kv').delete(k);}catch(e){}}
/* ---------- HTTP ---------- */
class NetErr extends Error{constructor(m){super(m||'Sin conexión');this.net=true;}}
class ApiErr extends Error{constructor(m,st,body){super(m);this.status=st;this.body=body;}}
async function hreq(path,o={}){const h={apikey:CLOUD.key,'Content-Type':'application/json'};
 if(o.auth!==false){const t=await accessToken();if(!t)throw new ApiErr('Sesión vencida: volvé a ingresar',401);h.Authorization='Bearer '+t;}
 Object.assign(h,o.headers||{});let r;
 try{r=await fetch(CLOUD.url+path,{method:o.method||'GET',headers:h,body:o.body!==undefined?JSON.stringify(o.body):undefined});}catch(e){if(!o.fn)cl.online=false;throw new NetErr();}
 if(!o.fn)cl.online=true;let j=null;const txt=await r.text();try{j=txt?JSON.parse(txt):null;}catch(e){j=txt;}
 if(r.status===502||r.status===503||r.status===504){if(r.status===502&&j&&typeof j==='object'&&j.etapa)throw new ApiErr(String(j.error||'ARCA no respondió'),502,j);if(!o.fn)cl.online=false;throw new NetErr();}
 if(!r.ok){const m=(j&&(j.message||j.msg||j.error_description||j.error))||('Error '+r.status);throw new ApiErr(typeof m==='string'?m:'Error '+r.status,r.status,j);}
 return j;}
const rpc=(fn,args,o)=>hreq('/rest/v1/rpc/'+fn,{method:'POST',body:args||{},...(o||{})});
const sel=(q)=>hreq('/rest/v1/'+q);
async function accessToken(){const s=cl.ses;if(!s)return'';
 if(s.exp-60000>Date.now())return s.access;
 try{const r=await fetch(CLOUD.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:CLOUD.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh})});
  if(r.status===400||r.status===401||r.status===403){cl.ses=null;await cloudMetaSave();return'';}
  const j=await r.json();if(!j.access_token)return s.exp>Date.now()?s.access:'';setSes(j);await cloudMetaSave();cl.online=true;return cl.ses.access;}
 catch(e){cl.online=false;return s.exp>Date.now()?s.access:'';}}
function setSes(j){cl.ses={access:j.access_token,refresh:j.refresh_token,exp:Date.now()+(+j.expires_in||3600)*1000};if(j.user){cl.uid=j.user.id;cl.email=(j.user.email||cl.email||'').toLowerCase();}}
const authCall=(p,b)=>hreq('/auth/v1/'+p,{method:'POST',auth:false,body:b});
async function signIn(email,pass){const j=await authCall('token?grant_type=password',{email,password:pass});setSes(j);return j;}
async function signUp(email,pass){const j=await authCall('signup',{email,password:pass});
 if(j&&j.access_token){setSes(j);return{ok:true};}
 return{ok:false,confirm:true};}
/* ---------- qué colección del servidor corresponde a qué parte del estado ---------- */
const COLS=[
 {c:'prod',key:'products',strip:['stock'],del:1},
 {c:'ventas',key:'sales'},
 {c:'turnos',key:'sessions'},
 {c:'movs',key:'movs'},
 {c:'cierres',key:'closures',strip:['notes'],once:1},
 {c:'rubros',key:'rubros',del:1},
 {c:'clientes',key:'customers',pii:['name','last','birth','wa','email','secret','notes'],del:1},
 {c:'fiado',key:'fiadoPays',once:1},
 {c:'emp',key:'employees',pii:['pin','dni'],del:1},
 {c:'fich',key:'punches'},
 {c:'puestos',key:'puestos',del:1},
 {c:'tareas',key:'tasks',del:1},
 {c:'tlogs',key:'taskLogs',del:1,synth:l=>l.taskId+':'+l.day},
 {c:'cupones',key:'coupons',strip:['uses'],del:1},
 {c:'planes',key:'plans',del:1},
 {c:'membs',key:'members'},
 {c:'pedidos',key:'orderReqs',del:1},
 {c:'arrep',key:'arrep'},
 {c:'pya',key:'pya'},
 {c:'lotes',key:'batches'},
 {c:'sucs',key:'branches'},
 {c:'cajas',key:'registers'},
 {c:'ctransf',key:'transfers',once:1}];
const BYC=Object.fromEntries(COLS.map(x=>[x.c,x]));
const DELC=new Set(COLS.filter(x=>x.del).map(x=>x.c));
const CFGIDS=['tenant','cfg','menu','loyalty','roles','integ','legal'];
const ONCEC=new Set(['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado']);
const r3=n=>Math.round(n*1000)/1000;
function stripOf(col,it){const d=JSON.parse(JSON.stringify(it));(col.strip||[]).forEach(k=>delete d[k]);return d;}
function cfgWire(id){switch(id){
 case'tenant':{const t=JSON.parse(JSON.stringify(S.tenant));delete t.caja;delete t.regId;return t;}
 case'cfg':return JSON.parse(JSON.stringify(S.cfg));
 case'menu':return JSON.parse(JSON.stringify(S.menu));
 case'loyalty':return{goal:S.loyalty.goal,reward:S.loyalty.reward};
 case'roles':return JSON.parse(JSON.stringify(S.roles));
 case'integ':{const x=JSON.parse(JSON.stringify(S.integ));return x;}
 case'legal':return JSON.parse(JSON.stringify(S.legal));}return null;}
/* todo lo que hoy existe en este equipo, en el formato que viaja */
function collectAll(){const out=[];
 for(const col of COLS){const arr=S[col.key]||[];for(const it of arr){if(!it)continue;const id=col.synth?col.synth(it):it.id;if(!id||String(id).length>80)continue;out.push({c:col.c,id:String(id),w:stripOf(col,it),col});}}
 for(const e of S.audit)out.push({c:'audit',id:e.id,w:Object.assign({dev:cl.dev},e)});
 for(const e of S.loyalty.ledger)out.push({c:'sellos',id:e.id,w:e});
 for(const [k,ts] of Object.entries(S.loyalty.usedOtp||{}))if(k.length<=80)out.push({c:'otp',id:k,w:{ts}});
 for(const cp of S.coupons)for(const u of(cp.uses||[]))if(u.sale)out.push({c:'cusos',id:(cp.id+':'+u.sale).slice(0,80),w:{cp:cp.id,ts:u.ts,sale:u.sale,cust:u.cust||''}});
 for(const k of S.closures)for(const n of(k.notes||[]))out.push({c:'cnotas',id:(k.id+':'+cyrb(canon(n))).slice(0,80),w:Object.assign({cl:k.id},n)});
 for(const id of CFGIDS)out.push({c:'cfg',id,w:cfgWire(id)});
 if(cl.clubPriv&&cl.clubPriv.new)out.push({c:'cfg',id:'clubkey',w:{pub:cl.clubPriv.pub,priv:cl.clubPriv.priv},raw:1});
 return out;}
async function sealPii(col,id,w){if(!col||!col.pii||!col.pii.length)return w;const d=Object.assign({},w),p={};let any=false;for(const k of col.pii)if(d[k]!==undefined){p[k]=d[k];delete d[k];any=true;}
 if(any)d.__pii=await sealJ(p,cl.dek,'pii|'+cl.comercio.id+'|'+col.c+'|'+id);return d;}
async function openPii(col,id,d){if(!d||!d.__pii)return d;const o=Object.assign({},d);const box=o.__pii;delete o.__pii;
 try{Object.assign(o,await openJ(box,cl.dek,'pii|'+cl.comercio.id+'|'+col.c+'|'+id));}catch(e){o.__piiError=true;}return o;}
/* ---------- meta local ---------- */
async function cloudMetaSave(){await kvPut('cloud',{v:1,ses:cl.ses,uid:cl.uid,email:cl.email,rol:cl.rol,nombre:cl.nombre,comercio:cl.comercio,dev:cl.dev,snum:cl.snum,fp:cl.fp,base:cl.base,outStock:cl.outStock,cursor:cl.cursor,dekWrap:cl.dekWrap||null,rejects:cl.rejects.slice(-30),pubHash:cl.pubHash||'',adopted:cl.adopted,cajaNo:cl.cajaNo,lastOk:cl.lastOk});}
/* ---------- empujar cambios ---------- */
function outSum(pid){return cl.outStock.reduce((a,m)=>a+(m.pid===pid?m.d:0),0);}
function queueStock(){for(const p of S.products){if(!p||!p.id)continue;const b=cl.base[p.id]===undefined?0:cl.base[p.id];const d=r3((+p.stock||0)-b);
  if(Math.abs(d)>=0.0005){cl.outStock.push({id:cl.dev+'-'+(++cl.snum),pid:p.id,d});cl.base[p.id]=r3(b+d);}}}
async function pushAll(){queueStock();const all=collectAll();const seen=new Set(),ch=[];
 for(const it of all){const key=it.c+'|'+it.id;seen.add(key);const h=cyrb(canon(it.w));if(cl.fp[key]!==h)ch.push({it,key,h});}
 for(const key of Object.keys(cl.fp)){if(seen.has(key))continue;const c=key.split('|')[0];if(DELC.has(c))ch.push({key,del:1,c,id:key.slice(c.length+1)});else delete cl.fp[key];}
 const rk=x=>{const c=x.it?x.it.c:x.c;return c==='prod'?0:(c==='ctransf'?2:1);};ch.sort((a,b)=>rk(a)-rk(b));
 let sent=0;
 for(let i=0;i<ch.length;i+=150){const part=ch.slice(i,i+150),body=[];
  for(const x of part){if(x.del){body.push({c:x.c,id:x.id,d:{},x:true});continue;}
   const col=BYC[x.it.c];body.push({c:x.it.c,id:x.it.id,d:x.it.raw?x.it.w:await sealPii(col,x.it.id,x.it.w)});}
  const r=await rpc('sincronizar',{p_comercio:cl.comercio.id,p_dispositivo:cl.dev,p_cambios:body});
  const bad=new Map((r.rechazos||[]).map(z=>[z.c+'|'+z.id,z.motivo]));
  for(const x of part){const key=x.key;if(x.del){delete cl.fp[key];}else cl.fp[key]=x.h;if(bad.has(key))noteReject(key,bad.get(key));}
  sent+=part.length;await cloudMetaSave();}
 /* movimientos de stock: recién cuando el producto ya está en el servidor */
 for(;;){const ready=cl.outStock.filter(m=>cl.fp['prod|'+m.pid]!==undefined).slice(0,200);if(!ready.length)break;
  const r=await rpc('sincronizar',{p_comercio:cl.comercio.id,p_dispositivo:cl.dev,p_cambios:ready.map(m=>({c:'smov',id:m.id,d:{pid:m.pid,d:m.d,dev:cl.dev}}))});
  const bad=new Map((r.rechazos||[]).map(z=>[z.id,z.motivo]));ready.forEach(m=>{if(bad.has(m.id))noteReject('smov|'+m.id,bad.get(m.id)+' ('+m.pid+')');});
  const ids=new Set(ready.map(m=>m.id));cl.outStock=cl.outStock.filter(m=>!ids.has(m.id));sent+=ready.length;await cloudMetaSave();}
 return sent;}
function noteReject(key,m){cl.rejects.push({key,m,ts:now()});if(cl.rejects.length>60)cl.rejects.shift();}
/* ---------- bajar cambios ---------- */
const arrOf=col=>{if(!Array.isArray(S[col.key]))S[col.key]=[];return S[col.key];};
async function applyRec(r){const c=r.coleccion,id=r.id,key=c+'|'+id;
 if(c==='smov'||c==='cnotas'&&false)return;
 if(c==='audit'){const d=r.datos;if(d&&d.dev!==cl.dev){S.auditX=S.auditX||[];if(!S.auditX.some(a=>a.id===d.id))S.auditX.push(d);}return;}
 if(c==='sellos'){if(!S.loyalty.ledger.some(e=>e.id===id))S.loyalty.ledger.push(r.datos);return;}
 if(c==='otp'){S.loyalty.usedOtp[id]=r.datos.ts;return;}
 if(c==='cusos'){const cp=S.coupons.find(x=>x.id===r.datos.cp);if(cp){cp.uses=cp.uses||[];if(!cp.uses.some(u=>u.sale===r.datos.sale))cp.uses.push({ts:r.datos.ts,sale:r.datos.sale,cust:r.datos.cust||''});}return;}
 if(c==='cnotas'){const k=S.closures.find(x=>x.id===r.datos.cl);if(k){k.notes=k.notes||[];const n=Object.assign({},r.datos);delete n.cl;if(!k.notes.some(m=>canon(m)===canon(n)))k.notes.push(n);}return;}
 if(c==='cfg'){const d=r.datos;
  if(id==='clubkey'){if(d&&d.priv&&d.pub&&cl.dek){try{cl.clubPriv={pub:d.pub,priv:d.priv,jwk:await openJ(d.priv,cl.dek,'clubkey|'+cl.comercio.id)};}catch(e){}}return;}
  const h=cyrb(canon(d));const loc=cfgWire(id);if(cl.fp[key]!==undefined&&cyrb(canon(loc))!==cl.fp[key])return; // cambio local sin subir: gana el local
  if(id==='tenant'){const caja=S.tenant.caja,regId=S.tenant.regId;S.tenant=Object.assign({},d,{caja,regId});}
  else if(id==='cfg')S.cfg=d;else if(id==='menu')S.menu=d;else if(id==='roles')S.roles=rolesMigrate(d);else if(id==='integ')S.integ=d;else if(id==='legal')S.legal=d;
  else if(id==='loyalty'){S.loyalty.goal=d.goal;S.loyalty.reward=d.reward;}
  cl.fp[key]=h;return;}
 const col=BYC[c];if(!col)return;const arr=arrOf(col);
 const idx=arr.findIndex(x=>x&&String(col.synth?col.synth(x):x.id)===id);
 if(r.borrado){if(idx>=0)arr.splice(idx,1);delete cl.fp[key];return;}
 let d=await openPii(col,id,r.datos);const srvStock=c==='prod'?+(d.stock||0):0;if(c==='prod')delete d.stock;
 const h=cyrb(canon(d));
 if(idx<0){const n=Object.assign({},d);if(col.strip&&col.strip.includes('uses'))n.uses=[];if(col.strip&&col.strip.includes('notes'))n.notes=[];if(c==='prod')n.stock=r3(srvStock+outSum(id));arr.push(n);cl.fp[key]=h;if(c==='prod')cl.base[id]=r3(srvStock+outSum(id));return;}
 const loc=arr[idx];const lh=cyrb(canon(stripOf(col,loc)));
 if(c==='prod'){const base=cl.base[id]===undefined?(+loc.stock||0):cl.base[id];const unq=r3((+loc.stock||0)-base);loc.stock=r3(srvStock+outSum(id)+unq);cl.base[id]=r3(srvStock+outSum(id));}
 if(cl.fp[key]!==undefined&&lh!==cl.fp[key])return; // cambio local sin subir: gana el local
 if(lh===h){cl.fp[key]=h;return;}
 const keep={};(col.strip||[]).forEach(k=>{if(k!=='stock')keep[k]=loc[k];});const stock=loc.stock;
 if(c==='ventas')['arca','arcaNC'].forEach(k=>{if(loc[k]&&loc[k].cae&&!(d[k]&&d[k].cae))keep[k]=loc[k];}); // una lectura vieja no borra un CAE ya obtenido
 for(const k of Object.keys(loc))delete loc[k];Object.assign(loc,d,keep);if(c==='prod')loc.stock=stock;cl.fp[key]=(keep.arca||keep.arcaNC)?cyrb(canon(stripOf(col,loc))):h;}
function fixUses(){for(const cp of S.coupons){if(!cp.uses)continue;cp.uses=cp.uses.filter(u=>{const s=S.sales.find(x=>x.id===u.sale);return!s||s.status==='ok'||s.status==='pendiente';});}}
async function pullAll(){let from=cl.cursor?new Date(Date.parse(cl.cursor)-30000).toISOString():null,max=cl.cursor,total=0,first=true;
 for(let page=0;page<200;page++){const rows=await rpc('bajar',{p_comercio:cl.comercio.id,p_desde:from,p_limite:500});
  for(const r of rows){try{await applyRec(r);}catch(e){console.warn('applyRec',r.coleccion,r.id,e);}if(!max||r.actualizado>max)max=r.actualizado;}
  total+=rows.length;if(rows.length<500)break;from=rows[rows.length-1].actualizado;first=false;}
 fixUses();cl.cursor=max;await cloudMetaSave();return total;}
/* ---------- estado local cifrado ---------- */
async function cloudLoadState(){const st=await kvGet('state');if(st&&st.enc&&st.cid===cl.comercio.id){try{const o=await openJ(st,cl.dek,'state|'+cl.comercio.id);if(o&&o.v===3)return mergeDefaults(o);}catch(e){}}return null;}
let persistT;
async function cloudPersistNow(){if(!cl.ready||!cl.dek)return;try{const box=await sealJ(JSON.parse(JSON.stringify(S)),cl.dek,'state|'+cl.comercio.id);box.enc=1;box.cid=cl.comercio.id;await kvPut('state',box);}catch(e){console.warn('persist',e);}}
const cloudHook={persist(){clearTimeout(persistT);persistT=setTimeout(cloudPersistNow,1200);cloudTouch();}};
let touchT;function cloudTouch(){if(!cl.ready)return;clearTimeout(touchT);touchT=setTimeout(()=>cloudSync(),1500);cloudBadge();}
/* estado en blanco para un equipo que se une a un comercio que ya tiene datos */
function blankState(){const d=DEF();d.rubros=[];d.products=[];d.employees=[];d.puestos=[];d.tasks=[];d.plans=[];d.coupons=[];d.users=[];d.customers=[];return d;}
/* ---------- ingreso ---------- */
function cloudBadge(){const el=document.getElementById('cloudtag');if(!el)return;if(!cl.ready){el.textContent='';return;}
 let n=0;try{n=pendingCount();}catch(e){}
 if(!cl.online||cl.lastErr==='Sin conexión'){el.className='tag warn';el.textContent='☁ Sin conexión'+(n?' · '+n+' por subir':'');}
 else if(cl.busy){el.className='tag';el.textContent='☁ Sincronizando…';}
 else if(cl.lastErr){el.className='tag bad';el.textContent='☁ Error: '+cl.lastErr.slice(0,40);}
 else{el.className='tag ok';el.textContent='☁ Al día'+(n?' · '+n+' por subir':'');}}
function pendingCount(){let n=cl.outStock.length;for(const it of collectAll())if(cl.fp[it.c+'|'+it.id]!==cyrb(canon(it.w)))n++;return n;}
async function cloudBoot(){
 const meta=await kvGet('cloud');
 cl.dev=(meta&&meta.dev)||('d'+uid()+uid());cl.snum=(meta&&meta.snum)||0;cl.meta=meta||null;
 S=DEF();S.users=[];
 if(!meta)await kvPut('cloud',{v:1,dev:cl.dev,snum:0});
 CLOUD_HOOK=cloudHook;
 loadPubSnap().then(()=>{if(location.hash===''||location.hash==='#menu')pubReload();});
 const m=/access_token=([^&]+).*type=recovery/.exec(location.hash);if(m){history.replaceState(null,'',location.pathname+location.search+'#acceso');cl.recoveryToken=decodeURIComponent(m[1]);}
 route();}
function loginHtml(mode,msg,pre){const em=esc((pre&&pre.email)||(cl.meta&&cl.meta.email)||'');
 const tab=(k,t)=>`<button type="button" class="btn sm ${mode===k?'gold':''}" data-act="cloudMode" data-mode="${k}">${t}</button>`;
 let f='';
 if(mode==='ingresar')f=`<label for="cl-em">Correo</label><input id="cl-em" type="email" autocomplete="username" value="${em}"><label for="cl-pw">Contraseña</label><input id="cl-pw" type="password" autocomplete="current-password">`;
 else if(mode==='crear')f=`<p class="sm mut">Para dueños. Vincular Business te da un <b>código de invitación</b> (se pide una sola vez).</p><label for="cl-nm">Nombre del comercio</label><input id="cl-nm" maxlength="80"><label for="cl-em">Correo</label><input id="cl-em" type="email" autocomplete="username" value="${em}"><label for="cl-pw">Contraseña (mínimo 10 caracteres)</label><input id="cl-pw" type="password" autocomplete="new-password"><label for="cl-co">Código de invitación de Vincular Business</label><input id="cl-co" autocomplete="off">`;
 else if(mode==='unirme')f=`<p class="sm mut">Para el equipo. El administrador te da un <b>código de acceso</b> y tu correo queda invitado.</p><label for="cl-em">Correo (el mismo con el que te invitaron)</label><input id="cl-em" type="email" autocomplete="username" value="${em}"><label for="cl-pw">Elegí tu contraseña (mínimo 10 caracteres)</label><input id="cl-pw" type="password" autocomplete="new-password"><label for="cl-co">Código de acceso</label><input id="cl-co" autocomplete="off">`;
 else f=`<p class="sm mut">Dejanos cómo contactarte y te ayudamos a volver a entrar. También podés escribir por WhatsApp.</p><label for="cl-sc">WhatsApp o correo</label><input id="cl-sc" maxlength="120"><label for="cl-sd">Contanos qué pasó</label><textarea id="cl-sd" rows="3" maxlength="500"></textarea>`;
 return `<div class="lbox"><div style="text-align:center"><img src="${LOGO_MENU}" alt="RAVE" style="width:150px;border-radius:12px"><h1>Acceso del equipo</h1><p class="mut sm">${esc(S.tenant.legal||'Sistema RAVE')}</p></div>
 <div class="row" style="justify-content:center;gap:.4rem;margin:.4rem 0">${tab('ingresar','Ingresar')}${tab('crear','Crear comercio')}${tab('unirme','Tengo una invitación')}${tab('ayuda','Necesito ayuda')}</div>${f}
 <div class="merr" id="lerr" role="alert">${esc(msg||'')}</div>
 <div class="row" style="margin-top:.8rem"><button class="btn gold sp" data-act="cloudGo" data-mode="${mode}" id="cl-go">${mode==='ingresar'?'Ingresar':mode==='ayuda'?'Enviar pedido':'Continuar'}</button><a class="btn" href="#menu">Volver al menú</a></div>
 ${mode==='ingresar'?'<p class="sm" style="margin-top:.6rem"><a href="#" data-act="cloudForgot">Olvidé mi contraseña</a></p>':''}
 ${vbFooter(true)}</div>`;}
let loginMode='ingresar';
function cloudLogin(msg){const L=$('#login');L.hidden=false;
 if(!CLOUD.on){L.innerHTML=`<div class="lbox"><h1>Acceso del equipo</h1><p>La conexión a la nube todavía no está configurada en este archivo (<b>Pendiente de configuración</b>). Vincular Business carga la dirección del proyecto y la clave publicable.</p><div class="row"><a class="btn" href="#menu">Volver al menú</a></div></div>`;return;}
 if(cl.recoveryToken){L.innerHTML=`<div class="lbox"><h1>Nueva contraseña</h1><p class="sm mut">Elegí una contraseña nueva (mínimo 10 caracteres). Después vas a necesitar tu <b>código de recuperación</b> para volver a abrir tus datos.</p><label for="cl-pw">Contraseña nueva</label><input id="cl-pw" type="password" autocomplete="new-password"><div class="merr" id="lerr" role="alert">${esc(msg||'')}</div><div class="row" style="margin-top:.8rem"><button class="btn gold" data-act="cloudNewPass">Guardar</button></div></div>`;return;}
 L.innerHTML=loginHtml(loginMode,msg);
 const go=()=>A.cloudGo($('#cl-go'));L.querySelectorAll('input').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter')go();}));}
A.cloudMode=el=>{loginMode=el.dataset.mode;cloudLogin();};
const lerr=m=>{const e=$('#lerr');if(e)e.textContent=m||'';};
const mailOk=s=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)&&s.length<=120;
function errTxt(e){if(e&&e.net)return'No hay conexión con la nube. Probá de nuevo cuando vuelva internet.';const m=String((e&&e.message)||e||'');
 if(/invalid login|Invalid login/i.test(m))return'Correo o contraseña incorrectos.';if(/already registered|already been registered/i.test(m))return'Ese correo ya tiene cuenta: usá "Ingresar".';
 if(/rate limit|too many/i.test(m))return'Demasiados intentos: esperá unos minutos.';return m;}
A.cloudGo=async el=>{const mode=el.dataset.mode;lerr('');el.disabled=true;
 try{
  if(mode==='ayuda'){const c=val('cl-sc').trim();await rpc('pedir_soporte',{p:{contacto:c,motivo:'clave',comercio:S.tenant.legal,detalle:val('cl-sd'),version:'cliente-1',equipo:navigator.userAgent.slice(0,100)}},{auth:false});lerr('');$('#login .lbox').insertAdjacentHTML('afterbegin','<div class="okbox">Recibimos tu pedido. Te contactamos pronto.</div>');return;}
  const email=val('cl-em').trim().toLowerCase(),pass=val('cl-pw');
  if(!mailOk(email))return lerr('Escribí un correo válido.');
  if(mode==='ingresar'){if(!pass)return lerr('Escribí tu contraseña.');await cloudSignInFlow(email,pass,{});return;}
  if(pass.length<10)return lerr('La contraseña necesita al menos 10 caracteres.');
  const code=val('cl-co').trim();if(code.length<6)return lerr('Falta el código.');
  let r;try{r=await signUp(email,pass);}catch(e){if(/already/i.test(String(e.message))){await signIn(email,pass);r={ok:true};}else throw e;}
  if(!r.ok)return lerr('Te mandamos un correo para confirmar la cuenta. Confirmala y volvé a "Ingresar".');
  if(mode==='crear'){const nm=val('cl-nm').trim();if(nm.length<2)return lerr('Escribí el nombre del comercio.');await cloudSignInFlow(email,pass,{newCommerce:{nombre:nm,codigo:code}});}
  else await cloudSignInFlow(email,pass,{inviteCode:code,already:true});
 }catch(e){lerr(errTxt(e));}finally{el.disabled=false;}};
function askText(title,label,opts={}){return new Promise(res=>{const w=modal(title,`<label for="ask-v">${esc(label)}</label><input id="ask-v" ${opts.secret?'type="password"':''} autocomplete="off" ${opts.num?'inputmode="numeric"':''}>${opts.hint?`<p class="sm mut">${esc(opts.hint)}</p>`:''}`,
  {okText:opts.ok||'Aceptar',onOk:w2=>{const v=val('ask-v').trim();if(!v){w2._err('Completá este dato.');return false;}res(v);}});
 w.addEventListener('click',e=>{const b=e.target.closest('[data-m="x"]');if(b)res(null);});});}
function showSecret(title,code,msg,share){return new Promise(res=>{modal(title,`<p>${msg}</p><p style="font:700 1.4rem/1.3 monospace;letter-spacing:.08em;text-align:center;background:#f4efe6;color:#242220;padding:.8rem;border-radius:10px;user-select:all">${esc(code)}</p>${share?`<div class="row" style="flex-wrap:wrap"><button class="btn sm" data-act="secCopy" data-t="${esc(share)}">Copiar mensaje de invitación</button><button class="btn sm" data-act="secWa" data-t="${esc(share)}">Enviar por WhatsApp</button></div>`:''}<label class="chk"><input type="checkbox" id="sec-ok"> Ya lo guardé en un lugar seguro</label>`,
  {noCancel:true,okText:'Listo',onOk:w=>{if(!$('#sec-ok',w).checked){w._err('Marcá que lo guardaste.');return false;}res(true);}});});}
A.secCopy=el=>{try{navigator.clipboard.writeText(el.dataset.t);toast('Mensaje copiado');}catch(e){toast('No se pudo copiar',1);}};
A.secWa=el=>{window.open('https://wa.me/?text='+encodeURIComponent(el.dataset.t),'_blank','noopener,noreferrer');};
async function cloudFetchMember(email){
 const mem=await sel('miembros?select=rol,nombre,comercio_id,comercios(id,nombre,slug)&usuario_id=eq.'+cl.uid);
 if(!Array.isArray(mem)||!mem.length)return null;
 return mem.find(m=>m.comercios&&m.comercios.slug===CLOUD.slug)||mem[0];}
async function cloudSignInFlow(email,pass,opts){
 let offline=false,raw,mem=null,created=false;const meta=cl.meta||{};
 if(!opts.already){try{await signIn(email,pass);}catch(e){if(e.net&&meta.email===email&&meta.dekWrap&&meta.comercio){offline=true;}else throw e;}}
 cl.email=email;
 if(offline){cl.uid=meta.uid;cl.rol=meta.rol;cl.nombre=meta.nombre;cl.comercio=meta.comercio;cl.slug=meta.comercio.slug;cl.ses=meta.ses||null;cl.dekWrap=meta.dekWrap;
  try{raw=await unwrapDek(meta.dekWrap,pass);}catch(e){throw new Error('Correo o contraseña incorrectos.');}}
 else{
  mem=await cloudFetchMember();
  if(!mem&&opts.inviteCode){const r=await rpc('aceptar_invitacion',{p_huella:sha256(normCode(opts.inviteCode))});if(!r.ok)throw new Error(r.error||'El código no es correcto.');mem=await cloudFetchMember();}
  if(!mem&&opts.newCommerce){const r=await rpc('crear_comercio',{p_nombre:opts.newCommerce.nombre,p_rubro:'comercio',p_codigo:opts.newCommerce.codigo});if(!r.ok)throw new Error(r.error||'No se pudo crear el comercio.');created=true;mem=await cloudFetchMember();}
  if(!mem)throw new Error('Tu cuenta todavía no pertenece a ningún comercio. Usá "Crear comercio" (con el código de Rave) o "Tengo una invitación".');
  cl.rol=mem.rol;cl.nombre=mem.nombre||email.split('@')[0];cl.comercio={id:mem.comercios.id,nombre:mem.comercios.nombre,slug:mem.comercios.slug};cl.slug=cl.comercio.slug;
  const cid=cl.comercio.id;
  const kr=await sel(`llaves?select=kdf,wrap,temporal&comercio_id=eq.${cid}&usuario_id=eq.${cl.uid}`);
  const patch=async nw=>{await hreq(`/rest/v1/llaves?comercio_id=eq.${cid}&usuario_id=eq.${cl.uid}`,{method:'PATCH',body:{kdf:nw.kdf,wrap:nw.wrap,temporal:false,actualizado:new Date().toISOString()},headers:{Prefer:'return=minimal'}});};
  if(!kr.length){
   let empty=false;if(cl.rol==='admin'){const b=await rpc('bajar',{p_comercio:cid,p_desde:null,p_limite:1});const rr=await sel('llaves_recuperacion?select=comercio_id&comercio_id=eq.'+cid);empty=!b.length&&!rr.length;}
   if(!empty)throw new Error('Tu cuenta no tiene la llave de cifrado de este comercio. Pedile al administrador una invitación nueva.');
   raw=rnd(32);const w=await wrapDek(raw,pass);await hreq('/rest/v1/llaves',{method:'POST',body:{comercio_id:cid,usuario_id:cl.uid,kdf:w.kdf,wrap:w.wrap,temporal:false},headers:{Prefer:'return=minimal'}});cl.dekWrap=w;created=true;
   const code=genCode(20,5);const rw=await wrapDek(raw,normCode(code));await hreq('/rest/v1/llaves_recuperacion',{method:'POST',body:{comercio_id:cid,kdf:rw.kdf,wrap:rw.wrap},headers:{Prefer:'return=minimal'}});
   await showSecret('Código de recuperación',code,'Este código es la <b>única forma</b> de volver a abrir los datos si olvidás la contraseña. Se muestra <b>una sola vez</b>: anotalo y guardalo (no en este equipo).');}
  else if(kr[0].temporal){const code=opts.inviteCode||await askText('Código de acceso','Escribí el código de acceso que te dio el administrador',{});if(!code)throw new Error('Ingreso cancelado.');
   try{raw=await unwrapDek(kr[0],normCode(code));}catch(e){throw new Error('El código de acceso no es correcto.');}
   const nw=await wrapDek(raw,pass);await patch(nw);cl.dekWrap=nw;}
  else{try{raw=await unwrapDek(kr[0],pass);cl.dekWrap=kr[0];}
   catch(e){ // la contraseña fue restablecida: la llave se reabre con el código de recuperación
    const code=await askText('Abrir tus datos','Tu contraseña fue restablecida. Escribí tu código de recuperación (el administrador lo guardó al crear el comercio).',{secret:true,ok:'Abrir'});
    if(!code)throw new Error('Ingreso cancelado.');
    const rr=await sel('llaves_recuperacion?select=kdf,wrap&comercio_id=eq.'+cid);
    if(!rr.length)throw new Error('Sólo el administrador puede usar el código de recuperación. Pedile que te quite y te vuelva a invitar.');
    try{raw=await unwrapDek(rr[0],normCode(code));}catch(e2){throw new Error('El código de recuperación no es correcto.');}
    const nw=await wrapDek(raw,pass);await patch(nw);cl.dekWrap=nw;}}
 }
 cl.dekRaw=raw;cl.dek=await dekKey(raw);
 const m2=cl.meta&&cl.meta.comercio&&cl.meta.comercio.id===cl.comercio.id&&cl.meta.uid===cl.uid?cl.meta:null;
 cl.fp=m2?(m2.fp||{}):{};cl.base=m2?(m2.base||{}):{};cl.outStock=m2?(m2.outStock||[]):[];cl.cursor=m2?(m2.cursor||null):null;cl.rejects=m2?(m2.rejects||[]):[];cl.pubHash=m2?(m2.pubHash||''):'';
 let st=await cloudLoadState();
 if(!st){S=created?DEF():blankState();S.users=[];cl.fp={};cl.base={};cl.outStock=[];cl.cursor=null;if(created){S.tenant.legal=cl.comercio.nombre;S.tenant.name=cl.comercio.nombre.slice(0,24);S.customers=[];}}
 else{S=st;S.users=[];}
 cl.ready=true;user={id:cl.uid,name:cl.nombre,role:cl.rol};
 if(!offline){let ok=true;for(let i=0;i<5&&ok;i++){try{ok=!(await rpc('registrar_caja',{p_comercio:cl.comercio.id,p_nro:+S.tenant.caja||1,p_disp:cl.dev,p_nombre:cl.nombre}));}catch(e){ok=false;break;}
   if(ok){const n=await askText('Número de caja','Ese número de caja ya lo usa otro equipo. Escribí otro número (1 a 99) para este equipo.',{num:1});if(!n){break;}S.tenant.caja=Math.min(99,Math.max(1,parseInt(n,10)||1));}}}
 await cloudMetaSave();
 audit('LOGIN','ingreso a la nube'+(offline?' (sin conexión)':''));
 startTimers();
 if(!offline){try{await cloudSync(true);}catch(e){}if(cl.rol==='admin')await ensureClubKey();}
 await cloudPersistNow();
 location.hash='#panel/inicio';route();}
function startTimers(){clearInterval(cl.timer);cl.timer=setInterval(()=>cloudSync(),15000);
 window.addEventListener('online',()=>cloudSync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)cloudSync();});
 const bump=()=>{cl.lastAct=Date.now();};['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,bump,{passive:true}));bump();
 clearInterval(cl.idle);cl.idle=setInterval(()=>{if(cl.ready&&Date.now()-cl.lastAct>30*60000)A.logout();},30000);}
async function cloudSync(force){if(!cl.ready||cl.busy||!CLOUD.on)return;cl.busy=true;cloudBadge();
 try{
  if(!cl.cursor)await pullAll();
  await pushAll();await pullAll();
  cl.lastOk=Date.now();cl.lastErr='';cl.online=true;
  if(cl.rol==='admin')autoPublish();
  if(Date.now()-(cl.lastAltas||0)>60000){cl.lastAltas=Date.now();try{await importAltas();}catch(e){}}
  if(typeof arcaTick==='function'){try{await arcaTick();}catch(e){}}
  await cloudMetaSave();await cloudPersistNow();
 }catch(e){
  if(e.net)cl.lastErr='Sin conexión';
  else if(e.status===403&&/no sos miembro/i.test(String(e.message))){cl.lastErr='Tu acceso fue quitado';cl.revoked=true;setTimeout(()=>{if(cl.revoked)A.logout();},800);}
  else if(e.status===401||e.status===403&&/JWT/i.test(String(e.message))){cl.lastErr='Reconectá la nube (Nube → Reconectar)';}
  else cl.lastErr=String(e.message||'error').slice(0,100);
 }finally{cl.busy=false;cloudBadge();refreshIfIdle();}}
/* si cambió algo que vino de otro equipo y nadie está escribiendo, se refresca la pantalla */
let lastShown='';function refreshIfIdle(){try{if($('#panel').hidden||document.querySelector('#modal-root .ov'))return;const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return;
 if(['vender','caja'].includes(curScreen))return;const sig=cyrb(canon([S.products.length,S.sales.length,S.movs.length,S.customers.length,S.sessions.length,S.closures.length,S.products.reduce((x,p)=>x+(+p.stock||0),0)]));
 if(sig!==lastShown){lastShown=sig;rerender();}}catch(e){}}
A.logout=async()=>{if(!CLOUD.on){audit('LOGOUT','');user=null;location.hash='#menu';return;}
 const was=cl.ready;if(was){audit('LOGOUT','');try{await Promise.race([cloudSync(true),new Promise(r=>setTimeout(r,4000))]);}catch(e){}await cloudPersistNow();
  try{if(cl.ses)fetch(CLOUD.url+'/auth/v1/logout',{method:'POST',headers:{apikey:CLOUD.key,Authorization:'Bearer '+cl.ses.access}}).catch(()=>{});}catch(e){}}
 cl.ready=false;clearInterval(cl.timer);clearInterval(cl.idle);cl.dek=null;cl.dekRaw=null;cl.ses=null;cl.revoked=false;
 const cm=cl.comercio;await cloudMetaSave();cl.meta=await kvGet('cloud');
 S=DEF();S.users=[];user=null;loginMode='ingresar';location.hash='#menu';route();};
A.cloudForgot=async()=>{const email=(val('cl-em')||'').trim().toLowerCase();if(!mailOk(email))return lerr('Escribí tu correo arriba y volvé a tocar "Olvidé mi contraseña".');
 try{await hreq('/auth/v1/recover',{method:'POST',auth:false,body:{email}});}catch(e){if(e.net)return lerr(errTxt(e));}
 lerr('Si el correo está registrado, te mandamos un enlace para elegir otra contraseña. Después vas a necesitar tu código de recuperación. Si no te llega, usá "Necesito ayuda".');};
A.cloudNewPass=async()=>{const p=val('cl-pw');if(p.length<10)return lerr('La contraseña necesita al menos 10 caracteres.');
 try{cl.ses={access:cl.recoveryToken,refresh:'',exp:Date.now()+3000000};await hreq('/auth/v1/user',{method:'PUT',body:{password:p}});cl.ses=null;cl.recoveryToken=null;loginMode='ingresar';cloudLogin('Contraseña cambiada. Ingresá con la nueva.');}catch(e){lerr(errTxt(e));}};
/* ---------- llave pública del Club (alta anónima desde el menú, cifrada de punta a punta) ---------- */
async function ensureClubKey(){if(cl.clubPriv||!cl.dek||cl.rol!=='admin')return;
 const kp=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
 const pub=await crypto.subtle.exportKey('jwk',kp.publicKey),priv=await crypto.subtle.exportKey('jwk',kp.privateKey);
 cl.clubPriv={pub,priv:await sealJ(priv,cl.dek,'clubkey|'+cl.comercio.id),jwk:priv,new:true};try{await cloudSync(true);}catch(e){}}
async function rsaSeal(jwkPub,obj){const pk=await crypto.subtle.importKey('jwk',jwkPub,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
 const ak=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);const iv=rnd(12);
 const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},ak,te.encode(JSON.stringify(obj))));
 const k=new Uint8Array(await crypto.subtle.encrypt({name:'RSA-OAEP'},pk,await crypto.subtle.exportKey('raw',ak)));return{k:b64(k),iv:b64(iv),ct:b64(ct)};}
async function rsaOpen(jwkPriv,box){const sk=await crypto.subtle.importKey('jwk',jwkPriv,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
 const raw=await crypto.subtle.decrypt({name:'RSA-OAEP'},sk,unb64(box.k));const ak=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
 return JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv)},ak,unb64(box.ct))));}
async function importAltas(){if(!cl.ready||!cl.clubPriv||!cl.clubPriv.jwk||!cl.online)return 0;
 const rows=await sel(`club_altas?select=id,cifrado&comercio_id=eq.${cl.comercio.id}&estado=eq.nueva&order=id&limit=100`);if(!rows.length)return 0;
 const ok=[],bad=[];
 for(const r of rows){try{const p=await rsaOpen(cl.clubPriv.jwk,r.cifrado);const b=parseBirth(p.birth);const w=normWA(p.wa);
   if(!b||!w||ageOf(b)<18||String(p.name||'').trim().length<1||String(p.last||'').trim().length<1){bad.push(r.id);continue;}
   if(!S.customers.some(c=>normWA(c.wa)===w)){const c=custCreate({name:p.name,last:p.last,birth:p.birth,wa:p.wa,comm:!!p.comm},'menú público');c.id='alta'+r.id;}
   ok.push(r.id);}catch(e){bad.push(r.id);}}
 if(ok.length)await rpc('club_altas_marcar',{p_comercio:cl.comercio.id,p_ids:ok,p_estado:'importada'});
 if(bad.length)await rpc('club_altas_marcar',{p_comercio:cl.comercio.id,p_ids:bad,p_estado:'rechazada'});
 if(ok.length){audit('CLUB_ALTAS_IMPORT',ok.length+' altas del menú público ('+bad.length+' rechazadas)');save();}return ok.length;}
/* ---------- menú público en la nube ---------- */
function menuContent(){const site=pubSite();
 const cps=S.coupons.filter(cp=>cp.active&&cp.public!==false&&cp.aud==='todos').map(cp=>({code:cp.code,type:cp.type,value:cp.value,min:cp.min||0,from:cp.from||'',to:cp.to||'',note:cp.note||'',aud:cp.aud}));
 return{site,catalog:pubCatalog(),plans:pubPlans(),coupons:cps,legal:legalPublic(),clubkey:cl.clubPriv?cl.clubPriv.pub:null};}
async function cloudPublishMenu(manual){if(!cl.ready||cl.rol!=='admin')return{ok:false};
 const c=menuContent();const h=sha256(canon(c));if(!manual&&h===cl.pubHash)return{ok:true,same:true};
 const r=await rpc('publicar_menu',{p_comercio:cl.comercio.id,p_contenido:c,p_hash:h});cl.pubHash=h;cl.lastPub=Date.now();cl.pubVer=r.version;
 cl.pubSnap={version:r.version,publicado:new Date().toISOString(),nombre:cl.comercio.nombre,contenido:JSON.parse(JSON.stringify(c))};await kvPut('pubsnap',cl.pubSnap);await cloudMetaSave();return r;}
function autoPublish(){if(cl.lastPub&&Date.now()-cl.lastPub<30000)return;cloudPublishMenu(false).catch(e=>{if(!e.net)cl.lastErr='Menú: '+String(e.message).slice(0,80);});}
async function loadPubSnap(){if(!CLOUD.on||!CLOUD.slug)return;
 if(!cl.pubSnap){const c=await kvGet('pubsnap');if(c&&c.contenido)cl.pubSnap=c;}
 try{const r=await rpc('menu_publico',{p_slug:CLOUD.slug},{auth:false});if(r&&r.contenido){const changed=!cl.pubSnap||cl.pubSnap.version!==r.version;cl.pubSnap=r;await kvPut('pubsnap',r);return changed;}}catch(e){}return false;}
const snapC=()=>cl.pubSnap&&cl.pubSnap.contenido||null;
async function cloudClubJoin(f){const en=()=>window.RAVE_LANG&&window.RAVE_LANG()==='en';const bad=(es,e)=>({ok:false,msg:en()?e:es});
 const full=String(f.nombre||'').trim().replace(/\s+/g,' ');const parts=full.split(' ');
 if(parts.length<2||full.length<3||full.length>80)return bad('Ingresá tu nombre y apellido.','Enter your first and last name.');
 const last=parts.pop(),name=parts.join(' ');const b=parseBirth(f.cumple);if(!b)return bad('Elegí una fecha de cumpleaños válida.','Choose a valid birthday.');
 const w=normWA(f.whatsapp);if(!w||/^(\d)\1+$/.test(w))return bad('Ingresá un WhatsApp válido.','Enter a valid WhatsApp number.');
 if(ageOf(b)<18)return bad('El Club RAVE es sólo para mayores de 18 años.','RAVE Club is for adults (18+) only.');
 const t=now();const recent=clubHits.filter(x=>t-x<60000);if(recent.length>=3)return bad('Demasiados intentos, probá en un minuto.','Too many attempts, try again in a minute.');
 clubHits.length=0;recent.forEach(x=>clubHits.push(x));clubHits.push(t);
 const key=snapC()&&snapC().clubkey;if(!key)return bad('El Club no está disponible en este momento.','The Club is not available right now.');
 try{const enc=await rsaSeal(key,{name:name.replace(/[<>]/g,'').slice(0,40),last:last.replace(/[<>]/g,'').slice(0,40),birth:b.y+'-'+String(b.mo).padStart(2,'0')+'-'+String(b.d).padStart(2,'0'),wa:waFull(w),comm:!!f.comm,v:'v1',ts:t});
  const r=await rpc('club_alta',{p_slug:CLOUD.slug,p_huella:sha256(uid()+uid()+uid()+t),p_cifrado:enc},{auth:false});
  if(!r||!r.ok)return bad((r&&r.error)||'No pudimos registrarte, probá de nuevo.','We could not sign you up, please try again.');
 }catch(e){return bad('No pudimos registrarte (¿hay internet?). Probá de nuevo.','We could not sign you up (is there internet?). Please try again.');}
 return{ok:true,msg:en()?'Done! We received your request: the card is activated at the counter.':'¡Listo! Recibimos tu solicitud: tu tarjeta se activa en el mostrador.'};}
function cloudApiWrap(local){if(!CLOUD.on)return local;
 const pub=()=>!cl.ready;
 const pick=(l,p)=>(...a)=>pub()?p(...a):l(...a);
 const today=()=>dkey(now());
 const cpOk=cp=>(!cp.from||today()>=cp.from)&&(!cp.to||today()<=cp.to);
 return{
  site:pick(local.site,()=>{const c=snapC();return c?c.site:{title:'',sub:{es:'',en:''},pitch:{es:'',en:''},promo:{on:false,es:'',en:''},address:'',social:[],icons:{},footer:{es:'',en:''},wa:'',alcFrom:7,alcTo:24,hideTeamBtn:false,clubOn:false,wifi:{on:false}};}),
  catalog:pick(local.catalog,()=>{const c=snapC();return c?c.catalog:{secciones:[],productos:[]};}),
  clubJoin:pick(local.clubJoin,cloudClubJoin),
  card:pick(local.card,()=>null),cardCode:pick(local.cardCode,()=>null),cardLogin:pick(local.cardLogin,()=>null),
  coupons:pick(local.coupons,()=>{const c=snapC();return((c&&c.coupons)||[]).filter(cpOk).map(cp=>({code:cp.code,desc:cp.note||(cp.type==='pct'?cp.value+' % de descuento':money(cp.value)+' de descuento'),cond:(cp.min?'Compra mínima '+money(cp.min)+' · ':'')+'Excluye tabaco'}));}),
  couponInfo:pick(local.couponInfo,(code,total)=>{code=String(code||'').trim().toUpperCase();const c=snapC();const cp=((c&&c.coupons)||[]).find(x=>x.code===code);
   if(!cp)return{ok:false,msg:'Ese cupón no existe o no está activo.',msgEn:'That coupon does not exist or is not active.'};
   if(!cpOk(cp))return{ok:false,msg:'El cupón no está vigente.',msgEn:'The coupon is not valid today.'};
   if(total<(cp.min||0))return{ok:false,msg:'Compra mínima '+money(cp.min)+'.',msgEn:'Minimum purchase '+money(cp.min)+'.'};
   const d=cp.type==='pct'?cp.value+' % de descuento':money(cp.value)+' de descuento';const dd=cpDisc(cp,total);
   return{ok:true,code:cp.code,desc:d+' (se valida en el mostrador)',descEn:(cp.type==='pct'?cp.value+' % off':money(cp.value)+' off')+' (validated at the counter)',total:Math.max(0,total-dd)};}),
  plans:pick(local.plans,()=>{const c=snapC();return(c&&c.plans)||[];}),
  orderRequest:pick(local.orderRequest,o=>{rpc('menu_evento',{p_slug:CLOUD.slug,p_tipo:'pedido',p_items:(o.items||[]).length,p_total:Math.round((+o.total||0)*100)},{auth:false}).catch(()=>{});}),
  legal:pick(local.legal,()=>{const c=snapC();return(c&&c.legal)||[];}),
  logArrep:pick(local.logArrep,()=>{rpc('menu_evento',{p_slug:CLOUD.slug,p_tipo:'arrepentimiento'},{auth:false}).catch(()=>{});}),
  openPanel:local.openPanel};}
/* ---- Equipo: invitar, roles y quitar (se usa en Nube y en Usuarios y permisos) ---- */
function teamCardHtml(){return `<div class="card" id="team-card" style="margin-top:1rem"><h3>Equipo (personas con acceso)</h3><div id="nb-team" class="sm mut">Cargando…</div>
 <h4>Invitar a una persona</h4><div class="grid g2"><div><label for="nb-em">Correo</label><input id="nb-em" type="email"></div><div><label for="nb-nm">Nombre</label><input id="nb-nm" maxlength="60"></div><div><label for="nb-rl">Rol</label><select id="nb-rl"><option value="mostrador">Mostrador</option><option value="supervisor">Supervisor</option><option value="operador">Operador</option><option value="admin">Administrador</option></select></div></div>
 <div class="row" style="margin-top:.5rem"><button class="btn gold" data-act="nbInvite">Generar código de acceso</button></div>
 <p class="sm mut">La persona entra a "Tengo una invitación", escribe ese correo, elige su contraseña y pega el código. Si olvida su contraseña: "Olvidé mi contraseña" y luego quitala y volvé a invitarla.</p>
 <h4>Código de recuperación</h4><p class="sm">Permite volver a abrir los datos si el administrador pierde su contraseña. Si lo perdiste, generá uno nuevo (el anterior deja de servir).</p><button class="btn" data-act="nbRecov">Generar código nuevo</button></div>`;}
async function teamInit(){if(!CLOUD.on||cl.rol!=='admin')return;const box=document.getElementById('nb-team');if(!box)return;
  try{const [m,inv]=await Promise.all([sel(`miembros?select=usuario_id,rol,nombre,email&comercio_id=eq.${cl.comercio.id}&order=creado`),rpc('invitaciones_de',{p_comercio:cl.comercio.id})]);
   box.innerHTML=`<div class="tw"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th></th></tr></thead><tbody>${m.map(x=>`<tr><td>${esc(x.nombre||'')}</td><td>${esc(x.email||'')}</td><td>${x.usuario_id===cl.uid?esc(ROLES_LBL[x.rol]):`<select data-act-change="nbRole" class="nb-role" data-u="${esc(x.usuario_id)}">${Object.keys(ROLES_LBL).map(r=>`<option value="${r}" ${r===x.rol?'selected':''}>${ROLES_LBL[r]}</option>`).join('')}</select>`}</td><td>${x.usuario_id===cl.uid?'(vos)':`<button class="btn sm red" data-act="nbDel" data-u="${esc(x.usuario_id)}" data-n="${esc(x.nombre||x.email||'')}">Quitar</button>`}</td></tr>`).join('')}</tbody></table></div>
   ${inv.length?`<p class="sm"><b>Invitaciones pendientes:</b> ${inv.map(i=>esc(i.email)+' ('+esc(ROLES_LBL[i.rol]||i.rol)+')').join(', ')}</p>`:''}`;
   box.querySelectorAll('.nb-role').forEach(s=>s.addEventListener('change',async()=>{try{await rpc('cambiar_rol',{p_comercio:cl.comercio.id,p_usuario:s.dataset.u,p_rol:s.value});audit('EQUIPO_ROL',s.value);toast('Rol cambiado');}catch(e){toast(errTxt(e),1);rerender();}}));
  }catch(e){box.textContent='No se pudo cargar el equipo: '+errTxt(e);}}
if(CLOUD.on){INV_HOOK.online=()=>!!(cl.ready&&cl.online);INV_HOOK.preview=async ids=>{const r=await rpc('inventario_vista_previa_borrado',{p_comercio:cl.comercio.id,p_ids:ids});return Array.isArray(r)?r:[];};}
if(CLOUD.on){UI_HOOK.usersCard=()=>cl.rol==='admin'?teamCardHtml():'<div class="card" style="margin-top:1rem"><h3>Equipo</h3><p class="sm mut">Sólo el administrador puede invitar o quitar personas.</p></div>';UI_HOOK.usersAfter=teamInit;}
/* ---------- pantalla "Nube" ---------- */
const ROLES_LBL={admin:'Administrador',supervisor:'Supervisor',mostrador:'Mostrador',operador:'Operador'};
reg('nube','Nube','globe','config',()=>{
 if(!CLOUD.on)return `<h1>Nube</h1><div class="card"><span class="tag warn">Pendiente de configuración</span><p>Esta copia funciona <b>sólo en este equipo</b>. Para sincronizar varios equipos y publicar el menú para el público, Vincular Business carga en el archivo la dirección del proyecto de Supabase y su clave <b>publicable</b> (nunca una clave secreta).</p></div>`;
 let n=0;try{n=pendingCount();}catch(e){}
 const adm=cl.rol==='admin';
 return `<div class="row"><h1 class="sp">Nube</h1><button class="btn gold" data-act="nbSync">Sincronizar ahora</button></div>
 <div class="grid g2"><div class="card"><h3>Estado</h3><table><tbody>
 <tr><td>Comercio</td><td><b>${esc(cl.comercio.nombre)}</b> · dirección corta <code>${esc(cl.slug)}</code></td></tr>
 ${CLOUD.slug&&CLOUD.slug!==cl.slug?`<tr><td colspan="2"><div class="errbox">La dirección corta de este archivo (<code>${esc(CLOUD.slug)}</code>) no coincide con la del comercio (<code>${esc(cl.slug)}</code>): el público no verá el menú. Vincular Business tiene que corregir el archivo.</div></td></tr>`:''}
 <tr><td>Cuenta</td><td>${esc(cl.email)} · ${esc(ROLES_LBL[cl.rol]||cl.rol)}</td></tr>
 <tr><td>Este equipo</td><td>Caja ${S.tenant.caja}</td></tr>
 <tr><td>Conexión</td><td><span class="tag ${cl.online&&!cl.lastErr?'ok':'warn'}">${cl.lastErr?esc(cl.lastErr):cl.online?'Conectado':'Sin conexión'}</span></td></tr>
 <tr><td>Última sincronización</td><td>${cl.lastOk?fmtDT(cl.lastOk):'—'}</td></tr>
 <tr><td>Por subir</td><td>${n} cambios</td></tr></tbody></table>
 <div class="row" style="margin-top:.6rem">${cl.ses?'':'<button class="btn" data-act="nbReauth">Reconectar</button>'}<button class="btn" data-act="nbPass">Cambiar mi contraseña</button><button class="btn" data-act="logout">Cerrar sesión</button></div>
 <p class="sm mut">Si no hay internet seguís vendiendo: todo se guarda cifrado en este equipo y se sube solo cuando vuelve la conexión.</p>
 ${cl.rejects.length?`<details><summary class="sm">Cambios que el servidor no aceptó (${cl.rejects.length})</summary>${cl.rejects.slice(-10).map(r=>`<p class="sm">${fmtDT(r.ts)} · ${esc(r.key)} — ${esc(r.m)}</p>`).join('')}</details>`:''}</div>
 <div class="card"><h3>Menú público</h3><p class="sm">Dirección que ve el público (código QR): <code>${esc(location.href.split('#')[0])}</code></p>
 <p class="sm">Versión publicada: <b>${cl.pubSnap?'v'+cl.pubSnap.version:'ninguna'}</b>${cl.pubSnap?' · '+fmtDT(Date.parse(cl.pubSnap.publicado)):''}. El catálogo se actualiza solo cuando cambian productos o precios.</p>
 ${adm?'<div class="row"><button class="btn" data-act="nbPublish">Publicar ahora</button></div>':'<p class="sm mut">Sólo el administrador publica el menú.</p>'}
 <div class="row" style="margin-top:.4rem"><button class="btn" data-act="nbAltas">Traer altas del Club</button></div>
 <p class="sm mut">Las altas del Club llegan cifradas: sólo este comercio las puede abrir.</p></div></div>
 ${adm?teamCardHtml():''}`;},
 teamInit,'Sistema');
A.nbSync=async()=>{await cloudSync(true);await importAltas().catch(()=>{});toast(cl.lastErr?cl.lastErr:'Sincronizado',!!cl.lastErr);rerender();};
A.nbPublish=async()=>{try{const r=await cloudPublishMenu(true);audit('MENU_NUBE','publicado v'+(r.version||'?'));toast('Menú publicado v'+r.version);rerender();}catch(e){toast(errTxt(e),1);}};
A.nbAltas=async()=>{try{const n=await importAltas();toast(n?n+' altas nuevas del Club':'No hay altas nuevas');rerender();}catch(e){toast(errTxt(e),1);}};
A.nbReauth=async()=>{const p=await askText('Reconectar','Escribí tu contraseña',{secret:true,ok:'Reconectar'});if(!p)return;try{await signIn(cl.email,p);await cloudMetaSave();await cloudSync(true);toast('Reconectado');rerender();}catch(e){toast(errTxt(e),1);}};
A.nbPass=async()=>{const p=await askText('Cambiar contraseña','Contraseña nueva (mínimo 10 caracteres)',{secret:true,ok:'Cambiar'});if(!p)return;if(p.length<10)return toast('Mínimo 10 caracteres',1);
 try{await hreq('/auth/v1/user',{method:'PUT',body:{password:p}});const nw=await wrapDek(cl.dekRaw,p);
  await hreq(`/rest/v1/llaves?comercio_id=eq.${cl.comercio.id}&usuario_id=eq.${cl.uid}`,{method:'PATCH',body:{kdf:nw.kdf,wrap:nw.wrap,temporal:false,actualizado:new Date().toISOString()},headers:{Prefer:'return=minimal'}});
  cl.dekWrap=nw;await cloudMetaSave();audit('CAMBIO_CLAVE','contraseña propia');toast('Contraseña cambiada');}catch(e){toast(errTxt(e),1);}};
A.nbInvite=async()=>{const email=val('nb-em').trim().toLowerCase(),nm=val('nb-nm').trim(),rol=val('nb-rl');if(!mailOk(email))return toast('Correo inválido',1);
 const code=genCode(12,4);try{const w=await wrapDek(cl.dekRaw,normCode(code));
  await rpc('invitar_miembro',{p_comercio:cl.comercio.id,p_email:email,p_rol:rol,p_nombre:nm,p_huella:sha256(normCode(code)),p_llave:{kdf:w.kdf,wrap:w.wrap}});
  audit('EQUIPO_INVITAR',email+' · '+rol);await showSecret('Código de acceso para '+(nm||email),code,'Pasáselo a la persona por un canal seguro (en persona o WhatsApp). Vale 14 días y se usa una sola vez. Se muestra <b>una sola vez</b>.','Hola'+(nm?' '+nm:'')+'! Te invité al sistema de '+cl.comercio.nombre+'. Entrá a '+location.href.split('#')[0]+' → "Acceso del equipo" → "Tengo una invitación". Tu correo: '+email+' · Código de acceso: '+code+' (vale 14 días, se usa una sola vez). Elegí una contraseña de 10 caracteres o más.');rerender();}
 catch(e){toast(errTxt(e),1);}};
A.nbDel=el=>confirmBox('Quitar del equipo','¿Quitar a '+esc(el.dataset.n)+'? Pierde el acceso en todos los equipos.',async()=>{try{await rpc('quitar_miembro',{p_comercio:cl.comercio.id,p_usuario:el.dataset.u});audit('EQUIPO_QUITAR',el.dataset.n);toast('Quitado');rerender();}catch(e){toast(errTxt(e),1);}},'Quitar');
A.nbRecov=()=>confirmBox('Código de recuperación','Se genera uno nuevo y el anterior deja de servir. ¿Seguimos?',async()=>{try{const code=genCode(20,5);const w=await wrapDek(cl.dekRaw,normCode(code));
 await hreq('/rest/v1/llaves_recuperacion?comercio_id=eq.'+cl.comercio.id,{method:'PATCH',body:{kdf:w.kdf,wrap:w.wrap,creado:new Date().toISOString()},headers:{Prefer:'return=minimal'}});audit('RECUPERACION_NUEVA','código regenerado');
 await showSecret('Código de recuperación',code,'Anotalo y guardalo. Reemplaza al anterior.');}catch(e){toast(errTxt(e),1);}});
/* número de caja: en la nube cada equipo reserva el suyo */
const _cfgSaveLocal=A.cfgSave;
A.cfgSave=async el=>{if(CLOUD.on&&cl.ready){const c=parseNum(val('cf-c'));if(c>=1&&c!==S.tenant.caja){try{const ok=await rpc('registrar_caja',{p_comercio:cl.comercio.id,p_nro:c,p_disp:cl.dev,p_nombre:cl.nombre});if(!ok)return toast('Ese número de caja ya lo usa otro equipo',1);}catch(e){return toast(errTxt(e),1);}}}return _cfgSaveLocal(el);};
