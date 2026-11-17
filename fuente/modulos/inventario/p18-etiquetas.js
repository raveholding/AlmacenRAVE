/* ===== V26.77 · Precios y etiquetas profesionales (prompt V26.77, Fase 1) =====
   Marca (logo B/N para térmicas) · Editor visual en milímetros con plantillas · Cola inteligente (cambios de precio e ingresos de compras)
   · Motor de impresión exacto en mm (rollo o plancha) · EAN-13 / Code 128 / QR vectoriales en negro puro.
   Sin librerías externas (CSP y uso sin conexión). Depende de p17-gestion.js (módulos, historial de precios, EAN-13).
   Plantillas y marca viven en S.cfg.lbl (se sincronizan con la configuración). La cola (S.lblQ) queda en el equipo hasta el SQL 30.
   En Almacén RAVE nace apagado: lo activa el administrador desde Sistema → Módulos. */

GI_MODS.push({k:'labels',t:'Etiquetas profesionales',d:'Editor de etiquetas en milímetros con plantillas, logo en blanco y negro, cola automática (cambios de precio e ingresos de mercadería) e impresión exacta en rollo o plancha A4.',plan:'esencial',dep:['price_hist'],scr:'etiquetas'});
const LB_PX=96/25.4; /* px CSS por mm */

/* ---------- Configuración y plantillas predefinidas ---------- */
let lbSeq=0;const lbId=()=>'e'+Date.now().toString(36)+(lbSeq++).toString(36);
function lbEl(o){return Object.assign({id:lbId(),type:'text',x:2,y:2,w:20,h:6,text:'',fs:10,bold:0,align:'left',valign:'middle',fit:1,strike:0,inv:0,dec:'sup',sym:'auto',hr:1},o);}
const LB_PRESETS=[
 {k:'gondola',name:'Góndola 50 × 30 (rollo)',w:50,h:30,media:{type:'roll'},els:()=>[
  lbEl({x:2,y:1.5,w:46,h:8,text:'{nombre_producto}',fs:10,bold:1,valign:'top'}),
  lbEl({type:'price',x:2,y:9.5,w:30,h:11,text:'{precio_final}',fs:26,bold:1}),
  lbEl({x:32.5,y:10,w:15.5,h:5,text:'{precio_unidad_medida}',fs:6.5,align:'right'}),
  lbEl({x:32.5,y:15,w:15.5,h:5,text:'{fecha_vigencia}',fs:6,align:'right'}),
  lbEl({type:'barcode',x:2,y:21,w:30,h:8,text:'{codigo_barras}'}),
  lbEl({x:33,y:22,w:15,h:6.5,text:'{comercio}',fs:6,align:'right',valign:'bottom'})]},
 {k:'a4',name:'Plancha A4 3 × 8 (63,5 × 33,9)',w:63.5,h:33.9,media:{type:'sheet',pw:210,ph:297,cols:3,rows:8,mx:7.2,my:12.9,gx:2.5,gy:0},els:()=>[
  lbEl({x:2.5,y:2,w:58.5,h:8,text:'{nombre_producto}',fs:11,bold:1,valign:'top'}),
  lbEl({type:'price',x:2.5,y:10.5,w:36,h:12,text:'{precio_final}',fs:28,bold:1}),
  lbEl({x:39,y:11,w:22,h:5,text:'{precio_unidad_medida}',fs:7,align:'right'}),
  lbEl({x:39,y:16.5,w:22,h:5,text:'Sin imp. nac. {precio_sin_impuestos}',fs:6,align:'right'}),
  lbEl({type:'barcode',x:2.5,y:23,w:34,h:9.5,text:'{codigo_barras}'}),
  lbEl({x:38,y:24,w:23,h:8,text:'{comercio} · {fecha_vigencia}',fs:6,align:'right',valign:'bottom'})]},
 {k:'oferta',name:'Oferta A4 (cartel)',w:210,h:297,media:{type:'roll'},els:()=>[
  lbEl({type:'rect',x:0,y:0,w:210,h:45,inv:1}),
  lbEl({x:10,y:5,w:190,h:35,text:'OFERTA',fs:90,bold:1,align:'center',inv:1}),
  lbEl({x:10,y:55,w:190,h:50,text:'{nombre_producto}',fs:48,bold:1,align:'center'}),
  lbEl({x:10,y:110,w:190,h:25,text:'Antes {precio_anterior}',fs:32,align:'center',strike:1}),
  lbEl({type:'price',x:10,y:140,w:190,h:80,text:'{precio_final}',fs:150,bold:1,align:'center'}),
  lbEl({x:10,y:222,w:190,h:12,text:'{precio_unidad_medida}',fs:18,align:'center'}),
  lbEl({type:'logo',x:10,y:245,w:50,h:40}),
  lbEl({x:65,y:250,w:135,h:30,text:'{leyenda}\nVigente desde {fecha_vigencia}',fs:12,align:'right',valign:'bottom'})]},
 {k:'kilo',name:'Precio por kilo 60 × 40',w:60,h:40,media:{type:'roll'},els:()=>[
  lbEl({x:2,y:2,w:56,h:9,text:'{nombre_producto}',fs:12,bold:1,valign:'top'}),
  lbEl({type:'price',x:2,y:12,w:56,h:15,text:'{precio_final}',fs:34,bold:1,align:'center'}),
  lbEl({x:2,y:27,w:56,h:5,text:'{precio_unidad_medida}',fs:9,align:'center'}),
  lbEl({type:'line',x:2,y:33,w:56,h:0.3}),
  lbEl({x:2,y:34,w:56,h:5,text:'{comercio} · {fecha_vigencia}',fs:6.5,align:'center'})]},
 {k:'colgante',name:'Colgante 40 × 60 con QR',w:40,h:60,media:{type:'roll'},els:()=>[
  lbEl({type:'logo',x:8,y:2,w:24,h:10}),
  lbEl({x:2,y:13,w:36,h:10,text:'{nombre_producto}',fs:10,bold:1,align:'center'}),
  lbEl({type:'price',x:2,y:23,w:36,h:11,text:'{precio_final}',fs:22,bold:1,align:'center'}),
  lbEl({type:'qr',x:10,y:35,w:20,h:20,text:'{codigo_qr}'}),
  lbEl({x:2,y:55.5,w:36,h:4,text:'{sku}',fs:6,align:'center'})]}];
function lbCfg(){const c=S.cfg.lbl||(S.cfg.lbl={});
 if(!c.brand)c.brand={name:'',phone:'',web:'',addr:'',legal:'',logo:'',bw:1,thr:150};
 if(c.iva===undefined)c.iva=21;if(c.qrBase===undefined)c.qrBase='';
 if(!Array.isArray(c.tpls)||!c.tpls.length){c.tpls=LB_PRESETS.map(p=>lbFromPreset(p));c.def=c.tpls[0].id;}
 if(!c.tpls.some(t=>t.id===c.def))c.def=c.tpls[0].id;return c;}
function lbFromPreset(p,name){return{id:'t'+lbId(),name:name||p.name,w:p.w,h:p.h,media:Object.assign({type:'roll',pw:210,ph:297,cols:1,rows:1,mx:0,my:0,gx:0,gy:0},p.media),els:p.els()};}
const lbTpl=id=>lbCfg().tpls.find(t=>t.id===id)||lbCfg().tpls.find(t=>t.id===lbCfg().def);

/* ---------- Datos de un artículo para la etiqueta ---------- */
const lbNum=c=>{c=Math.round(c);const p=Math.floor(Math.abs(c)/100),r=Math.abs(c)%100;return{ent:String(p).replace(/\B(?=(\d{3})+(?!\d))/g,'.'),dec:String(r).padStart(2,'0')};};
const lbMoney=c=>{const n=lbNum(c);return '$ '+n.ent+(n.dec!=='00'?','+n.dec:'');};
/* contenido neto leído de la presentación o del nombre: {q en kg o litros, u:'kg'|'litro'}; null si es combinado o no se lee */
function lbContent(p){if(p.unit==='kg')return{q:1,u:'kg',per:1};if(p.unit==='lt')return{q:1,u:'litro',per:1};
 const src=(p.sub||'')+' '+p.name;if(/\+/.test(p.sub||''))return null;
 const m=[...src.toLowerCase().matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|grs?|g|gramos|lts?|litros?|l|ml|cc|cm3)\b/g)];if(m.length!==1)return null;
 const v=parseFloat(m[0][1].replace(',','.'));if(!(v>0))return null;const u=m[0][2];
 if(/^(kg|kilo)/.test(u))return{q:v,u:'kg'};if(/^g/.test(u))return{q:v/1000,u:'kg'};if(/^(ml|cc|cm3)$/.test(u))return{q:v/1000,u:'litro'};return{q:v,u:'litro'};}
function lbVars(p){const c=lbCfg(),b=c.brand,t=S.tenant;const lg=(typeof giLog==='function'?giLog():[]).filter(e=>e.pid===p.id&&e.f==='price');const last=lg[lg.length-1];
 const prev=last&&last.to===p.price&&last.from>p.price?last.from:0;
 const ct=lbContent(p);let upm='';if(ct){if(ct.per)upm=lbMoney(p.price)+' x '+ct.u;else upm=lbMoney(Math.round(p.price/ct.q))+' x '+ct.u;}
 const iva=+c.iva||0;const code=String(p.barcode||p.plu||p.id||'');const rub=(S.rubros||[]).find(r=>r.id===p.rubro);
 const vig=last?last.ts:now();
 return{nombre_producto:p.name,descripcion:p.sub||'',precio_final:lbMoney(p.price),_price:p.price,precio_anterior:prev?lbMoney(prev):'',precio_sin_impuestos:lbMoney(Math.round(p.price/(1+iva/100))),
  precio_unidad_medida:upm,codigo_barras:code,sku:String(p.plu||p.id||''),codigo_qr:c.qrBase?String(c.qrBase).replace('{codigo}',encodeURIComponent(code)):code,rubro:rub?rub.name:'',
  fecha_vigencia:dmy(dkey(vig)),comercio:b.name||t.name||'',telefono:b.phone||t.phone||'',web:b.web||'',direccion:b.addr||t.address||'',leyenda:b.legal||''};}
const LB_VARS=[['nombre_producto','Nombre'],['descripcion','Presentación'],['precio_final','Precio'],['precio_anterior','Precio anterior'],['precio_sin_impuestos','Precio sin imp. nac.'],['precio_unidad_medida','Precio por kg/litro'],
 ['codigo_barras','Código de barras'],['codigo_qr','Código QR'],['sku','Código interno'],['rubro','Rubro'],['fecha_vigencia','Fecha de vigencia'],['comercio','Comercio'],['telefono','Teléfono'],['web','Web'],['direccion','Dirección'],['leyenda','Leyenda legal']];
const lbFill=(txt,v)=>String(txt||'').replace(/\{([a-z_]+)\}/g,(m,k)=>v[k]!==undefined&&k[0]!=='_'?v[k]:m);

/* ---------- Códigos de barras (módulos) ---------- */
function lbEan13(code){if(typeof giEanOk!=='function'||!giEanOk(code))return null;const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
 const G=L.map(s=>s.split('').reverse().map(x=>x==='1'?'0':'1').join(''));const R=L.map(s=>s.split('').map(x=>x==='1'?'0':'1').join(''));
 const P=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'][+code[0]];let b='101';
 for(let i=1;i<=6;i++)b+=(P[i-1]==='L'?L:G)[+code[i]];b+='01010';for(let i=7;i<=12;i++)b+=R[+code[i]];return b+'101';}
const LB_C128='212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
function lbC128(txt){txt=String(txt||'');if(!txt||txt.length>60||/[^\x20-\x7e]/.test(txt))return null;const cs=[];
 if(/^\d+$/.test(txt)&&txt.length>=4&&txt.length%2===0){cs.push(105);for(let i=0;i<txt.length;i+=2)cs.push(+txt.substr(i,2));}
 else{cs.push(104);for(const ch of txt)cs.push(ch.charCodeAt(0)-32);}
 let sum=cs[0];for(let i=1;i<cs.length;i++)sum+=cs[i]*i;cs.push(sum%103);cs.push(106);
 let b='';for(const c of cs){const w=LB_C128[c];for(let i=0;i<w.length;i++)b+=(i%2?'0':'1').repeat(+w[i]);}return b;}
/* SVG del código: quiet zone incluida; mod = ancho de módulo resultante en mm (para avisar si queda chico) */
function lbBarSvg(code,sym,wmm,hmm,hr){let bits=null,kind='';if(sym!=='code128'){bits=lbEan13(code);kind='EAN-13';}if(!bits){bits=lbC128(code);kind='Code 128';}
 if(!bits)return{svg:'<div class="lb-nob">Sin código</div>',mod:0,kind:''};
 const q=kind==='EAN-13'?{l:11,r:7}:{l:10,r:10};const n=bits.length+q.l+q.r;const mod=wmm/n;const th=hr?Math.min(hmm*0.3,3.2):0;const bh=Math.max(1,hmm-th);
 let d='',x=q.l,i=0;while(i<bits.length){if(bits[i]==='1'){let j=i;while(j<bits.length&&bits[j]==='1')j++;d+=`M${x+i} 0h${j-i}v${bh/mod}h-${j-i}z`;i=j;}else i++;}
 const vbH=hmm/mod;const txt=hr?`<text x="${n/2}" y="${vbH-0.6/mod}" font-size="${(th*0.95)/mod}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" fill="#000">${esc(code)}</text>`:'';
 return{svg:`<svg viewBox="0 0 ${n} ${vbH}" preserveAspectRatio="none" shape-rendering="crispEdges" width="100%" height="100%" aria-label="${kind} ${esc(code)}"><path d="${d}" fill="#000"/>${txt}</svg>`,mod,kind};}
function lbQrSvg(text){const m=(typeof QR!=='undefined'&&text)?QR.encode(String(text).slice(0,300)):null;if(!m)return{svg:'<div class="lb-nob">Sin QR</div>',n:0};
 const n=m.length,qz=2,s=n+qz*2;let d='';for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(m[i][j])d+=`M${j+qz} ${i+qz}h1v1h-1z`;
 return{svg:`<svg viewBox="0 0 ${s} ${s}" width="100%" height="100%" shape-rendering="crispEdges" aria-label="Código QR"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`,n:s};}

/* ---------- Logo en blanco y negro de alto contraste ---------- */
function lbLogoSrc(){const b=lbCfg().brand;return b.logo||(typeof LOGO_TICKET!=='undefined'?LOGO_TICKET:'');}
function lbToBW(src,thr,cb){if(!src)return cb('');const im=new Image();im.onload=()=>{try{const k=Math.min(1,600/Math.max(im.width,im.height));const w=Math.max(1,Math.round(im.width*k)),h=Math.max(1,Math.round(im.height*k));
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);const d=x.getImageData(0,0,w,h);
  for(let i=0;i<d.data.length;i+=4){const a=d.data[i+3]/255;const l=(0.299*d.data[i]+0.587*d.data[i+1]+0.114*d.data[i+2])*a+255*(1-a);const v=l<thr?0:255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}
  x.putImageData(d,0,0);cb(cv.toDataURL('image/png'));}catch(e){cb('');}};im.onerror=()=>cb('');im.src=src;}
let lbLogoBW='',lbLogoBWKey='';
function lbLogoReady(cb){const b=lbCfg().brand,src=lbLogoSrc();if(!b.bw)return cb&&cb();const key=src.length+':'+src.slice(-40)+':'+b.thr;if(key===lbLogoBWKey&&lbLogoBW)return cb&&cb();
 lbToBW(src,+b.thr||150,u=>{lbLogoBW=u;lbLogoBWKey=key;cb&&cb();});}
const lbLogo=()=>{const b=lbCfg().brand;return b.bw&&lbLogoBW?lbLogoBW:lbLogoSrc();};

/* ---------- Render de una etiqueta (HTML en mm) ---------- */
function lbStyle(){if($('#lb-css'))return;const s=document.createElement('style');s.id='lb-css';s.textContent=LB_CSS;document.head.appendChild(s);}
const LB_CSS=`.lbx{position:relative;overflow:hidden;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
.lbx .le{position:absolute;box-sizing:border-box;overflow:hidden;display:flex;line-height:1.08;white-space:pre-line;word-break:break-word}
.lbx .le.inv{background:#000;color:#fff}.lbx .le.st span{text-decoration:line-through}.lbx .le img{width:100%;height:100%;object-fit:contain}
.lbx .le.bc,.lbx .le.qr{display:block}.lbx .le.rc{border:.3mm solid #000}.lbx .le.rc.inv{border:0}.lbx .le.ln{background:#000}
.lbx .le .pr sup{font-size:.48em;vertical-align:top;position:relative;top:.12em;margin-left:.04em}.lb-nob{font-size:7pt;color:#888;border:1px dashed #bbb;height:100%;display:flex;align-items:center;justify-content:center}`;
function lbElHTML(e,v,edit){const st=`left:${e.x}mm;top:${e.y}mm;width:${e.w}mm;height:${Math.max(e.type==='line'?0.2:1,e.h)}mm`;
 const ja={left:'flex-start',center:'center',right:'flex-end'}[e.align]||'flex-start',ai={top:'flex-start',middle:'center',bottom:'flex-end'}[e.valign]||'center';
 const cls='le'+(e.inv?' inv':'')+(edit?' ed':'');const da=edit?` data-eid="${e.id}"`:'';
 if(e.type==='barcode'){const r=lbBarSvg(lbFill(e.text||'{codigo_barras}',v),e.sym,e.w,e.h,e.hr);return`<div class="${cls} bc"${da} style="${st}" data-mod="${r.mod.toFixed(3)}">${r.svg}</div>`;}
 if(e.type==='qr'){const r=lbQrSvg(lbFill(e.text||'{codigo_qr}',v));const s=Math.min(e.w,e.h);return`<div class="${cls} qr"${da} style="left:${e.x}mm;top:${e.y}mm;width:${s}mm;height:${s}mm" data-mod="${r.n?(s/r.n).toFixed(3):0}">${r.svg}</div>`;}
 if(e.type==='logo'){const s=lbLogo();return`<div class="${cls}"${da} style="${st}">${s?`<img src="${s}" alt="">`:'<div class="lb-nob">Logo</div>'}</div>`;}
 if(e.type==='rect')return`<div class="${cls} rc"${da} style="${st}"></div>`;
 if(e.type==='line')return`<div class="${cls} ln"${da} style="${st}"></div>`;
 let inner;const txt=lbFill(e.text,v);
 if(e.type==='price'&&e.text.trim()==='{precio_final}'&&e.dec!=='normal'){const n=lbNum(v._price);inner=`<span class="pr">$ ${n.ent}${e.dec==='none'||n.dec==='00'&&e.dec!=='sup0'?'':`<sup>${n.dec}</sup>`}</span>`;}
 else inner=`<span>${esc(txt)}</span>`;
 return`<div class="${cls}${e.strike?' st':''}"${da} data-fit="${e.fit?1:0}" data-fs="${e.fs}" style="${st};font-size:${e.fs}pt;font-weight:${e.bold?700:400};justify-content:${ja};align-items:${ai};text-align:${e.align}">${inner}</div>`;}
function lbHTML(t,p,edit){const v=lbVars(p);return`<div class="lbx" style="width:${t.w}mm;height:${t.h}mm">${t.els.map(e=>lbElHTML(e,v,edit)).join('')}</div>`;}
/* autoajuste: achica la letra hasta que el texto entra en su caja (en pasos de 0,5 pt, mínimo 4 pt) */
function lbFit(root){root.querySelectorAll('.le[data-fit="1"]').forEach(el=>{let fs=+el.dataset.fs||10;el.style.fontSize=fs+'pt';
 let n=0;while((el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)&&fs>4&&n<200){fs-=0.5;el.style.fontSize=fs+'pt';n++;}el.dataset.fsr=fs;});}

/* ---------- Motor de impresión (mm exactos, margen 0) ---------- */
/* jobs: [{pid,copies}] · o: {tpl, start (celda inicial en plancha, desde 0)} → {html, labels, pages} */
function lbBuild(jobs,o){lbStyle();const t=lbTpl(o&&o.tpl);const list=[];for(const j of jobs){const p=prod(j.pid);if(!p)continue;const n=Math.max(0,Math.min(500,Math.floor(+j.copies||0)));for(let i=0;i<n;i++)list.push(p);}
 if(!list.length)return{err:'No hay etiquetas para imprimir.'};if(list.length>3000)return{err:'Son más de 3.000 etiquetas: imprimilas en tandas.'};
 let host=$('#lb-host');if(!host){host=document.createElement('div');host.id='lb-host';host.setAttribute('aria-hidden','true');host.style.cssText='position:fixed;left:-20000px;top:0;visibility:hidden';document.body.appendChild(host);}
 const cache={};const out=list.map(p=>{if(cache[p.id])return cache[p.id];host.innerHTML=lbHTML(t,p);lbFit(host);return cache[p.id]=host.innerHTML;});host.innerHTML='';
 let m=t.media||{type:'roll'};let body,size,pages;const a4=o&&o.paper==='a4'&&m.type!=='sheet';
 /* V27.17 · papel común: las etiquetas de rollo se agrupan en hojas A4 (margen 6 mm, 2 mm entre etiquetas y guías de corte) */
 if(a4){const g=2,mg=6;const cols=Math.max(1,Math.floor((210-2*mg+g)/(t.w+g))),rows=Math.max(1,Math.floor((297-2*mg+g)/(t.h+g)));
  m={type:'sheet',pw:210,ph:297,gx:g,gy:g,cols,rows,mx:Math.round((210-(cols*t.w+(cols-1)*g))/2*10)/10,my:Math.round((297-(rows*t.h+(rows-1)*g))/2*10)/10};}
 if(m.type==='sheet'){const per=Math.max(1,m.cols*m.rows);const st=Math.max(0,Math.min(per-1,+(o&&o.start)||0));const cells=Array(st).fill(null).concat(out);pages=Math.ceil(cells.length/per);size=`${m.pw}mm ${m.ph}mm`;
  body='';for(let pg=0;pg<pages;pg++){body+=`<div class="pg" style="width:${m.pw}mm;height:${m.ph}mm">`;for(let k=0;k<per;k++){const h=cells[pg*per+k];if(!h)continue;const r=Math.floor(k/m.cols),c=k%m.cols;
   body+=`<div class="cell" style="left:${(+m.mx)+c*(t.w+(+m.gx))}mm;top:${(+m.my)+r*(t.h+(+m.gy))}mm">${h}</div>`;}body+='</div>';}}
 else{size=`${t.w}mm ${t.h}mm`;pages=out.length;body=out.map(h=>`<div class="pg" style="width:${t.w}mm;height:${t.h}mm">${h}</div>`).join('');}
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas · ${esc(t.name)}</title><style>@page{size:${size};margin:0}html,body{margin:0;padding:0;background:#fff}
 *{-webkit-print-color-adjust:exact;print-color-adjust:exact}.pg{position:relative;overflow:hidden;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}.cell{position:absolute}${a4?'.cell{outline:.2mm dashed #c8c8c8;outline-offset:.6mm}':''}${LB_CSS}</style></head><body>${body}</body></html>`;
 return{html,labels:list.length,pages,tpl:t,a4,per:a4?m.cols*m.rows:0};}
function lbPrintDoc(html){let f=$('#lb-print');if(f)f.remove();f=document.createElement('iframe');f.id='lb-print';f.setAttribute('aria-hidden','true');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';
 document.body.appendChild(f);const d=f.contentDocument;d.open();d.write(html);d.close();
 setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){toast('No se pudo abrir la impresión: '+e.message,1);}},250);return f;}

/* ---------- Cola inteligente ---------- */
const lbQ=()=>S.lblQ||(S.lblQ=[]);
const LB_WHY={precio:'Cambio de precio',ingreso:'Ingreso de mercadería',manual:'Agregado a mano'};
/* ingresos de compras nuevos → a la cola con la cantidad de la factura (sólo los que llegan después de activar el módulo) */
function lbScanReceipts(){const R=S.receipts||[];if(S.lblRcN===undefined||!giOn('labels')){S.lblRcN=R.length;return;}
 if(R.length>S.lblRcN){for(const r of R.slice(S.lblRcN)){const ref=((r.res&&r.res.tipo_comprobante)||'Compra')+' '+((r.res&&r.res.nro_comprobante)||'');
  (r.items||[]).forEach(it=>{if(it&&it.pid&&it.qty>0)lbQ().push({id:uid(),pid:it.pid,ts:r.ts||now(),why:'ingreso',ref:ref.trim(),qty:Math.round(it.qty),done:0});});}}
 S.lblRcN=R.length;if(lbQ().length>5000)S.lblQ=lbQ().filter(x=>!x.done).slice(-5000);}
{const _sv=save;save=function(){try{lbScanReceipts();}catch(e){}return _sv.apply(this,arguments);};}
/* filas pendientes: una por artículo (motivo más reciente), uniendo cambios de precio sin etiqueta y la cola */
function lbPending(f){f=f||{};const rows=new Map();const ts=giLblTs();
 if(giOn('price_hist')){const last={};giLog().forEach(e=>{if(e.f!=='cost'&&e.ts>(last[e.pid]||0))last[e.pid]=e.ts;});
  for(const pid in last){if(last[pid]>(ts[pid]||0))rows.set(pid,{pid,ts:last[pid],why:'precio',ref:'',qty:0});}}
 for(const q of lbQ()){if(q.done)continue;const r=rows.get(q.pid);if(!r||q.ts>=r.ts)rows.set(q.pid,{pid:q.pid,ts:q.ts,why:q.why,ref:q.ref,qty:(r&&r.why==='ingreso'?r.qty:0)+(q.why==='ingreso'?q.qty:0)});else if(q.why==='ingreso')r.qty+=q.qty;}
 let L=[...rows.values()].filter(r=>{const p=prod(r.pid);return p&&p.active!==false&&!p.archived;});
 if(f.rubro)L=L.filter(r=>prod(r.pid).rubro===f.rubro);if(f.sup){const s=giSupPids(f.sup);L=L.filter(r=>s.has(r.pid));}
 if(f.why)L=L.filter(r=>r.why===f.why);if(f.from)L=L.filter(r=>r.ts>=f.from);if(f.to)L=L.filter(r=>r.ts<f.to+86400000);
 return L.sort((a,b)=>b.ts-a.ts);}
function lbCopies(r,mode,man){const p=prod(r.pid);if(mode==='stock')return Math.max(0,Math.min(500,Math.floor(+p.stock||0)));if(mode==='factura')return r.why==='ingreso'&&r.qty>0?Math.min(500,r.qty):1;return Math.max(0,Math.min(500,Math.floor(+man||1)));}
function lbMarkDone(pids){const t=now();pids.forEach(id=>{giLblTs()[id]=t;});lbQ().forEach(q=>{if(!q.done&&pids.includes(q.pid))q.done=t;});}
function lbAddManual(pids,why){let n=0;const t=now();pids.forEach(pid=>{if(!prod(pid))return;if(lbQ().some(q=>!q.done&&q.pid===pid&&q.why==='manual'))return;lbQ().push({id:uid(),pid,ts:t,why:why||'manual',ref:'',qty:0,done:0});n++;});
 if(n){audit('ETIQUETAS_COLA',n+' artículo(s) agregados a la cola');save();}return n;}

/* ---------- Pantalla «Etiquetas» ---------- */
let lbTab='cola',lbF={},lbSel=new Set(),lbMode='uno',lbMan={},lbTplSel='',lbStart=0;
const lbPaper=()=>((S.cfg.lbl||{}).paper)||'a4';
const lbA4Per=t=>Math.max(1,Math.floor((198+2)/(t.w+2)))*Math.max(1,Math.floor((285+2)/(t.h+2)));
document.addEventListener('change',ev=>{if(ev.target&&ev.target.id==='lb-pa'){(S.cfg.lbl||(S.cfg.lbl={})).paper=ev.target.value==='rollo'?'rollo':'a4';save();}});
A.lbTab=el=>{lbTab=el.dataset.t;rerender();};
const lbFilterNow=()=>({rubro:val('lb-fr'),sup:val('lb-fs'),why:val('lb-fw'),from:val('lb-fd')?new Date(val('lb-fd')+'T00:00:00').getTime():0,to:val('lb-fh')?new Date(val('lb-fh')+'T00:00:00').getTime():0});
function lbColaHTML(){const L=lbPending(lbF);const rubs=S.rubros.filter(r=>r.kind==='rubro');const sups=(S.suppliers||[]).filter(s=>s.activo!==false);const c=lbCfg();
 if(!lbTplSel||!c.tpls.some(t=>t.id===lbTplSel))lbTplSel=c.def;const t=lbTpl(lbTplSel);const sel=L.filter(r=>lbSel.has(r.pid));
 const total=sel.reduce((a,r)=>a+lbCopies(r,lbMode,lbMan[r.pid]),0);const iso=x=>x?new Date(x).toISOString().slice(0,10):'';
 return`<div class="card"><div class="f">
 <div><label for="lb-fr">Rubro</label><select id="lb-fr"><option value="">Todos</option>${rubs.map(r=>`<option value="${r.id}" ${lbF.rubro===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></div>
 <div><label for="lb-fs">Proveedor</label><select id="lb-fs"><option value="">Todos</option>${sups.map(s=>`<option value="${s.id}" ${lbF.sup===s.id?'selected':''}>${esc(s.name||s.razon||'')}</option>`).join('')}</select></div>
 <div><label for="lb-fw">Motivo</label><select id="lb-fw"><option value="">Todos</option>${Object.entries(LB_WHY).map(([k,v])=>`<option value="${k}" ${lbF.why===k?'selected':''}>${v}</option>`).join('')}</select></div>
 <div><label for="lb-fd">Desde</label><input type="date" id="lb-fd" value="${iso(lbF.from)}"></div><div><label for="lb-fh">Hasta</label><input type="date" id="lb-fh" value="${iso(lbF.to)}"></div></div>
 <div class="row" style="gap:.5rem;flex-wrap:wrap"><input id="lb-add" class="sp" placeholder="Agregar a mano: código de barras o nombre (Enter)" autocomplete="off" style="min-width:14rem"><button class="btn sm" data-act="lbAdd">Agregar</button><button class="btn sm" data-act="lbAddRubro">Agregar todo el rubro elegido</button></div></div>
 <div class="card"><div class="f">
 <div><label for="lb-tp">Plantilla</label><select id="lb-tp">${c.tpls.map(x=>`<option value="${x.id}" ${x.id===lbTplSel?'selected':''}>${esc(x.name)} (${String(x.w).replace('.',',')} × ${String(x.h).replace('.',',')} mm)</option>`).join('')}</select></div>
 <div><label for="lb-cm">Copias</label><select id="lb-cm"><option value="uno" ${lbMode==='uno'?'selected':''}>Las que indico en cada fila</option><option value="stock" ${lbMode==='stock'?'selected':''}>Una por unidad en stock</option><option value="factura" ${lbMode==='factura'?'selected':''}>Según la factura de compra</option></select></div>
 ${t.media.type!=='sheet'?`<div><label for="lb-pa">Papel</label><select id="lb-pa"><option value="a4" ${lbPaper()==='a4'?'selected':''}>Hoja A4 · agrupadas (${lbA4Per(t)} por hoja)</option><option value="rollo" ${lbPaper()==='rollo'?'selected':''}>Rollo de etiquetera · una por etiqueta</option></select></div>`:''}${t.media.type==='sheet'?`<div><label for="lb-st">Empezar en la etiqueta N.º (plancha usada)</label><input id="lb-st" type="number" min="1" max="${t.media.cols*t.media.rows}" value="${lbStart+1}"></div>`:''}</div>
 <div class="row" style="gap:.5rem;flex-wrap:wrap"><b class="sp">${L.length} pendiente(s) · ${sel.length} elegida(s) · ${total} etiqueta(s)</b>
 <button class="btn sm" data-act="lbSelAll">${sel.length===L.length&&L.length?'Ninguna':'Elegir todas'}</button><button class="btn sm" data-act="lbPreview" ${sel.length?'':'disabled'}>Vista previa</button>
 <button class="btn gold" data-act="lbPrint" ${total?'':'disabled'}>🖨 Imprimir ${total}</button><button class="btn sm" data-act="lbDone" ${sel.length?'':'disabled'}>Marcar como impresas</button></div></div>
 ${L.length?`<div class="tw"><table data-nosort><thead><tr><th><span class="sr">Elegir</span></th><th>Artículo</th><th class="r">Precio</th><th>Motivo</th><th>Fecha</th><th class="r">Stock</th><th class="r">Copias</th></tr></thead><tbody>
 ${L.map(r=>{const p=prod(r.pid);const on=lbSel.has(r.pid);return`<tr><td><input type="checkbox" class="lb-ck" data-pid="${r.pid}" ${on?'checked':''} aria-label="Elegir ${esc(p.name)}"></td><td>${esc(pfull(p))}</td><td class="r">${money(p.price)}</td>
  <td>${esc(LB_WHY[r.why])}${r.ref?` <span class="sm mut">${esc(r.ref)}</span>`:''}${r.why==='ingreso'&&r.qty?` <span class="tag">${r.qty} u.</span>`:''}</td><td>${fmtDT(r.ts)}</td><td class="r">${+p.stock||0}</td>
  <td class="r">${lbMode==='uno'?`<input class="lb-cp" data-pid="${r.pid}" type="number" min="0" max="500" value="${lbMan[r.pid]===undefined?1:lbMan[r.pid]}" style="width:4.5rem" aria-label="Copias de ${esc(p.name)}">`:lbCopies(r,lbMode)}</td></tr>`;}).join('')}</tbody></table></div>`
 :'<div class="okbox">No hay etiquetas pendientes. Se suman solas cuando cambia un precio o entra mercadería por una compra.</div>'}`;}
function lbColaAfter(){const re=()=>{lbF=lbFilterNow();rerender();};['lb-fr','lb-fs','lb-fw','lb-fd','lb-fh'].forEach(i=>{const e=$('#'+i);if(e)e.addEventListener('change',re);});
 const tp=$('#lb-tp');if(tp)tp.addEventListener('change',()=>{lbTplSel=tp.value;lbStart=0;rerender();});const cm=$('#lb-cm');if(cm)cm.addEventListener('change',()=>{lbMode=cm.value;rerender();});
 const st=$('#lb-st');if(st)st.addEventListener('change',()=>{lbStart=Math.max(0,(+st.value||1)-1);});
 $$('.lb-ck').forEach(c=>c.addEventListener('change',()=>{c.checked?lbSel.add(c.dataset.pid):lbSel.delete(c.dataset.pid);rerender();}));
 $$('.lb-cp').forEach(c=>c.addEventListener('change',()=>{lbMan[c.dataset.pid]=Math.max(0,Math.min(500,+c.value||0));rerender();}));
 const ad=$('#lb-add');if(ad)ad.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();A.lbAdd();}});}
const lbJobs=()=>lbPending(lbF).filter(r=>lbSel.has(r.pid)).map(r=>({pid:r.pid,copies:lbCopies(r,lbMode,lbMan[r.pid])}));
A.lbSelAll=()=>{const L=lbPending(lbF);if(L.length&&L.every(r=>lbSel.has(r.pid)))lbSel.clear();else L.forEach(r=>lbSel.add(r.pid));rerender();};
A.lbAdd=()=>{const q=val('lb-add').trim();if(!q)return;const p=giFind(q)[0];if(!p)return toast('No encontré ese artículo.',1);lbAddManual([p.id]);lbSel.add(p.id);rerender();toast('Agregado: '+p.name);};
A.lbAddRubro=()=>{if(!lbF.rubro)return toast('Elegí primero un rubro en el filtro.',1);const L=S.products.filter(p=>p.rubro===lbF.rubro&&p.active!==false&&!p.archived);const n=lbAddManual(L.map(p=>p.id));L.forEach(p=>lbSel.add(p.id));rerender();toast(n+' artículo(s) agregados');};
A.lbPreview=()=>{const J=lbJobs();if(!J.length)return;lbLogoReady(()=>{const r=lbBuild(J.slice(0,12).map(j=>({pid:j.pid,copies:1})),{tpl:lbTplSel});if(r.err)return toast(r.err,1);
 const k=Math.min(1,560/(r.tpl.w*LB_PX));modal('Vista previa · '+esc(r.tpl.name),`<p class="sm mut">Tamaño real ${String(r.tpl.w).replace('.',',')} × ${String(r.tpl.h).replace('.',',')} mm${k<1?' (achicada para la pantalla)':''}. Se muestran hasta 12 artículos, una copia de cada uno.</p>
  <div class="lb-prev" style="display:flex;flex-wrap:wrap;gap:8px;max-height:60vh;overflow:auto">${(()=>{lbStyle();const t=r.tpl;return lbJobs().slice(0,12).map(j=>`<div style="width:${t.w*LB_PX*k}px;height:${t.h*LB_PX*k}px;outline:1px solid #ccc"><div style="transform:scale(${k});transform-origin:0 0">${lbHTML(t,prod(j.pid))}</div></div>`).join('');})()}</div>`,{wide:true,okText:'Imprimir',onOk:()=>{A.lbPrint();}});
 setTimeout(()=>{const w=$('.lb-prev');if(w)lbFit(w);},30);});};
A.lbPrint=()=>{const J=lbJobs().filter(j=>j.copies>0);if(!J.length)return toast('Elegí artículos con al menos una copia.',1);
 lbLogoReady(()=>{const r=lbBuild(J,{tpl:lbTplSel,start:lbStart,paper:lbPaper()});if(r.err)return toast(r.err,1);lbPrintDoc(r.html);
  audit('ETIQUETAS_IMPRESION',r.labels+' etiqueta(s) · '+r.pages+' página(s) · '+r.tpl.name+(r.a4?' · A4 ('+r.per+' por hoja)':''));
  setTimeout(()=>confirmBox('¿Salieron bien las etiquetas?',`Se mandaron <b>${r.labels}</b> etiqueta(s) en <b>${r.pages}</b> página(s). Si salieron bien, las marco como impresas y salen de la cola.<br><span class="sm mut">Para PDF: elegí «Guardar como PDF», márgenes «Ninguno» y escala 100 %.</span>`,()=>{lbMarkDone(J.map(j=>j.pid));lbSel.clear();lbStart=0;save();rerender();toast('Marcadas como impresas');},'Sí, salieron bien'),400);});};
A.lbDone=()=>{const J=lbJobs();if(!J.length)return;confirmBox('Marcar como impresas',`Salen de la cola <b>${J.length}</b> artículo(s) sin imprimir.`,()=>{lbMarkDone(J.map(j=>j.pid));audit('ETIQUETAS_MARCADAS',J.length+' artículo(s)');lbSel.clear();save();rerender();});};

/* ---------- Editor visual ---------- */
let lbEdT='',lbEdSel='',lbZoom=0,lbPrevPid='',lbUndo=[],lbSaveT=0;
const lbEdTpl=()=>{const c=lbCfg();if(!lbEdT||!c.tpls.some(t=>t.id===lbEdT))lbEdT=c.def;return lbTpl(lbEdT);};
const lbEdEl=()=>lbEdTpl().els.find(e=>e.id===lbEdSel);
function lbPrevProd(){let p=lbPrevPid&&prod(lbPrevPid);if(!p){p=S.products.find(x=>x.active!==false&&!x.archived&&x.barcode&&giEanOk(x.barcode))||S.products.find(x=>x.active!==false&&!x.archived);lbPrevPid=p?p.id:'';}
 return p||{id:'demo',name:'Producto de ejemplo',sub:'1 kg',price:123456,barcode:'7790000000004',unit:'u',rubro:''};}
function lbSnap(){lbUndo.push(JSON.stringify(lbEdTpl()));if(lbUndo.length>40)lbUndo.shift();}
function lbCommit(audTxt){clearTimeout(lbSaveT);lbSaveT=setTimeout(()=>{save();},600);if(audTxt)audit('ETIQUETAS_PLANTILLA',audTxt);}
const lbZ=()=>{const t=lbEdTpl();const host=$('#lb-cvw');const avail=host?host.clientWidth-24:640;return lbZoom||Math.max(0.5,Math.min(6,avail/(t.w*LB_PX)));};
function lbCanvasHTML(){const t=lbEdTpl(),z=lbZ();return`<div id="lb-cv" style="width:${t.w*LB_PX*z}px;height:${t.h*LB_PX*z}px;position:relative;box-shadow:0 0 0 1px #888,0 4px 18px rgba(0,0,0,.25);background:#fff;touch-action:none">
 <div id="lb-cvi" style="transform:scale(${z});transform-origin:0 0;width:${t.w}mm;height:${t.h}mm">${lbHTML(t,lbPrevProd(),true)}</div></div>`;}
function lbPaint(){const w=$('#lb-cvw');if(!w)return;w.innerHTML=lbCanvasHTML();lbFit(w);const s=lbEdSel&&w.querySelector(`[data-eid="${lbEdSel}"]`);if(s){s.classList.add('sel');s.insertAdjacentHTML('beforeend','<div class="lb-h" data-h="1" aria-hidden="true"></div>');}
 const warn=[];w.querySelectorAll('.le.bc,.le.qr').forEach(e=>{const m=+e.dataset.mod;if(e.classList.contains('bc')&&m&&m<0.25)warn.push('El código de barras queda con barras de '+m.toFixed(2).replace('.',',')+' mm: agrandalo (mínimo recomendado 0,25 mm) para que lo lea cualquier lector.');if(e.classList.contains('qr')&&m&&m<0.33)warn.push('El QR queda chico ('+m.toFixed(2).replace('.',',')+' mm por módulo): agrandalo a 0,33 mm o más.');});
 const wb=$('#lb-warn');if(wb)wb.innerHTML=warn.map(x=>`<div class="warnbox">${esc(x)}</div>`).join('');}
function lbPropsHTML(){const e=lbEdEl();if(!e)return'<p class="sm mut">Tocá un elemento del lienzo para editarlo, o arrastrá una variable desde la paleta.</p>';const num=(k,l,st)=>`<div><label for="lp-${k}">${l}</label><input id="lp-${k}" data-k="${k}" class="lb-p" type="number" step="${st||0.5}" value="${e[k]}"></div>`;
 const isTxt=e.type==='text'||e.type==='price';
 return`<h3 style="margin-top:0">${esc({text:'Texto',price:'Precio',barcode:'Código de barras',qr:'Código QR',logo:'Logo',rect:'Recuadro',line:'Línea'}[e.type])}</h3>
 ${['text','price','barcode','qr'].includes(e.type)?`<label for="lp-text">Contenido (podés combinar texto y {variables})</label><textarea id="lp-text" data-k="text" class="lb-p" rows="2">${esc(e.text)}</textarea>`:''}
 <div class="f">${num('x','X (mm)')}${num('y','Y (mm)')}${num('w','Ancho (mm)')}${num('h','Alto (mm)')}</div>
 ${isTxt?`<div class="f">${num('fs','Letra máx. (pt)')}<div><label for="lp-align">Alineación</label><select id="lp-align" data-k="align" class="lb-p">${[['left','Izquierda'],['center','Centro'],['right','Derecha']].map(([v,l])=>`<option value="${v}" ${e.align===v?'selected':''}>${l}</option>`).join('')}</select></div>
  <div><label for="lp-valign">Vertical</label><select id="lp-valign" data-k="valign" class="lb-p">${[['top','Arriba'],['middle','Medio'],['bottom','Abajo']].map(([v,l])=>`<option value="${v}" ${e.valign===v?'selected':''}>${l}</option>`).join('')}</select></div></div>
  <div class="row" style="gap:1rem;flex-wrap:wrap">${[['bold','Negrita'],['fit','Achicar para que entre'],['strike','Tachado'],['inv','Blanco sobre negro']].map(([k,l])=>`<label class="row" style="gap:.3rem"><input type="checkbox" data-k="${k}" class="lb-p" ${e[k]?'checked':''}> ${l}</label>`).join('')}</div>
  ${e.type==='price'?`<label for="lp-dec">Centavos</label><select id="lp-dec" data-k="dec" class="lb-p">${[['sup','Chiquitos arriba (si hay)'],['normal','Normales'],['none','Sin centavos']].map(([v,l])=>`<option value="${v}" ${e.dec===v?'selected':''}>${l}</option>`).join('')}</select>`:''}`:''}
 ${e.type==='barcode'?`<div class="f"><div><label for="lp-sym">Tipo</label><select id="lp-sym" data-k="sym" class="lb-p">${[['auto','Automático (EAN-13 si es válido; si no, Code 128)'],['code128','Code 128']].map(([v,l])=>`<option value="${v}" ${e.sym===v?'selected':''}>${l}</option>`).join('')}</select></div></div><label class="row" style="gap:.3rem"><input type="checkbox" data-k="hr" class="lb-p" ${e.hr?'checked':''}> Mostrar los números debajo</label>`:''}
 ${e.type==='rect'?`<label class="row" style="gap:.3rem"><input type="checkbox" data-k="inv" class="lb-p" ${e.inv?'checked':''}> Relleno negro</label>`:''}
 <div class="row" style="gap:.5rem;margin-top:.6rem"><button class="btn sm" data-act="lbDup">Duplicar</button><button class="btn sm red" data-act="lbDel">Eliminar</button></div>`;}
function lbEditorHTML(){const c=lbCfg(),t=lbEdTpl();const m=t.media;
 return`<div class="card"><div class="row" style="gap:.5rem;flex-wrap:wrap"><label for="lb-et" class="sr">Plantilla</label><select id="lb-et">${c.tpls.map(x=>`<option value="${x.id}" ${x.id===t.id?'selected':''}>${esc(x.name)}${x.id===c.def?' ★':''}</option>`).join('')}</select>
 <button class="btn sm" data-act="lbNewTpl">+ Nueva</button><button class="btn sm" data-act="lbDupTpl">Duplicar</button><button class="btn sm" data-act="lbDefTpl" ${t.id===c.def?'disabled':''}>Usar por defecto</button><button class="btn sm red" data-act="lbDelTpl" ${c.tpls.length<2?'disabled':''}>Eliminar</button>
 <button class="btn sm" data-act="lbUndoA" title="Ctrl + Z" ${lbUndo.length?'':'disabled'}>↶ Deshacer</button></div>
 <div class="f"><div><label for="lb-en">Nombre</label><input id="lb-en" value="${esc(t.name)}" maxlength="40"></div><div><label for="lb-ew">Ancho de la etiqueta (mm)</label><input id="lb-ew" type="number" step="0.1" min="10" max="420" value="${t.w}"></div>
 <div><label for="lb-eh">Alto (mm)</label><input id="lb-eh" type="number" step="0.1" min="10" max="420" value="${t.h}"></div>
 <div><label for="lb-em">Papel</label><select id="lb-em"><option value="roll" ${m.type==='roll'?'selected':''}>Rollo (una etiqueta por página)</option><option value="sheet" ${m.type==='sheet'?'selected':''}>Plancha (A4 u otra)</option></select></div></div>
 ${m.type==='sheet'?`<div class="f">${[['pw','Ancho del papel'],['ph','Alto del papel'],['cols','Columnas',1],['rows','Filas',1],['mx','Margen izq.'],['my','Margen sup.'],['gx','Separación horiz.'],['gy','Separación vert.']].map(([k,l,int])=>`<div><label for="lb-m${k}">${l}${int?'':' (mm)'}</label><input id="lb-m${k}" class="lb-m" data-k="${k}" type="number" step="${int?1:0.1}" min="0" value="${m[k]}"></div>`).join('')}</div>
  <p class="sm ${lbSheetOk(t)?'mut':'warn'}">${lbSheetOk(t)?'Entran '+(m.cols*m.rows)+' etiquetas por hoja.':'⚠ Las etiquetas no entran en el papel con esas medidas: revisá márgenes, separación, filas y columnas.'} <button class="btn sm" data-act="lbAutoSheet">Calcular márgenes centrados</button></p>`:''}</div>
 <style>.lb-ed{display:grid;grid-template-columns:minmax(10rem,13rem) minmax(0,1fr) minmax(14rem,19rem);gap:.8rem;align-items:start}@media(max-width:1000px){.lb-ed{grid-template-columns:minmax(0,1fr)}.lb-pal{order:2}}.lb-ed .le.ed{cursor:move;outline:1px dashed #0003}.lb-ed .le.ed.sel{outline:2px solid #1a73e8}.lb-h{position:absolute;right:0;bottom:0;width:2.2mm;height:2.2mm;background:#1a73e8;cursor:nwse-resize}</style><div class="lb-ed">
 <div class="card lb-pal"><h3 style="margin-top:0">Paleta</h3><p class="sm mut">Arrastrá al lienzo o tocá para agregar.</p>
  ${LB_VARS.map(([k,l])=>`<button class="btn sm lb-pi" draggable="true" data-act="lbAddEl" data-v="${k}" style="display:block;width:100%;margin:.15rem 0;text-align:left">{${esc(l)}}</button>`).join('')}
  <hr>${[['text','Texto libre'],['barcode','Código de barras'],['qr','Código QR'],['logo','Logo'],['rect','Recuadro'],['line','Línea']].map(([k,l])=>`<button class="btn sm lb-pi" draggable="true" data-act="lbAddEl" data-ty="${k}" style="display:block;width:100%;margin:.15rem 0;text-align:left">+ ${l}</button>`).join('')}</div>
 <div><div class="row" style="gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem"><input id="lb-pp" class="sp" placeholder="Ver con otro artículo (código o nombre)" autocomplete="off"><label for="lb-zm" class="sr">Zoom</label><select id="lb-zm">${[[0,'Ajustar'],[1,'100 %'],[2,'200 %'],[3,'300 %'],[4,'400 %']].map(([v,l])=>`<option value="${v}" ${lbZoom===v?'selected':''}>${l}</option>`).join('')}</select>
  <button class="btn sm" data-act="lbTestPrint">Imprimir prueba</button></div><p class="sm mut">Vista previa con: <b>${esc(pfull(lbPrevProd()))}</b></p>
  <div id="lb-cvw" style="overflow:auto;padding:12px;background:repeating-conic-gradient(#8881 0 25%,transparent 0 50%) 0 0/16px 16px;border-radius:8px;min-height:8rem"></div><div id="lb-warn"></div>
  <p class="sm mut">Mover: arrastrar o flechas (0,5 mm; con Mayús 2 mm). Tamaño: tirador de la esquina. Suprimir: borra. Ctrl + Z: deshace.</p></div>
 <div class="card" id="lb-props">${lbPropsHTML()}</div></div>`;}
function lbSheetOk(t){const m=t.media;if(m.type!=='sheet')return true;return (+m.mx)+m.cols*t.w+(m.cols-1)*(+m.gx)<=(+m.pw)+0.01&&(+m.my)+m.rows*t.h+(m.rows-1)*(+m.gy)<=(+m.ph)+0.01&&m.cols>=1&&m.rows>=1;}
function lbEditorAfter(){const t=lbEdTpl();lbLogoReady(()=>lbPaint());lbPaint();const g=id=>$('#'+id);
 g('lb-et').addEventListener('change',()=>{lbEdT=g('lb-et').value;lbEdSel='';lbUndo=[];rerender();});
 g('lb-en').addEventListener('change',()=>{lbSnap();t.name=g('lb-en').value.trim().slice(0,40)||'Plantilla';lbCommit();rerender();});
 [['lb-ew','w'],['lb-eh','h']].forEach(([i,k])=>g(i).addEventListener('change',()=>{const v=Math.max(10,Math.min(420,+g(i).value||t[k]));lbSnap();t[k]=Math.round(v*10)/10;lbCommit('Tamaño '+t.name+': '+t.w+' × '+t.h+' mm');rerender();}));
 g('lb-em').addEventListener('change',()=>{lbSnap();t.media.type=g('lb-em').value;if(t.media.type==='sheet'&&!(t.media.cols>0)){Object.assign(t.media,{pw:210,ph:297,cols:1,rows:1,gx:0,gy:0});}if(t.media.type==='sheet')lbAutoSheet(t,!(t.media.cols*t.media.rows>1)||!lbSheetOk(t));lbCommit();rerender();});
 $$('.lb-m').forEach(i=>i.addEventListener('change',()=>{lbSnap();const k=i.dataset.k;let v=+i.value||0;if(k==='cols'||k==='rows')v=Math.max(1,Math.min(40,Math.round(v)));t.media[k]=Math.max(0,v);lbCommit();rerender();}));
 g('lb-zm').addEventListener('change',()=>{lbZoom=+g('lb-zm').value;lbPaint();});
 g('lb-pp').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const p=giFind(g('lb-pp').value)[0];if(!p)return toast('No encontré ese artículo.',1);lbPrevPid=p.id;rerender();}});
 lbPropsBind();
 const w=g('lb-cvw');
 /* arrastrar desde la paleta (HTML5) */
 $$('.lb-pi').forEach(b=>b.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',JSON.stringify({v:b.dataset.v||'',ty:b.dataset.ty||''}));e.dataTransfer.effectAllowed='copy';}));
 w.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
 w.addEventListener('drop',e=>{e.preventDefault();let d;try{d=JSON.parse(e.dataTransfer.getData('text/plain'));}catch(x){return;}const cv=$('#lb-cv');if(!cv)return;const r=cv.getBoundingClientRect(),z=lbZ();
  lbAddEl(d.v,d.ty,Math.max(0,(e.clientX-r.left)/(LB_PX*z)),Math.max(0,(e.clientY-r.top)/(LB_PX*z)));});
 /* mover y redimensionar con el puntero (mouse, lápiz o dedo) */
 let drag=null;
 w.addEventListener('pointerdown',e=>{const le=e.target.closest('.le.ed');if(!le){if(e.target.closest('#lb-cv')){lbEdSel='';lbPaint();lbPropsRefresh();}return;}
  const el=lbEdTpl().els.find(x=>x.id===le.dataset.eid);if(!el)return;e.preventDefault();if(lbEdSel!==el.id){lbEdSel=el.id;lbPaint();lbPropsRefresh();}
  const node=w.querySelector(`[data-eid="${el.id}"]`);lbSnap();drag={el,node,rs:!!e.target.closest('.lb-h'),sx:e.clientX,sy:e.clientY,o:{x:el.x,y:el.y,w:el.w,h:el.h},z:lbZ(),moved:false};try{w.setPointerCapture(e.pointerId);}catch(x){}});
 w.addEventListener('pointermove',e=>{if(!drag)return;const t=lbEdTpl();const dx=(e.clientX-drag.sx)/(LB_PX*drag.z),dy=(e.clientY-drag.sy)/(LB_PX*drag.z);const sn=v=>Math.round(v*2)/2;const el=drag.el;
  if(Math.abs(dx)+Math.abs(dy)>0.2)drag.moved=true;
  if(drag.rs){el.w=Math.max(2,Math.min(t.w-el.x,sn(drag.o.w+dx)));el.h=Math.max(el.type==='line'?0.2:1,Math.min(t.h-el.y,sn(drag.o.h+dy)));drag.node.style.width=el.w+'mm';drag.node.style.height=(el.type==='qr'?Math.min(el.w,el.h):el.h)+'mm';if(el.type==='qr')drag.node.style.width=Math.min(el.w,el.h)+'mm';}
  else{el.x=Math.max(0,Math.min(t.w-Math.min(el.w,t.w),sn(drag.o.x+dx)));el.y=Math.max(0,Math.min(t.h-Math.min(el.h,t.h),sn(drag.o.y+dy)));drag.node.style.left=el.x+'mm';drag.node.style.top=el.y+'mm';}});
 const end=()=>{if(!drag)return;const d=drag;drag=null;if(!d.moved){lbUndo.pop();return;}lbCommit();lbPaint();lbPropsRefresh();};
 w.addEventListener('pointerup',end);w.addEventListener('pointercancel',end);
 if(!window._lbKeys){window._lbKeys=1;document.addEventListener('keydown',lbKeys);}}
function lbKeys(e){if(curScreen!=='etiquetas'||lbTab!=='editor'||$('#modal-root .ov'))return;const tg=e.target;const typing=tg&&/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName);
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!typing){e.preventDefault();A.lbUndoA();return;}
 const el=lbEdEl();if(!el||typing)return;const t=lbEdTpl();const st=e.shiftKey?2:0.5;const mv={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]}[e.key];
 if(mv){e.preventDefault();lbSnap();el.x=Math.max(0,Math.min(t.w-el.w,Math.round((el.x+mv[0])*10)/10));el.y=Math.max(0,Math.min(t.h-el.h,Math.round((el.y+mv[1])*10)/10));lbCommit();lbPaint();lbPropsRefresh();}
 else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();A.lbDel();}}
function lbPropsRefresh(){const p=$('#lb-props');if(p){p.innerHTML=lbPropsHTML();lbPropsBind();}}
function lbPropsBind(){$$('.lb-p').forEach(i=>i.addEventListener(i.tagName==='TEXTAREA'?'input':'change',()=>{const el=lbEdEl();if(!el)return;const k=i.dataset.k;lbSnap();
 if(i.type==='checkbox')el[k]=i.checked?1:0;else if(i.type==='number'){const v=+i.value;if(!isFinite(v))return;el[k]=Math.max(k==='fs'?3:0,Math.round(v*10)/10);}else el[k]=k==='text'?i.value.slice(0,300):i.value;
 lbCommit();lbPaint();}));}
function lbAddEl(v,ty,x,y){const t=lbEdTpl();lbSnap();let e;
 if(v){const isP=v==='precio_final';e=lbEl({type:isP?'price':(v==='codigo_barras'?'barcode':v==='codigo_qr'?'qr':'text'),text:'{'+v+'}',w:isP?Math.min(30,t.w-2):v==='codigo_qr'?Math.min(18,t.w,t.h):Math.min(30,t.w-2),h:isP?Math.min(10,t.h):v==='codigo_barras'?Math.min(9,t.h):v==='codigo_qr'?Math.min(18,t.w,t.h):Math.min(6,t.h),fs:isP?22:9,bold:isP?1:0});}
 else e=lbEl({type:ty,text:ty==='text'?'Texto':ty==='barcode'?'{codigo_barras}':ty==='qr'?'{codigo_qr}':'',w:ty==='qr'?Math.min(18,t.w,t.h):Math.min(ty==='line'?t.w-4:24,t.w-2),h:ty==='line'?0.3:ty==='qr'?Math.min(18,t.w,t.h):ty==='logo'?Math.min(10,t.h):Math.min(8,t.h)});
 e.x=Math.max(0,Math.min(t.w-e.w,Math.round((x===undefined?2:x)*2)/2));e.y=Math.max(0,Math.min(t.h-e.h,Math.round((y===undefined?2:y)*2)/2));t.els.push(e);lbEdSel=e.id;lbCommit();lbPaint();lbPropsRefresh();}
A.lbAddEl=el=>{if(lbTab!=='editor')return;lbAddEl(el.dataset.v,el.dataset.ty);};
A.lbDel=()=>{const t=lbEdTpl();const e=lbEdEl();if(!e)return;lbSnap();t.els=t.els.filter(x=>x.id!==e.id);lbEdSel='';lbCommit();lbPaint();lbPropsRefresh();};
A.lbDup=()=>{const t=lbEdTpl();const e=lbEdEl();if(!e)return;lbSnap();const n=Object.assign({},e,{id:lbId(),x:Math.min(t.w-e.w,e.x+2),y:Math.min(t.h-e.h,e.y+2)});t.els.push(n);lbEdSel=n.id;lbCommit();lbPaint();lbPropsRefresh();};
A.lbUndoA=()=>{if(!lbUndo.length)return;const s=JSON.parse(lbUndo.pop());const c=lbCfg();const i=c.tpls.findIndex(t=>t.id===s.id);if(i<0)return;c.tpls[i]=s;if(!s.els.some(e=>e.id===lbEdSel))lbEdSel='';lbCommit();rerender();};
A.lbNewTpl=()=>{modal('Nueva plantilla',`<label for="nt-p">Partir de</label><select id="nt-p">${LB_PRESETS.map(p=>`<option value="${p.k}">${esc(p.name)}</option>`).join('')}<option value="blank">En blanco</option></select><label for="nt-n">Nombre</label><input id="nt-n" maxlength="40" placeholder="Ej.: Góndola bebidas">`,{okText:'Crear',onOk:w=>{
 const k=val('nt-p');const pr=LB_PRESETS.find(p=>p.k===k);const t=pr?lbFromPreset(pr,val('nt-n').trim()||pr.name):{id:'t'+lbId(),name:val('nt-n').trim()||'Plantilla en blanco',w:50,h:30,media:{type:'roll',pw:210,ph:297,cols:1,rows:1,mx:0,my:0,gx:0,gy:0},els:[]};
 lbCfg().tpls.push(t);lbEdT=t.id;lbEdSel='';lbUndo=[];audit('ETIQUETAS_PLANTILLA','Nueva: '+t.name);save();rerender();}});};
A.lbDupTpl=()=>{const t=lbEdTpl();const n=JSON.parse(JSON.stringify(t));n.id='t'+lbId();n.name=(t.name+' (copia)').slice(0,40);n.els.forEach(e=>e.id=lbId());lbCfg().tpls.push(n);lbEdT=n.id;lbEdSel='';lbUndo=[];audit('ETIQUETAS_PLANTILLA','Duplicada: '+n.name);save();rerender();};
A.lbDefTpl=()=>{const t=lbEdTpl();lbCfg().def=t.id;audit('ETIQUETAS_PLANTILLA','Por defecto: '+t.name);save();rerender();};
A.lbDelTpl=()=>{const c=lbCfg(),t=lbEdTpl();if(c.tpls.length<2)return;confirmBox('Eliminar plantilla',`Se elimina <b>${esc(t.name)}</b>.`,()=>{c.tpls=c.tpls.filter(x=>x.id!==t.id);if(c.def===t.id)c.def=c.tpls[0].id;lbEdT='';lbEdSel='';lbUndo=[];audit('ETIQUETAS_PLANTILLA','Eliminada: '+t.name);save();rerender();},'Eliminar');};
function lbAutoSheet(t,reset){const m=t.media;if(reset||!(m.cols>=1)){m.gx=m.gx||0;m.gy=m.gy||0;m.cols=Math.max(1,Math.floor((m.pw+m.gx)/(t.w+m.gx)));m.rows=Math.max(1,Math.floor((m.ph+m.gy)/(t.h+m.gy)));}
 m.mx=Math.max(0,Math.round(((m.pw-(m.cols*t.w+(m.cols-1)*m.gx))/2)*10)/10);m.my=Math.max(0,Math.round(((m.ph-(m.rows*t.h+(m.rows-1)*m.gy))/2)*10)/10);}
A.lbAutoSheet=()=>{const t=lbEdTpl();lbSnap();lbAutoSheet(t,!lbSheetOk(t));lbCommit();rerender();};
A.lbTestPrint=()=>{const p=lbPrevProd();if(!prod(p.id))return toast('Cargá al menos un artículo para la prueba.',1);lbLogoReady(()=>{const r=lbBuild([{pid:p.id,copies:1}],{tpl:lbEdTpl().id});if(r.err)return toast(r.err,1);lbPrintDoc(r.html);});};

/* ---------- Marca ---------- */
function lbMarcaHTML(){const c=lbCfg(),b=c.brand,t=S.tenant;const src=lbLogoSrc();
 return`<div class="card"><h3 style="margin-top:0">Datos del comercio para las etiquetas</h3><p class="sm mut">Si dejás un campo vacío se usa el del comercio.</p><div class="f">
 ${[['name','Nombre',t.name],['phone','Teléfono',t.phone],['web','Web',''],['addr','Dirección',t.address]].map(([k,l,ph])=>`<div><label for="lm-${k}">${l}</label><input id="lm-${k}" class="lb-b" data-k="${k}" value="${esc(b[k]||'')}" placeholder="${esc(ph||'')}" maxlength="80"></div>`).join('')}</div>
 <label for="lm-legal">Leyenda legal fija</label><textarea id="lm-legal" class="lb-b" data-k="legal" rows="2" maxlength="200" placeholder="Ej.: Precios en pesos con IVA incluido. Vigentes salvo error de impresión.">${esc(b.legal||'')}</textarea>
 <div class="f"><div><label for="lm-iva">IVA para «precio sin impuestos nacionales» (%)</label><input id="lm-iva" type="number" min="0" max="50" step="0.5" value="${c.iva}"></div>
 <div><label for="lm-qr">Enlace del QR (opcional; {codigo} = código del artículo)</label><input id="lm-qr" value="${esc(c.qrBase||'')}" placeholder="https://…/producto?c={codigo}" maxlength="200"></div></div>
 <p class="sm mut">El precio sin impuestos sólo descuenta el IVA indicado; no descuenta impuestos internos. [VERIFICAR con el contador.]</p></div>
 <div class="card"><h3 style="margin-top:0">Logo</h3><div class="row" style="gap:1rem;flex-wrap:wrap;align-items:flex-start">
 <div><div class="sm mut">Original</div><div style="width:12rem;height:6rem;background:#fff;border:1px solid #ccc;display:flex;align-items:center;justify-content:center">${src?`<img src="${src}" alt="Logo original" style="max-width:100%;max-height:100%">`:'—'}</div></div>
 <div><div class="sm mut">Blanco y negro (impresoras térmicas)</div><div style="width:12rem;height:6rem;background:#fff;border:1px solid #ccc;display:flex;align-items:center;justify-content:center"><img id="lm-bwi" alt="Logo en blanco y negro" style="max-width:100%;max-height:100%"></div></div></div>
 <div class="row" style="gap:.5rem;flex-wrap:wrap;margin-top:.6rem"><label class="btn sm" for="lm-file">Subir logo</label><input id="lm-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>${b.logo?'<button class="btn sm" data-act="lbLogoDef">Usar el logo del sistema</button>':''}</div>
 <label class="row" style="gap:.4rem;margin-top:.6rem"><input type="checkbox" id="lm-bw" ${b.bw?'checked':''}> Imprimir el logo en blanco y negro de alto contraste</label>
 <label for="lm-thr">Umbral (más alto = más negro): <b id="lm-thv">${b.thr}</b></label><input id="lm-thr" type="range" min="40" max="230" value="${b.thr}"></div>`;}
function lbMarcaAfter(){const c=lbCfg(),b=c.brand;const paint=()=>lbToBW(lbLogoSrc(),+b.thr||150,u=>{const i=$('#lm-bwi');if(i&&u)i.src=u;});paint();
 $$('.lb-b').forEach(i=>i.addEventListener('change',()=>{b[i.dataset.k]=i.value.replace(/[<>]/g,'').trim().slice(0,i.dataset.k==='legal'?200:80);audit('ETIQUETAS_MARCA','Cambio: '+i.dataset.k);save();}));
 $('#lm-iva').addEventListener('change',()=>{const v=+$('#lm-iva').value;if(v>=0&&v<=50){c.iva=v;save();}});
 $('#lm-qr').addEventListener('change',()=>{const v=$('#lm-qr').value.trim();if(v&&!/^https:\/\//.test(v))return toast('El enlace tiene que empezar con https://',1);c.qrBase=v.slice(0,200);save();});
 $('#lm-bw').addEventListener('change',()=>{b.bw=$('#lm-bw').checked?1:0;lbLogoBWKey='';save();});
 const th=$('#lm-thr');th.addEventListener('input',()=>{$('#lm-thv').textContent=th.value;});th.addEventListener('change',()=>{b.thr=+th.value;lbLogoBWKey='';save();paint();});
 $('#lm-file').addEventListener('change',()=>{const f=$('#lm-file').files[0];if(!f)return;if(f.size>3000000)return toast('La imagen es muy pesada (máx. 3 MB).',1);const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{
  const u=lbShrinkLogo(im);if(!u)return toast('El logo queda muy pesado aun achicado: probá con uno más simple.',1);b.logo=u;lbLogoBWKey='';audit('ETIQUETAS_MARCA','Logo nuevo');save();rerender();};im.src=rd.result;};rd.readAsDataURL(f);});}
/* el logo viaja dentro de la configuración del comercio (la nube acepta registros de hasta 400.000 caracteres): se guarda en 60 KB como máximo */
const LB_LOGO_MAX=60000;
function lbShrinkLogo(im){for(const side of [360,280,200,140]){const k=Math.min(1,side/Math.max(im.width,im.height));const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(im.width*k));cv.height=Math.max(1,Math.round(im.height*k));
  const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.drawImage(im,0,0,cv.width,cv.height);let u=cv.toDataURL('image/png');if(u.length<=LB_LOGO_MAX)return u;u=cv.toDataURL('image/jpeg',0.86);if(u.length<=LB_LOGO_MAX)return u;}return'';}
A.lbLogoDef=()=>{lbCfg().brand.logo='';lbLogoBWKey='';audit('ETIQUETAS_MARCA','Logo del sistema');save();rerender();};

reg('etiquetas','Etiquetas','list','edit_products',()=>{lbStyle();const tabs=[['cola','Cola de impresión'],['editor','Plantillas y editor'],['marca','Marca y logo']];
 return`<div class="row"><h1 class="sp">Etiquetas</h1><button class="btn sm" data-act="nav" data-id="precios">Historial y precios</button></div>
 <p class="sm mut">Las etiquetas se arman solas cuando cambia un precio o entra mercadería. Elegí la plantilla, la cantidad y imprimí en rollo térmico o en plancha A4 (o guardá como PDF).</p>
 <div class="ux-tabs" role="tablist">${tabs.map(([k,t])=>`<a role="tab" tabindex="0" data-act="lbTab" data-t="${k}" aria-selected="${k===lbTab}" class="${k===lbTab?'on':''}">${t}</a>`).join('')}</div>
 ${lbTab==='editor'?lbEditorHTML():lbTab==='marca'?lbMarcaHTML():lbColaHTML()}`;},
 ()=>{if(lbTab==='editor')lbEditorAfter();else if(lbTab==='marca')lbMarcaAfter();else lbColaAfter();},'Operación');
SCREENS.etiquetas.show=()=>giOn('labels');
NAV.push(['etiquetas','Operación']);
/* en «Precios y etiquetas», la pestaña de etiquetas manda a la cola profesional cuando el módulo está activo */
{const _lh=giLblHTML;giLblHTML=function(){if(!giOn('labels'))return _lh.apply(this,arguments);const n=lbPending().length;
 return`<div class="card"><h3 style="margin-top:0">Etiquetas profesionales activas</h3><p>Hay <b>${n}</b> artículo(s) en la cola de impresión.</p><button class="btn gold" data-act="nav" data-id="etiquetas">Ir a Etiquetas</button></div>`;};}
/* demo: activo y con plantillas; en la demo también la cola tiene un ingreso de mercadería de ejemplo */
{const _rt=route;route=function(){try{if(S&&S.cfg&&!IS_CLIENT&&!S.lbDemo){S.lbDemo=1;giCfg().labels=1;lbCfg();const P=S.products.filter(p=>p.active!==false&&!p.archived).slice(8,11);
 P.forEach((p,i)=>lbQ().push({id:uid(),pid:p.id,ts:now()-(2-i)*3600e3,why:'ingreso',ref:'Factura A 0001-0000123 (ejemplo)',qty:6*(i+1),done:0}));S.lblRcN=(S.receipts||[]).length;}}catch(e){console.warn('lbDemo',e);}return _rt.apply(this,arguments);};}
