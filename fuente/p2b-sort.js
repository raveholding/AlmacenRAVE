/* ===== V26 · 4.15 Ordenamiento reutilizable (SortableTable) =====
   Un solo componente para TODAS las tablas de datos: se aplica solo a cada <table> con <thead>
   (también a las que se crean después, en pantallas y ventanas). Excepciones: table[data-nosort],
   columnas sin título (acciones) o con th[data-nosort]. Los datos viven completos en el equipo,
   por eso el orden es local; no hay consulta al servidor con nombres de columna (nada que inyectar). */
const SORTST=new Map();
const SORT_COLL=new Intl.Collator('es',{sensitivity:'base',numeric:true});
function sortParse(txt,sv){
 if(sv!==undefined&&sv!==null&&sv!==''){const n=Number(sv);return isNaN(n)?{k:'s',v:String(sv)}:{k:'n',v:n};}
 let t=String(txt||'').replace(/\s+/g,' ').trim();if(t===''||t==='—'||t==='-'||t==='–')return null;
 const d=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
 if(d){let y=+d[3];if(y<100)y+=2000;const ms=Date.UTC(y,+d[2]-1,+d[1],+(d[4]||0),+(d[5]||0),+(d[6]||0));if(!isNaN(ms))return{k:'n',v:ms};}
 const m=t.replace(/[−–]/g,'-').match(/^(-?)\s*\$?\s*(-?)\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(?:%|und|kg|lt|hs|h|u)?(?:\s*\/\s*(?:und|kg|lt|u|l))?$/);
 if(m){const neg=(m[1]||m[2])?-1:1;const ent=m[3].replace(/\./g,'');return{k:'n',v:neg*Number(ent+(m[4]?'.'+m[4]:''))};}
 return{k:'s',v:t};}
function sortKeyOf(tb){const host=tb.closest('#view')||tb.closest('.dlg')||document.body;
 const scope=tb.closest('#view')?'v:'+curScreen:(tb.closest('.dlg')?'m:'+(tb.closest('.dlg').getAttribute('aria-label')||''):'x');
 return scope+'#'+Array.prototype.indexOf.call(host.querySelectorAll('table'),tb);}
function sortApply(tb){
 const st=SORTST.get(tb.dataset.skey),tbody=tb.tBodies[0];if(!tbody)return;
 const rows=Array.from(tbody.rows);rows.forEach((r,i)=>{if(r.dataset.oi===undefined)r.dataset.oi=String(i);});
 const hs=Array.from(tb.querySelectorAll('thead th'));
 hs.forEach(h=>{if(h.dataset.sc===undefined)return;h.setAttribute('aria-sort',st&&st.col===h.dataset.sc?(st.dir==='asc'?'ascending':'descending'):'none');
  const mk=h.querySelector('.thmark');if(mk)mk.textContent=st&&st.col===h.dataset.sc?(st.dir==='asc'?'▲':'▼'):'↕';});
 /* los renglones de encabezado de grupo (una sola celda ancha) no se mueven: ordenan dentro de su grupo */
 const isSep=r=>r.cells.length<=1||r.classList.contains('rgroup')||r.hasAttribute('data-fixed');
 const segs=[];let cur=[];rows.forEach(r=>{if(isSep(r)){segs.push({sep:r});cur=[];}else{if(!cur.length)segs.push({rows:cur});cur.push(r);}});
 const ci=st?Number(st.col):-1;
 segs.forEach(sg=>{if(!sg.rows)return;
  const keyed=sg.rows.map(r=>{const c=r.cells[ci];return{r,p:st&&c?sortParse(c.textContent,c.dataset.sv):null,oi:+r.dataset.oi};});
  if(!st){keyed.sort((a,b)=>a.oi-b.oi);}
  else{const allNum=keyed.every(x=>x.p===null||x.p.k==='n');const dir=st.dir==='asc'?1:-1;
   keyed.sort((a,b)=>{if(a.p===null&&b.p===null)return a.oi-b.oi;if(a.p===null)return 1;if(b.p===null)return-1; /* vacíos siempre al final */
    let c=allNum?(a.p.v-b.p.v):SORT_COLL.compare(String(a.p.v),String(b.p.v));
    if(c===0)return a.oi-b.oi;return c*dir;});}
  sg.rows.splice(0,sg.rows.length,...keyed.map(x=>x.r));});
 const frag=document.createDocumentFragment();segs.forEach(sg=>{if(sg.sep)frag.appendChild(sg.sep);else sg.rows.forEach(r=>frag.appendChild(r));});
 tbody.appendChild(frag);
 const cap=tb.querySelector('caption.sortlive');if(cap)cap.textContent=st?'Ordenada por '+(hs.find(h=>h.dataset.sc===st.col)||{textContent:''}).dataset.st+' ('+(st.dir==='asc'?'ascendente':'descendente')+')':'';}
function sortEnhance(tb){
 if(tb.dataset.sx||tb.hasAttribute('data-nosort')||!tb.tHead||!tb.tHead.rows.length||tb.closest('#pub'))return;
 const hr=tb.tHead.rows[tb.tHead.rows.length-1];let any=false,col=0;
 Array.from(hr.cells).forEach(h=>{const idx=col;col+=h.colSpan||1;
  const label=h.textContent.replace(/\s+/g,' ').trim();if(!label||h.hasAttribute('data-nosort')||(h.colSpan||1)>1)return;
  h.dataset.sc=String(idx);h.dataset.st=label;h.setAttribute('aria-sort','none');
  const b=document.createElement('button');b.type='button';b.className='thsort';b.setAttribute('aria-label','Ordenar por '+label);
  b.innerHTML='<span class="thl">'+esc(label)+'</span><span class="thmark" aria-hidden="true">↕</span>';
  h.textContent='';h.appendChild(b);any=true;});
 tb.dataset.sx='1';if(!any)return;tb.dataset.skey=sortKeyOf(tb);
 const live=document.createElement('caption');live.className='sortlive sr';live.setAttribute('aria-live','polite');tb.insertBefore(live,tb.firstChild);
 tb.addEventListener('click',e=>{const b=e.target.closest('.thsort');if(!b||!tb.contains(b))return;e.preventDefault();e.stopPropagation();
  const h=b.closest('th'),key=tb.dataset.skey,st=SORTST.get(key);
  if(!st||st.col!==h.dataset.sc)SORTST.set(key,{col:h.dataset.sc,dir:'asc'});else if(st.dir==='asc')SORTST.set(key,{col:h.dataset.sc,dir:'desc'});else SORTST.delete(key);
  sortApply(tb);},true);
 if(SORTST.has(tb.dataset.skey))sortApply(tb);else Array.from(tb.tBodies[0]?tb.tBodies[0].rows:[]).forEach((r,i)=>{r.dataset.oi=String(i);});}
function sortEnhanceAll(){document.querySelectorAll('table:not([data-sx])').forEach(sortEnhance);}
let _sortQ=0;
new MutationObserver(()=>{if(_sortQ)return;_sortQ=requestAnimationFrame(()=>{_sortQ=0;try{sortEnhanceAll();}catch(e){console.warn('sort',e);}});}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',sortEnhanceAll);
