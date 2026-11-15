/* ===== V26.49 · 4.34 H2/H4 · Cortes X y Z, cajón de dinero y corte del papel =====
   · Corte X: foto guardada (escritura única, colección `cortesx`), numerada por caja y turno (X-<caja>-<n>),
     imprimible; NO cierra ni reinicia la caja.
   · Corte Z: el cierre sellado de siempre + número correlativo por caja (Z-<caja>-<n>) dentro del texto sellado.
   · En ambos, la deuda nueva del turno se separa en Fiado y Cuenta corriente.
   · Cajón: ESC p (0x1B 0x70 m t1 t2), pin 2 o 5; se abre DESPUÉS de confirmar una venta con efectivo (o siempre, según
     Configuración) y desde Caja con permiso; toda apertura queda en Auditoría. [VERIFICAR con el cajón real]
   · Corte del papel: parcial (GS V 66), total (GS V 65) o sin corte. */
function cortesX(){if(!Array.isArray(S.cortesX))S.cortesX=[];return S.cortesX;}
function tkCut(){const c=S.cfg.ticket&&S.cfg.ticket.cut;return c==='total'||c==='no'?c:'parcial';}
function tkDrawer(){const d=(S.cfg.ticket&&S.cfg.ticket.drawer)||{};return{when:d.when==='cash'||d.when==='all'?d.when:'no',pin:d.pin===5?5:2};}
const drawerBytes=pin=>[0x1b,0x70,pin===5?1:0,0x19,0xfa];
function cutBytes(){const c=tkCut();return c==='no'?[0x0a,0x0a,0x0a,0x0a]:[0x0a,0x0a,0x0a,0x1d,0x56,c==='total'?0x41:0x42,0x00];}
function drawerWanted(s){const d=tkDrawer();if(d.when==='no'||!s||s.id==='test'||s.id==='demo')return false;if(d.when==='all')return true;return salePays(s).some(p=>p.m==='efectivo'&&p.a>0);}
/* texto plano a ESC/POS (para cortes X/Z) */
function escposText(text){const W=S.cfg.ticket.w===58?32:42;const o=[0x1b,0x40,0x1b,0x74,0x02];
 String(text).split('\n').forEach(l=>{wrapTxt(l,W).forEach(x=>{encPC850(x).forEach(b=>o.push(b));o.push(0x0a);});});cutBytes().forEach(b=>o.push(b));return new Uint8Array(o);}
async function printText(title,text){const d=devList().find(x=>x.type==='printer_thermal'&&x.status==='conectado'&&!x.sim);
 if(d){try{await devSend(d,escposText(text));audit('IMPRESION',title+' · '+d.name);toast('Enviado a '+d.name);}catch(e){toast('No se pudo imprimir: '+(e.message||e),1);}return;}
 const w=window.open('','_blank','width=420,height=640');if(!w)return toast('El navegador bloqueó la ventana de impresión.',1);
 w.document.write('<!doctype html><meta charset="utf-8"><title>'+esc(title)+'</title><pre style="font:12px/1.35 monospace;white-space:pre-wrap">'+esc(text)+'</pre><script>print()<\/script>');w.document.close();audit('IMPRESION',title+' · navegador');}
A.openDrawer=async()=>{if(!can('cash_mov'))return toast('Sin permiso para abrir el cajón.',1);const d=devList().find(x=>x.type==='printer_thermal'&&x.status==='conectado'&&!x.sim);
 if(!d)return toast('El cajón se abre a través de la impresora térmica conectada (USB, serie o Bluetooth).',1);
 try{await devSend(d,new Uint8Array([0x1b,0x40].concat(drawerBytes(tkDrawer().pin))));audit('CAJON_ABIERTO','sin venta · '+user.name);toast('Cajón abierto (queda en Auditoría)');}catch(e){toast('No se pudo abrir el cajón: '+(e.message||e),1);}};

/* ---- corte X ---- */
function corteXText(x){const L=[];const P=s=>L.push(s);
 P('CORTE X N.º '+x.n+'  (no cierra la caja)');P(fmtDT(x.ts)+' · '+x.user+' · caja '+x.caja);P('');
 P('Ventas confirmadas: '+x.count+' · '+money(x.total));
 Object.keys(x.byMethod||{}).forEach(m=>{const b=x.byMethod[m];P('  '+(MET[m]||m)+(m==='fiado'?' (crédito)':'')+': '+b.n+' · '+money(b.gross));});
 if(x.aCtaCte>0){P('Deuda nueva de clientes (no entró a caja): '+money(x.aCtaCte));if(x.aFiado||x.aCC){P('  Fiado: '+money(x.aFiado));P('  Cuenta corriente: '+money(x.aCC));}}
 P('Cobrado: '+money(x.cobrado));P('Ingresos de caja: '+money(x.ing)+' · Egresos: '+money(x.egr));P('EFECTIVO ESPERADO EN CAJA: '+money(x.expectedCash));
 return L.join('\n');}
A.corteX=()=>{if(!can('close_cash'))return toast('Sin permiso',1);const c=arqCtx();if(!c)return toast('No hay caja abierta.',1);const a=c.a,s=c.s;
 const caja=s.caja!==undefined?s.caja:S.tenant.caja;const k=cortesX().filter(x=>x.sessId===s.id).length+1;
 const x={id:uid(),n:'X-'+caja+'-'+k,k,sessId:s.id,caja,ts:now(),user:user.name,total:a.total,count:a.count,cobrado:a.cobrado,aCtaCte:a.aCtaCte||0,aFiado:a.aFiado||0,aCC:a.aCC||0,
  byMethod:JSON.parse(JSON.stringify(a.byMethod||{})),ing:a.ing||0,egr:a.egr||0,expectedCash:a.expectedCash||0};
 x.text=corteXText(x);x.hash=sha256(JSON.stringify(x));cortesX().push(x);audit('CORTE_X',x.n+' · ventas '+money(x.total)+' · efectivo esperado '+money(x.expectedCash));save();
 modal('Corte X '+x.n,`<pre class="rep">${esc(x.text)}</pre><p class="sm mut">Es una foto del turno: la caja sigue abierta. Queda guardado en «Cortes X».${typeof CLOUD!=='undefined'&&CLOUD.on?' Para que también quede en la nube hay que haber corrido <code>17-fiado-cc-cortes.sql</code> en Supabase.':''}</p>`,{okText:'Imprimir',cancelText:'Cerrar',onOk:()=>{printText('Corte X '+x.n,x.text);return false;}});};
A.corteXVer=el=>{const x=cortesX().find(y=>y.id===el.dataset.id);if(!x)return;modal('Corte X '+x.n,`<pre class="rep">${esc(x.text)}</pre>`,{okText:'Imprimir',cancelText:'Cerrar',onOk:()=>{printText('Corte X '+x.n,x.text);return false;}});};
function corteXListHTML(sessId){const L=cortesX().filter(x=>!sessId||x.sessId===sessId).slice(-10).reverse();if(!L.length)return'';
 return `<div class="card" style="margin-top:1rem"><h3 style="margin-top:0">Cortes X de este turno</h3><div class="tw"><table data-nosort><thead><tr><th>N.º</th><th>Hora</th><th>Usuario</th><th class="r">Ventas</th><th class="r">Efectivo esperado</th><th></th></tr></thead><tbody>${L.map(x=>`<tr><td>${esc(x.n)}</td><td>${fmtDT(x.ts)}</td><td>${esc(x.user)}</td><td class="r">${money(x.total)}</td><td class="r">${money(x.expectedCash)}</td><td class="r"><button class="btn sm" data-act="corteXVer" data-id="${x.id}">Ver</button></td></tr>`).join('')}</tbody></table></div></div>`;}
/* ---- corte Z: número correlativo por caja ---- */
function zNext(caja){let mx=0;S.closures.forEach(c=>{if(String(c.caja)===String(caja))mx=Math.max(mx,c.zn||0);});const legacy=S.closures.filter(c=>String(c.caja)===String(caja)&&!c.zn).length;return Math.max(mx,legacy)+1;}
const zLabel=(caja,n)=>'Z-'+caja+'-'+n;
