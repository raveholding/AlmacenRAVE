/* ===== V26.49 · 4.34 H3 · Fiado y Cuenta corriente: dos tipos de deuda sobre el MISMO libro del cliente =====
   · Mismo medio de pago (`fiado`), mismo límite, mismos bloqueos. Cada venta con parte a crédito guarda
     `ck`: 'fiado' (vence a los cfg.credit.fiadoDays días, 7 por defecto) o 'cc' (vence según el plazo del cliente;
     sin plazo = sin vencimiento fijo, como hasta ahora). Las ventas viejas sin `ck` son cuenta corriente.
   · Al cobrar, si hay parte a crédito, el cajero TIENE que elegir «Mandar a Fiado» o «Mandar a Cuenta Corriente»
     (nada viene preseleccionado).
   · Los saldos por tipo se DERIVAN (nunca se guardan): ccAlloc aplica cada cobro a la venta más vieja (como siempre);
     si el cobro se marcó para un tipo, primero cancela ese tipo. Sin cobros marcados el resultado es idéntico al de antes. */
function creditConf(){const c=(S.cfg&&S.cfg.credit)||{};return{split:c.split!==false,fiadoDays:c.fiadoDays>0?Math.round(c.fiadoDays):7};}
const creditSplit=()=>creditConf().split;
const saleCk=s=>s&&s.ck==='fiado'?'fiado':'cc';
const CK_TXT={fiado:'Fiado',cc:'Cuenta corriente'};
function ccAlloc(cid){
 const docs=S.sales.filter(s=>s.cust===cid&&s.status==='ok'&&saleFiadoAmt(s)>0).sort((a,b)=>a.ts-b.ts).map(s=>({s,left:saleFiadoAmt(s),tot:saleFiadoAmt(s),ck:saleCk(s)}));
 const pays=S.fiadoPays.filter(p=>p.cust===cid).sort((a,b)=>a.ts-b.ts);const by={};
 for(const p of pays){let need=p.amount;const parts=[];
  const take=pred=>{for(const d of docs){if(need<=0)break;if(d.left<=0||!pred(d))continue;const t=Math.min(need,d.left);d.left-=t;need-=t;parts.push([d,t]);}};
  if(p.ck==='fiado'||p.ck==='cc')take(d=>d.ck===p.ck);take(()=>true);by[p.id]=parts;}
 return{docs,by};}
function ccByKind(cid){const o={fiado:0,cc:0};ccAlloc(cid).docs.forEach(d=>{o[d.ck]+=d.left;});return o;}
function ccDueFor(ck,ts,cust){if(ck==='fiado')return ts+creditConf().fiadoDays*86400000;return cust&&cust.term>0?ts+cust.term*86400000:0;}
function ccKindsHTML(cid){if(!creditSplit())return'';const k=ccByKind(cid);if(!(k.fiado||k.cc))return'';
 return `<span class="sm"> · Fiado <b>${money(k.fiado)}</b> · Cta. cte. <b>${money(k.cc)}</b></span>`;}

/* ---- cobro: selector obligatorio y excluyente ---- */
function ckNeeded(){if(!creditSplit())return false;return pos.mix?pos.pays.some(p=>p.m==='fiado'&&cents(p.a)>0):pos.method==='fiado';}
function ckPickHTML(){if(!ckNeeded())return'';const cust=custById(pos.cust);const d=dmy(dkey(ccDueFor('fiado',now(),null)));const cd=ccDueFor('cc',now(),cust);
 const b=(k,t,sub)=>`<button type="button" class="ckbtn ${pos.ck===k?'selected':''}" data-act="cbck" data-k="${k}" aria-pressed="${pos.ck===k?'true':'false'}"><b>${pos.ck===k?'✔ ':''}${t}</b><small>${sub}</small></button>`;
 return `<div class="card" id="ckpick" style="margin:.5rem 0"><h3 style="margin:0 0 .4rem">¿Cómo queda la deuda? <span class="tag warn">obligatorio</span></h3><div class="ckrow">
  ${b('fiado','Mandar a Fiado','Vence el '+d+' ('+creditConf().fiadoDays+' días)')}${b('cc','Mandar a Cuenta Corriente',cd?'Vence el '+dmy(dkey(cd))+' (plazo del cliente: '+cust.term+' días)':'Según el plazo del cliente'+(cust?' (sin plazo cargado)':''))}</div>
  ${pos.ck?'':'<p class="sm" style="margin:.4rem 0 0;color:var(--bad,#b42318)">Elegí una de las dos opciones para poder cobrar.</p>'}</div>`;}
A.cbck=el=>{pos.ck=el.dataset.k==='fiado'?'fiado':'cc';cobroRender();};

/* ---- Configuración ---- */
function creditCfgCard(){if(!can('config'))return'';const c=creditConf();
 return `<div class="card" id="ck-cfg" style="margin-top:1rem"><h3 style="margin-top:0">Fiado y cuenta corriente</h3>
 <label class="chk"><input type="checkbox" id="ck-on" ${c.split?'checked':''}> Separar «Fiado» (corto plazo) de «Cuenta corriente» (plazo del cliente)</label>
 <label for="ck-d">El fiado vence a los (días)</label><input id="ck-d" inputmode="numeric" maxlength="3" style="width:6em" value="${c.fiadoDays}">
 <p class="sm mut">Las dos deudas usan el mismo límite de crédito del cliente. Al cobrar con parte a crédito el cajero elige una de las dos; nada viene marcado. Las ventas anteriores quedan como cuenta corriente.</p>
 <button class="btn gold" data-act="ckSave">Guardar</button></div>`;}
A.ckSave=()=>{if(!can('config'))return toast('Sin permiso',1);const d=Math.round(parseNum(val('ck-d')));if(!(d>=1&&d<=365))return toast('Los días del fiado van de 1 a 365.',1);
 const prev=JSON.stringify(creditConf());S.cfg.credit={split:$('#ck-on').checked,fiadoDays:d};audit('CONFIG_CREDITO',prev+' → '+JSON.stringify(S.cfg.credit));save();toast('Guardado');rerender();};
