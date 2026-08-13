import Foundation

/// Scripts JS de automatización de los portales IMSS, transcritos verbatim de
/// los controladores Android (`TuPerfilFlowController.kt`,
/// `TarjetonDigitalFlowController.kt`, `ImssPdfCaptureCoordinator.kt`).
/// Los selectores dependen del DOM real de los portales: no "mejorar" sin
/// probar contra el portal real.
enum PortalScripts {

    /// Codifica un String Swift como literal JS (con comillas) — equivalente a
    /// `org.json.JSONObject.quote`.
    static func jsQuote(_ s: String) -> String {
        let data = try! JSONSerialization.data(withJSONObject: s)
        return String(data: data, encoding: .utf8)!
    }

    // MARK: - Tu Perfil

    static func tuPerfilFill(u: String, p: String) -> String {
        #"""
(function(){
var m=document.querySelector('#matricula');var pw=document.querySelector('#password');
if(!m||!pw)return JSON.stringify({ok:false,reason:'INPUTS_MISSING'});
function setVal(e,v){
  var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  if(!d||!d.set)return false;
  e.focus();
  d.set.call(e,v);
  e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:v}));
  e.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:'Unidentified'}));
  e.dispatchEvent(new Event('change',{bubbles:true}));
  e.dispatchEvent(new Event('blur',{bubbles:true}));
  e.blur();
  return true;
}
var r1=setVal(m,\#(jsQuote(u)));var r2=setVal(pw,\#(jsQuote(p)));
return JSON.stringify({ok:r1&&r2,matriculaHasValue:m.value.length>0,passwordHasValue:pw.value.length>0})})()
"""#
    }

    static func tuPerfilVerify(u: String, p: String) -> String {
        #"""
(function(){
var m=document.querySelector('#matricula');var pw=document.querySelector('#password');
if(!m||!pw)return JSON.stringify({matriculaOk:false,passwordOk:false,canSubmit:false});
var mOk=m.value===\#(jsQuote(u));var pOk=pw.value===\#(jsQuote(p));
var mHas=String(m.value||'').trim().length>0;var pHas=String(pw.value||'').length>0;
return JSON.stringify({matriculaOk:mOk,passwordOk:pOk,canSubmit:mHas&&pHas})})()
"""#
    }

    static let tuPerfilClick = #"""
(function(){
function n(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}
var m=document.querySelector('#matricula');var pw=document.querySelector('#password');
if(m&&(!m.value||!String(m.value).trim()))return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_MATRICULA_EMPTY'});
if(pw&&!String(pw.value||''))return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_PASSWORD_EMPTY'});
var b=Array.from(document.querySelectorAll('button.primary')).find(function(x){return n(x.textContent)==='iniciar sesion'});
if(!b)b=Array.from(document.querySelectorAll('button')).find(function(x){return n(x.textContent)==='iniciar sesion'});
if(!b)return JSON.stringify({ok:false,reason:'BUTTON_MISSING'});
if(b.disabled)return JSON.stringify({ok:false,reason:'BUTTON_DISABLED'});
b.click();return JSON.stringify({ok:true})})()
"""#

    static let tuPerfilSnapshot = #"""
(function(){var m=document.querySelector('#matricula');var p=document.querySelector('#password');return JSON.stringify({matriculaFound:!!m,passwordFound:!!p})})()
"""#

    static let tuPerfilLoginError = #"""
(function(){
var sels=['mat-error','.mat-mdc-form-field-error','.alert-danger','.alert','[role="alert"]','.error-message','.invalid-feedback','.mat-mdc-snack-bar-container','.snackbar','.toast-error','.auth-error'];
function isVisible(el){
  if(!el)return false;
  if(el.offsetParent===null&&el.getClientRects().length===0)return false;
  var r=el.getBoundingClientRect();return r.width>0&&r.height>0;
}
function txt(el){return (el.innerText||'').replace(/\s+/g,' ').trim()}
for(var i=0;i<sels.length;i++){
  var els=document.querySelectorAll(sels[i]);
  for(var j=0;j<els.length;j++){
    var el=els[j];
    if(!isVisible(el))continue;
    var t=txt(el);
    if(t&&t.length>2&&t.length<300)return JSON.stringify(t);
  }
}
return JSON.stringify('');
})()
"""#

    static let tuPerfilCardDom = #"""
(function(){var s=Array.from(document.querySelectorAll('mat-select[role="combobox"]'));var o=s.find(function(x){return String(x.textContent||'').toLowerCase().includes('ooad')})||s[0];return JSON.stringify({ready:!!o&&o.getAttribute('aria-disabled')!=='true'&&!o.classList.contains('mat-select-disabled')&&!!o.querySelector('.mat-select-trigger')})})()
"""#

    static let tuPerfilCardSnapshot = #"""
(function(){return JSON.stringify({s:window.__LVD_CARD_STATE__||{},r:window.__LVD_CARD_RESULT__||null,e:window.__LVD_CARD_ERROR__||null})})()
"""#

    /// Selecciona el periodo y pulsa "Buscar" (port de `selectPeriodAndSearch`).
    static func tuPerfilSearch(code: String) -> String {
        #"""
(function(){
    try {
        var psel = document.querySelectorAll('mat-select[role="combobox"]')[1];
        if (!psel) return 'NO_SELECT';
        if (psel.getAttribute('aria-expanded') !== 'true') {
            var pt = psel.querySelector('.mat-select-trigger');
            if (pt) pt.click(); else psel.click();
        }
        setTimeout(function(){
            var opts = document.querySelectorAll('mat-option[role="option"]');
            var found = null;
            opts.forEach(function(o){
                if ((o.innerText||'').trim().startsWith('\#(code)')) found = o;
            });
            if (found) {
                found.click();
                setTimeout(function(){
                    var btns = document.querySelectorAll('button.primary');
                    var search = null;
                    btns.forEach(function(b){ if ((b.innerText||'').trim().toLowerCase() === 'buscar') search = b; });
                    if (!search) {
                        btns = document.querySelectorAll('button');
                        btns.forEach(function(b){ if ((b.innerText||'').trim().toLowerCase() === 'buscar') search = b; });
                    }
                    if (search) { search.click(); return 'OK'; }
                    return 'NO_BUTTON';
                }, 400);
            } else { return 'NO_OPTION'; }
        }, 600);
    } catch(e) { return 'ERROR'; }
})();
"""#
    }

    static let tuPerfilCardAutomation = #"""
(function(){
if(window.__LVD_CARD_RUNNING__)return;
window.__LVD_CARD_RUNNING__=true;window.__LVD_CARD_STATE__={stage:'STARTING'};window.__LVD_CARD_RESULT__=null;window.__LVD_CARD_ERROR__=null;
function n(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}
function setState(k,x){var o={stage:k};if(x){for(var p in x){o[p]=x[p]}}window.__LVD_CARD_STATE__=o}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function waitFor(fn,timeout,interval){return new Promise(function(resolve,reject){var t0=Date.now();(function poll(){var v;try{v=fn()}catch(e){v=null}if(v){resolve(v);return}if(Date.now()-t0>timeout){reject(new Error('TIMEOUT'));return}setTimeout(poll,interval)})()})}
function findOoadSelect(){var ss=Array.from(document.querySelectorAll('mat-select[role="combobox"]'));var byText=ss.find(function(x){return n(x.innerText||x.textContent).indexOf('ooad')>=0});return byText||ss[0]||null}
function findPeriodSelect(){var ss=Array.from(document.querySelectorAll('mat-select[role="combobox"]'));var byText=ss.find(function(x){return n(x.innerText||x.textContent).indexOf('periodo')>=0});return byText||ss[1]||null}
function getMatchingOptions(matcher){return Array.from(document.querySelectorAll('mat-option[role="option"]')).filter(function(opt){return matcher(n(opt.innerText||opt.textContent))})}
async function openMatSelect(select,optionMatcher,name){
  var existing=getMatchingOptions(optionMatcher);
  if(existing.length>0)return existing;
  select.scrollIntoView({behavior:'auto',block:'center',inline:'center'});
  await sleep(100);
  var trigger=select.querySelector('.mat-select-trigger')||select;
  trigger.click();
  try{
    return await waitFor(function(){var o=getMatchingOptions(optionMatcher);return o.length>0?o:null},1500,50);
  }catch(_){}
  existing=getMatchingOptions(optionMatcher);
  if(existing.length>0)return existing;
  trigger.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));
  trigger.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window}));
  trigger.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
  return await waitFor(function(){var o=getMatchingOptions(optionMatcher);return o.length>0?o:null},3000,50);
}

(async function(){
try{
  setState('OPENING_OOAD');
  var ooadSelect=await waitFor(function(){return findOoadSelect()},10000,100);
  if(!ooadSelect)throw new Error('OOAD_SELECT_NOT_FOUND');

  setState('WAITING_OOAD_OPTIONS');
  var ooadElements=await openMatSelect(ooadSelect,function(t){return /^\d{2}\s*-\s*.+/.test(t)},'OOAD');

  var parsedOoads=ooadElements.map(function(el){
    var raw=String(el.innerText||el.textContent).replace(/\s+/g,' ').trim();
    var m=raw.match(/^(\d{2})\s*-\s*(.+)$/);
    return m?{element:el,code:m[1],label:raw}:null;
  }).filter(Boolean);

  setState('OOAD_OPTIONS_READY',{count:parsedOoads.length});

  var michoacan=parsedOoads.find(function(x){return x.code==='17'});
  if(!michoacan)throw new Error('OOAD_17_NOT_FOUND count='+parsedOoads.length+' codes='+parsedOoads.map(function(x){return x.code}).join(','));

  var ooadForNative=parsedOoads.map(function(x){return{code:x.code,label:x.label}});

  setState('SELECTING_OOAD',{code:'17'});
  michoacan.element.click();

  setState('WAITING_OOAD_SELECTED');
  await waitFor(function(){
    var s=findOoadSelect();if(!s)return false;
    return /^17\s*-\s*/.test(n(s.innerText||s.textContent));
  },5000,50);

  setState('OOAD_SELECTED',{code:'17'});

  await waitFor(function(){var s=findOoadSelect();return s&&s.getAttribute('aria-expanded')!=='true'},3000,50);
  await sleep(150);

  setState('OPENING_PERIOD');
  var periodSelect=await waitFor(function(){return findPeriodSelect()},5000,100);
  if(!periodSelect)throw new Error('PERIOD_SELECT_NOT_FOUND');

  setState('WAITING_PERIOD_OPTIONS');
  var periodElements=await openMatSelect(periodSelect,function(t){return /^\d{7}\s*\(/.test(t)},'PERIOD');

  var periods=periodElements.map(function(el){
    var raw=String(el.innerText||el.textContent).replace(/\s+/g,' ').trim();
    var m=raw.match(/^(\d{7})\s*(.*)$/);
    return m?{element:el,code:m[1],label:raw}:null;
  }).filter(Boolean);

  if(periods.length===0)throw new Error('NO_PERIODS');
  setState('PERIOD_OPTIONS_READY',{count:periods.length});

  var latest=periods.reduce(function(best,cur){if(!best)return cur;return Number(cur.code)>Number(best.code)?cur:best},null);

  var periodsForNative=periods.map(function(p){return{code:p.code,label:p.label}});

  setState('SELECTING_PERIOD',{code:latest.code});
  latest.element.click();

  setState('WAITING_PERIOD_SELECTED');
  await waitFor(function(){
    var s=findPeriodSelect();
    var text=s?String(s.innerText||s.textContent):'';
    return text.indexOf(latest.code)>=0;
  },5000,50);

  window.__LVD_CARD_RESULT__={ok:true,ooadOptions:ooadForNative,selectedOoad:{code:'17',label:michoacan.label},periodOptions:periodsForNative,selectedPeriod:{code:latest.code,label:latest.label}};
  setState('READY');
}catch(e){
  var stage=window.__LVD_CARD_STATE__&&window.__LVD_CARD_STATE__.stage||'UNKNOWN';
  window.__LVD_CARD_ERROR__={stage:stage,message:String(e&&e.message||e)};
  window.__LVD_CARD_STATE__={stage:'ERROR',errorStage:stage,message:String(e&&e.message||e)};
}finally{
  window.__LVD_CARD_RUNNING__=false;
}
})();
})()
"""#

    // MARK: - Tarjetón Digital

    static let tdReportIntercept = #"""
(function(){
try{
  var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return;
  var win=iframe.contentWindow;if(!win||win.__LVD_OPEN_HOOKED__)return;
  win.__LVD_OPEN_HOOKED__=true;
  var orig=win.open;
  win.open=function(url,name,features){
    if(typeof url==='string'&&url.indexOf('wfrReporteTarjeton')>=0){
      var abs=url;try{abs=new URL(url,win.location.href).href;}catch(e){}
      try{if(window.TarjetonDigitalBridge)window.TarjetonDigitalBridge.onReport(abs);}catch(e){}
      return null;
    }
    return orig.apply(this,arguments);
  };
}catch(e){}
})()
"""#

    static let tdSnapshot = #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');
if(!iframe)return JSON.stringify({iframeFound:false,loginInputs:false,delegacionesReady:false});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}
if(!doc)return JSON.stringify({iframeFound:true,loginInputs:false,delegacionesReady:false});
var deleg=doc.getElementById('ddlDelegacion');
var user=doc.getElementById('txtUsuario');
var pass=doc.getElementById('txtContraseña');
return JSON.stringify({
  iframeFound:true,
  loginInputs:!!deleg&&!!user&&!!pass,
  delegacionesReady:!!deleg&&deleg.options&&deleg.options.length>1
})})()
"""#

    static let tdDelegaciones = #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return '[]';
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return '[]';
var deleg=doc.getElementById('ddlDelegacion');if(!deleg)return '[]';
var out=[];for(var i=0;i<deleg.options.length;i++){var o=deleg.options[i];
if(o.value&&o.value!=='0')out.push({value:o.value,text:(o.text||o.innerText||'').trim()})}
return JSON.stringify(out)})()
"""#

    static func tdFill(dv: String, u: String, p: String) -> String {
        #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ok:false,reason:'IFRAME_MISSING'});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ok:false,reason:'IFRAME_DOC'});
var deleg=doc.getElementById('ddlDelegacion');var user=doc.getElementById('txtUsuario');var pass=doc.getElementById('txtContraseña');
if(!deleg||!user||!pass)return JSON.stringify({ok:false,reason:'INPUTS_MISSING'});
function setInput(el,v){
  var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  try{d.set.call(el,v);}catch(e){el.value=v;}
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  el.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true}));
  el.dispatchEvent(new Event('blur',{bubbles:true}));
}
deleg.value=\#(jsQuote(dv));
deleg.dispatchEvent(new Event('change',{bubbles:true}));
setInput(user,\#(jsQuote(u)));
setInput(pass,\#(jsQuote(p)));
return JSON.stringify({ok:true,delegHasValue:deleg.value.length>0,userHasValue:user.value.length>0,passHasValue:pass.value.length>0})})()
"""#
    }

    static func tdVerify(dv: String, u: String, p: String) -> String {
        #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ok:false,canSubmit:false});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ok:false,canSubmit:false});
var deleg=doc.getElementById('ddlDelegacion');var user=doc.getElementById('txtUsuario');var pass=doc.getElementById('txtContraseña');
if(!deleg||!user||!pass)return JSON.stringify({ok:false,canSubmit:false});
var dOk=deleg.value===\#(jsQuote(dv));var uOk=user.value===\#(jsQuote(u));var pOk=pass.value===\#(jsQuote(p));
var canSubmit=!!deleg.value&&deleg.value!=='0'&&!!user.value&&!!pass.value;
return JSON.stringify({ok:dOk&&uOk&&pOk,delegOk:dOk,userOk:uOk,passOk:pOk,canSubmit:canSubmit})})()
"""#
    }

    static let tdClick = #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ok:false,reason:'IFRAME_MISSING'});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ok:false,reason:'IFRAME_DOC'});
var deleg=doc.getElementById('ddlDelegacion');var user=doc.getElementById('txtUsuario');var pass=doc.getElementById('txtContraseña');
var btn=doc.getElementById('btnIngresar');
if(!deleg||!user||!pass)return JSON.stringify({ok:false,reason:'INPUTS_MISSING'});
if(!deleg.value||deleg.value==='0')return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_DELEGACION_EMPTY'});
if(!user.value||!String(user.value).trim())return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_USER_EMPTY'});
if(!pass.value)return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_PASSWORD_EMPTY'});
if(!btn)return JSON.stringify({ok:false,reason:'BUTTON_MISSING'});
btn.click();return JSON.stringify({ok:true})})()
"""#

    static let tdAuth = #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({page:'none',message:''});
var url='';try{url=iframe.src||'';}catch(e){}
var path='';try{path=iframe.contentWindow.location.pathname;}catch(e){}
var doc=null;try{doc=iframe.contentDocument;}catch(e){}
var page='none';
if(url.indexOf('wfrGenerarTarjeton')>=0||path.indexOf('wfrGenerarTarjeton')>=0)page='tarjeton';
else if(url.indexOf('wfrAcceso')>=0||path.indexOf('wfrAcceso')>=0)page='login';
var message='';
if(doc){var msj=doc.getElementById('msjLeyenda');if(msj)message=(msj.innerText||msj.textContent||'').replace(/\s+/g,' ').trim();}
return JSON.stringify({page:page,message:message})})()
"""#

    static let tdPeriods = #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return '[]';
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return '[]';
var win=null;try{win=iframe.contentWindow;}catch(e){}
var out=[];var seen={};
function add(code,fechas,obs){
  code=String(code||'').replace(/^grid_/,'').trim();
  if(!code||seen[code])return;
  seen[code]=1;
  out.push({code:code,fechas:String(fechas||'').trim(),observaciones:String(obs||'').trim()});
}
try{
  if(win&&win.jQuery){
    var grid=win.jQuery('#jqGridTarjetones');
    if(grid.length){
      var ids=grid.jqGrid('getDataIDs')||[];
      for(var i=0;i<ids.length;i++){
        var id=String(ids[i]);
        var rd={};try{rd=grid.jqGrid('getRowData',id)||{};}catch(e2){}
        add(rd.Periodo||id, rd.Fechas||'', rd.Observaciones||'');
      }
    }
  }
}catch(e){}
if(out.length===0){
  try{
    var rows=doc.querySelectorAll('#jqGridTarjetones tr.jqgrow');
    for(var j=0;j<rows.length;j++){ add(rows[j].id||'', '', ''); }
  }catch(e2){}
}
return JSON.stringify(out)})()
"""#

    static let tdGenerarDom = #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ready:false});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ready:false});
return JSON.stringify({ready:!!doc.getElementById('btnAceptar')&&!!doc.getElementById('jqGridTarjetones')&&!!doc.getElementById('txtMatricula')})})()
"""#

    static func tdManualConsulta(u: String) -> String {
        #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ok:false,reason:'IFRAME_MISSING'});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ok:false,reason:'IFRAME_DOC'});
var win=null;try{win=iframe.contentWindow;}catch(e){}
var mat=doc.getElementById('txtMatricula');if(!mat)return JSON.stringify({ok:false,reason:'NO_MATRICULA'});
if(!mat.value||!String(mat.value).trim()){mat.value=\#(jsQuote(u));}
try{
  if(win&&win.fnConsultaDatos){win.fnConsultaDatos();return JSON.stringify({ok:true,method:'fnConsultaDatos'});}
}catch(e){}
var btn=doc.getElementById('btnConsultar');
if(btn){btn.click();return JSON.stringify({ok:true,method:'btnConsultar'});}
return JSON.stringify({ok:false,reason:'NO_FN'})})()
"""#
    }

    static let tdDiag = #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return 'NO_IFRAME';
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return 'NO_DOC';
var win=null;try{win=iframe.contentWindow;}catch(e){}
var url='';try{url=iframe.src||'';}catch(e){}
var hasGrid=!!doc.getElementById('jqGridTarjetones');
var rowCount=doc.querySelectorAll('#jqGridTarjetones tr.jqgrow').length;
var hasJQ=!!(win&&win.jQuery);
var mat=doc.getElementById('txtMatricula');
var matriculaFilled=!!mat&&!!String(mat.value||'').trim();
var hasFn=!!(win&&win.fnConsultaDatos);
var consultar=doc.getElementById('btnConsultar');
var consultarVisible=!!consultar&&consultar.style.visibility!=='hidden'&&getComputedStyle(consultar).visibility!=='hidden';
return JSON.stringify({url:url,hasGrid:hasGrid,rowCount:rowCount,hasJQuery:hasJQ,matriculaFilled:matriculaFilled,hasFnConsultaDatos:hasFn,consultarVisible:consultarVisible})})()
"""#

    static func tdGenerate(code: String, tipoId: String) -> String {
        #"""
(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ok:false,reason:'IFRAME_MISSING'});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ok:false,reason:'IFRAME_DOC'});
var win=null;try{win=iframe.contentWindow;}catch(e){}
var obs='';var contr='';var rowId=null;
try{
  if(win&&win.jQuery){
    var grid=win.jQuery('#jqGridTarjetones');
    var ids=grid.jqGrid('getDataIDs')||[];
    for(var i=0;i<ids.length;i++){var id=String(ids[i]);if(id.replace(/^grid_/,'')===\#(jsQuote(code))){rowId=id;break;}}
    if(rowId){var rd=grid.jqGrid('getRowData',rowId);obs=(rd.Observaciones||'').trim();contr=(rd.TipoContrato||'').trim();}
  }
}catch(e){}
if(!rowId)return JSON.stringify({ok:false,reason:'PERIOD_NOT_FOUND'});
try{if(win)win.strObservaciones=obs;}catch(e){}
var hdnP=doc.getElementById('hdnPeriodo');if(!hdnP)return JSON.stringify({ok:false,reason:'HDN_PERIODO_MISSING'});
hdnP.value=\#(jsQuote(code));
var hdnC=doc.getElementById('hdnContratacion');if(hdnC)hdnC.value=contr;
var rdoA=doc.getElementById('rdoArchivo');if(rdoA)rdoA.checked=true;
var tipo=doc.getElementById('\#(tipoId)');if(!tipo)return JSON.stringify({ok:false,reason:'TIPO_NOT_FOUND'});
tipo.checked=true;
var btn=doc.getElementById('btnAceptar');if(!btn)return JSON.stringify({ok:false,reason:'BUTTON_MISSING'});
btn.click();return JSON.stringify({ok:true})})()
"""#
    }

    // MARK: - Captura de PDF (blob monitor)

    static let pdfMonitor = #"""
(function(){
    if (window.__LVD_PDF_MONITOR__) return;
    window.__LVD_PDF_MONITOR__ = true;
    window.__LVD_PDFS__ = {};

    var _orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function(obj) {
        var result = _orig(obj);
        try {
            if (obj instanceof Blob && obj.type && obj.type.indexOf('pdf') !== -1) {
                var id = 'pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
                var reader = new FileReader();
                reader.onload = function() {
                    window.__LVD_PDFS__[id] = {
                        b64: reader.result.split(',')[1],
                        type: obj.type, size: obj.size
                    };
                };
                reader.readAsDataURL(obj);
            }
        } catch(e) {}
        return result;
    };
})();
"""#

    static let pdfPoll = #"""
(function(){
    var keys = Object.keys(window.__LVD_PDFS__ || {});
    if (keys.length === 0) return null;
    var key = keys[0];
    var data = window.__LVD_PDFS__[key];
    delete window.__LVD_PDFS__[key];
    return JSON.stringify({key: key, b64: data.b64, type: data.type, size: data.size});
})();
"""#
}
