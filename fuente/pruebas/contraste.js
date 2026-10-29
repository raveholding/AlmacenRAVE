(()=>{
const P=s=>{if(!s)return null;const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return{r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1};};
const L=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};
const CR=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
const mix=(top,bot)=>({r:top.r*top.a+bot.r*(1-top.a),g:top.g*top.a+bot.g*(1-top.a),b:top.b*top.a+bot.b*(1-top.a),a:1});
function bgs(el){ // devuelve lista de fondos posibles (opacos)
  const layers=[];let e=el;
  while(e&&e.nodeType===1){const cs=getComputedStyle(e);
    const bi=cs.backgroundImage;
    if(bi&&bi.includes('gradient')){const cols=(bi.match(/rgba?\([^)]+\)/g)||[]).map(P).filter(Boolean);
      if(cols.length){let res=cols.map(c=>c.a<1?mix(c,{r:255,g:255,b:255,a:1}):c);return res.map(c=>layers.reduceRight((acc,l)=>mix(l,acc),c));}}
    const c=P(cs.backgroundColor);if(c&&c.a>0){layers.push(c);if(c.a>=0.99)break;}
    e=e.parentElement;}
  let base={r:255,g:255,b:255,a:1};
  try{const rb=P(getComputedStyle(document.documentElement).backgroundColor);if(rb&&rb.a>0&&!layers.length)base=rb;}catch(x){}
  return [layers.reduceRight((acc,l)=>mix(l,acc),base)];}
const out=[];const seen=new Set();
const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
let n;while(n=walker.nextNode()){const t=n.nodeValue.trim();if(t.length<2||!/[A-Za-z0-9ÁÉÍÓÚáéíóúñÑ$]/.test(t))continue;const el=n.parentElement;if(!el)continue;
  if(el.closest('svg,script,style,noscript,[aria-hidden=true]'))continue;
  const r=el.getBoundingClientRect();if(r.width<2||r.height<2)continue;
  const cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity===0)continue;
  let h=el,vis=true;while(h){const s=getComputedStyle(h);if(s.display==='none'||+s.opacity<0.15){vis=false;break;}h=h.parentElement;}if(!vis)continue;
  if(el.closest('button:disabled,input:disabled,[disabled]'))continue;
  const fg=P(cs.color);if(!fg)continue;const fs=parseFloat(cs.fontSize),fw=+cs.fontWeight||400;
  const large=fs>=24||(fs>=18.66&&fw>=700);const need=large?3:4.5;
  let worst=99,wbg=null;for(const bg of bgs(el)){const f=fg.a<1?mix(fg,bg):fg;const c=CR(f,bg);if(c<worst){worst=c;wbg=bg;}}
  if(worst<need){const key=el.tagName+'|'+(el.className||'')+'|'+t.slice(0,30);if(seen.has(key))continue;seen.add(key);
    const path=[];let q=el;for(let i=0;i<3&&q&&q!==document.body;i++){path.unshift(q.tagName.toLowerCase()+(q.id?'#'+q.id:'')+(q.className&&typeof q.className==='string'?'.'+q.className.trim().split(/\s+/).slice(0,2).join('.'):''));q=q.parentElement;}
    out.push({r:Math.round(worst*100)/100,need,t:t.slice(0,50),fg:cs.color,bg:wbg?`rgb(${wbg.r|0},${wbg.g|0},${wbg.b|0})`:'',p:path.join(' > ')});}}
return out;})()
