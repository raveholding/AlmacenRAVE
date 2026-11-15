/* ===== V26.49 · 4.34 H5 · Pantalla del cliente (segundo monitor) =====
   · Ruta `#pantalla-cliente/<caja>` dentro del MISMO index.html (misma marca, CSP y build). Arranca en modo mínimo:
     NO abre el estado, NO descifra nada, NO pide usuario; sólo escucha.
   · Canal BroadcastChannel('svb-cs-' + base de la build + '-' + caja): las 4 publicaciones comparten origen en GitHub Pages,
     así que el nombre de la base separa una demo del sistema real.
   · Mensajes versionados {v:1,type:'cart'|'paid'|'idle',seq,name,lines,sub,ben,adj,total,cust}. NUNCA viajan costos, márgenes,
     CUIT, DNI, teléfono ni saldos (los saldos del cliente están APAGADOS por decisión del dueño, 2026-11-04). */
const CS_V=1;
const csCh=caja=>'svb-cs-'+((window.RAVE_BUILD&&window.RAVE_BUILD.db)||'rave')+'-'+caja;
const csIsRoute=()=>/^#pantalla-cliente(\/|$)/.test(location.hash||'');
let CS_BC=null,CS_SEQ=0,CS_LAST='';
function csSupported(){return typeof BroadcastChannel!=='undefined';}
function csOut(){if(!csSupported())return null;const c=csCh(S&&S.tenant?S.tenant.caja:1);if(CS_BC&&CS_BC.name===c)return CS_BC;try{CS_BC&&CS_BC.close();}catch(e){}CS_BC=new BroadcastChannel(c);return CS_BC;}
function csPayload(type,extra){const first=n=>String(n||'').trim().split(/\s+/)[0]||'';const cust=pos.cust?custById(pos.cust):null;
 const lines=pos.lines.map(l=>({name:String(l.name).slice(0,80),qty:l.qty,unit:l.unit||'u',amt:typeof lnAmt==='function'?lnAmt(l):Math.round(l.qty*l.price)}));
 const sub=typeof posGross==='function'?posGross():lines.reduce((a,l)=>a+l.amt,0);const B=typeof posBen==='function'?posBen():{disc:0};
 let adj=[],total=sub-(B.disc||0);if(typeof paCalcFor==='function'&&!pos.mix){const R=paCalcFor([{m:pos.method,b:total}]);adj=R.adj.map(a=>({label:a.label,amt:a.amt}));total=R.total;}
 return Object.assign({v:CS_V,type,seq:++CS_SEQ,ts:Date.now(),name:(S.tenant&&S.tenant.name)||'',lines,sub,ben:B.disc?{label:B.label,amt:B.disc}:null,adj,total,method:MET[pos.method]||pos.method,cust:cust?{first:first(cust.name)}:null},extra||{});}
function csPush(){if(!csSupported()||!S||!S.cfg)return;const ch=csOut();if(!ch)return;const p=csPayload(pos.lines.length?'cart':'idle');const k=JSON.stringify([p.type,p.lines,p.total,p.adj,p.ben,p.cust,p.method]);if(k===CS_LAST)return;CS_LAST=k;try{ch.postMessage(p);}catch(e){}}
function csPaid(sale){if(!csSupported())return;const ch=csOut();if(!ch)return;CS_LAST='';try{ch.postMessage({v:CS_V,type:'paid',seq:++CS_SEQ,ts:Date.now(),name:(S.tenant&&S.tenant.name)||'',total:sale.total,vuelto:sale.vuelto||0});}catch(e){}}
A.csOpen=()=>{if(!csSupported())return toast('Este navegador no permite la pantalla del cliente.',1);const u=location.href.split('#')[0]+'#pantalla-cliente/'+encodeURIComponent(S.tenant.caja);
 const w=window.open(u,'svb-cs-'+S.tenant.caja,'popup,width=1024,height=700');if(!w)return toast('El navegador bloqueó la ventana: permití ventanas emergentes para este sitio.',1);
 audit('PANTALLA_CLIENTE','abierta · caja '+S.tenant.caja);setTimeout(()=>{CS_LAST='';csPush();},900);toast('Pantalla del cliente abierta: arrastrala al segundo monitor y poné pantalla completa (F11).');};

/* ---------- lado del cliente: modo mínimo ---------- */
function csBoot(){const caja=decodeURIComponent((location.hash.split('/')[1]||'1'));document.title='Pantalla del cliente';
 const st=document.createElement('style');st.textContent=`html,body{margin:0;height:100%;background:#111;color:#fff;font:18px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
 #cs{display:grid;grid-template-rows:auto 1fr auto;height:100vh;padding:2vh 3vw;box-sizing:border-box;gap:2vh}#cs h1{margin:0;font-size:4vh}#cs .ln{display:flex;justify-content:space-between;gap:1rem;font-size:3.2vh;padding:.6vh 0;border-bottom:1px solid #333}
 #cs .list{overflow:auto}#cs .tot{display:flex;justify-content:space-between;font-size:7vh;font-weight:700;border-top:3px solid #c9963e;padding-top:1vh}#cs .sm{font-size:2.6vh;opacity:.85}#cs .adj{color:#7bd88f}#cs .rec{color:#ffb4a8}
 #cs .idle{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:3vh;text-align:center}#cs .idle img{max-width:50vw;max-height:40vh;border-radius:16px;background:#fff}#cs .thanks{font-size:8vh;font-weight:700}
 #cs .wait{opacity:.6;font-size:2.4vh}`;document.head.appendChild(st);
 const app=document.getElementById('app');if(app)app.hidden=true;const root=document.createElement('div');root.id='cs';root.setAttribute('aria-live','polite');document.body.appendChild(root);
 const M=n=>typeof money==='function'?money(n):'$ '+(n/100).toFixed(2);let lastTs=0,timer=null,name='';
 const idle=()=>{root.innerHTML=`<div class="idle" style="grid-row:1/4">${typeof LOGO_MENU==='string'&&LOGO_MENU?`<img src="${LOGO_MENU}" alt="">`:''}<h1>${esc(name||'¡Bienvenido!')}</h1><p class="wait">Pantalla del cliente · caja ${esc(caja)}</p></div>`;};
 const show=m=>{if(!m||m.v!==CS_V||typeof m.ts!=='number'||m.ts<lastTs)return;lastTs=m.ts;name=m.name||name;clearTimeout(timer);
  if(m.type==='idle'||(m.type==='cart'&&!(m.lines||[]).length))return idle();
  if(m.type==='paid'){root.innerHTML=`<div class="idle" style="grid-row:1/4"><div class="thanks">¡Gracias por su compra!</div><div style="font-size:6vh">Total ${M(m.total)}</div>${m.vuelto>0?`<div style="font-size:5vh">Su vuelto: ${M(m.vuelto)}</div>`:''}</div>`;timer=setTimeout(idle,60000);return;}
  root.innerHTML=`<div><h1>${esc(name)}</h1>${m.cust?`<p class="sm">Hola, ${esc(m.cust.first)}</p>`:''}</div>
   <div class="list">${m.lines.map(l=>`<div class="ln"><span>${esc(l.name)} × ${String(l.qty).replace('.',',')}${l.unit&&l.unit!=='u'?' '+esc(l.unit):''}</span><b>${M(l.amt)}</b></div>`).join('')}</div>
   <div>${(m.ben||(m.adj&&m.adj.length))?`<div class="ln sm"><span>Subtotal</span><span>${M(m.sub)}</span></div>`:''}${m.ben?`<div class="ln sm adj"><span>${esc(m.ben.label)}</span><span>− ${M(m.ben.amt)}</span></div>`:''}${(m.adj||[]).map(a=>`<div class="ln sm ${a.amt<0?'adj':'rec'}"><span>${esc(a.label)}</span><span>${a.amt<0?'− ':'+ '}${M(Math.abs(a.amt))}</span></div>`).join('')}
   <div class="tot"><span>TOTAL</span><span>${M(m.total)}</span></div><p class="sm">Medio de pago: ${esc(m.method||'')}</p></div>`;};
 idle();if(!csSupported()){root.innerHTML='<div class="idle" style="grid-row:1/4"><h1>Este navegador no permite la pantalla del cliente</h1></div>';return;}
 const bc=new BroadcastChannel(csCh(caja));bc.onmessage=e=>show(e.data);window.__cs={show,caja,channel:csCh(caja)};}
