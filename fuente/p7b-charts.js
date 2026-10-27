/* ===== V26.29 · Gráficos del Resumen: tarjetas KPI, barras (horizontales o verticales), líneas (tendencia) y tacómetro (gauge) =====
   SVG propio (sin librerías: la CSP no las permite), colores por variables CSS (sirven en claro y oscuro),
   cada gráfico con su tabla equivalente («Ver como tabla») para accesibilidad. */
const chE=v=>esc(String(v));
function chTable(head,rows){return `<details class="sm" style="margin-top:.4rem"><summary>Ver como tabla</summary><div class="tw"><table><thead><tr>${head.map(h=>`<th>${chE(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i?'r':''}">${chE(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;}
function chShort(c){const v=c/100;if(Math.abs(v)>=1e6)return '$'+numAR(v/1e6,1)+' M';if(Math.abs(v)>=1e3)return '$'+numAR(v/1e3,0)+' mil';return '$'+numAR(v,0);}
/* líneas: pts=[[etiqueta,valor]], series opcional 2 */
function chLine(pts,opt={}){if(!pts.length)return '<p class="mut">Sin datos suficientes.</p>';
 const W=640,H=230,L=58,R=12,T=14,B=38,iw=W-L-R,ih=H-T-B;const ser=[{v:pts.map(p=>p[1]),c:'var(--gold)',n:opt.n1||'Ventas'}].concat(opt.s2?[{v:opt.s2,c:'var(--ok)',n:opt.n2||''}]:[]);
 const mx=Math.max(1,...ser.flatMap(s=>s.v));const nice=(()=>{const p=Math.pow(10,Math.floor(Math.log10(mx)));return Math.ceil(mx/p)*p;})();
 const X=i=>L+(pts.length===1?iw/2:i*iw/(pts.length-1)),Y=v=>T+ih-(v/nice)*ih;
 const grid=[0,.25,.5,.75,1].map(f=>`<line x1="${L}" x2="${W-R}" y1="${Y(nice*f)}" y2="${Y(nice*f)}" stroke="var(--line)"/><text x="${L-6}" y="${Y(nice*f)+4}" text-anchor="end" font-size="11" fill="var(--mut)">${chE(chShort(nice*f))}</text>`).join('');
 const step=Math.max(1,Math.ceil(pts.length/8));const xl=pts.map((p,i)=>i%step&&i!==pts.length-1?'':`<text x="${X(i)}" y="${H-B+16}" text-anchor="middle" font-size="11" fill="var(--mut)">${chE(p[0])}</text>`).join('');
 const lines=ser.map(s=>`<polyline fill="none" stroke="${s.c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${s.v.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}"/>`+s.v.map((v,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" fill="${s.c}"><title>${chE(pts[i][0])}: ${chE(money(v))}</title></circle>`).join('')).join('');
 const area=`<polygon fill="var(--gold)" opacity=".12" points="${L},${Y(0)} ${ser[0].v.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')} ${X(pts.length-1)},${Y(0)}"/>`;
 const leg=ser.length>1?`<div class="row sm" style="gap:1rem">${ser.map(s=>`<span><i style="display:inline-block;width:14px;height:3px;background:${s.c};vertical-align:middle"></i> ${chE(s.n)}</span>`).join('')}</div>`:'';
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${chE(opt.label||'Gráfico de líneas')}" style="width:100%;height:auto;display:block">${grid}${area}${lines}${xl}</svg>${leg}${chTable([opt.xh||'Período'].concat(ser.map(s=>s.n)),pts.map((p,i)=>[p[0]].concat(ser.map(s=>money(s.v[i])))))}`;}
/* barras verticales: items=[[etiqueta,valor,extra]] */
function chBarsV(items,opt={}){if(!items.length)return '<p class="mut">Sin datos suficientes.</p>';
 const W=640,H=250,L=58,R=10,T=14,B=58,iw=W-L-R,ih=H-T-B;const mx=Math.max(1,...items.map(i=>i[1]));const p=Math.pow(10,Math.floor(Math.log10(mx)));const nice=Math.ceil(mx/p)*p;
 const bw=Math.min(56,iw/items.length*0.7),gap=iw/items.length;const Y=v=>T+ih-(v/nice)*ih;
 const grid=[0,.5,1].map(f=>`<line x1="${L}" x2="${W-R}" y1="${Y(nice*f)}" y2="${Y(nice*f)}" stroke="var(--line)"/><text x="${L-6}" y="${Y(nice*f)+4}" text-anchor="end" font-size="11" fill="var(--mut)">${chE(chShort(nice*f))}</text>`).join('');
 const bars=items.map(([l,v,x,col],i)=>{const cx=L+gap*i+gap/2;const lab=String(l).length>12?String(l).slice(0,11)+'…':l;return `<rect x="${(cx-bw/2).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(T+ih-Y(v)).toFixed(1)}" rx="5" fill="${col||opt.color||'var(--gold)'}"><title>${chE(l)}: ${chE(money(v))}${x?' · '+chE(x):''}</title></rect><text x="${cx}" y="${(Y(v)-5).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="var(--ink)">${chE(x||chShort(v))}</text><text x="${cx}" y="${H-B+16}" text-anchor="middle" font-size="11" fill="var(--mut)">${chE(lab)}</text>`;}).join('');
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${chE(opt.label||'Gráfico de barras')}" style="width:100%;height:auto;display:block">${grid}${bars}</svg>${chTable(['Nombre','Ventas','%'],items.map(i=>[i[0],money(i[1]),i[2]||'']))}`;}
/* barras horizontales (con su tabla: reutiliza dbBars) */
function chBarsH(items,opt={}){if(!items.length)return '<p class="mut">Sin datos suficientes.</p>';const mx=Math.max(1,...items.map(i=>i[1]));
 return `<div role="img" aria-label="${chE(opt.label||'Gráfico de barras horizontales')}">${items.map(([l,v,x,col])=>`<div style="display:grid;grid-template-columns:minmax(80px,30%) 1fr auto;gap:.5rem;align-items:center;margin:.35rem 0"><span class="sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${chE(l)}">${chE(l)}</span><div class="bar" style="height:16px"><i style="display:block;height:100%;width:${Math.max(1,Math.round(v/mx*100))}%;background:${col||opt.color||'var(--gold)'};border-radius:99px"></i></div><span class="sm" style="white-space:nowrap"><b>${chE(money(v))}</b>${x?' <span class="mut">'+chE(x)+'</span>':''}</span></div>`).join('')}</div>${chTable(['Nombre','Ventas','%'],items.map(i=>[i[0],money(i[1]),i[2]||'']))}`;}
/* tacómetro: valor contra meta (aguja de 0 a 1,5 × meta) */
function chGauge(val,goal,opt={}){const W=300,H=190,cx=150,cy=158,r=118;const max=Math.max(1,Math.round(goal*1.5));const f=Math.max(0,Math.min(1,val/max));
 const pt=(fr,rr)=>{const a=Math.PI*(1-fr);return [cx+rr*Math.cos(a),cy-rr*Math.sin(a)];};
 const arc=(a,b,c)=>{const [x1,y1]=pt(a,r),[x2,y2]=pt(b,r);return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}" stroke="${c}" stroke-width="22" fill="none"/>`;};
 const g=goal/max;const [nx,ny]=pt(f,r-30);const [mx1,my1]=pt(g,r-14),[mx2,my2]=pt(g,r+14);const pc=goal?Math.round(val/goal*100):0;
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${chE((opt.label||'Tacómetro')+': '+money(val)+' de '+money(goal)+' ('+pc+' %)')}" style="width:100%;max-width:340px;height:auto;display:block;margin:0 auto">
  ${arc(0,g*0.5,'#c0392b')}${arc(g*0.5,g,'#e0a43a')}${arc(g,1,'#2e9e5b')}
  <line x1="${mx1.toFixed(1)}" y1="${my1.toFixed(1)}" x2="${mx2.toFixed(1)}" y2="${my2.toFixed(1)}" stroke="var(--ink)" stroke-width="3"/>
  <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="9" fill="var(--ink)"/>
  <text x="${cx}" y="${cy-48}" text-anchor="middle" font-size="26" font-weight="700" fill="var(--ink)">${pc} %</text>
  <text x="18" y="${H-6}" font-size="11" fill="var(--mut)">$ 0</text><text x="${W-18}" y="${H-6}" text-anchor="end" font-size="11" fill="var(--mut)">${chE(chShort(max))}</text></svg>
  <p class="sm" style="text-align:center;margin:.2rem 0"><b>${chE(money(val))}</b> de ${chE(money(goal))}${opt.sub?' · '+opt.sub:''}</p>${chTable(['Dato','Valor'],[['Valor',money(val)],['Meta',money(goal)],['Cumplimiento',pc+' %']])}`;}
