package com.laveintedigital.app.imss.portal

import android.util.Log
import android.webkit.WebView
import com.laveintedigital.app.imss.credentials.ImssCredentialPayload
import com.laveintedigital.app.imss.credentials.ImssCredentialRepository
import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.credentials.ImssVaultManager
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

/**
 * Motor de SESIÓN compartido de Tu Perfil IMSS.
 *
 * Tarjetones y Registros biométricos son funciones del MISMO portal y usan la
 * MISMA credencial guardada (`ImssPortal.TU_PERFIL`) y las MISMAS cookies del
 * WebView. Este controlador extrae el login maduro que antes vivía dentro de
 * `TuPerfilFlowController` (espera de inputs, fill con
 * `HTMLInputElement.prototype.value` + `InputEvent` + keyup/change/blur,
 * doble verificación, reintentos, guard contra doble submit, detección de
 * errores con anti-falsos positivos y persistencia SOLO después de una
 * autenticación correcta) para que ambas funciones lo consuman.
 *
 * Los consumidores observan [state] y reaccionan a [TuPerfilSessionState.Authenticated]
 * navegando a su sección (tarjetón / biométricos).
 */
class TuPerfilSessionController(
    private val scope: CoroutineScope,
    private val context: android.content.Context,
) {
    companion object {
        const val TAG = "TuPerfilSession"
        const val LOGIN_URL = "https://tuperfil.imss.gob.mx/guitpei-web/login"
        private const val MAX_FILL_ATTEMPTS = 10
        private const val MAX_FIELDS_REQUIRED_RETRIES = 3
        private const val ERROR_PERSIST_SAMPLES = 3
    }

    private val _state = MutableStateFlow<TuPerfilSessionState>(TuPerfilSessionState.CheckingSession)
    val state: StateFlow<TuPerfilSessionState> = _state.asStateFlow()

    private val webViewReady = CompletableDeferred<WebView>()
    private var autoLoginAttempted = false
    private var loginJob: Job? = null
    var lastUsername: String? = null

    fun attachWebView(wv: WebView) { if (!webViewReady.isCompleted) webViewReady.complete(wv) }

    suspend fun awaitWebView(): WebView = webViewReady.await()

    fun start() { _state.value = TuPerfilSessionState.CheckingSession; scope.launch { runFlow() } }

    fun loginWithCredentials(username: String, password: String, remember: Boolean) {
        if (loginJob?.isActive == true) {
            Log.w(TAG, "LOGIN_JOB_BLOCKED_DUPLICATE")
            return
        }
        Log.i(TAG, "LOGIN_CREDENTIALS_SUBMITTED source=NATIVE_DIALOG")
        loginJob = scope.launch {
            try {
                Log.i(TAG, "LOGIN_DIRECT_ATTEMPT_STARTED")
                _state.value = TuPerfilSessionState.WaitingForm
                doLogin(username, password)
                val finalState = _state.value
                val success = finalState is TuPerfilSessionState.Authenticated
                if (remember && success) {
                    Log.i(TAG, "CREDENTIALS_SAVED afterLoginSuccess")
                    withContext(Dispatchers.IO) {
                        ImssVaultManager.saveCredentials(context, ImssPortal.TU_PERFIL,
                            ImssCredentialPayload(username, password))
                    }
                }
                if (finalState is TuPerfilSessionState.Error && !success) {
                    _state.value = TuPerfilSessionState.LoginError(PortalLoginErrorKind.UNKNOWN)
                }
            } catch (e: Exception) {
                Log.e(TAG, "LOGIN_DIRECT_FAILED", e)
                _state.value = TuPerfilSessionState.LoginError(
                    kind = PortalLoginErrorKind.UNKNOWN,
                )
            }
        }
    }

    fun reset() { autoLoginAttempted = false; _state.value = TuPerfilSessionState.CheckingSession }

    /** Reintenta el autologin completo (para el modal de error → "Intentar nuevamente"). */
    fun retryLogin() {
        if (loginJob?.isActive == true) return
        autoLoginAttempted = false
        _state.value = TuPerfilSessionState.CheckingSession
        scope.launch { runFlow() }
    }

    /** Pide login manual (para el modal de error → "Entrar manualmente"). */
    fun manualEntry() {
        autoLoginAttempted = true
        _state.value = TuPerfilSessionState.LoginRequired
    }

    /**
     * Reautenticación forzada (sesión expirada en plena operación).
     * Re-lanza el auto-login y espera el desenlace. Devuelve true si quedó
     * autenticado; false si no hay credenciales o el portal rechazó.
     */
    suspend fun reauthenticate(): Boolean {
        if (_state.value is TuPerfilSessionState.Authenticated) return true
        autoLoginAttempted = false
        _state.value = TuPerfilSessionState.CheckingSession
        scope.launch { runFlow() }
        return try {
            withTimeout(90_000L) {
                _state.first {
                    it is TuPerfilSessionState.Authenticated ||
                        it is TuPerfilSessionState.LoginRequired ||
                        it is TuPerfilSessionState.LoginError ||
                        it is TuPerfilSessionState.Error
                }
            }
            _state.value is TuPerfilSessionState.Authenticated
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (_: Exception) {
            false
        }
    }

    private fun fail(reason: String) { Log.e(TAG, reason); _state.value = TuPerfilSessionState.Error(reason) }

    // ── Core flow ──────────────────────────────────────────────────────────

    private suspend fun runFlow() {
        try {
            val wv = webViewReady.await()
            val path = TuPerfilWebBridge.evaluateJs(wv, "location.pathname")?.trim('"') ?: ""
            if (path.startsWith("/guitpei-web/app")) {
                Log.i(TAG, "SESSION_ALREADY_AUTHENTICATED")
                _state.value = TuPerfilSessionState.Authenticated
                return
            }
            if (!autoLoginAttempted) {
                autoLoginAttempted = true
                val payload = ImssCredentialRepository.read(context, ImssPortal.TU_PERFIL.id)?.let { (ct, iv) ->
                    try { ImssVaultManager.decryptCredentials(context, ImssPortal.TU_PERFIL) } catch (_: Exception) { null }
                }
                if (payload != null) {
                    lastUsername = payload.username
                    _state.value = TuPerfilSessionState.WaitingForm
                    doLogin(payload.username, payload.password)
                    return
                }
            }
            _state.value = TuPerfilSessionState.LoginRequired
        } catch (e: Exception) { fail("FLOW_ERROR: ${e.message}") }
    }

    // ── Login flow ─────────────────────────────────────────────────────────

    private suspend fun doLogin(u: String, p: String) {
        try {
            val wv = webViewReady.await()
            lastUsername = u
            TuPerfilWebBridge.loadUrl(wv, LOGIN_URL)
            _state.value = TuPerfilSessionState.WaitingForm

            // 1) Wait until both inputs exist (DOM + Angular ready)
            val inputsReady = awaitInputs(wv)
            if (!inputsReady) { fail("LOGIN_INPUTS_TIMEOUT"); return }

            // Fill → submit → detect. Si Angular muestra "Campo obligatorio",
            // se considera fallo de automatización y se vuelve a rellenar.
            var fieldsRequiredRetries = 0
            while (true) {
                // 2) Fill + verify values with retries (Angular may reset them)
                _state.value = TuPerfilSessionState.FillingForm
                val filled = fillAndVerify(wv, u, p)
                if (!filled) { fail("LOGIN_FILL_FAILED"); return }

                // 3) Final stability check right before submitting
                _state.value = TuPerfilSessionState.VerifyingForm
                if (!valuesStillPresent(wv, u, p)) { fail("LOGIN_VALUE_RESET"); return }

                // 4) Submit ONLY when both fields are non-empty
                _state.value = TuPerfilSessionState.SubmittingLogin
                val click = clickLogin(wv)
                if (!click.ok) { fail(click.reason); return }

                // 5) Wait for auth or a classified portal error
                _state.value = TuPerfilSessionState.WaitingAuthentication
                val (result, errorInfo) = awaitAuth(wv)
                when (result) {
                    AuthResult.SUCCESS -> {
                        _state.value = TuPerfilSessionState.Authenticated
                        return
                    }
                    AuthResult.ERROR -> {
                        val kind = errorInfo?.kind ?: PortalLoginErrorKind.UNKNOWN
                        if (kind == PortalLoginErrorKind.FIELDS_REQUIRED &&
                            fieldsRequiredRetries < MAX_FIELDS_REQUIRED_RETRIES) {
                            fieldsRequiredRetries++
                            Log.i(TAG, "LOGIN_FIELDS_REQUIRED_RETRY attempt=$fieldsRequiredRetries")
                            continue
                        }
                        _state.value = TuPerfilSessionState.LoginError(
                            kind = kind,
                            portalMessage = errorInfo?.message,
                        )
                        return
                    }
                    AuthResult.TIMEOUT -> {
                        fail("LOGIN_AUTH_TIMEOUT")
                        return
                    }
                }
            }
        } catch (e: TimeoutCancellationException) { fail("LOGIN_TIMEOUT") }
    }

    /** Polls for #matricula and #password. Max ~7.5s. */
    private suspend fun awaitInputs(wv: WebView): Boolean {
        var attempts = 0
        while (attempts < 30) {
            val s = getSnapshot(wv)
            if (s.matriculaFound && s.passwordFound) return true
            delay(250)
            attempts++
        }
        return false
    }

    /**
     * Fill both fields, then confirm the values survive Angular's re-render.
     * Retries the whole cycle up to [MAX_FILL_ATTEMPTS].
     */
    private suspend fun fillAndVerify(wv: WebView, u: String, p: String): Boolean {
        repeat(MAX_FILL_ATTEMPTS) { attempt ->
            val fr = fillCredentials(wv, u, p)
            if (!fr.ok) { delay(250); return@repeat }

            // Give Angular time to register the input events
            delay(300)

            // First verification: values must match exactly
            val v1 = verifyCredentials(wv, u, p)
            if (v1.matriculaOk && v1.passwordOk && v1.canSubmit) {
                // Second check ~200ms later: Angular must NOT have reset them
                delay(200)
                val v2 = verifyCredentials(wv, u, p)
                if (v2.matriculaOk && v2.passwordOk && v2.canSubmit) {
                    Log.i(TAG, "LOGIN_FILL_VERIFIED attempt=${attempt + 1}")
                    return true
                }
            }
            delay(200)
        }
        return false
    }

    /** Guard final: both fields must still hold the exact credentials. */
    private suspend fun valuesStillPresent(wv: WebView, u: String, p: String): Boolean {
        val v = verifyCredentials(wv, u, p)
        return v.matriculaOk && v.passwordOk && v.canSubmit
    }

    data class FR(val ok: Boolean, val reason: String = "", val matriculaHasValue: Boolean = false, val passwordHasValue: Boolean = false)
    private suspend fun fillCredentials(wv: WebView, u: String, p: String): FR {
        val r = TuPerfilWebBridge.evaluateJs(wv, FILL_SCRIPT(org.json.JSONObject.quote(u), org.json.JSONObject.quote(p)))
        return TarjetonDigitalJson.parseObject(r)?.let { FR(it.optBoolean("ok"), it.optString("reason"), it.optBoolean("matriculaHasValue"), it.optBoolean("passwordHasValue")) } ?: FR(false)
    }

    data class VerifyResult(
        val matriculaOk: Boolean = false,
        val passwordOk: Boolean = false,
        val canSubmit: Boolean = false,
    )
    private suspend fun verifyCredentials(wv: WebView, u: String, p: String): VerifyResult {
        val r = TuPerfilWebBridge.evaluateJs(wv, VERIFY_SCRIPT(org.json.JSONObject.quote(u), org.json.JSONObject.quote(p)))
        return TarjetonDigitalJson.parseObject(r)?.let {
            VerifyResult(
                matriculaOk = it.optBoolean("matriculaOk"),
                passwordOk = it.optBoolean("passwordOk"),
                canSubmit = it.optBoolean("canSubmit"),
            )
        } ?: VerifyResult()
    }

    data class ClickResult(val ok: Boolean, val reason: String = "LOGIN_CLICK_FAILED")
    private suspend fun clickLogin(wv: WebView): ClickResult {
        val r = TarjetonDigitalJson.parseObject(TuPerfilWebBridge.evaluateJs(wv, CLICK_SCRIPT))
        return if (r?.optBoolean("ok") == true) ClickResult(ok = true)
        else ClickResult(ok = false, reason = r?.optString("reason") ?: "LOGIN_CLICK_FAILED")
    }

    private suspend fun getSnapshot(wv: WebView) = TarjetonDigitalJson.parseObject(TuPerfilWebBridge.evaluateJs(wv, SNAPSHOT_SCRIPT))?.let { LS(it.optBoolean("matriculaFound"), it.optBoolean("passwordFound")) } ?: LS()
    data class LS(val matriculaFound: Boolean = false, val passwordFound: Boolean = false)

    enum class AuthResult { SUCCESS, ERROR, TIMEOUT }
    data class LoginErrorInfo(val kind: PortalLoginErrorKind, val message: String?)

    /**
     * Polls until the user is authenticated, a portal error appears, or timeout.
     * Solo se aborta ante un error que PERSISTE varias muestras seguidas, para
     * descartar destellos transitorios o elementos ocultos.
     */
    private suspend fun awaitAuth(wv: WebView): Pair<AuthResult, LoginErrorInfo?> {
        var result: Pair<AuthResult, LoginErrorInfo?>? = null
        var errorStreak = 0
        var lastErrorKind: PortalLoginErrorKind? = null
        var lastErrorMessage: String? = null
        try {
            withTimeout(25_000L) {
                while (true) {
                    delay(500)
                    val p = TuPerfilWebBridge.evaluateJs(wv, "location.pathname")?.trim('"') ?: ""
                    if (p.startsWith("/guitpei-web/app")) {
                        result = AuthResult.SUCCESS to null
                        return@withTimeout
                    }
                    val raw = TuPerfilWebBridge.evaluateJs(wv, LOGIN_ERROR_SCRIPT)
                    val message = parseErrorText(raw)
                    val kind = classifyPortalError(message)
                    if (kind != null) {
                        if (kind == lastErrorKind && message == lastErrorMessage) {
                            errorStreak++
                        } else {
                            lastErrorKind = kind
                            lastErrorMessage = message
                            errorStreak = 1
                        }
                        if (errorStreak >= ERROR_PERSIST_SAMPLES) {
                            result = AuthResult.ERROR to LoginErrorInfo(kind, message)
                            return@withTimeout
                        }
                    } else {
                        errorStreak = 0
                        lastErrorKind = null
                        lastErrorMessage = null
                    }
                }
            }
        } catch (_: TimeoutCancellationException) {
            return AuthResult.TIMEOUT to null
        }
        return result ?: (AuthResult.TIMEOUT to null)
    }

    /** Extrae un string plano (JSON string) del resultado de evaluateJavascript. */
    private fun parseErrorText(raw: String?): String? {
        if (raw == null || raw == "null") return null
        return try {
            val v = org.json.JSONTokener(raw).nextValue()
            (v as? String)?.takeIf { it.isNotBlank() }
        } catch (e: Exception) { null }
    }

    /**
     * Clasifica el mensaje detectado en Tu Perfil IMSS. Devuelve null si no hay
     * mensaje o si no es un error real (evita falsos positivos con texto benigno).
     */
    private fun classifyPortalError(message: String?): PortalLoginErrorKind? {
        if (message.isNullOrBlank()) return null
        val m = normalizeMessage(message)
        fun has(vararg keys: String) = keys.any { m.contains(it) }
        return when {
            has("campo obligatorio", "campo requerido", "obligatorio", "requerido") ->
                PortalLoginErrorKind.FIELDS_REQUIRED
            has("contraseña incorrecta", "contrasena incorrecta", "usuario o contraseña incorrectos",
                "usuario o contraseña incorrecta", "credenciales incorrectas", "credenciales no validas",
                "no coinciden", "contraseña no valida", "datos incorrectos", "incorrecta. intente") ->
                PortalLoginErrorKind.BAD_CREDENTIALS
            has("bloqueada", "bloqueado", "no registrado", "usuario no existe", "cuenta desactivada",
                "intentos agotados", "cuenta suspendida") ->
                PortalLoginErrorKind.ACCOUNT_LOCKED_OR_UNREGISTERED
            has("servicio no disponible", "no disponible en este momento", "error interno",
                "intente mas tarde", "servicio temporalmente", "no pudimos") ->
                PortalLoginErrorKind.SERVICE_UNAVAILABLE
            else -> null
        }
    }

    private fun normalizeMessage(message: String): String =
        message.lowercase()
            .replace("á", "a").replace("é", "e").replace("í", "i")
            .replace("ó", "o").replace("ú", "u").replace("ü", "u").replace("ñ", "n")

    // ── JS scripts ─────────────────────────────────────────────────────────

    private fun FILL_SCRIPT(u: String, p: String) = """(function(){
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
var r1=setVal(m,$u);var r2=setVal(pw,$p);
return JSON.stringify({ok:r1&&r2,matriculaHasValue:m.value.length>0,passwordHasValue:pw.value.length>0})})()"""
    private fun VERIFY_SCRIPT(u: String, p: String) = """(function(){
var m=document.querySelector('#matricula');var pw=document.querySelector('#password');
if(!m||!pw)return JSON.stringify({matriculaOk:false,passwordOk:false,canSubmit:false});
var mOk=m.value===$u;var pOk=pw.value===$p;
var mHas=String(m.value||'').trim().length>0;var pHas=String(pw.value||'').length>0;
return JSON.stringify({matriculaOk:mOk,passwordOk:pOk,canSubmit:mHas&&pHas})})()"""
    private val CLICK_SCRIPT = """(function(){
function n(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}
var m=document.querySelector('#matricula');var pw=document.querySelector('#password');
if(m&&(!m.value||!String(m.value).trim()))return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_MATRICULA_EMPTY'});
if(pw&&!String(pw.value||''))return JSON.stringify({ok:false,reason:'DO_NOT_SUBMIT_PASSWORD_EMPTY'});
var b=Array.from(document.querySelectorAll('button.primary')).find(function(x){return n(x.textContent)==='iniciar sesion'});
if(!b)b=Array.from(document.querySelectorAll('button')).find(function(x){return n(x.textContent)==='iniciar sesion'});
if(!b)return JSON.stringify({ok:false,reason:'BUTTON_MISSING'});
if(b.disabled)return JSON.stringify({ok:false,reason:'BUTTON_DISABLED'});
b.click();return JSON.stringify({ok:true})})()"""
    private val SNAPSHOT_SCRIPT = """(function(){var m=document.querySelector('#matricula');var p=document.querySelector('#password');return JSON.stringify({matriculaFound:!!m,passwordFound:!!p})})()"""
    private val LOGIN_ERROR_SCRIPT = """(function(){
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
})()"""
}
