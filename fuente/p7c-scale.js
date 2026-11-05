/* ===== V26.49 · 4.34 H1 · Balanza (Systel / Kretz / genérica) y etiquetas EAN-13 pesables =====
   Funciones PURAS (sin DOM ni estado global) para poder probarlas solas:
     scaleFrame(línea)            → {kg, stable, zero} | null      (interpreta una trama de la balanza)
     scaleStabNew / scaleStabPush → estable cuando el peso no cambia durante ≥ 400 ms (medido con la hora de cada muestra)
     scaleDupNew / scaleDupCheck / scaleDupMark / scaleDupSeen → guardia anti-duplicado por ticket
     ean13Ok(código)              → dígito verificador EAN-13 (módulo 10)
     scaleLabelParse(código, formatos, modoGlobal) → {plu, mode, kg|priceC} | {err}
     scaleLabelQty(importe, precioKg) → peso (3 decimales) y precio que dan el importe EXACTO de la etiqueta
   Protocolos (datos públicos de instaladores, [VERIFICAR] con el equipo real):
     Systel: 9600 8N1, pide el peso con ENQ (0x05); también puede enviar en continuo.
     Kretz:  9600 8N1, pide con «P»+CR; responde «PE» + peso (estable) o «PI» + peso (moviéndose).
     Genérico: pide con «W»+CR, o envío continuo. */
const SCALE_MAX=300;          /* kg: cubre balanzas de mostrador (31 kg) y básculas (300 kg) */
const SCALE_ZERO=0.005;       /* kg: hasta acá se considera «plato vacío» */
const SCALE_PROTOS={
 continuo:{name:'Envío continuo',req:null},
 systel:{name:'Systel',req:[0x05]},
 kretz:{name:'Kretz',req:[0x50,0x0d]},
 generico:{name:'Genérico (pedido W)',req:[0x57,0x0d]}};
const SCALE_PROBE=['systel','kretz','generico'];
const SCALE_BAUDS=[9600,4800,19200,2400];

function scaleFrame(line){
 let s=String(line==null?'':line).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,' ').trim();
 if(!s)return null;
 /* bandera de estabilidad: Kretz PE/PI; CAS y otras ST/US; «M» o «?» = en movimiento */
 let stable=true;
 if(/^PI\b|^PI(?=[\s+\-\d])/i.test(s)||/(^|[\s,])(US|UN|M|\?)(?=[\s,]|$)/i.test(s)||/^\?/.test(s))stable=false;
 const m=/([-+]?)\s*(\d{1,6}(?:[.,]\d{1,4})?)\s*(kg|g|lb)?\b/i.exec(s.replace(/^P[EI]/i,' '));
 if(!m)return null;
 const raw=m[2],neg=m[1]==='-';const u=(m[3]||'').toLowerCase();
 let v=parseFloat(raw.replace(',','.'));if(!isFinite(v))return null;
 if(u==='g')v=v/1000;
 else if(u==='lb')return null;                                   /* libras: no se usan en Argentina */
 else if(!u&&!/[.,]/.test(raw)&&raw.length>=5)v=v/1000;          /* entero sin unidad de 5+ cifras (01250) = gramos [VERIFICAR] */
 if(neg)return{kg:0,stable,zero:true,neg:true};
 if(v>SCALE_MAX)return null;
 v=Math.round(v*1000)/1000;
 return{kg:v,stable,zero:v<=SCALE_ZERO};}

function scaleStabNew(o){o=o||{};return{win:o.win>0?o.win:400,tol:o.tol>0?o.tol:0,buf:[]};}
/* agrega una muestra {kg, stable, t} y devuelve {stable, kg}: estable cuando TODAS las muestras desde hace ≥ win ms
   están dentro de la tolerancia y la última trama no dice «moviéndose» */
function scaleStabPush(st,smp){
 st.buf.push({kg:smp.kg,ok:smp.stable!==false,t:smp.t});
 const lim=smp.t-st.win-2000;while(st.buf.length>2&&st.buf[0].t<lim)st.buf.shift();
 const cur=st.buf[st.buf.length-1];let start=cur.t;
 for(let i=st.buf.length-1;i>=0;i--){const b=st.buf[i];if(Math.abs(b.kg-cur.kg)<=st.tol+1e-9)start=b.t;else break;}
 const stable=cur.ok&&(cur.t-start)>=st.win;
 return{stable,kg:cur.kg};}

/* guardia anti-duplicado (por ticket): después de tomar un peso W, el siguiente se toma sin preguntar si
   (a) el plato pasó por cero, o (b) el peso es distinto de W y pasaron ≥ 3 s. Si no, se pide confirmación
   (dos productos iguales pueden pesar lo mismo: no se bloquea). */
function scaleDupNew(){return{lastKg:null,lastT:0,sawZero:true};}
function scaleDupSeen(g,smp){if(smp&&smp.zero)g.sawZero=true;}
function scaleDupCheck(g,kg,t){
 if(g.lastKg===null||g.sawZero)return{ok:true};
 const same=Math.abs(kg-g.lastKg)<=1e-9;
 if(!same&&t-g.lastT>=3000)return{ok:true};
 return{ok:false,same,why:same?'Mismo peso que el anterior ('+kg.toFixed(3).replace('.',',')+' kg) sin que la balanza vuelva a cero. ¿Es otro producto?'
                             :'La balanza no volvió a cero desde el peso anterior. ¿Es otro producto?'};}
function scaleDupMark(g,kg,t){g.lastKg=kg;g.lastT=t;g.sawZero=false;}

function ean13Ok(code){const s=String(code||'');if(!/^\d{13}$/.test(s))return false;let t=0;for(let i=0;i<12;i++)t+=(+s[i])*(i%2?3:1);return (10-t%10)%10===+s[12];}

/* formatos de etiqueta por prefijo. Por defecto: 2 cifras de prefijo + 5 de PLU + 5 de valor + verificador.
   20 = peso (gramos), 21 = importe; el resto de los prefijos 22–29 usa el modo global (Configuración). */
const SCALE_LABELS_DEF=[{prefix:'20',pluLen:5,mode:'peso',dec:3},{prefix:'21',pluLen:5,mode:'precio',dec:0}];
function scaleLabelParse(code,layouts,globalMode){
 const s=String(code||'').trim();if(!/^2\d{12}$/.test(s))return null;           /* no es etiqueta de balanza */
 if(!ean13Ok(s))return{err:'Etiqueta mal leída (el dígito verificador no coincide). Volvé a pasarla.'};
 const L=(Array.isArray(layouts)&&layouts.length?layouts:SCALE_LABELS_DEF).slice().sort((a,b)=>String(b.prefix).length-String(a.prefix).length);
 let f=L.find(x=>s.startsWith(String(x.prefix)));
 if(!f)f={prefix:s.slice(0,2),pluLen:5,mode:globalMode==='precio'?'precio':'peso',dec:globalMode==='precio'?0:3};
 const pl=String(f.prefix).length,n=Math.max(3,Math.min(6,+f.pluLen||5));
 const vlen=12-pl-n;if(vlen<4)return{err:'Formato de etiqueta inválido para el prefijo '+f.prefix+'.'};
 const plu=String(+s.slice(pl,pl+n));const v=+s.slice(pl+n,12);
 if(f.mode==='precio'){const dec=+f.dec===2?2:0;const priceC=dec===2?v:v*100;if(!(priceC>0))return{err:'Importe en cero en la etiqueta.'};return{plu,mode:'precio',priceC,prefix:f.prefix};}
 const dec=f.dec===undefined?3:+f.dec;const kg=Math.round(v/Math.pow(10,dec)*1000)/1000;
 if(!(kg>0&&kg<=SCALE_MAX))return{err:'Peso fuera de rango en la etiqueta.'};
 return{plu,mode:'peso',kg,prefix:f.prefix};}

/* peso con 3 decimales y precio por kg cuyo producto redondeado da EXACTO el importe de la etiqueta.
   1) con el precio del sistema, si algún peso de ±3 g lo logra; 2) si no, se ajusta el precio de la línea
   (el precio de la balanza no coincide con el del sistema) y se avisa. */
function scaleLabelQty(priceC,unitC){
 if(!(priceC>0&&unitC>0))return null;
 const q0=Math.round(priceC/unitC*1000);
 for(const d of[0,1,-1,2,-2,3,-3]){const q=(q0+d)/1000;if(q>0&&Math.round(q*unitC)===priceC)return{qty:q,price:unitC,exact:true,adj:false};}
 const q=Math.max(1,q0)/1000;let p=Math.round(priceC/q);
 for(const d of[0,1,-1,2,-2]){if(Math.round(q*(p+d))===priceC){p=p+d;break;}}
 return{qty:q,price:p,exact:Math.round(q*p)===priceC,adj:true,diffPct:Math.abs(p-unitC)/unitC*100};}

if(typeof module!=='undefined'&&module.exports)module.exports={scaleFrame,scaleStabNew,scaleStabPush,scaleDupNew,scaleDupCheck,scaleDupMark,scaleDupSeen,ean13Ok,scaleLabelParse,scaleLabelQty,SCALE_LABELS_DEF,SCALE_PROTOS};
