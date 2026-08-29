package com.laveintedigital.app.imss.portal

import android.util.Log
import android.webkit.WebView
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import com.laveintedigital.app.imss.credentials.*
import com.laveintedigital.app.imss.tarjeton.TarjetonDigitalDelegaciones
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import org.json.JSONObject

/**
 * Controlador del flujo de Tarjetón Digital IMSS.
 *
 * El portal es ASP.NET WebForms: la página principal
 * (`rh.imss.gob.mx/Personal/TarjetonDigital/`) contiene un iframe
 * `#ifrPaginaSecundaria` cuyo `src` alterna entre
 * `RegistroUsuarios/Web/wfrAcceso.aspx` (login) y
 * `ComprobanteDigital/Web/wfrGenerarTarjeton.aspx` (consulta).
 *
 * El login NO es un postback: `#btnIngresar` → `fnValidaUsuario()` hace un AJAX
 * POST a `wsRegistroUsuario.asmx/wsValidaUsuario`. Por eso NO reconstruimos
 * ViewState/EventValidation; interactuamos con el formulario real vía JS.
 */
class TarjetonDigitalFlowController(
    private val scope: CoroutineScope,
    private val context: android.content.Context,
) {
    companion object {
        private const val TAG = "TarjetonDigital"
        private const val LOGIN_URL = "https://rh.imss.gob.mx/Personal/TarjetonDigital/"
        private const val ALLOWED_HOST = "rh.imss.gob.mx"
        private const val MAX_FILL_ATTEMPTS = 10
        private const val MAX_FIELDS_REQUIRED_RETRIES = 3

        /** Script que se inyecta en el iframe para interceptar el reporte PDF. */
        val REPORT_INTERCEPT_SCRIPT = """(function(){
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
})()"""
    }

    private val _state = MutableStateFlow<TarjetonDigitalFlowState>(TarjetonDigitalFlowState.CheckingSession)
    val state: StateFlow<TarjetonDigitalFlowState> = _state.asStateFlow()
    private val webViewReady = CompletableDeferred<WebView>()
    private var autoLoginAttempted = false
    private var loginJob: Job? = null
    private var manualMonitorJob: Job? = null
    @Volatile private var authenticated = false

    var lastDelegacion: TarjetonDigitalDelegaciones.Delegacion? = null
    var lastUsername: String? = null
    var delegaciones = TarjetonDigitalDelegaciones.FALLBACK
    var periods = listOf<TarjetonPeriod>()
    var selectedPeriod by mutableStateOf<TarjetonPeriod?>(null)

    fun attachWebView(wv: WebView) { if (!webViewReady.isCompleted) webViewReady.complete(wv) }

    data class TarjetonSavedInfo(
        val documentId: Long,
        val localPath: String,
        val wasDuplicate: Boolean,
        val periodLabel: String,
    )

    fun markGenerating() { _state.value = TarjetonDigitalFlowState.GeneratingTarjeton }
    fun markSaving() { _state.value = TarjetonDigitalFlowState.SavingTarjeton }
    fun markTarjetonSaved(info: TarjetonSavedInfo) {
        _state.value = TarjetonDigitalFlowState.TarjetonSaved(
            documentId = info.documentId,
            localPath = info.localPath,
            wasDuplicate = info.wasDuplicate,
            periodLabel = info.periodLabel,
        )
        Log.i(TAG, "LOCAL_PDF_OPEN_REQUESTED docId=${info.documentId}")
    }
    fun markCaptureFailed() {
        _state.value = TarjetonDigitalFlowState.Error("No pudimos guardar el tarjetón.")
    }

    fun start() { _state.value = TarjetonDigitalFlowState.CheckingSession; scope.launch { runFlow() } }

    fun loginWithCredentials(
        delegacion: TarjetonDigitalDelegaciones.Delegacion,
        username: String,
        password: String,
        remember: Boolean,
    ) {
        if (loginJob?.isActive == true) { Log.w(TAG, "LOGIN_JOB_BLOCKED_DUPLICATE"); return }
        Log.i(TAG, "LOGIN_CREDENTIALS_SUBMITTED source=NATIVE_DIALOG")
        loginJob = scope.launch {
            try {
                Log.i(TAG, "LOGIN_DIRECT_ATTEMPT_STARTED")
                authenticated = false
                _state.value = TarjetonDigitalFlowState.LoadingPage
                doLogin(delegacion, username, password)
                val finalState = _state.value
                val success = authenticated
                if (remember && success) {
                    Log.i(TAG, "CREDENTIALS_SAVED afterLoginSuccess")
                    withContext(Dispatchers.IO) {
                        ImssVaultManager.saveCredentials(context, ImssPortal.TARJETON_DIGITAL,
                            ImssCredentialPayload(username, password,
                                delegacionValue = delegacion.value,
                                delegacionLabel = delegacion.label))
                    }
                }
                Log.i(TAG, "LOGIN_FLOW_FINAL_STATE=${finalState::class.simpleName}")
                if (finalState is TarjetonDigitalFlowState.Error) {
                    _state.value = TarjetonDigitalFlowState.LoginError(
                        TarjetonDigitalLoginResult.UnknownError(null))
                }
            } catch (e: Exception) {
                Log.e(TAG, "LOGIN_DIRECT_FAILED", e)
                _state.value = TarjetonDigitalFlowState.LoginError(
                    TarjetonDigitalLoginResult.UnknownError(null))
            }
        }
    }

    fun reset() { autoLoginAttempted = false; _state.value = TarjetonDigitalFlowState.CheckingSession }

    fun retryLogin() {
        if (loginJob?.isActive == true) return
        autoLoginAttempted = false
        _state.value = TarjetonDigitalFlowState.CheckingSession
        scope.launch { runFlow() }
    }

    fun manualEntry() {
        autoLoginAttempted = true
        _state.value = TarjetonDigitalFlowState.ManualMode
        startManualMonitor()
    }

    /** Vuelve a pedir datos (para el modal de error → "Revisar datos"). */
    fun reviewData() {
        autoLoginAttempted = true
        _state.value = TarjetonDigitalFlowState.LoginRequired
    }

    fun retryTarjetonAutomation() {
        scope.launch {
            val wv = webViewReady.await()
            _state.value = TarjetonDigitalFlowState.OpeningTarjetonPage
            doOpenTarjetonPage(wv)
        }
    }

    /** Tipo de comprobante en la pantalla "Generar Tarjetón". */
    enum class TarjetonTipo(val radioId: String, val value: String) {
        TARJETON("rdoTarjeton", "2"),
        CONCEPTOS("rdoConceptos", "3"),
        XML("rdoXML", "1"),
    }

    /**
     * Selecciona el periodo y pulsa "Aceptar" (formato Archivo) para que el
     * portal genere el comprobante. El PDF lo captura [ImssPdfCaptureCoordinator]
     * vía el bridge `TarjetonDigitalBridge`.
     */
    fun consultarTarjeton(period: TarjetonPeriod, tipo: TarjetonTipo) {
        scope.launch {
            val wv = webViewReady.await()
            selectedPeriod = period
            _state.value = TarjetonDigitalFlowState.GeneratingTarjeton
            Log.i(TAG, "CONSULTAR_TARJETON period=${period.code} tipo=${tipo.value}")
            val r = parseJson(evaluateJs(wv, GENERATE_SCRIPT(
                org.json.JSONObject.quote(period.code), tipo.radioId)))
            if (r?.optBoolean("ok") != true) {
                Log.w(TAG, "GENERATE_CLICK_FAILED reason=${r?.optString("reason")}")
            }
            // Espera al guardado o falla por timeout.
            var saved = false
            try {
                withTimeout(45_000L) {
                    while (true) {
                        delay(500)
                        if (_state.value is TarjetonDigitalFlowState.TarjetonSaved) { saved = true; break }
                    }
                }
            } catch (_: TimeoutCancellationException) {}
            if (!saved) {
                ImssPdfCaptureCoordinator.finishSession()
                markCaptureFailed()
            }
        }
    }

    // ── evaluateJs ─────────────────────────────────────────────────────────

    private suspend fun evaluateJs(wv: WebView, script: String): String? =
        withContext(Dispatchers.Main.immediate) { suspendCoroutine { cont -> wv.evaluateJavascript(script) { raw -> cont.resume(raw ?: "null") } } }

    private suspend fun loadUrl(wv: WebView, url: String) = withContext(Dispatchers.Main.immediate) { wv.loadUrl(url) }

    private fun parseJson(raw: String?): JSONObject? = TarjetonDigitalJson.parseObject(raw)

    /**
     * Parsea el resultado de un script que hace `JSON.stringify(array)`.
     * `evaluateJavascript` devuelve ese string con DOBLE serialización:
     *   "[{\"code\":\"...\"}]"  (JSON string que contiene el array)
     * así que hay que deshacer el nivel extra de string antes de leer el array.
     */
    private fun parseJsonArray(raw: String?): org.json.JSONArray? = TarjetonDigitalJson.parseArray(raw)

    private fun fail(reason: String) { Log.e(TAG, reason); _state.value = TarjetonDigitalFlowState.Error(reason) }

    // ── Core flow ──────────────────────────────────────────────────────────

    private suspend fun runFlow() {
        try {
            val wv = webViewReady.await()
            // Si ya estamos dentro del área autenticada, ir directo a consulta.
            val snap = parseJson(evaluateJs(wv, AUTH_SCRIPT))
            if (snap?.optString("page") == "tarjeton") { doOpenTarjetonPage(wv); return }
            if (!autoLoginAttempted) {
                autoLoginAttempted = true
                val payload = try { ImssVaultManager.decryptCredentials(context, ImssPortal.TARJETON_DIGITAL) }
                catch (_: Exception) { null }
                if (payload != null && !payload.username.isBlank() && !payload.password.isBlank()) {
                    val deleg = resolveDelegacion(payload.delegacionValue, payload.delegacionLabel)
                    if (deleg != null) {
                        lastUsername = payload.username
                        lastDelegacion = deleg
                        _state.value = TarjetonDigitalFlowState.LoadingPage
                        doLogin(deleg, payload.username, payload.password)
                        return
                    }
                }
            }
            _state.value = TarjetonDigitalFlowState.LoginRequired
        } catch (e: Exception) { fail("FLOW_ERROR: ${e.message}") }
    }

    private fun resolveDelegacion(value: String?, label: String?): TarjetonDigitalDelegaciones.Delegacion? {
        value?.let { v -> delegaciones.find { it.value == v }?.let { return it } }
        label?.let { l -> delegaciones.find { it.label == l }?.let { return it } }
        return value?.let { v -> TarjetonDigitalDelegaciones.Delegacion(v, label ?: v) }
    }

    // ── Login flow ─────────────────────────────────────────────────────────

    private suspend fun doLogin(delegacion: TarjetonDigitalDelegaciones.Delegacion, u: String, p: String) {
        try {
            val wv = webViewReady.await()
            lastUsername = u
            lastDelegacion = delegacion
            loadUrl(wv, LOGIN_URL)
            _state.value = TarjetonDigitalFlowState.LoadingPage
            Log.i(TAG, "page loaded")

            // 1) Esperar iframe
            _state.value = TarjetonDigitalFlowState.WaitingIframe
            if (!awaitIframe(wv)) { fail("IFRAME_TIMEOUT"); return }
            Log.i(TAG, "iframe detected")

            // 2) Esperar DOM del login (select de delegaciones ya poblado)
            _state.value = TarjetonDigitalFlowState.WaitingDom
            if (!awaitDom(wv)) { fail("LOGIN_DOM_TIMEOUT"); return }
            Log.i(TAG, "login DOM ready")

            // 3) Refrescar catálogo de delegaciones desde el DOM real
            refreshDelegaciones(wv)

            // 4) Rellenar + verificar + submit, con retry ante "campos requeridos"
            var fieldsRequiredRetries = 0
            while (true) {
                _state.value = TarjetonDigitalFlowState.FillingForm
                val filled = fillAndVerify(wv, delegacion.value, u, p)
                if (!filled) { fail("LOGIN_FILL_FAILED"); return }

                _state.value = TarjetonDigitalFlowState.VerifyingForm
                if (!valuesStillPresent(wv, delegacion.value, u, p)) { fail("LOGIN_VALUE_RESET"); return }

                _state.value = TarjetonDigitalFlowState.Submitting
                val click = clickIngresar(wv)
                if (!click.ok) { fail(click.reason); return }
                Log.i(TAG, "submit")

                _state.value = TarjetonDigitalFlowState.WaitingAuthResult
                val (result, errorInfo) = awaitAuth(wv)
                when (result) {
                    AuthResult.SUCCESS -> {
                        Log.i(TAG, "authentication success")
                        authenticated = true
                        _state.value = TarjetonDigitalFlowState.Authenticated
                        doOpenTarjetonPage(wv)
                        return
                    }
                    AuthResult.ERROR -> {
                        val parsed = errorInfo?.result ?: TarjetonDigitalLoginResult.UnknownError(null)
                        // "Campos requeridos" justo después de nuestro autofill = fallo de automatización.
                        if (parsed == TarjetonDigitalLoginResult.MissingFields &&
                            fieldsRequiredRetries < MAX_FIELDS_REQUIRED_RETRIES) {
                            fieldsRequiredRetries++
                            Log.i(TAG, "LOGIN_FIELDS_REQUIRED_RETRY attempt=$fieldsRequiredRetries")
                            continue
                        }
                        _state.value = TarjetonDigitalFlowState.LoginError(
                            result = parsed,
                            portalMessage = errorInfo?.message,
                        )
                        return
                    }
                    AuthResult.TIMEOUT -> { fail("LOGIN_AUTH_TIMEOUT"); return }
                }
            }
        } catch (e: TimeoutCancellationException) { fail("LOGIN_TIMEOUT") }
    }

    private suspend fun awaitIframe(wv: WebView): Boolean {
        var attempts = 0
        while (attempts < 40) {
            val s = parseJson(evaluateJs(wv, SNAPSHOT_SCRIPT))
            if (s?.optBoolean("iframeFound") == true && s.optBoolean("loginInputs") == true) {
                injectReportHook(wv)
                return true
            }
            delay(250); attempts++
        }
        return false
    }

    private suspend fun injectReportHook(wv: WebView) {
        try { evaluateJs(wv, REPORT_INTERCEPT_SCRIPT) } catch (_: Exception) {}
    }

    /**
     * Captura alertas nativas del portal (`alert(...)`), vía WebChromeClient.
     * El portal las usa para "su sesión ha expirado" y para errores de red AJAX.
     */
    fun onPortalAlert(message: String?) {
        val m = message ?: return
        val result = TarjetonDigitalLoginErrorParser.classify(m)
        when {
            result == TarjetonDigitalLoginResult.SessionExpired ->
                _state.value = TarjetonDigitalFlowState.LoginError(result, m)
            m.startsWith("ERROR") || result == TarjetonDigitalLoginResult.ServiceUnavailable ->
                _state.value = TarjetonDigitalFlowState.LoginError(
                    TarjetonDigitalLoginResult.ServiceUnavailable, m)
        }
    }

    private suspend fun awaitDom(wv: WebView): Boolean {
        var attempts = 0
        while (attempts < 40) {
            val s = parseJson(evaluateJs(wv, SNAPSHOT_SCRIPT))
            if (s?.optBoolean("delegacionesReady") == true && s.optBoolean("loginInputs") == true) return true
            delay(250); attempts++
        }
        return false
    }

    private suspend fun refreshDelegaciones(wv: WebView) {
        val raw = evaluateJs(wv, DELEGACIONES_SCRIPT)
        val arr = parseJsonArray(raw)
        val list = mutableListOf<TarjetonDigitalDelegaciones.Delegacion>()
        if (arr != null) {
            for (i in 0 until arr.length()) {
                try {
                    val o = arr.getJSONObject(i)
                    val value = o.optString("value")
                    val text = o.optString("text")
                    if (value.isNotBlank() && value != "0" && text.isNotBlank()) {
                        list.add(TarjetonDigitalDelegaciones.Delegacion(value, text))
                    }
                } catch (_: Exception) {}
            }
        }
        if (list.isNotEmpty()) delegaciones = list
        Log.i(TAG, "delegation options ready count=${delegaciones.size}")
    }

    private suspend fun fillAndVerify(wv: WebView, delegValue: String, u: String, p: String): Boolean {
        repeat(MAX_FILL_ATTEMPTS) { attempt ->
            val r = parseJson(evaluateJs(wv, FILL_SCRIPT(
                org.json.JSONObject.quote(delegValue), org.json.JSONObject.quote(u), org.json.JSONObject.quote(p))))
            val ok = r?.optBoolean("ok") == true
            if (!ok) { delay(250); return@repeat }
            delay(300)
            val v1 = verify(wv, delegValue, u, p)
            if (v1.ok && v1.canSubmit) {
                delay(200)
                val v2 = verify(wv, delegValue, u, p)
                if (v2.ok && v2.canSubmit) {
                    Log.i(TAG, "values verified")
                    return true
                }
            }
            delay(200)
        }
        return false
    }

    private suspend fun valuesStillPresent(wv: WebView, delegValue: String, u: String, p: String): Boolean {
        val v = verify(wv, delegValue, u, p)
        return v.ok && v.canSubmit
    }

    private data class Verify(val ok: Boolean, val canSubmit: Boolean)
    private suspend fun verify(wv: WebView, delegValue: String, u: String, p: String): Verify {
        val r = parseJson(evaluateJs(wv, VERIFY_SCRIPT(
            org.json.JSONObject.quote(delegValue), org.json.JSONObject.quote(u), org.json.JSONObject.quote(p))))
        return Verify(r?.optBoolean("ok") == true, r?.optBoolean("canSubmit") == true)
    }

    private data class ClickResult(val ok: Boolean, val reason: String = "LOGIN_CLICK_FAILED")
    private suspend fun clickIngresar(wv: WebView): ClickResult {
        val r = parseJson(evaluateJs(wv, CLICK_SCRIPT))
        return if (r?.optBoolean("ok") == true) ClickResult(true)
        else ClickResult(false, r?.optString("reason") ?: "LOGIN_CLICK_FAILED")
    }

    enum class AuthResult { SUCCESS, ERROR, TIMEOUT }
    data class LoginErrorInfo(val result: TarjetonDigitalLoginResult, val message: String?)

    private suspend fun awaitAuth(wv: WebView): Pair<AuthResult, LoginErrorInfo?> {
        var result: Pair<AuthResult, LoginErrorInfo?>? = null
        try {
            withTimeout(30_000L) {
                while (true) {
                    delay(400)
                    val j = parseJson(evaluateJs(wv, AUTH_SCRIPT)) ?: continue
                    val page = j.optString("page")
                    if (page == "tarjeton") {
                        Log.i(TAG, "waiting authentication")
                        result = AuthResult.SUCCESS to null
                        return@withTimeout
                    }
                    val message = j.optString("message").takeIf { it.isNotBlank() }
                    val parsed = TarjetonDigitalLoginErrorParser.classify(message)
                    if (parsed != null) {
                        result = AuthResult.ERROR to LoginErrorInfo(parsed, message)
                        return@withTimeout
                    }
                }
            }
        } catch (_: TimeoutCancellationException) {
            return AuthResult.TIMEOUT to null
        }
        return result ?: (AuthResult.TIMEOUT to null)
    }

    private fun startManualMonitor() {
        if (manualMonitorJob?.isActive == true) return
        manualMonitorJob = scope.launch {
            val wv = webViewReady.await()
            try {
                withTimeout(60_000L) {
                    while (true) {
                        delay(500)
                        val j = parseJson(evaluateJs(wv, AUTH_SCRIPT)) ?: continue
                        if (j.optString("page") == "tarjeton") {
                            Log.i(TAG, "manual login detected")
                            _state.value = TarjetonDigitalFlowState.Authenticated
                            doOpenTarjetonPage(wv)
                            return@withTimeout
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    // ── Post-login: consulta de tarjetones ────────────────────────────────

    private suspend fun doOpenTarjetonPage(wv: WebView) {
        _state.value = TarjetonDigitalFlowState.OpeningTarjetonPage
        if (!awaitPage(wv, "tarjeton", 20_000L)) {
            failTarjeton("TARJETON_NAV_TIMEOUT"); return
        }
        Log.i(TAG, "tarjeton page detected")

        // Re-hook window.open (idempotente) tras la navegación del iframe.
        injectReportHook(wv)

        // Esperar a que el DOM de la pantalla "Generar Tarjetón" esté listo.
        if (!awaitGenerarDom(wv, 15_000L)) {
            Log.e(TAG, "GENERAR_DIAG ${readDiagnostic(wv)}")
            failTarjeton("TARJETON_DOM_TIMEOUT"); return
        }
        Log.i(TAG, "generar DOM ready")

        // Esperar a que la grilla se autopobles (perfil trabajador).
        var periodsRaw = awaitPeriods(wv, 8_000L)

        // Fallback: la autocarga puede no dispararse (GetVariables/PageMethod).
        // Disparamos la consulta manualmente con la matrícula del usuario.
        if (periodsRaw.isEmpty()) {
            Log.i(TAG, "periods empty, driving query manually")
            manualConsulta(wv)
            periodsRaw = awaitPeriods(wv, 20_000L)
        }

        if (periodsRaw.isEmpty()) {
            Log.e(TAG, "PERIODS_DIAG ${readDiagnostic(wv)}")
            failTarjeton("No encontramos tarjetones disponibles para tu cuenta.")
            return
        }

        periods = periodsRaw
        selectedPeriod = periods.firstOrNull()
        Log.i(TAG, "tarjeton periods ready count=${periods.size}")
        _state.value = TarjetonDigitalFlowState.TarjetonReady(periods, selectedPeriod, delegaciones)
    }

    private fun failTarjeton(reason: String) {
        Log.e(TAG, reason)
        _state.value = TarjetonDigitalFlowState.TarjetonError(reason)
    }

    private suspend fun awaitPage(wv: WebView, page: String, timeoutMs: Long): Boolean {
        try {
            withTimeout(timeoutMs) {
                while (true) {
                    delay(400)
                    val j = parseJson(evaluateJs(wv, AUTH_SCRIPT)) ?: continue
                    if (j.optString("page") == page) return@withTimeout
                }
            }
        } catch (_: TimeoutCancellationException) { return false }
        return true
    }

    private suspend fun awaitGenerarDom(wv: WebView, timeoutMs: Long): Boolean {
        try {
            withTimeout(timeoutMs) {
                while (true) {
                    delay(400)
                    val j = parseJson(evaluateJs(wv, GENERAR_DOM_SCRIPT))
                    if (j?.optBoolean("ready") == true) return@withTimeout
                }
            }
        } catch (_: TimeoutCancellationException) { return false }
        return true
    }

    private suspend fun awaitPeriods(wv: WebView, timeoutMs: Long): List<TarjetonPeriod> {
        var last: List<TarjetonPeriod> = emptyList()
        try {
            withTimeout(timeoutMs) {
                while (true) {
                    delay(500)
                    last = readPeriods(wv)
                    if (last.isNotEmpty()) return@withTimeout
                }
            }
        } catch (_: TimeoutCancellationException) {}
        return last
    }

    private suspend fun manualConsulta(wv: WebView) {
        val u = lastUsername ?: return
        try { evaluateJs(wv, MANUAL_CONSULTA_SCRIPT(org.json.JSONObject.quote(u))) } catch (_: Exception) {}
    }

    private suspend fun readDiagnostic(wv: WebView): String =
        try { evaluateJs(wv, DIAG_SCRIPT)?.trim('"') ?: "none" } catch (_: Exception) { "none" }

    private suspend fun readPeriods(wv: WebView): List<TarjetonPeriod> {
        val raw = evaluateJs(wv, PERIODS_SCRIPT)
        if (com.laveintedigital.app.BuildConfig.DEBUG) {
            Log.d(TAG, "readPeriods raw=${raw?.take(300)}")
        }
        val arr = parseJsonArray(raw) ?: return emptyList()
        val list = mutableListOf<TarjetonPeriod>()
        for (i in 0 until arr.length()) {
            try {
                val o = arr.getJSONObject(i)
                list.add(TarjetonPeriod(
                    code = o.optString("code"),
                    fechas = o.optString("fechas"),
                    observaciones = o.optString("observaciones"),
                ))
            } catch (_: Exception) {}
        }
        if (list.isNotEmpty()) Log.i(TAG, "readPeriods count=${list.size}")
        return list
    }

    // ── JS scripts ─────────────────────────────────────────────────────────
    // Todos operan sobre el documento del iframe `#ifrPaginaSecundaria`
    // (mismo origen que el padre: rh.imss.gob.mx).

    private val SNAPSHOT_SCRIPT = """(function(){
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
})})()"""

    private val DELEGACIONES_SCRIPT = """(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return '[]';
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return '[]';
var deleg=doc.getElementById('ddlDelegacion');if(!deleg)return '[]';
var out=[];for(var i=0;i<deleg.options.length;i++){var o=deleg.options[i];
if(o.value&&o.value!=='0')out.push({value:o.value,text:(o.text||o.innerText||'').trim()})}
return JSON.stringify(out)})()"""

    private fun FILL_SCRIPT(dv: String, u: String, p: String) = """(function(){
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
deleg.value=$dv;
deleg.dispatchEvent(new Event('change',{bubbles:true}));
setInput(user,$u);
setInput(pass,$p);
return JSON.stringify({ok:true,delegHasValue:deleg.value.length>0,userHasValue:user.value.length>0,passHasValue:pass.value.length>0})})()"""

    private fun VERIFY_SCRIPT(dv: String, u: String, p: String) = """(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ok:false,canSubmit:false});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ok:false,canSubmit:false});
var deleg=doc.getElementById('ddlDelegacion');var user=doc.getElementById('txtUsuario');var pass=doc.getElementById('txtContraseña');
if(!deleg||!user||!pass)return JSON.stringify({ok:false,canSubmit:false});
var dOk=deleg.value===$dv;var uOk=user.value===$u;var pOk=pass.value===$p;
var canSubmit=!!deleg.value&&deleg.value!=='0'&&!!user.value&&!!pass.value;
return JSON.stringify({ok:dOk&&uOk&&pOk,delegOk:dOk,userOk:uOk,passOk:pOk,canSubmit:canSubmit})})()"""

    private val CLICK_SCRIPT = """(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ok:false,reason:'IFRAME_MISSING'});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ok:false,reason:'IFRAME_DOC'});
var deleg=doc.getElementById('ddlDelegacion');var user=doc.getElementById('txtUsuario');var pass=doc.getElementById('txtContraseña');
var btn=doc.getElementById('btnIngresar');
if(!deleg||!user||!pass)return JSON.stringify({ok:false,reason:'INPUTS_MISSING'});
if(!deleg.value||deleg.value==='0')return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_DELEGACION_EMPTY'});
if(!user.value||!String(user.value).trim())return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_USER_EMPTY'});
if(!pass.value)return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_PASSWORD_EMPTY'});
if(!btn)return JSON.stringify({ok:false,reason:'BUTTON_MISSING'});
btn.click();return JSON.stringify({ok:true})})()"""

    private val AUTH_SCRIPT = """(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({page:'none',message:''});
var url='';try{url=iframe.src||'';}catch(e){}
var path='';try{path=iframe.contentWindow.location.pathname;}catch(e){}
var doc=null;try{doc=iframe.contentDocument;}catch(e){}
var page='none';
if(url.indexOf('wfrGenerarTarjeton')>=0||path.indexOf('wfrGenerarTarjeton')>=0)page='tarjeton';
else if(url.indexOf('wfrAcceso')>=0||path.indexOf('wfrAcceso')>=0)page='login';
var message='';
if(doc){var msj=doc.getElementById('msjLeyenda');if(msj)message=(msj.innerText||msj.textContent||'').replace(/\s+/g,' ').trim();}
return JSON.stringify({page:page,message:message})})()"""

    private val PERIODS_SCRIPT = """(function(){
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
return JSON.stringify(out)})()"""

    private val GENERAR_DOM_SCRIPT = """(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ready:false});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ready:false});
return JSON.stringify({ready:!!doc.getElementById('btnAceptar')&&!!doc.getElementById('jqGridTarjetones')&&!!doc.getElementById('txtMatricula')})})()"""

    private fun MANUAL_CONSULTA_SCRIPT(u: String) = """(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ok:false,reason:'IFRAME_MISSING'});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ok:false,reason:'IFRAME_DOC'});
var win=null;try{win=iframe.contentWindow;}catch(e){}
var mat=doc.getElementById('txtMatricula');if(!mat)return JSON.stringify({ok:false,reason:'NO_MATRICULA'});
if(!mat.value||!String(mat.value).trim()){mat.value=$u;}
try{
  if(win&&win.fnConsultaDatos){win.fnConsultaDatos();return JSON.stringify({ok:true,method:'fnConsultaDatos'});}
}catch(e){}
var btn=doc.getElementById('btnConsultar');
if(btn){btn.click();return JSON.stringify({ok:true,method:'btnConsultar'});}
return JSON.stringify({ok:false,reason:'NO_FN'})})()"""

    private val DIAG_SCRIPT = """(function(){
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
return JSON.stringify({url:url,hasGrid:hasGrid,rowCount:rowCount,hasJQuery:hasJQ,matriculaFilled:matriculaFilled,hasFnConsultaDatos:hasFn,consultarVisible:consultarVisible})})()"""

    private fun GENERATE_SCRIPT(code: String, tipoId: String) = """(function(){
var iframe=document.getElementById('ifrPaginaSecundaria');if(!iframe)return JSON.stringify({ok:false,reason:'IFRAME_MISSING'});
var doc=null;try{doc=iframe.contentDocument;}catch(e){}if(!doc)return JSON.stringify({ok:false,reason:'IFRAME_DOC'});
var win=null;try{win=iframe.contentWindow;}catch(e){}
var obs='';var contr='';var rowId=null;
try{
  if(win&&win.jQuery){
    var grid=win.jQuery('#jqGridTarjetones');
    var ids=grid.jqGrid('getDataIDs')||[];
    for(var i=0;i<ids.length;i++){var id=String(ids[i]);if(id.replace(/^grid_/,'')===$code){rowId=id;break;}}
    if(rowId){var rd=grid.jqGrid('getRowData',rowId);obs=(rd.Observaciones||'').trim();contr=(rd.TipoContrato||'').trim();}
  }
}catch(e){}
if(!rowId)return JSON.stringify({ok:false,reason:'PERIOD_NOT_FOUND'});
try{if(win)win.strObservaciones=obs;}catch(e){}
var hdnP=doc.getElementById('hdnPeriodo');if(!hdnP)return JSON.stringify({ok:false,reason:'HDN_PERIODO_MISSING'});
hdnP.value=$code;
var hdnC=doc.getElementById('hdnContratacion');if(hdnC)hdnC.value=contr;
var rdoA=doc.getElementById('rdoArchivo');if(rdoA)rdoA.checked=true;
var tipo=doc.getElementById('$tipoId');if(!tipo)return JSON.stringify({ok:false,reason:'TIPO_NOT_FOUND'});
tipo.checked=true;
var btn=doc.getElementById('btnAceptar');if(!btn)return JSON.stringify({ok:false,reason:'BUTTON_MISSING'});
btn.click();return JSON.stringify({ok:true})})()"""
}
