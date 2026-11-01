# V26.38 · Centro Inteligente: hablarle al Gerente IA por micrófono y que responda en voz alta (micrófono y voz simulados)
from playwright.sync_api import sync_playwright
import sys
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
MOCK="""(()=>{window.__heard='¿qué tengo que reponer?';window.__spoken=[];window.__recStarts=0;
 class FakeRec{constructor(){this.lang='';}start(){window.__recStarts++;window.__lastLang=this.lang;setTimeout(()=>{if(window.__recErr){this.onerror&&this.onerror({error:window.__recErr});this.onend&&this.onend();return;}this.onresult&&this.onresult({results:[[{transcript:window.__heard}]]});this.onend&&this.onend();},150);}stop(){this.onend&&this.onend();}abort(){}}
 window.SpeechRecognition=FakeRec;window.webkitSpeechRecognition=FakeRec;
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:u=>{window.__spoken.push({t:u.text,lang:u.lang});u.onstart&&u.onstart();setTimeout(()=>u.onend&&u.onend(),100);},cancel:()=>{},getVoices:()=>[{lang:'es-AR',name:'x'}]}});
 window.SpeechSynthesisUtterance=function(t){this.text=t;};})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    ctx=b.new_context(viewport={'width':1280,'height':900});ctx.add_init_script(MOCK)
    pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("S.cfg.ci={on:true,roles:['mostrador']};showPanel('centro')");pg.wait_for_timeout(300)
    pg.click('[data-act=ciTab][data-id=gerente]');pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=ciMic]').count()==0,'voz apagada por defecto: no hay micrófono')
    chk(pg.locator('.ci-vset').count()==2,'el administrador ve «Voz del Gerente IA» con micrófono y lectura en voz alta')
    pg.click('.ci-root details summary');pg.wait_for_timeout(150)
    pg.check('.ci-vset[data-k=voice]');pg.wait_for_timeout(300);pg.click('.ci-root details summary');pg.wait_for_timeout(150);pg.check('.ci-vset[data-k=tts]');pg.wait_for_timeout(300)
    chk(ev("S.cfg.ci.voice===true&&S.cfg.ci.tts===true"),'se encienden el micrófono y la lectura')
    chk(ev("S.audit.filter(a=>a.action==='CENTRO_INTELIGENTE'&&a.detail.startsWith('voz')).length")>=2,'los cambios de voz quedan auditados')
    chk(ev("!S.cfg.assistant||S.cfg.assistant.voice!==true"),'no cambia la voz del Asistente general (configuración propia del módulo)')
    chk(pg.locator('[data-act=ciMic]').count()==1,'aparece el botón «🎙 Hablar»')
    pg.click('[data-act=ciMic]');pg.wait_for_timeout(60)
    chk('Escuchando' in pg.inner_text('#view'),'mientras escucha lo muestra en pantalla')
    pg.wait_for_timeout(500)
    chk(ev("__lastLang")=='es-AR','escucha en castellano de Argentina')
    t=pg.inner_text('.ci-chat')
    chk('🎙 ¿qué tengo que reponer?' in t and ('reponer' in t.split('🎙')[-1] or 'No hay artículos' in t),'la pregunta hablada se responde (%s…)'%t[-80:].replace('\n',' '))
    sp=ev("__spoken")
    chk(len(sp)>=1 and sp[-1]['lang']=='es-AR' and len(sp[-1]['t'])>10 and '<' not in sp[-1]['t'],'la respuesta se lee en voz alta, sin código HTML (%s…)'%(sp[-1]['t'][:60] if sp else ''))
    pg.click('[data-act=ciChip][data-id=hoy]');pg.wait_for_timeout(300)
    chk('pesos' in ev("__spoken")[-1]['t'],'los importes se leen como pesos')
    pg.click('[data-act=ciMute]');pg.wait_for_timeout(200);n=len(ev("__spoken"))
    pg.click('[data-act=ciChip][data-id=top]');pg.wait_for_timeout(300)
    chk(len(ev("__spoken"))==n,'🔇 silencia las respuestas en este equipo')
    pg.click('[data-act=ciMute]');pg.wait_for_timeout(150)
    ev("__recErr='not-allowed'");pg.click('[data-act=ciMic]');pg.wait_for_timeout(500)
    chk('permiso al micrófono' in pg.inner_text('body') and not ev("CI.st.listen"),'sin permiso del micrófono avisa y vuelve a la normalidad')
    ev("__recErr=null")
    chk(ev("CI.log.some(x=>x.kind==='voz')"),'la actividad de voz queda en el Registro (sin audio)')
    # rol mostrador habilitado: puede hablar pero no cambiar la voz
    ev("(()=>{window.__u=user.role;user.role='mostrador';showPanel('centro');})()");pg.wait_for_timeout(300)
    pg.click('[data-act=ciTab][data-id=gerente]');pg.wait_for_timeout(200)
    chk(pg.locator('.ci-vset').count()==0 and pg.locator('[data-act=ciMic]').count()==1,'otro rol habilitado puede hablar pero no ve la configuración de voz')
    ev("user.role=window.__u")
    # sin reconocimiento de voz en el navegador
    ev("delete window.SpeechRecognition;delete window.webkitSpeechRecognition;showPanel('centro')");pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=ciMic]').count()==0 and pg.locator('#ci-q').count()==1,'navegador sin micrófono: queda el texto, sin errores')
    # salir de la pantalla corta la voz; apagar el módulo también
    ev("showPanel('vender')");pg.wait_for_timeout(200)
    chk(ev("!CI.st.listen"),'al salir de la pantalla no queda escuchando')
    pg.set_viewport_size({'width':360,'height':800});ev("showPanel('centro')");pg.wait_for_timeout(300)
    chk(ev("document.documentElement.scrollWidth<=362"),'360 px sin desborde con los botones de voz')
    chk(not errs,'sin errores de JavaScript %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
