/* ===== V26.29 · 4.8 Cargar factura de proveedor (foto o PDF) con lectura automática y REVISIÓN HUMANA obligatoria =====
   Cascada: 1) QR fiscal de ARCA (foto, con el lector del navegador) → 2) IA en la nube (opcional, Edge Function «leer-factura»,
   sólo administrador, cuesta por uso) → 3) texto del PDF leído en el equipo → 4) carga a mano.
   Nada se guarda sin revisar: el resultado prellena la «Carga de remito» (stock, costo y deuda/caja según 4.21: un solo registro). */
const FAC_MAX=5*1024*1024;
let facS=null;
function facAiCfg(){S.cfg.aiInv=S.cfg.aiInv||{on:false};return S.cfg.aiInv;}
const facAiReady=()=>!!(facAiCfg().on&&typeof CLOUD!=='undefined'&&CLOUD.on&&typeof cl!=='undefined'&&cl.ready);
function facB64(buf){const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);}
/* --- 1) QR fiscal ARCA: https://www.afip.gob.ar/fe/qr/?p=<base64 JSON> [VERIFICAR especificación vigente] --- */
async function facQrFromImage(file){try{if(!('BarcodeDetector' in window))return null;const bd=new BarcodeDetector({formats:['qr_code']});const bm=await createImageBitmap(file);const r=await bd.detect(bm);for(const x of r){const q=facParseQr(x.rawValue);if(q)return q;}}catch(e){}return null;}
function facParseQr(raw){try{const u=new URL(String(raw));const p=u.searchParams.get('p');if(!p)return null;const j=JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g,'+').replace(/_/g,'/')))));
 if(!j||!j.cuit)return null;const T={1:['Factura','A'],2:['Nota de débito','A'],3:['Nota de crédito','A'],6:['Factura','B'],7:['Nota de débito','B'],8:['Nota de crédito','B'],11:['Factura','C'],12:['Nota de débito','C'],13:['Nota de crédito','C'],51:['Factura','M']}[+j.tipoCmp]||['Factura',''];
 return{src:'QR fiscal',cuit:String(j.cuit).replace(/\D/g,''),tipo:T[0],letra:T[1],pto:String(j.ptoVta||''),nro:String(j.nroCmp||''),fecha:String(j.fecha||'').slice(0,10),total:Math.round((+j.importe||0)*100),cae:String(j.codAut||'')};}catch(e){return null;}}
/* --- 3) texto de un PDF (flujos FlateDecode + operadores Tj/TJ; los PDF escaneados no tienen texto) --- */
async function facPdfText(buf){const b=new Uint8Array(buf);const td=new TextDecoder('latin1');const all=td.decode(b);const out=[];let i=0,n=0;
 while((i=all.indexOf('stream',i))!==-1&&n<400){n++;let s=i+6;if(all[s]==='\r')s++;if(all[s]==='\n')s++;const e=all.indexOf('endstream',s);if(e<0)break;const dict=all.slice(Math.max(0,i-300),i);let txt='';
  try{let raw=b.slice(s,e);if(/ASCII85Decode/.test(dict))raw=facA85(all.slice(s,e));
   if(/FlateDecode/.test(dict)){const ds=new DecompressionStream('deflate');const w=ds.writable.getWriter();w.write(raw).catch(()=>{});w.close().catch(()=>{});txt=td.decode(await new Response(ds.readable).arrayBuffer());}else txt=td.decode(raw);}catch(x){txt='';}
  if(/T[Jj]/.test(txt))out.push(facOps(txt));i=e+9;}
 return out.join('\n').replace(/[ \t]+/g,' ').slice(0,60000);}
function facA85(t){t=t.replace(/\s+/g,'');const i=t.indexOf('~>');if(i>=0)t=t.slice(0,i);if(t.startsWith('<~'))t=t.slice(2);const out=[];let g=[];
 for(const ch of t){if(ch==='z'&&!g.length){out.push(0,0,0,0);continue;}const c=ch.charCodeAt(0)-33;if(c<0||c>84)continue;g.push(c);if(g.length===5){let v=0;for(const x of g)v=v*85+x;out.push(v>>>24&255,v>>>16&255,v>>>8&255,v&255);g=[];}}
 if(g.length){const n=g.length;while(g.length<5)g.push(84);let v=0;for(const x of g)v=v*85+x;const bb=[v>>>24&255,v>>>16&255,v>>>8&255,v&255];out.push(...bb.slice(0,n-1));}return new Uint8Array(out);}
function facOps(t){const o=[];const str=s=>s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g,(m,c)=>/^[0-7]/.test(c)?String.fromCharCode(parseInt(c,8)):({n:'\n',r:'',t:' ',b:'',f:''}[c]??c));
 const re=/\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*Tj|(T\*|Td|TD|ET)/g;let m;
 while((m=re.exec(t))){if(m[1]!==undefined){let s='';m[1].replace(/\(((?:[^()\\]|\\.)*)\)|(-?\d+(?:\.\d+)?)/g,(x,a,num)=>{if(a!==undefined)s+=str(a);else if(+num<-200)s+=' ';return '';});o.push(s);}else if(m[2]!==undefined)o.push(str(m[2]));else o.push('\n');}
 return o.join('').replace(/\n+/g,'\n');}
/* --- parser local de texto (formato argentino) --- */
const facNum=s=>{s=String(s||'').replace(/[^\d.,-]/g,'');if(/,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');const v=parseFloat(s);return isNaN(v)?NaN:Math.round(v*100);};
function facParseText(t){if(!t||t.length<20)return null;const T=t.replace(/\s+/g,' ');const r={src:'texto del PDF'};
 const cuits=[...T.matchAll(/(\d{2})[-\s.]?(\d{8})[-\s.]?(\d)\b/g)].map(m=>m[1]+m[2]+m[3]).filter(c=>typeof arcaCuitOk!=='function'||arcaCuitOk(c));if(cuits.length)r.cuit=cuits[0];
 let m=T.match(/\b(FACTURA|NOTA DE CR[EÉ]DITO|NOTA DE D[EÉ]BITO|REMITO)\b[^A-Z]{0,20}\b([ABCM])\b/i);if(m){r.tipo=/CR/i.test(m[1])?'Nota de crédito':/D[EÉ]B/i.test(m[1])?'Nota de débito':/REM/i.test(m[1])?'Remito':'Factura';r.letra=m[2].toUpperCase();}
 m=T.match(/Punto de Venta:?\s*(\d{1,5})\s*Comp\.?\s*Nro:?\s*(\d{1,8})/i)||T.match(/\b(\d{4,5})\s*-\s*(\d{8})\b/);if(m){r.pto=String(+m[1]);r.nro=String(+m[2]);}
 m=T.match(/Fecha de Emisi[oó]n:?\s*(\d{2})\/(\d{2})\/(\d{4})/i)||T.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);if(m)r.fecha=m[3]+'-'+m[2]+'-'+m[1];
 m=T.match(/Importe Total:?\s*\$?\s*([\d.,]+)/i)||T.match(/\bTOTAL:?\s*\$?\s*([\d.,]+)/i);if(m)r.total=facNum(m[1]);
 m=T.match(/(?:Importe Neto Gravado|Subtotal|Neto Gravado):?\s*\$?\s*([\d.,]+)/i);if(m)r.neto=facNum(m[1]);
 m=T.match(/IVA\s*(?:21|10[.,]5|27)\s*%:?\s*\$?\s*([\d.,]+)/i);if(m)r.iva=facNum(m[1]);
 m=T.match(/Raz[oó]n Social:?\s*([^:]{3,60}?)\s+(?:Domicilio|Fecha|CUIT|Condici)/i);if(m)r.razon=m[1].trim();
 return(r.cuit||r.total||r.nro)?r:null;}
/* --- 2) IA en la nube --- */
async function facAi(file,buf){const mime=file.type||(file.name.toLowerCase().endsWith('.pdf')?'application/pdf':'');
 const j=await hreq('/functions/v1/leer-factura',{method:'POST',fn:true,body:{comercio:cl.comercio.id,mime,data:facB64(buf)}});const d=(j&&j.datos)||{};
 const c=x=>Math.round((+x||0)*100);return{src:'IA en la nube',cuit:String(d.proveedor_cuit||'').replace(/\D/g,''),razon:d.proveedor_razon_social||'',tipo:d.tipo||'Factura',letra:d.letra||'',pto:String(d.punto_venta||'').replace(/\D/g,''),nro:String(d.numero||'').replace(/\D/g,''),
  fecha:/^\d{4}-\d{2}-\d{2}$/.test(d.fecha_emision||'')?d.fecha_emision:'',neto:c(d.neto),iva:c(d.iva),otros:c(d.otros_impuestos),total:c(d.total),cat:d.categoria_sugerida||'',notEs:d.es_factura===false,
  lines:(Array.isArray(d.renglones)?d.renglones:[]).slice(0,60).map(x=>({desc:String(x.descripcion||'').slice(0,120),qty:+x.cantidad||0,price:c(x.precio_unitario),sub:c(x.subtotal)}))};}
/* ---------- pantalla ---------- */
A.facLoad=()=>{if(!can('purchases'))return toast('Sin permiso',1);
 const ai=facAiCfg().on,cloud=typeof CLOUD!=='undefined'&&CLOUD.on;
 const w=modal('Cargar factura de proveedor',`<p class="sm">Sacale una <b>foto</b> o elegí el <b>PDF</b>. El sistema intenta leer los datos solo y después <b>los revisás vos</b> antes de guardar.</p>
  <label for="fac-f">Foto o PDF (máx. 5 MB)</label><input id="fac-f" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment">
  <ol class="sm mut"><li>QR fiscal de ARCA de la factura (con la foto; necesita Chrome o Edge).</li><li>${ai&&cloud?'<b>IA en la nube activada</b> (sólo el administrador; cuesta por uso).':'IA en la nube: <b>no activada</b>'+(can('config')?' — se activa en Configuración → «Lectura de facturas con IA».':'.')}</li><li>Texto del PDF (si el PDF no es una imagen escaneada).</li><li>Si nada funciona, cargás los datos a mano.</li></ol>
  <div id="fac-st" aria-live="polite"></div>`,{okText:'Leer',onOk:w=>{const f=$('#fac-f',w).files[0];if(!f)return w._err('Elegí la foto o el PDF.'),false;if(f.size>FAC_MAX)return w._err('El archivo pesa más de 5 MB.'),false;
   if(!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)&&!/\.pdf$/i.test(f.name))return w._err('Formato no admitido: JPG, PNG, WEBP o PDF.'),false;facRead(f,w);return false;}});};
async function facRead(f,w){const st=$('#fac-st',w);const say=t=>{if(st)st.innerHTML=`<div class="okbox sm">${esc(t)}</div>`;};
 const btn=w.querySelector('[data-m=ok]');if(btn)btn.disabled=true;const buf=await f.arrayBuffer();const isPdf=/pdf/.test(f.type)||/\.pdf$/i.test(f.name);let r=null,tries=[];
 if(!isPdf){say('Buscando el QR fiscal…');r=await facQrFromImage(f);tries.push('QR fiscal: '+(r?'leído':'no encontrado'));}
 if(facAiReady()&&can('config')&&(!r||!r.lines)){say('Leyendo con IA en la nube…');try{const a=await facAi(f,buf);r=r?Object.assign({},a,{cuit:r.cuit||a.cuit,pto:r.pto||a.pto,nro:r.nro||a.nro,fecha:r.fecha||a.fecha,total:r.total||a.total,cae:r.cae,src:'QR fiscal + IA'}):a;tries.push('IA: leída');audit('FACTURA_IA','lectura con IA · '+(f.type||'pdf'));}catch(e){tries.push('IA: '+(e.message||'no disponible'));}}
 if(isPdf&&(!r||!r.total)){say('Leyendo el texto del PDF…');try{const t=await facPdfText(buf);const p=facParseText(t);if(p)r=r?Object.assign({},p,r):p;tries.push('Texto del PDF: '+(p?'leído':'sin datos (puede ser un escaneo)'));}catch(e){tries.push('Texto del PDF: no se pudo leer');}}
 const url=URL.createObjectURL(f);facS=Object.assign({cuit:'',razon:'',tipo:'Factura',letra:'',pto:'',nro:'',fecha:'',neto:0,iva:0,otros:0,total:0,lines:[],src:'a mano'},r||{},{url,isPdf,tries,name:f.name});
 w.remove();facReview();}
function facProvByCuit(c){return c?cmpArr('suppliers').find(s=>String(s.cuit).replace(/\D/g,'')===c):null;}
function facChecks(d){const W=[];const cuit=String(d.cuit||'').replace(/\D/g,'');
 if(!cuit)W.push('Falta el CUIT del proveedor.');else if(typeof arcaCuitOk==='function'&&!arcaCuitOk(cuit))W.push('El CUIT no pasa el dígito verificador: revisalo.');
 if(!(d.total>0))W.push('Falta el total.');if(d.neto>0&&Math.abs(d.neto+(d.iva||0)+(d.otros||0)-d.total)>100)W.push('Neto + IVA + otros impuestos ('+money(d.neto+(d.iva||0)+(d.otros||0))+') no da el total ('+money(d.total)+').');
 if(d.fecha){if(d.fecha>dkey(now()))W.push('La fecha es futura.');else if(d.fecha<addDays(dkey(now()),-400))W.push('La fecha tiene más de un año.');}else W.push('Falta la fecha.');
 const p=facProvByCuit(cuit);const nroF=(d.pto?String(d.pto).padStart(4,'0')+'-':'')+String(d.nro||'').padStart(8,'0');
 if(p&&d.nro&&(S.receipts||[]).some(r=>r.provId===p.id&&String(r.nro).replace(/\D/g,'').endsWith(String(+d.nro))&&String(r.tipo).toLowerCase().startsWith(String(d.tipo||'').slice(0,4).toLowerCase())))W.push('Parece DUPLICADO: ya hay un '+d.tipo+' '+nroF+' de este proveedor.');
 if(d.notEs)W.push('La IA dice que el documento no parece un comprobante.');return W;}
function facReview(){const d=facS;if(!d)return;const p=facProvByCuit(d.cuit);const pv=x=>x?pesosStr(x):'';
 const w=modal('Revisar la factura antes de guardar',`<div class="grid g2" style="align-items:start"><div>${d.isPdf?`<div class="card"><p>📄 PDF cargado: <b>${esc(d.name)}</b></p><a class="btn" href="${d.url}" target="_blank" rel="noopener">Abrir el PDF para compararlo</a></div>`:`<img src="${d.url}" alt="Foto de la factura" style="width:100%;max-height:520px;object-fit:contain;border:1px solid var(--line);border-radius:12px">`}
  <p class="sm mut">Leído con: <b>${esc(d.src)}</b>${d.tries.length?' · '+esc(d.tries.join(' · ')):''}. Lo leído automáticamente puede tener errores: compará con la imagen.</p></div>
  <div><label for="fv-cuit">CUIT del proveedor</label><input id="fv-cuit" inputmode="numeric" maxlength="13" value="${esc(d.cuit?(typeof arcaCuitFmt==='function'?arcaCuitFmt(d.cuit):d.cuit):'')}">
  <div id="fv-prov" class="sm">${p?`<span class="tag ok">Proveedor: ${esc(p.razon)}</span>`:`<span class="tag warn">No está cargado</span>`}</div>
  <label for="fv-rs">Razón social</label><input id="fv-rs" maxlength="120" value="${esc(p?p.razon:(d.razon||''))}">
  <div class="grid g2"><div><label for="fv-tipo">Tipo</label><select id="fv-tipo">${['Factura','Remito','Nota de crédito','Nota de débito','Ticket'].map(x=>`<option ${d.tipo===x?'selected':''}>${x}</option>`).join('')}</select></div><div><label for="fv-l">Letra</label><select id="fv-l">${['','A','B','C','M'].map(x=>`<option ${d.letra===x?'selected':''}>${x}</option>`).join('')}</select></div></div>
  <div class="grid g2"><div><label for="fv-pto">Punto de venta</label><input id="fv-pto" inputmode="numeric" maxlength="5" value="${esc(d.pto||'')}"></div><div><label for="fv-nro">Número</label><input id="fv-nro" inputmode="numeric" maxlength="8" value="${esc(d.nro||'')}"></div></div>
  <label for="fv-f">Fecha de emisión</label><input id="fv-f" type="date" value="${esc(d.fecha||'')}">
  <div class="grid g2"><div><label for="fv-n">Neto ($)</label><input id="fv-n" inputmode="decimal" value="${esc(pv(d.neto))}"></div><div><label for="fv-i">IVA ($)</label><input id="fv-i" inputmode="decimal" value="${esc(pv(d.iva))}"></div></div>
  <div class="grid g2"><div><label for="fv-o">Otros impuestos / percepciones ($)</label><input id="fv-o" inputmode="decimal" value="${esc(pv(d.otros))}"></div><div><label for="fv-t">Total ($)</label><input id="fv-t" inputmode="decimal" value="${esc(pv(d.total))}"></div></div>
  ${d.lines&&d.lines.length?`<p class="sm"><b>${d.lines.length} renglón(es)</b> leídos: se pasan a la carga de remito para que elijas cada producto.</p>`:''}
  <div id="fv-w" aria-live="polite"></div></div></div>`,{wide:true,okText:'Revisado: pasar a la carga de remito',onOk:w=>{const x=facFromForm(w);const W=facChecks(x);
   const dup=W.find(t=>/DUPLICADO/.test(t));if(dup&&!w._dupOk){w._dupOk=1;w._err(dup+' Si igual querés seguir, tocá de nuevo.');return false;}
   const cuit=String(x.cuit).replace(/\D/g,'');if(!cuit||(typeof arcaCuitOk==='function'&&!arcaCuitOk(cuit)))return w._err('Revisá el CUIT del proveedor.'),false;if(!(x.total>0))return w._err('Escribí el total.'),false;
   facGo(x,w);return false;}});
 const paint=()=>{const x=facFromForm(w);const W=facChecks(x);$('#fv-w',w).innerHTML=W.length?`<div class="warnbox sm">${W.map(esc).join('<br>')}</div>`:'<div class="okbox sm">Controles: CUIT, total, fecha y duplicados en orden.</div>';const pp=facProvByCuit(String(x.cuit).replace(/\D/g,''));$('#fv-prov',w).innerHTML=pp?`<span class="tag ok">Proveedor: ${esc(pp.razon)}</span>`:'<span class="tag warn">No está cargado: se crea al seguir</span>';};
 w.addEventListener('input',paint);w.addEventListener('change',paint);paint();}
function facFromForm(w){const c=id=>{const v=cents($('#'+id,w).value||'0');return isNaN(v)?0:v;};return Object.assign({},facS,{cuit:$('#fv-cuit',w).value.replace(/\D/g,''),razon:$('#fv-rs',w).value.trim(),tipo:$('#fv-tipo',w).value,letra:$('#fv-l',w).value,pto:$('#fv-pto',w).value.replace(/\D/g,''),nro:$('#fv-nro',w).value.replace(/\D/g,''),fecha:$('#fv-f',w).value,neto:c('fv-n'),iva:c('fv-i'),otros:c('fv-o'),total:c('fv-t')});}
async function facGo(x,w){let p=facProvByCuit(x.cuit);
 if(!p){if(x.razon.length<2)return w._err('Escribí la razón social para crear el proveedor.');try{await CMP.supSave({razon_social:x.razon,cuit:x.cuit,condicion_iva:x.letra==='A'?'Responsable Inscripto':(x.letra==='C'?'Monotributista':'Responsable Inscripto'),email:'',telefono:'',direccion:'',activo:true});}catch(e){return w._err(e.message||'No se pudo crear el proveedor.');}p=facProvByCuit(x.cuit);if(!p)return w._err('Se creó el proveedor pero todavía no aparece: probá de nuevo en unos segundos.');}
 cmpNewRemito(p.id);const tipo=/Remito/.test(x.tipo)?'Remito':'Factura';crS.tipo=tipo;crS.nro=(x.pto?String(x.pto).padStart(4,'0')+'-':'')+String(x.nro||'').padStart(8,'0');if(x.fecha)crS.fecha=x.fecha;crS.decl=pesosStr(x.total);
 crS.obs=('Cargada desde '+x.src+(x.letra?' · '+x.tipo+' '+x.letra:'')+(x.neto?' · neto '+money(x.neto):'')+(x.iva?' · IVA '+money(x.iva):'')+(x.otros?' · otros imp. '+money(x.otros):'')).slice(0,200);
 if(x.lines&&x.lines.length){const prods=S.products.filter(q=>!q.archived);crS.rows=x.lines.map(l=>{const dw=foldTxt(l.desc).split(/\s+/).filter(t=>t.length>2);let best=null,bs=0;prods.forEach(q=>{const h=foldTxt(q.name+' '+(q.sub||''));const sc=dw.filter(t=>h.includes(t)).length;if(sc>bs){bs=sc;best=q;}});
  return{pid:best&&bs>=Math.min(2,dw.length)?best.id:'',txt:best&&bs>=Math.min(2,dw.length)?'':l.desc,qty:l.qty?String(l.qty).replace('.',','):'',cost:l.price?pesosStr(l.price):''};});}
 audit('FACTURA_REVISADA',x.tipo+' '+crS.nro+' · '+money(x.total)+' · '+x.src);if(/Nota de cr/.test(x.tipo))toast('Es una nota de crédito: cargala desde la cuenta corriente del proveedor («Nota de crédito»).',1);
 try{URL.revokeObjectURL(facS.url);}catch(e){}facS=null;w.remove();cmpS.tab='remito';if(location.hash!=='#panel/proveedores')go('proveedores');else cmpRepaint();toast('Datos pasados a la carga de remito: completá los productos y confirmá.');}
/* configuración (sólo administrador) */
function facCfgCard(){if(!can('config'))return '';const c=facAiCfg();const cloud=typeof CLOUD!=='undefined'&&CLOUD.on;
 return `<div class="card" style="margin-top:1rem"><h3>Lectura de facturas con IA (opcional)</h3><p class="sm mut">En «Proveedores y compras → Cargar factura» el sistema lee la foto o el PDF: primero el QR fiscal y el texto del PDF (gratis, en el equipo); con esta opción, además, la IA en la nube (lee fotos sin QR y los renglones). <b>Cuesta por uso</b> y necesita que el desarrollador despliegue la función «leer-factura» y cargue la clave de la API en los secretos del servidor (nunca acá). Siempre hay revisión humana antes de guardar.</p>
 <label class="chk"><input type="checkbox" id="fac-ai" ${c.on?'checked':''} ${cloud?'':'disabled'}> Usar IA en la nube para leer facturas${cloud?'':' (necesita la nube)'}</label></div>`;}
document.addEventListener('change',e=>{if(e.target&&e.target.id==='fac-ai'){if(!can('config'))return;facAiCfg().on=e.target.checked;audit('CONFIG_IA_FACTURAS',e.target.checked?'activada':'desactivada');save();toast(e.target.checked?'IA para facturas activada':'IA para facturas desactivada');}});
