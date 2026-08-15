package com.laveintedigital.app.imss.portal

import android.util.Log
import android.webkit.WebView
import com.laveintedigital.app.BuildConfig
import com.laveintedigital.app.imss.tarjeton.ImssPeriodOption
import com.laveintedigital.app.imss.tarjeton.PeriodParser
import com.laveintedigital.app.imss.tarjeton.PortalOoad
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

/**
 * Controlador de TARJETONES de Tu Perfil IMSS.
 *
 * La autenticación/sesión vive en [TuPerfilSessionController] —compartida con
 * Registros biométricos (una sola cuenta, una sola bóveda, un solo motor de
 * login)—. Este controlador se encarga exclusivamente del flujo del tarjetón:
 * abrir la ruta de tarjetón, preparar el formulario (OOAD/período) y orquestar
 * la generación/captura.
 */
class TuPerfilFlowController(
    private val scope: CoroutineScope,
    private val context: android.content.Context,
) {
    companion object {
        private const val TAG = "TuPerfilFlow"
        private const val CARD_URL = "https://tuperfil.imss.gob.mx/guitpei-web/app/administration/card"
    }

    private val session = TuPerfilSessionController(scope, context)

    private val _state = MutableStateFlow<TuPerfilFlowState>(TuPerfilFlowState.CheckingSession)
    val state: StateFlow<TuPerfilFlowState> = _state.asStateFlow()
    private val _cardStage = MutableStateFlow("")
    val cardStage: StateFlow<String> = _cardStage.asStateFlow()

    val lastUsername: String? get() = session.lastUsername

    var ooadOptions = listOf<PortalOoad>()
    var selectedOoad: PortalOoad? = null
    var periodOptions = listOf<ImssPeriodOption>()
    var selectedPeriod: ImssPeriodOption? = null

    init {
        // Mapea la sesión compartida a la máquina de estados del tarjetón.
        // El comportamiento observable es idéntico al flujo previo.
        scope.launch {
            session.state.collect { auth ->
                when (auth) {
                    is TuPerfilSessionState.CheckingSession -> _state.value = TuPerfilFlowState.CheckingSession
                    is TuPerfilSessionState.LoginRequired -> _state.value = TuPerfilFlowState.LoginRequired
                    is TuPerfilSessionState.WaitingForm -> _state.value = TuPerfilFlowState.WaitingForm
                    is TuPerfilSessionState.FillingForm -> _state.value = TuPerfilFlowState.FillingForm
                    is TuPerfilSessionState.VerifyingForm -> _state.value = TuPerfilFlowState.VerifyingForm
                    is TuPerfilSessionState.SubmittingLogin -> _state.value = TuPerfilFlowState.SubmittingLogin
                    is TuPerfilSessionState.WaitingAuthentication -> _state.value = TuPerfilFlowState.WaitingAuthentication
                    is TuPerfilSessionState.Authenticated -> {
                        _state.value = TuPerfilFlowState.Authenticated
                        scope.launch { doNavigateToCard(session.awaitWebView()) }
                    }
                    is TuPerfilSessionState.LoginError -> _state.value = TuPerfilFlowState.LoginError(auth.kind, auth.portalMessage)
                    is TuPerfilSessionState.Error -> _state.value = TuPerfilFlowState.Error(auth.reason)
                }
            }
        }
    }

    fun attachWebView(wv: WebView) = session.attachWebView(wv)

    data class TarjetonSavedInfo(
        val documentId: Long,
        val localPath: String,
        val wasDuplicate: Boolean,
        val ooadLabel: String,
        val periodLabel: String,
    )

    fun markGenerating() { _state.value = TuPerfilFlowState.GeneratingTarjeton }
    fun markSaving() { _state.value = TuPerfilFlowState.SavingTarjeton }

    fun markTarjetonSaved(info: TarjetonSavedInfo) {
        _state.value = TuPerfilFlowState.TarjetonSaved(
            documentId = info.documentId,
            localPath = info.localPath,
            wasDuplicate = info.wasDuplicate,
            ooadLabel = info.ooadLabel,
            periodLabel = info.periodLabel,
        )
        Log.i(TAG, "LOCAL_PDF_OPEN_REQUESTED docId=${info.documentId}")
    }

    fun markCaptureFailed() {
        _state.value = TuPerfilFlowState.Error("No pudimos guardar el tarjetón.")
    }

    fun start() { _state.value = TuPerfilFlowState.CheckingSession; session.start() }
    fun loginWithCredentials(username: String, password: String, remember: Boolean) =
        session.loginWithCredentials(username, password, remember)

    fun reset() = session.reset()

    /** Reintenta el autologin completo (para el modal de error → "Intentar nuevamente"). */
    fun retryLogin() = session.retryLogin()

    /** Pide login manual (para el modal de error → "Entrar manualmente"). */
    fun manualEntry() = session.manualEntry()

    fun retryCardAutomation() {
        scope.launch {
            _state.value = TuPerfilFlowState.PreparingCardForm
            val wv = session.awaitWebView()
            runAutomation(wv)
        }
    }

    // ── Card navigation + single-JS automation ─────────────────────────────

    private suspend fun doNavigateToCard(wv: WebView) {
        _state.value = TuPerfilFlowState.OpeningCardPage
        TuPerfilWebBridge.loadUrl(wv, CARD_URL)
        try { withTimeout(15_000L) { while (true) { delay(500); if ((TuPerfilWebBridge.evaluateJs(wv, "location.pathname")?.trim('"') ?: "").contains("/administration/card")) break } } }
        catch (_: TimeoutCancellationException) { _state.value = TuPerfilFlowState.Error("CARD_NAV_TIMEOUT"); return }
        // Wait for DOM
        try { withTimeout(10_000L) { while (true) { val j = TarjetonDigitalJson.parseObject(TuPerfilWebBridge.evaluateJs(wv, CARD_DOM_SCRIPT)) ?: JSONObject(); if (j.optBoolean("ready")) break; delay(200) } } }
        catch (_: TimeoutCancellationException) { _state.value = TuPerfilFlowState.Error("CARD_DOM_TIMEOUT"); return }
        // Run the single-JS automation
        _state.value = TuPerfilFlowState.PreparingCardForm
        runAutomation(wv)
    }

    // ── Single JS automation ───────────────────────────────────────────────

    private suspend fun runAutomation(wv: WebView) {
        TuPerfilWebBridge.evaluateJs(wv, CARD_AUTOMATION_JS)
        Log.d(TAG, "CARD_AUTOMATION_STARTED")
        _cardStage.value = "STARTING"

        var lastStage = ""
        try { withTimeout(40_000L) {
            while (true) {
                delay(300)
                val j = TarjetonDigitalJson.parseObject(TuPerfilWebBridge.evaluateJs(wv, CARD_SNAPSHOT_SCRIPT)) ?: continue
                val state = j.optJSONObject("s")
                val result = j.optJSONObject("r")
                val error = j.optJSONObject("e")

                val stage = state?.optString("stage", "") ?: ""
                if (stage != lastStage) {
                    lastStage = stage
                    _cardStage.value = stage
                    val detail = state?.optInt("count", -1).takeIf { it != -1 }?.let { "count=$it" }
                        ?: state?.optString("code", "")?.takeIf { it.isNotEmpty() }?.let { "code=$it" } ?: ""
                    Log.d(TAG, "CARD_JS_STAGE $stage $detail".trimEnd())
                }

                if (error != null) {
                    val eStage = error.optString("stage", lastStage)
                    val eMsg = error.optString("message", "")
                    failCardAutomation(eStage, eMsg)
                    return@withTimeout
                }

                if (result != null && result.optBoolean("ok")) {
                    applyCardResult(result)
                    return@withTimeout
                }
            }
        } } catch (_: TimeoutCancellationException) { failCardAutomation(lastStage, "TIMEOUT") }
    }

    private fun applyCardResult(result: JSONObject) {
        val ooadArr = result.optJSONArray("ooadOptions")
        val periodArr = result.optJSONArray("periodOptions")
        val selOoad = result.optJSONObject("selectedOoad")
        val selPeriod = result.optJSONObject("selectedPeriod")

        ooadOptions = (0 until (ooadArr?.length() ?: 0)).map { i ->
            val o = ooadArr!!.getJSONObject(i)
            val label = o.optString("label")
            PortalOoad(o.optString("code"), label, label.replace(Regex("""^\d{2}\s*-\s*"""), ""))
        }
        periodOptions = (0 until (periodArr?.length() ?: 0)).map { i ->
            PeriodParser.parse(periodArr!!.getJSONObject(i).optString("label"))
        }
        selectedOoad = selOoad?.let {
            val label = it.optString("label")
            PortalOoad(it.optString("code"), label, label.replace(Regex("""^\d{2}\s*-\s*"""), ""))
        }
        selectedPeriod = selPeriod?.let { PeriodParser.parse(it.optString("label")) }

        val ooadCount = ooadOptions.size
        val periodCount = periodOptions.size
        val selOoadCode = selectedOoad?.code ?: "-"
        val selPeriodCode = selectedPeriod?.code ?: "-"
        Log.d(TAG, "CARD_AUTOMATION_RESULT_RECEIVED ooadCount=$ooadCount periodCount=$periodCount selectedOoad=$selOoadCode selectedPeriod=$selPeriodCode")
        _state.value = TuPerfilFlowState.Ready(ooadOptions, selectedOoad, periodOptions, selectedPeriod)
        Log.d(TAG, "CARD_FLOW_STATE_READY")
    }

    private fun failCardAutomation(stage: String, message: String) {
        val sanitized = message.replace('\n', ' ')
        val reason = if (BuildConfig.DEBUG) "No pudimos preparar el formulario stage=$stage error=$sanitized"
            else "No pudimos preparar tus tarjetones."
        Log.e(TAG, "CARD_AUTOMATION_FAILED stage=$stage error=$sanitized")
        _cardStage.value = stage
        _state.value = TuPerfilFlowState.Error(reason)
    }

    // ── JS scripts (tarjetón) ──────────────────────────────────────────────

    private val CARD_DOM_SCRIPT = """(function(){var s=Array.from(document.querySelectorAll('mat-select[role="combobox"]'));var o=s.find(function(x){return String(x.textContent||'').toLowerCase().includes('ooad')})||s[0];return JSON.stringify({ready:!!o&&o.getAttribute('aria-disabled')!=='true'&&!o.classList.contains('mat-select-disabled')&&!!o.querySelector('.mat-select-trigger')})})()"""
    private val CARD_SNAPSHOT_SCRIPT = """(function(){return JSON.stringify({s:window.__LVD_CARD_STATE__||{},r:window.__LVD_CARD_RESULT__||null,e:window.__LVD_CARD_ERROR__||null})})()"""

    private val CARD_AUTOMATION_JS = """(function(){
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
})()"""
}
