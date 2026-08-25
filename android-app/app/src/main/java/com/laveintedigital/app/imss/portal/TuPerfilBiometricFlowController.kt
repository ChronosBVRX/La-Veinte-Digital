package com.laveintedigital.app.imss.portal

import android.util.Log
import android.webkit.WebView
import com.laveintedigital.app.BuildConfig
import com.laveintedigital.app.imss.biometric.BiometricColumn
import com.laveintedigital.app.imss.biometric.BiometricDiscovery
import com.laveintedigital.app.imss.biometric.BiometricErrorKind
import com.laveintedigital.app.imss.biometric.BiometricFlowPolicy
import com.laveintedigital.app.imss.biometric.BiometricJson
import com.laveintedigital.app.imss.biometric.BiometricOoad
import com.laveintedigital.app.imss.biometric.BiometricPeriod
import com.laveintedigital.app.imss.biometric.BiometricQuerySnapshot
import com.laveintedigital.app.imss.biometric.BiometricQueryStatus
import com.laveintedigital.app.imss.biometric.BiometricRecord
import com.laveintedigital.app.imss.biometric.BiometricTrace
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.json.JSONArray
import org.json.JSONObject

/**
 * Controlador de la función "Registros biométricos" de Tu Perfil IMSS.
 *
 * Responsabilidades EXCLUSIVAS (la sesión es compartida, ver
 * [TuPerfilSessionController]):
 *  - abrir `/app/administration/biometric/consult-period`;
 *  - esperar el DOM de Angular (polling con timeout, no solo onPageFinished);
 *  - DESCUBRIR el portal real antes de automatizar: volcado estructural
 *    sanitizado, etapas de preparación (ROUTE/FORM/PERIOD_CONTROL/PERIOD_DATA),
 *    lectura de periodos con **start-una-vez + poll-estado** (`runId` único;
 *    nunca se reinyecta el IIFE async en cada poll) y monitor de red v2;
 *  - aplicar el periodo elegido (abrir → seleccionar → VERIFICAR con script
 *    independiente) y solo después consultar;
 *  - pulsar Consultar comprobando el botón REAL (volcado de botones DEBUG) y
 *    su efecto observable (spinner / petición / mutación DOM);
 *  - esperar resultados por condiciones terminales explícitas
 *    (results/empty/error/unauth); `waiting`/`loading` NUNCA son error y el
 *    timeout se pospone mientras haya actividad observable;
 *  - manejar sesión expirada (reautenticación acotada a 1 por operación);
 *  - fallback "formulario original", captura del estado manual y reporte de
 *    descubrimiento DEBUG.
 *
 * DIAGNÓSTICO (fase de consulta): cada paso registra su evidencia en DEBUG —
 * `applyPeriod controlFound/optionFound/clickPerformed/overlayClosed/
 * portalSelectionVerified`, `consult buttonFound/buttonEnabled/clickPerformed`,
 * `resultAttempt attempt=N status=… tables=… matRows=… cards=…` y `TIMELINE
 * submit+0ms XHR_START+… HTTP200+… DOM+… ROWS+…`. En DEBUG los mensajes de
 * error incluyen `Etapa:` y `Código:` para no colapsar todos los fallos en un
 * mismo texto; en release el detalle técnico desaparece.
 *
 * ANTIRACE: cada operación recibe una generación (`generation`); los resultados
 * de generaciones viejas se ignoran y los jobs viejos se cancelan. Las corridas
 * JS async huérfanas se detectan por `runId` y se abortan solas (`orphaned`).
 *
 * PRIVACIDAD: los registros SOLO viven en memoria durante la pantalla. Nunca
 * se guardan en Room/Supabase ni se loguean los datos personales.
 */
class TuPerfilBiometricFlowController(
    private val scope: CoroutineScope,
    private val context: android.content.Context,
) {
    companion object {
        /** Logs de flujo/estado: LVD_BIOMETRIC (sin datos personales). */
        private const val FLOW_TAG = "LVD_BIOMETRIC"

        /** Logs de diagnóstico estructural del DOM (DEBUG): ver BiometricDiscovery.DIAG_TAG. */
        const val TAG = "LVD_TU_PERFIL_BIOMETRIC"

        const val BIOMETRIC_URL = "https://tuperfil.imss.gob.mx/guitpei-web/app/administration/biometric/consult-period"

        /** Allowlist explícita de hosts válidos de Tu Perfil IMSS (incluye el redirect legítimo). */
        val ALLOWED_HOSTS = setOf("tuperfil.imss.gob.mx", "tpei.imss.gob.mx")

        private const val NAV_TIMEOUT_MS = 15_000L
        private const val DOM_TIMEOUT_MS = 15_000L
        private const val OOAD_BUDGET_MS = 15_000L
        private const val OOAD_APPLY_BUDGET_MS = 15_000L
        private const val REFRESH_BUDGET_MS = 12_000L
        private const val PERIODS_BUDGET_MS = 18_000L
        private const val MAX_DISCOVERY_ATTEMPTS = 2
        private const val MAX_OOAD_APPLY_ATTEMPTS = 2
        private const val APPLY_BUDGET_MS = 20_000L
        private const val MAX_APPLY_ATTEMPTS = 2
        private const val QUERY_TIMEOUT_MS = 35_000L
        private const val MAX_QUERY_BUDGET_MS = 90_000L
        private const val ACTIVITY_EXTEND_MS = 8_000L
        private const val ACTIVITY_SAMPLE_EVERY = 3
        private const val ERROR_PERSIST_SAMPLES = 3

        /**
         * Harness de verificación del descubrimiento (SOLO desarrollo).
         *
         * Con valor > 0, tras leer los periodos con éxito el controlador abre
         * y lee el selector N veces seguidas registrando `verifyPeriods OPEN #k
         * → N periodos` (evidencia de estabilidad pedida por la sesión de
         * descubrimiento). En producción DEBE quedar en 0 para no retrasar la
         * pantalla de selección.
         */
        private const val DISCOVERY_VERIFY_OPENS = 0
        private const val VERIFY_BUDGET_MS = 10_000L
    }

    val session = TuPerfilSessionController(scope, context)

    private val _state = MutableStateFlow<TuPerfilBiometricFlowState>(TuPerfilBiometricFlowState.CheckingSession)
    val state: StateFlow<TuPerfilBiometricFlowState> = _state.asStateFlow()

    var periods: List<BiometricPeriod> = emptyList()
        private set
    var selectedPeriod: BiometricPeriod? = null
    var ooads: List<BiometricOoad> = emptyList()
        private set
    var selectedOoad: BiometricOoad? = null
    var lastColumns: List<BiometricColumn> = emptyList()
        private set
    var lastRecords: List<BiometricRecord> = emptyList()
        private set
    var lastQueryPeriod: BiometricPeriod? = null
        private set

    private var openingJob: Job? = null
    private var queryJob: Job? = null
    private var reauthInProgress = false
    private var reauthCount = 0
    private var pendingPeriod: BiometricPeriod? = null

    /** Generación de operación: los resultados de generaciones viejas se ignoran. */
    private var generation = 0

    /**
     * Mapeo gen → operationId (`BIO#N`): cada generación nueva recibe un
     * operationId incremental e inequívoco para agrupar TODA la traza de una
     * misma consulta y distinguirla de callbacks/estados viejos del WebView.
     */
    private val genOps = mutableMapOf<Int, Int>()
    private var opSeq = 0

    /** Job del loop de observación manual (DEBUG; se cancela al salir). */
    private var manualObserveJob: Job? = null

    init {
        scope.launch {
            session.state.collect { auth -> handleSessionState(auth) }
        }
    }

    // ── Estado + logging de transiciones ───────────────────────────────────

    private fun setState(s: TuPerfilBiometricFlowState, gen: Int? = null) {
        _state.value = s
        val label = stateLabel(s)
        BiometricTrace.trace(opOf(gen), gen, label, "TRANSITION")
        Log.i(FLOW_TAG, "[${gen ?: "-"}] $label")
    }

    private fun stateLabel(s: TuPerfilBiometricFlowState): String = when (s) {
        is TuPerfilBiometricFlowState.CheckingSession -> "CheckingSession"
        is TuPerfilBiometricFlowState.LoginRequired -> "LoginRequired"
        is TuPerfilBiometricFlowState.Authenticating -> "Authenticating"
        is TuPerfilBiometricFlowState.OpeningBiometrics -> "OpeningBiometrics"
        is TuPerfilBiometricFlowState.WaitingBiometricDom -> "WaitingDom"
        is TuPerfilBiometricFlowState.ReadingOoads -> "ReadingOoads"
        is TuPerfilBiometricFlowState.ApplyingOoad -> "ApplyingOoad"
        is TuPerfilBiometricFlowState.WaitingPeriodsForOoad -> "WaitingPeriodsForOoad"
        is TuPerfilBiometricFlowState.ReadingPeriods -> "ReadingPeriods"
        is TuPerfilBiometricFlowState.PeriodSelection -> "PeriodSelection periods=${s.periods.size}"
        is TuPerfilBiometricFlowState.ApplyingPeriod -> "ApplyingPeriod"
        is TuPerfilBiometricFlowState.VerifyingPeriod -> "VerifyingPeriod"
        is TuPerfilBiometricFlowState.SubmittingQuery -> "SubmittingQuery"
        is TuPerfilBiometricFlowState.WaitingResults -> "WaitingResults"
        is TuPerfilBiometricFlowState.ReadingResults -> "ReadingResults"
        is TuPerfilBiometricFlowState.Results -> "Results records=${s.records.size}"
        is TuPerfilBiometricFlowState.Empty -> "Empty"
        is TuPerfilBiometricFlowState.Error -> "Error kind=${s.kind.name}"
        is TuPerfilBiometricFlowState.LoginError -> "LoginError kind=${s.kind.name}"
        is TuPerfilBiometricFlowState.SessionExpired -> "SessionExpired"
        is TuPerfilBiometricFlowState.ManualMode -> "ManualMode"
    }

    private fun newGeneration(): Int {
        val g = ++generation
        genOps[g] = ++opSeq
        return g
    }

    /** operationId (`BIO#N`) de la generación indicada. */
    private fun opOf(gen: Int?): Int? = gen?.let { genOps[it] }

    /**
     * Traza estructurada (LVD_BIOMETRIC_TRACE + buffer en memoria). Todos los
     * detalles deben estar SANITIZADOS (nunca datos personales).
     */
    private fun trace(
        gen: Int?,
        stage: String,
        event: String,
        result: Boolean? = null,
        details: String? = null,
        durationMs: Long? = null,
    ) {
        BiometricTrace.trace(opOf(gen), gen, stage, event, result, details, durationMs)
    }

    /** Evento FAILED de una etapa (stage + código granular). */
    private fun traceFailure(gen: Int?, stage: String, code: String) {
        BiometricTrace.trace(opOf(gen), gen, stage, "FAILED", result = false, details = "code=$code")
    }

    /** Entrada de red correlacionada (método+path+status+duration, sin cuerpos). */
    private fun traceNet(gen: Int?, method: String?, path: String?, status: Int?, durationMs: Long?) {
        BiometricTrace.trace(
            opOf(gen), gen, "NET", "XHR",
            result = status != null && status in 200..299,
            details = "method=${method ?: "?"} path=${path ?: "?"} status=${status ?: -1}",
            durationMs = durationMs,
        )
    }

    /** Reporte sanitizado listo para copiar (botón "Copiar diagnóstico"). */
    fun copyDiagnosticsReport(): String = BiometricTrace.copySanitizedReport()

    // ── API pública ────────────────────────────────────────────────────────

    fun attachWebView(wv: WebView) = session.attachWebView(wv)

    fun start() {
        newGeneration()
        setState(TuPerfilBiometricFlowState.CheckingSession)
        session.start()
    }

    fun loginWithCredentials(username: String, password: String, remember: Boolean) =
        session.loginWithCredentials(username, password, remember)

    fun retryLogin() = session.retryLogin()

    /** Muestra de nuevo el diálogo de login (tras "Revisar datos"). */
    fun reviewData() { setState(TuPerfilBiometricFlowState.LoginRequired) }

    /** Fallback: deja el formulario original del portal a la vista. */
    fun manualEntry() {
        queryJob?.cancel()
        openingJob?.cancel()
        manualObserveJob?.cancel()
        newGeneration()
        reauthCount = 0
        reauthInProgress = false
        setState(TuPerfilBiometricFlowState.ManualMode)
        session.reset()
        if (BuildConfig.DEBUG) scope.launch { captureManualEntryContext() }
    }

    /** Vuelve de "formulario original" a la experiencia nativa. */
    fun resumeAfterManual() {
        reauthCount = 0
        manualObserveJob?.cancel()
        newGeneration()
        if (BuildConfig.DEBUG) scope.launch { captureManualResultContext() }
        setState(TuPerfilBiometricFlowState.CheckingSession)
        session.start()
    }

    /** Sesión expirada definitiva: pedir credenciales de nuevo. */
    fun recoverFromExpired() {
        setState(TuPerfilBiometricFlowState.LoginRequired)
        session.manualEntry()
    }

    /** Selección NATIVA del trabajador (fase A, UI Compose). Se aplica al portal al consultar. */
    fun selectPeriod(period: BiometricPeriod) {
        selectedPeriod = period
        trace(null, "NATIVE_SELECTION", "PERIOD_SELECTED", result = true,
            details = "label=${period.label} valueLen=${period.value.length}")
        Log.i(FLOW_TAG, "selectedPeriod label=\"${period.label}\" valueLen=${period.value.length}")
    }

    fun consultar(period: BiometricPeriod) {
        if (queryJob?.isActive == true) return
        pendingPeriod = period
        selectedPeriod = period
        reauthCount = 0
        val gen = newGeneration()
        trace(gen, "NATIVE_SELECTION", "PERIOD_SELECTED", result = true,
            details = "label=${period.label} valueLen=${period.value.length}")
        Log.i(FLOW_TAG, "[$gen] selectedPeriod label=\"${period.label}\"")
        queryJob = scope.launch { runQuery(period, gen) }
    }

    /** Reintenta la consulta (errores de consulta). */
    fun retryQuery() {
        val p = pendingPeriod ?: lastQueryPeriod ?: return
        consultar(p)
    }

    /** Reintenta la apertura/lectura de periodos (errores de periodos/DOM). */
    fun retryOpenBiometrics() {
        openBiometricsAsync()
    }

    fun backToPeriodSelection() {
        setState(TuPerfilBiometricFlowState.PeriodSelection(periods))
    }

    // ── Guardar PDF de checadas (blob capturado del portal) ─────────────────

    /** Guarda el reporte PDF de checadas del periodo consultado (blob).
     * Devuelve la ruta local del PDF guardado, o null si no se guardó. */
    fun saveBiometricPdf(onResult: (String?) -> Unit) {
        scope.launch {
            try {
                val wv = session.awaitWebView()
                // 1) Asegura que el monitor de blobs PDF esté inyectado.
                ImssPdfCaptureCoordinator.injectPdfMonitor(wv)
                // 2) Click REAL sobre "Descargar" (dispatchTouchEvent) — el click
                //    sintético por evaluateJavascript NO dispara la descarga del blob.
                val target = NativeDomTapper.locate(wv, NativeDomTapper.DOWNLOAD_TAP_SELECTOR)
                if (!target.ok) {
                    // fallback: click sintético como última opción
                    TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.clickDownloadJs())
                } else {
                    NativeDomTapper.tap(wv, target)
                }
                // 3) Poll del buffer de blobs PDF hasta que llegue el reporte.
                var path: String? = null
                val periodLabel = lastQueryPeriod?.label
                for (attempt in 0 until 24) {
                    delay(500)
                    val savedPath = ImssPdfCaptureCoordinator.pollBiometricPdf(wv, context, periodLabel)
                    if (savedPath != null) { path = savedPath; break }
                }
                withContext(Dispatchers.Main) { onResult(path) }
            } catch (e: Exception) {
                Log.e(TAG, "SAVE_BIOMETRIC_PDF_FAILED", e)
                withContext(Dispatchers.Main) { onResult(null) }
            }
        }
    }

    // ── Mapeo sesión compartida → máquina biométricos ──────────────────────

    private fun handleSessionState(auth: TuPerfilSessionState) {
        if (_state.value is TuPerfilBiometricFlowState.ManualMode) return
        when (auth) {
            is TuPerfilSessionState.CheckingSession -> setState(TuPerfilBiometricFlowState.CheckingSession)
            is TuPerfilSessionState.LoginRequired -> setState(TuPerfilBiometricFlowState.LoginRequired)
            is TuPerfilSessionState.WaitingForm,
            is TuPerfilSessionState.FillingForm,
            is TuPerfilSessionState.VerifyingForm,
            is TuPerfilSessionState.SubmittingLogin,
            is TuPerfilSessionState.WaitingAuthentication -> setState(TuPerfilBiometricFlowState.Authenticating)
            is TuPerfilSessionState.LoginError -> setState(TuPerfilBiometricFlowState.LoginError(auth.kind, auth.portalMessage))
            is TuPerfilSessionState.Error -> setState(TuPerfilBiometricFlowState.Error(
                BiometricErrorKind.UNKNOWN,
                "No pudimos conectar con Tu Perfil IMSS. Inténtalo de nuevo.",
            ))
            is TuPerfilSessionState.Authenticated -> {
                if (reauthInProgress) return
                openBiometricsAsync()
            }
        }
    }

    private fun openBiometricsAsync(autoQueryPeriod: BiometricPeriod? = null) {
        openingJob?.cancel()
        val gen = newGeneration()
        openingJob = scope.launch { openBiometrics(autoQueryPeriod, gen) }
    }

    // ── Apertura de la sección biométricos ─────────────────────────────────

    private suspend fun openBiometrics(autoQueryPeriod: BiometricPeriod? = null, gen: Int = generation) {
        try {
            val wv = session.awaitWebView()
            val openStartedAt = System.currentTimeMillis()
            trace(gen, "OPEN", "START", result = true)
            setState(TuPerfilBiometricFlowState.OpeningBiometrics, gen)
            TuPerfilWebBridge.loadUrl(wv, BIOMETRIC_URL)

            // 1) Esperar la ruta de Angular (puede navegar sin onPageFinished).
            var onBiometricPath = false
            try {
                withTimeout(NAV_TIMEOUT_MS) {
                    while (true) {
                        if (gen != generation) return@withTimeout
                        delay(500)
                        val p = TuPerfilWebBridge.evaluateJs(wv, "location.pathname")?.trim('"') ?: ""
                        if (p.contains("/biometric/consult-period")) { onBiometricPath = true; return@withTimeout }
                        if (p.contains("/login")) {
                            Log.i(FLOW_TAG, "[$gen] redirectedToLogin")
                            trace(gen, "ROUTE", "REDIRECTED_TO_LOGIN", result = false)
                            setState(TuPerfilBiometricFlowState.SessionExpired, gen)
                            return@withTimeout
                        }
                    }
                }
            } catch (_: TimeoutCancellationException) {
                if (gen == generation) {
                    setState(TuPerfilBiometricFlowState.Error(
                        BiometricErrorKind.QUERY_TIMEOUT,
                        "Tu Perfil IMSS tardó demasiado en responder. Vuelve a intentarlo.",
                    ), gen)
                    traceFailure(gen, "ROUTE", "ROUTE_TIMEOUT")
                }
                return
            }
            if (gen != generation || !onBiometricPath) return

            // ROUTE_READY: ya estamos en la ruta real (no mientras navegamos).
            logReadiness(wv, gen, "ROUTE_READY")
            trace(gen, "ROUTE", "ROUTE_READY", result = true)

            // 2) Esperar el DOM reconocible.
            setState(TuPerfilBiometricFlowState.WaitingBiometricDom, gen)
            val domReady = waitBiometricDom(wv, gen)
            if (gen != generation) return
            if (!domReady) {
                setState(TuPerfilBiometricFlowState.Error(
                    BiometricErrorKind.DOM_NOT_RECOGNIZED,
                    "No pudimos reconocer el formulario de Biométricos. Es posible que Tu Perfil IMSS haya actualizado esta sección.",
                ), gen)
                traceFailure(gen, "FORM", "DOM_NOT_RECOGNIZED")
                return
            }

            // FORM_READY / PERIOD_CONTROL_READY: evidencia separada del DOM.
            logReadiness(wv, gen, "FORM_READY")
            trace(gen, "FORM", "FORM_READY", result = true)

            // 3) Diagnóstico estructural + clasificación de selectores + monitores (SOLO DEBUG, sanitizado).
            dumpBiometricDiagnostics(wv)
            if (BuildConfig.DEBUG) logClassifyControls(wv, gen)
            injectMonitors(wv)

            // 3b) OOAD PRIMERO: el formulario real requiere seleccionar la OOAD
            // (17 — Michoacán) y esperar a que Angular repueble Periodo. NO se
            // leen periodos antes de aplicar OOAD: el selector de Periodo es
            // dependiente y las opciones previas quedarían obsoletas.
            setState(TuPerfilBiometricFlowState.ReadingOoads, gen)
            if (!readOoads(wv, gen)) return

            setState(TuPerfilBiometricFlowState.ApplyingOoad, gen)
            if (!applyOoadGuarded(wv, gen)) return

            setState(TuPerfilBiometricFlowState.WaitingPeriodsForOoad, gen)
            if (!waitPeriodsRefresh(wv, gen)) {
                setState(TuPerfilBiometricFlowState.Error(
                    BiometricErrorKind.PERIODS_NOT_READABLE,
                    errorMessage("Tras seleccionar la OOAD, Tu Perfil IMSS no cargó los periodos. Vuelve a intentarlo.", "WAIT_PERIODS", "PERIOD_REFRESH_TIMEOUT"),
                ), gen)
                traceFailure(gen, "WAIT_PERIODS", "PERIOD_REFRESH_TIMEOUT")
                return
            }

            // 4) Descubrir periodos reales (DESPUÉS de la OOAD + refresh).
            setState(TuPerfilBiometricFlowState.ReadingPeriods, gen)
            if (!readPeriods(wv, gen)) return

            // PERIOD_DATA_READY queda demostrado por el éxito del descubrimiento.
            Log.i(FLOW_TAG, "[$gen] PERIOD_DATA_READY periods=${periods.size}")
            trace(gen, "OPEN", "OK", result = true, durationMs = System.currentTimeMillis() - openStartedAt)

            // 5) ¿Recuperación post-sesión-expirada? → restaurar periodo y consultar.
            val target = autoQueryPeriod?.let { BiometricFlowPolicy.restorePeriod(periods, it) }
            if (target != null && gen == generation) {
                runQuery(target, gen)
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "OPEN_BIOMETRICS_FAILED", e)
            if (gen == generation) {
                setState(TuPerfilBiometricFlowState.Error(
                    BiometricErrorKind.UNKNOWN,
                    "No pudimos abrir Registros biométricos.",
                ), gen)
                traceFailure(gen, "OPEN", "INTERNAL")
            }
        }
    }

    private suspend fun waitBiometricDom(wv: WebView, gen: Int): Boolean {
        var ready = false
        try {
            withTimeout(DOM_TIMEOUT_MS) {
                while (true) {
                    if (gen != generation) return@withTimeout
                    delay(400)
                    val j = TarjetonDigitalJson.parseObject(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.domReadyJs())) ?: continue
                    if (j.optBoolean("ready")) { ready = true; return@withTimeout }
                }
            }
        } catch (_: TimeoutCancellationException) {}
        return ready && gen == generation
    }

    // ── Descubrimiento de periodos: START-UNA-VEZ + POLL-ESTADO ────────────

    /**
     * Descubre los periodos reales del portal.
     *
     * Por intento se inyecta `startDiscoveryJs(runId)` UNA sola vez (IIFE
     * async con contrato `{status:"working"|"success"|"error", runId, ...}`).
     * Kotlin SOLO hace polling del estado con `readDiscoveryStateJs()`:
     * `working`/`missing` nunca se interpretan como fallo (Angular puede
     * hidratar las opciones después). Al agotar intentos/presupuesto se
     * clasifica el fallo (selector no encontrado / selector vacío / timeout).
     */
    private suspend fun readPeriods(wv: WebView, gen: Int): Boolean {
        val startedAt = System.currentTimeMillis()
        var attempt = 0
        var lastFailure: BiometricFlowPolicy.PeriodsFailure? = null

        while (attempt < MAX_DISCOVERY_ATTEMPTS && System.currentTimeMillis() - startedAt < PERIODS_BUDGET_MS) {
            if (gen != generation) return false
            attempt++
            val runId = "gen$gen-att$attempt"

            // 1) START: limpiar el global y arrancar la corrida async UNA vez.
            TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_DISCOVERY__=null;")
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.startDiscoveryJs(runId))

            // 2) POLL: leer SOLO el estado hasta success/error/presupuesto.
            var finalState: JSONObject? = null
            while (finalState == null && System.currentTimeMillis() - startedAt < PERIODS_BUDGET_MS) {
                if (gen != generation) return false
                delay(400)
                val p = TuPerfilWebBridge.evaluateJs(wv, "location.pathname")?.trim('"') ?: ""
                if (p.contains("/login")) {
                    setState(TuPerfilBiometricFlowState.SessionExpired, gen)
                    return false
                }
                val raw = TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readDiscoveryStateJs())
                val j = TarjetonDigitalJson.parseObject(raw) ?: continue
                val status = j.optString("status")
                if (status == "success" || status == "error") finalState = j
            }
            if (gen != generation) return false

            if (finalState == null) { lastFailure = BiometricFlowPolicy.PeriodsFailure.TIMEOUT; break }

            if (finalState.optString("status") == "success") {
                val list = BiometricJson.parsePeriodArray(finalState.optJSONArray("periods"))
                if (BuildConfig.DEBUG) logDiscoveryAttempt(gen, attempt, finalState, list.size)
                if (list.isNotEmpty()) {
                    periods = list
                    selectedPeriod = BiometricFlowPolicy.defaultPeriod(list)
                    Log.i(FLOW_TAG, "[$gen] PeriodSelection periods=${list.size}")
                    trace(gen, "PERIODS", "DISCOVERED", result = true,
                        details = "count=${list.size} samples=${list.take(3).joinToString(" | ") { it.label }.take(120)}",
                        durationMs = System.currentTimeMillis() - startedAt)
                    val pc = finalState.optJSONObject("control")
                    if (pc != null) {
                        trace(gen, "PERIODS", "CONTROL_INFO",
                            details = "tag=${pc.optString("tag")} id=${pc.optString("id")} " +
                                "formcontrolname=${pc.optString("formcontrolname")} label=${pc.optString("label")} evidence=${pc.optString("evidence")}")
                    }
                    if (BuildConfig.DEBUG) {
                        logPeriodsDiscoveryReport(gen, finalState, wv)
                        runDiscoveryVerification(wv, gen)
                    }
                    TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.closeOverlayJs())
                    setState(TuPerfilBiometricFlowState.PeriodSelection(list), gen)
                    return true
                }
                lastFailure = BiometricFlowPolicy.PeriodsFailure.EMPTY_OPTIONS
            } else {
                val reason = finalState.optString("reason", "")
                if (BuildConfig.DEBUG) Log.w(FLOW_TAG, "[$gen] readPeriods attempt=$attempt error reason=$reason")
                lastFailure = when {
                    reason.contains("CONTROL_NOT_FOUND") -> BiometricFlowPolicy.PeriodsFailure.CONTROL_NOT_FOUND
                    reason.contains("NO_PERIOD_OPTIONS") -> BiometricFlowPolicy.PeriodsFailure.EMPTY_OPTIONS
                    else -> BiometricFlowPolicy.PeriodsFailure.TIMEOUT
                }
            }
            // El presupuesto sigue: el portal pudo cargar las quincenas mientras tanto.
        }

        val kind = BiometricFlowPolicy.periodsFailureKind(lastFailure)
        val code = when (kind) {
            BiometricErrorKind.DOM_NOT_RECOGNIZED -> "PERIOD_CONTROL_NOT_FOUND"
            BiometricErrorKind.PERIODS_NOT_READABLE -> "PERIOD_OPTIONS_EMPTY"
            else -> "PERIODS_TIMEOUT"
        }
        val message = when (kind) {
            BiometricErrorKind.DOM_NOT_RECOGNIZED ->
                "No pudimos reconocer el formulario de Biométricos. Es posible que Tu Perfil IMSS haya actualizado esta sección."
            BiometricErrorKind.PERIODS_NOT_READABLE ->
                "Tu Perfil IMSS no mostró periodos disponibles. Vuelve a intentarlo."
            else ->
                "Tu Perfil IMSS tardó demasiado en responder. Vuelve a intentarlo."
        }
        setState(TuPerfilBiometricFlowState.Error(kind, message), gen)
        traceFailure(gen, "PERIODS", code)
        return false
    }

    // ── OOAD (17 — Michoacán): pre-requisito del selector de Periodo ────────

    /**
     * Descubre el control REAL de OOAD y sus opciones (start-una-vez +
     * poll-estado, mismo patrón que la lectura de periodos). Resuelve 17 —
     * Michoacán por valor real del portal (respaldo: label "michoacan"),
     * nunca por posición. NO continúa si Michoacán no está disponible.
     */
    private suspend fun readOoads(wv: WebView, gen: Int): Boolean {
        val startedAt = System.currentTimeMillis()
        var attempt = 0
        var lastReason = ""
        while (attempt < MAX_DISCOVERY_ATTEMPTS && System.currentTimeMillis() - startedAt < OOAD_BUDGET_MS) {
            if (gen != generation) return false
            attempt++
            val runId = "ooad-gen$gen-att$attempt"
            TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_OOAD_READ__=null;")
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.startOoadReadJs(runId))

            var finalState: JSONObject? = null
            while (finalState == null && System.currentTimeMillis() - startedAt < OOAD_BUDGET_MS) {
                if (gen != generation) return false
                delay(400)
                val raw = TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readOoadStateJs())
                val j = TarjetonDigitalJson.parseObject(raw) ?: continue
                val status = j.optString("status")
                if (status == "success" || status == "error") finalState = j
            }
            if (gen != generation) return false
            if (finalState == null) break

            if (finalState.optString("status") == "success") {
                val list = BiometricJson.parseOoads(finalState.optJSONArray("ooads"))
                if (list.isNotEmpty()) {
                    val resolved = BiometricFlowPolicy.selectOoad(list)
                    if (resolved != null) {
                        ooads = list
                        selectedOoad = resolved
                        trace(gen, "OOAD", "READ", result = true,
                            details = "count=${list.size} resolved=\"${resolved.value}/${resolved.label}\"",
                            durationMs = System.currentTimeMillis() - startedAt)
                        val oc = finalState.optJSONObject("control")
                        if (oc != null) {
                            trace(gen, "OOAD", "CONTROL_INFO",
                                details = "tag=${oc.optString("tag")} id=${oc.optString("id")} " +
                                    "formcontrolname=${oc.optString("formcontrolname")} label=${oc.optString("label")} evidence=${oc.optString("evidence")}")
                        }
                        if (BuildConfig.DEBUG) {
                            Log.i(FLOW_TAG, "[$gen] readOoads attempt=$attempt result=ok count=${list.size} resolved=\"${resolved.label}\" value=\"${resolved.value}\"")
                            logOoadsDiscoveryReport(gen, finalState, resolved)
                        }
                        TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.closeOverlayJs())
                        return true
                    }
                    // Las opciones existen pero 17/Michoacán no está → no continuar.
                    trace(gen, "OOAD", "READ", result = false, details = "count=${list.size} code=OOAD_NOT_RESOLVED")
                    setState(TuPerfilBiometricFlowState.Error(
                        BiometricErrorKind.OOAD_NOT_READABLE,
                        errorMessage("No encontramos la opción 17 — Michoacán en el selector de OOAD del portal. Revisa el volcado BIOMETRIC_DUMP.", "READ_OOADS", "OOAD_NOT_RESOLVED"),
                    ), gen)
                    traceFailure(gen, "READ_OOADS", "OOAD_NOT_RESOLVED")
                    return false
                }
                lastReason = "OOAD_OPTIONS_EMPTY"
            } else {
                lastReason = finalState.optString("reason", "")
                if (BuildConfig.DEBUG) Log.w(FLOW_TAG, "[$gen] readOoads attempt=$attempt error reason=$lastReason")
            }
            // El presupuesto sigue: Angular pudo terminar de hidratar mientras tanto.
        }

        val code = when {
            lastReason.contains("OOAD_CONTROL_NOT_FOUND") -> "OOAD_CONTROL_NOT_FOUND"
            lastReason.contains("OOAD_OPTIONS_EMPTY") -> "OOAD_OPTIONS_EMPTY"
            else -> "OOAD_TIMEOUT"
        }
        val message = when (code) {
            "OOAD_CONTROL_NOT_FOUND" ->
                "No encontramos el selector de OOAD (delegación) en el formulario de Biométricos. Es posible que Tu Perfil IMSS haya actualizado esta sección."
            "OOAD_OPTIONS_EMPTY" ->
                "El portal no mostró delegaciones disponibles en el selector de OOAD. Vuelve a intentarlo."
            else ->
                "Tu Perfil IMSS tardó demasiado en cargar el selector de OOAD. Vuelve a intentarlo."
        }
        setState(TuPerfilBiometricFlowState.Error(
            BiometricErrorKind.OOAD_NOT_READABLE,
            errorMessage(message, "READ_OOADS", code),
        ), gen)
        traceFailure(gen, "READ_OOADS", code)
        return false
    }

    /**
     * Aplica la OOAD preferida (17 — Michoacán) al control REAL y la verifica
     * con script independiente. Usada tanto en la apertura como en la
     * recuperación `WRONG_OOAD` de la consulta.
     */
    private suspend fun applyOoadGuarded(wv: WebView, gen: Int): Boolean {
        val applied = applyOoadOnce(wv, gen) ?: return false
        if (applied.success) return true

        val code = when {
            !applied.controlFound -> "OOAD_CONTROL_NOT_FOUND"
            (applied.reason ?: "").contains("OOAD_OPTIONS_EMPTY") -> "OOAD_OPTIONS_EMPTY"
            !applied.optionFound -> "OOAD_OPTION_NOT_FOUND"
            else -> "OOAD_NOT_VERIFIED"
        }
        setState(TuPerfilBiometricFlowState.Error(
            BiometricErrorKind.OOAD_REJECTED,
            errorMessage("No pudimos seleccionar la OOAD 17 — Michoacán en el portal. Vuelve a intentarlo.", "APPLY_OOAD", code),
        ), gen)
        traceFailure(gen, "APPLY_OOAD", code)
        return false
    }

    private data class OoadApplyOutcome(
        val success: Boolean,
        val controlFound: Boolean,
        val overlayOpened: Boolean?,
        val optionCount: Int?,
        val optionFound: Boolean,
        val clickPerformed: Boolean,
        val overlayClosed: Boolean,
        val verified: Boolean,
        val reason: String?,
    )

    private suspend fun applyOoadOnce(wv: WebView, gen: Int): OoadApplyOutcome? {
        val ooad = selectedOoad
            ?: BiometricOoad(BiometricFlowPolicy.DEFAULT_OOAD_VALUE, BiometricFlowPolicy.DEFAULT_OOAD_LABEL)
        val startedAt = System.currentTimeMillis()
        var attempt = 0
        var lastReason = ""
        var controlFound = false
        var overlayOpened: Boolean? = null
        var optionCount: Int? = null
        var optionFound = false
        var clickPerformed = false
        var overlayClosed = false

        while (attempt < MAX_OOAD_APPLY_ATTEMPTS && System.currentTimeMillis() - startedAt < OOAD_APPLY_BUDGET_MS) {
            if (gen != generation) return null
            attempt++
            TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_OOAD_APPLY_RESULT__=null;window.__LVD_BIO_OOAD_APPLY_RUNNING__=false;")
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.applyOoadJs(ooad.value, ooad.label))

            var result: JSONObject? = null
            while (result == null && System.currentTimeMillis() - startedAt < OOAD_APPLY_BUDGET_MS) {
                if (gen != generation) return null
                delay(300)
                result = TarjetonDigitalJson.parseObject(TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_OOAD_APPLY_RESULT__"))
            }
            if (result == null) { lastReason = "TIMEOUT"; break }
            val detail = BiometricDiscovery.parseApplyDetail(TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_OOAD_APPLY_RESULT__"))
            controlFound = detail?.controlFound == true
            overlayOpened = detail?.overlayOpened
            optionCount = detail?.optionCount
            optionFound = detail?.optionFound == true
            clickPerformed = detail?.clickPerformed == true
            overlayClosed = detail?.overlayClosed == true
            lastReason = result.optString("reason", "")

            trace(gen, "OOAD", "CONTROL_FOUND", result = controlFound)
            trace(gen, "OOAD", "OVERLAY_OPENED", result = overlayOpened)
            if (optionCount != null) {
                trace(gen, "OOAD", "OPTIONS", result = optionCount > 0, details = "count=$optionCount")
            }
            trace(gen, "OOAD", "OPTION_FOUND", result = optionFound)
            trace(gen, "OOAD", "CLICK", result = clickPerformed)
            trace(gen, "OOAD", "OVERLAY_CLOSED", result = overlayClosed)

            if (result.optBoolean("ok")) {
                val verify = BiometricDiscovery.parseVerifyDetail(
                    TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.verifyOoadJs(ooad.value, ooad.label)))
                val verified = verify?.found == true && verify?.expectedMatch == true
                trace(gen, "OOAD", "VERIFIED", result = verified,
                    details = "displayText=${verify?.displayText ?: ""}",
                    durationMs = System.currentTimeMillis() - startedAt)
                if (BuildConfig.DEBUG) {
                    Log.i(FLOW_TAG,
                        "applyOoad controlFound=$controlFound overlayOpened=$overlayOpened optionCount=$optionCount optionFound=$optionFound clickPerformed=$clickPerformed " +
                            "overlayClosed=$overlayClosed ooadVerified=$verified displayText=\"${verify?.displayText ?: ""}\" overlayOpen=${verify?.overlayOpen}")
                }
                if (verified) {
                    Log.i(FLOW_TAG, "[$gen] applyOoad success=true attempt=$attempt ooadValue=\"${ooad.value}\" ooadLabel=\"${ooad.label}\"")
                    TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.closeOverlayJs())
                    return OoadApplyOutcome(true, controlFound, overlayOpened, optionCount, optionFound, clickPerformed, overlayClosed, true, null)
                }
                lastReason = "OOAD_NOT_VERIFIED"
            } else if (BuildConfig.DEBUG && (lastReason.contains("OOAD_OPTION_NOT_FOUND") || lastReason.contains("OOAD_OPTIONS_EMPTY"))) {
                logAvailableOptions("AVAILABLE OOADS", detail?.availableLabels.orEmpty())
            }
            Log.w(FLOW_TAG, "[$gen] applyOoad attempt=$attempt reason=$lastReason")
        }
        Log.w(FLOW_TAG, "[$gen] applyOoad success=false reason=$lastReason")
        return OoadApplyOutcome(false, controlFound, overlayOpened, optionCount, optionFound, clickPerformed, overlayClosed, false, lastReason)
    }

    /**
     * Espera a que Angular repueble el selector de Periodo tras la OOAD:
     * condiciones `control encontrado AND options > 0 AND loading == false`
     * (start-una-vez + poll-estado, sin delays fijos). Correlaciona la
     * petición que trae los periodos (OOAD_NET).
     */
    private suspend fun waitPeriodsRefresh(wv: WebView, gen: Int): Boolean {
        val startedAt = System.currentTimeMillis()
        var attempt = 0
        while (attempt < MAX_DISCOVERY_ATTEMPTS && System.currentTimeMillis() - startedAt < REFRESH_BUDGET_MS) {
            if (gen != generation) return false
            attempt++
            val runId = "refresh-gen$gen-att$attempt"
            TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_PERIOD_REFRESH__=null;")
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.startPeriodRefreshJs(runId))

            var finalState: JSONObject? = null
            while (finalState == null && System.currentTimeMillis() - startedAt < REFRESH_BUDGET_MS) {
                if (gen != generation) return false
                delay(400)
                val raw = TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readPeriodRefreshStateJs())
                val j = TarjetonDigitalJson.parseObject(raw) ?: continue
                val status = j.optString("status")
                if (status == "success" || status == "error") finalState = j
            }
            if (gen != generation) return false
            if (finalState == null) break

            if (finalState.optString("status") == "success") {
                val count = finalState.optInt("count", -1)
                trace(gen, "WAIT_PERIODS", "REFRESH_OK", result = true,
                    details = "control=${finalState.optBoolean("controlFound")} count=$count loading=${finalState.optBoolean("loading")}",
                    durationMs = System.currentTimeMillis() - startedAt)
                if (BuildConfig.DEBUG) {
                    logPeriodRefreshNet(wv, startedAt, gen)
                    Log.i(FLOW_TAG,
                        "[$gen] waitingPeriodRefresh=true periodControlFound=true periodCount=$count loading=${finalState.optBoolean("loading")}")
                } else {
                    Log.i(FLOW_TAG, "[$gen] waitingPeriodRefresh=true periodCount=$count")
                }
                return true
            }
            val reason = finalState.optString("reason", "")
            if (BuildConfig.DEBUG) Log.w(FLOW_TAG, "[$gen] waitPeriodsRefresh attempt=$attempt error reason=$reason")
        }
        Log.w(FLOW_TAG, "[$gen] waitPeriodsRefresh success=false")
        return false
    }

    /**
     * Pre-check de la consulta: OOAD actual == 17 Michoacán. Si no, vuelve a
     * `ApplyingOoad` + refresh (WRONG_OOAD). `applyPeriod()` SOLO comienza
     * desde un estado conocido.
     */
    private suspend fun ensureOoadReady(wv: WebView, gen: Int): Boolean {
        val ooad = selectedOoad
            ?: BiometricOoad(BiometricFlowPolicy.DEFAULT_OOAD_VALUE, BiometricFlowPolicy.DEFAULT_OOAD_LABEL)
        val status = BiometricDiscovery.parseOoadStatus(
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.ooadStatusJs(ooad.value, ooad.label)))
        if (status?.found == true && status.isDefault == true) {
            trace(gen, "OOAD", "VERIFIED", result = true, details = "displayText=${status.displayText ?: ""}")
            if (BuildConfig.DEBUG) {
                Log.i(FLOW_TAG, "ensureOoad ok=true displayText=\"${status.displayText ?: ""}\"")
            }
            return true
        }
        trace(gen, "APPLY_OOAD", "WRONG_OOAD", result = false,
            details = "found=${status?.found} isDefault=${status?.isDefault}")
        Log.i(FLOW_TAG, "ensureOoad ok=false → ApplyingOoad (WRONG_OOAD o ausente)")
        setState(TuPerfilBiometricFlowState.ApplyingOoad, gen)
        if (!applyOoadGuarded(wv, gen)) return false
        setState(TuPerfilBiometricFlowState.WaitingPeriodsForOoad, gen)
        if (!waitPeriodsRefresh(wv, gen)) {
            setState(TuPerfilBiometricFlowState.Error(
                BiometricErrorKind.OOAD_REJECTED,
                errorMessage("Tras restablecer la OOAD, el portal no recargó los periodos. Vuelve a intentarlo.", "APPLY_OOAD", "PERIOD_REFRESH_TIMEOUT"),
            ), gen)
            traceFailure(gen, "APPLY_OOAD", "PERIOD_REFRESH_TIMEOUT")
            return false
        }
        return true
    }

    // ── Consulta (fases separadas: APPLY → VERIFY → SUBMIT → WAIT) ─────────

    private data class ApplyOutcome(
        val success: Boolean,
        val controlFound: Boolean,
        val overlayOpened: Boolean?,
        val optionCount: Int?,
        val optionFound: Boolean,
        val clickPerformed: Boolean,
        val overlayClosed: Boolean,
        val verified: Boolean,
        val reason: String?,
        val ooadVerified: Boolean?,
        val ooadText: String?,
        val availableLabels: List<String>,
    )

    private sealed interface QueryOutcome {
        data class Rows(
            val snapshot: BiometricQuerySnapshot,
            val countsLog: String?,
            val startedAt: Long,
            val rowsDetectedAt: Long,
        ) : QueryOutcome
        data class Empty(val snapshot: BiometricQuerySnapshot) : QueryOutcome
        data class PortalError(val snapshot: BiometricQuerySnapshot) : QueryOutcome
        data class Timeout(
            val startedAt: Long,
            val activitySeen: Boolean,
            val requestSeen: Boolean,
            val spinnerSeen: Boolean,
        ) : QueryOutcome
        data object SessionExpired : QueryOutcome
        data object Stale : QueryOutcome
    }

    private suspend fun runQuery(period: BiometricPeriod, gen: Int) {
        try {
            val wv = session.awaitWebView()
            lastQueryPeriod = period
            val queryStartedAt = System.currentTimeMillis()
            trace(gen, "QUERY", "START", result = true, details = "period=${period.label}")

            // 1) OOAD PRIMERO: `applyPeriod()` debe comenzar desde un estado
            // conocido (OOAD 17 verificada). Nunca se pulsa Consultar sin eso.
            setState(TuPerfilBiometricFlowState.ApplyingPeriod, gen)
            if (!ensureOoadReady(wv, gen)) return

            // 2) APPLY: aplicar periodo al control REAL (abrir → seleccionar → click).
            val applied = applyPeriod(wv, period, gen)
            if (gen != generation) return
            if (!applied.success) {
                val reason = applied.reason ?: ""
                val code = when {
                    reason.contains("WRONG_OOAD") -> "WRONG_OOAD"
                    !applied.controlFound -> "PERIOD_CONTROL_NOT_FOUND"
                    reason.contains("PERIOD_OPTIONS_EMPTY") -> "PERIOD_OPTIONS_EMPTY"
                    !applied.optionFound -> "PERIOD_OPTION_NOT_FOUND"
                    else -> "PERIOD_NOT_VERIFIED"
                }
                if (BuildConfig.DEBUG) logApplyPeriodDiagnostics(applied, period)
                setState(TuPerfilBiometricFlowState.Error(
                    BiometricErrorKind.QUERY_REJECTED,
                    errorMessage("No pudimos seleccionar el periodo en el portal. Vuelve a intentarlo.", "APPLY_PERIOD", code),
                ), gen)
                traceFailure(gen, "APPLY_PERIOD", code)
                return
            }

            // 2) SUBMIT: pulsar Consultar (solo con el periodo verificado).
            setState(TuPerfilBiometricFlowState.SubmittingQuery, gen)
            val consultResult = clickConsult(wv, gen)
            if (gen != generation) return
            val clickedOk = consultResult?.optBoolean("ok") == true
            if (BuildConfig.DEBUG) {
                Log.i(FLOW_TAG,
                    "consult buttonFound=${consultResult != null} buttonText=\"${consultResult?.optString("text") ?: ""}\" " +
                        "buttonEnabled=${consultResult?.optBoolean("enabled") ?: false} clickPerformed=$clickedOk " +
                        "reason=${consultResult?.optString("reason") ?: ""}")
            }
            trace(gen, "SUBMIT", "DONE", result = clickedOk,
                details = "buttonFound=${consultResult != null} buttonText=${consultResult?.optString("text") ?: ""} " +
                    "buttonEnabled=${consultResult?.optBoolean("enabled") ?: false} reason=${consultResult?.optString("reason") ?: ""}")
            if (!clickedOk) {
                val code = if ((consultResult?.optString("reason") ?: "").contains("DISABLED")) "CONSULT_BUTTON_DISABLED" else "CONSULT_BUTTON_NOT_FOUND"
                setState(TuPerfilBiometricFlowState.Error(
                    BiometricErrorKind.QUERY_REJECTED,
                    errorMessage("No encontramos el botón de consulta. Es posible que el portal haya cambiado.", "SUBMIT_QUERY", code),
                ), gen)
                traceFailure(gen, "SUBMIT_QUERY", code)
                return
            }

            // 3) WAIT: esperar resultados por condiciones terminales.
            setState(TuPerfilBiometricFlowState.WaitingResults, gen)
            startObserveResults(wv, gen)
            when (val outcome = awaitResults(wv, gen, queryStartedAt)) {
                is QueryOutcome.Rows -> {
                    if (gen != generation) return
                    setState(TuPerfilBiometricFlowState.ReadingResults, gen)
                    lastColumns = outcome.snapshot.columns
                    lastRecords = outcome.snapshot.rows
                    Log.i(FLOW_TAG, "[$gen] state=ReadingResults ${outcome.countsLog ?: ""} emptyMessage=false errorMessage=false")
                    trace(gen, "RESULTS", "DETECTED", result = true,
                        details = "rows=${outcome.snapshot.rows.size} columns=${outcome.snapshot.columns.size} " +
                            "headers=${outcome.snapshot.columns.joinToString(",") { it.label }.take(100)}",
                        durationMs = outcome.rowsDetectedAt - queryStartedAt)
                    if (BuildConfig.DEBUG) {
                        logQueryTimeline(wv, outcome.startedAt, outcome.rowsDetectedAt, gen)
                        logDownloadDiscovery(wv, gen)
                    }
                    setState(TuPerfilBiometricFlowState.Results(period, lastRecords), gen)
                    reauthCount = 0
                }
                is QueryOutcome.Empty -> {
                    if (gen != generation) return
                    Log.i(FLOW_TAG, "[$gen] state=ReadingResults emptyMessage=true")
                    trace(gen, "RESULTS", "DETECTED", result = true, details = "status=empty")
                    if (BuildConfig.DEBUG) {
                        logQueryTimeline(wv, queryStartedAt, null, gen)
                        logDownloadDiscovery(wv, gen)
                    }
                    setState(TuPerfilBiometricFlowState.Empty(period), gen)
                    reauthCount = 0
                }
                is QueryOutcome.PortalError -> {
                    if (gen != generation) return
                    Log.i(FLOW_TAG, "[$gen] state=ReadingResults errorMessage=true")
                    trace(gen, "RESULTS", "PORTAL_ERROR", result = false, details = "message=${outcome.snapshot.errorMessage?.take(80)}")
                    if (BuildConfig.DEBUG) {
                        logQueryTimeline(wv, queryStartedAt, null, gen)
                        traceJsErrors(wv, gen)
                    }
                    setState(TuPerfilBiometricFlowState.Error(
                        BiometricErrorKind.RESULT_NOT_RECOGNIZED,
                        errorMessage(
                            "Tu Perfil IMSS respondió de forma inesperada. Puedes reintentar o abrir el formulario original.",
                            "WAIT_RESULTS", "PORTAL_ERROR"),
                    ), gen)
                    traceFailure(gen, "WAIT_RESULTS", "PORTAL_ERROR")
                }
                is QueryOutcome.Timeout -> {
                    if (gen != generation) return
                    val code = if (!outcome.requestSeen && !outcome.activitySeen) "RESULT_TIMEOUT_NO_ACTIVITY" else "RESULT_TIMEOUT"
                    if (BuildConfig.DEBUG) {
                        Log.w(FLOW_TAG, "[$gen] TIMEOUT activitySeen=${outcome.activitySeen} requestSeen=${outcome.requestSeen} spinnerSeen=${outcome.spinnerSeen}")
                        logQueryTimeline(wv, outcome.startedAt, null, gen)
                        traceJsErrors(wv, gen)
                    }
                    setState(TuPerfilBiometricFlowState.Error(
                        BiometricErrorKind.QUERY_TIMEOUT,
                        errorMessage("Tu Perfil IMSS tardó demasiado en responder. Vuelve a intentarlo.", "WAIT_RESULTS", code),
                    ), gen)
                    traceFailure(gen, "WAIT_RESULTS", code)
                }
                is QueryOutcome.SessionExpired -> {
                    Log.i(FLOW_TAG, "[$gen] sessionExpired reauthCount=$reauthCount")
                    if (gen != generation) return
                    trace(gen, "WAIT_RESULTS", "SESSION_EXPIRED", result = false)
                    if (BiometricFlowPolicy.canReauth(reauthCount)) {
                        reauthCount++
                        setState(TuPerfilBiometricFlowState.Authenticating, gen)
                        reauthInProgress = true
                        try {
                            val reauthed = session.reauthenticate()
                            if (reauthed) {
                                // Restaurar periodo si sigue disponible y continuar.
                                openBiometricsAsync(autoQueryPeriod = period)
                            } else {
                                setState(TuPerfilBiometricFlowState.SessionExpired, gen)
                            }
                        } finally {
                            reauthInProgress = false
                        }
                    } else {
                        setState(TuPerfilBiometricFlowState.SessionExpired, gen)
                    }
                }
                is QueryOutcome.Stale -> return
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "QUERY_FAILED", e)
            if (gen == generation) {
                setState(TuPerfilBiometricFlowState.Error(
                    BiometricErrorKind.UNKNOWN,
                    errorMessage("No pudimos consultar tus registros.", "QUERY", "INTERNAL"),
                ), gen)
                traceFailure(gen, "QUERY", "INTERNAL")
            }
        }
    }

    /**
     * Espera resultados. Condiciones terminales: results/empty/error/unauth.
     * `waiting`/`loading` (o `rows=0`) NUNCA son error. El timeout base es
     * [QUERY_TIMEOUT_MS] desde el submit, pero se pospone mientras haya
     * actividad observable (mutaciones DOM) hasta [MAX_QUERY_BUDGET_MS].
     */
    private suspend fun awaitResults(wv: WebView, gen: Int, startedAt: Long): QueryOutcome {
        var errorStreak = 0
        var lastError: String? = null
        var outcome: QueryOutcome? = null
        var deadline = startedAt + QUERY_TIMEOUT_MS
        var lastActivityAt = startedAt
        var requestSeen = false
        var spinnerSeen = false
        var attempt = 0
        startObserveResults(wv, gen)

        while (outcome == null && System.currentTimeMillis() < deadline) {
            if (gen != generation) return stopObserveResults(wv, gen).let { QueryOutcome.Stale }
            delay(600)
            attempt++
            val p = TuPerfilWebBridge.evaluateJs(wv, "location.pathname")?.trim('"') ?: ""
            if (p.contains("/login")) return stopObserveResults(wv, gen).let { QueryOutcome.SessionExpired }
            val raw = TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.resultSnapshotJs()) ?: continue
            val snap = BiometricJson.parseSnapshot(raw) ?: continue

            // Actividad observable: mutaciones DOM + peticiones tras el submit.
            if (BuildConfig.DEBUG && attempt % ACTIVITY_SAMPLE_EVERY == 0) {
                observeResultsTick(wv, gen)
                val activities = BiometricDiscovery.parseActivity(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readActivityJs()))
                val net = BiometricDiscovery.parseNet(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readNetJs()))
                val latest = activities.mapNotNull { it.t }.filter { it >= startedAt }.maxOrNull() ?: startedAt
                if (latest > lastActivityAt) lastActivityAt = latest
                if (net.any { it.startedAt != null && it.startedAt >= startedAt }) requestSeen = true
                if (BuildConfig.DEBUG) {
                    val fresh = net.filter { it.startedAt != null && it.startedAt >= startedAt }.takeLast(3)
                    trace(gen, "QUERY_ACTIVITY", "SAMPLE",
                        result = latest > startedAt || fresh.isNotEmpty(),
                        details = "attempt=$attempt domActivity=${latest > lastActivityAt && lastActivityAt > startedAt} " +
                            "spinner=$spinnerSeen netFresh=${fresh.size}",
                        durationMs = System.currentTimeMillis() - startedAt)
                    fresh.forEach { traceNet(gen, it.method, it.path, it.status, it.durationMs) }
                }
            }

            if (snap.status == BiometricQueryStatus.LOADING) spinnerSeen = true

            when (snap.status) {
                BiometricQueryStatus.ROWS -> {
                    outcome = QueryOutcome.Rows(
                        snapshot = snap,
                        countsLog = if (BuildConfig.DEBUG) BiometricDiscovery.snapshotCountsLog(raw) else null,
                        startedAt = startedAt,
                        rowsDetectedAt = System.currentTimeMillis(),
                    )
                }
                BiometricQueryStatus.EMPTY -> outcome = QueryOutcome.Empty(snap)
                BiometricQueryStatus.UNAUTHENTICATED -> outcome = QueryOutcome.SessionExpired
                BiometricQueryStatus.ERROR -> {
                    val m = snap.errorMessage
                    if (m != null && m == lastError) errorStreak++ else { lastError = m; errorStreak = 1 }
                    if (errorStreak >= ERROR_PERSIST_SAMPLES) outcome = QueryOutcome.PortalError(snap)
                }
                else -> { errorStreak = 0; lastError = null }
            }

            if (BuildConfig.DEBUG) logResultAttempt(gen, attempt, raw)

            // Nunca declarar timeout con actividad fresca: extender el plazo.
            if (System.currentTimeMillis() - lastActivityAt < ACTIVITY_EXTEND_MS && deadline < startedAt + MAX_QUERY_BUDGET_MS) {
                deadline = maxOf(deadline, lastActivityAt + ACTIVITY_EXTEND_MS)
                    .coerceAtMost(startedAt + MAX_QUERY_BUDGET_MS)
            }
        }
        stopObserveResults(wv, gen)
        if (outcome != null) return outcome
        return QueryOutcome.Timeout(
            startedAt = startedAt,
            activitySeen = lastActivityAt > startedAt,
            requestSeen = requestSeen,
            spinnerSeen = spinnerSeen,
        )
    }

    // ── OBSERVE RESULTS: MutationObserver de resultados via JS (DEBUG+release) ─

    private suspend fun startObserveResults(wv: WebView, gen: Int) {
        if (gen != generation) return
        TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_RESULTS_OBS__=null;")
        TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.startResultsObserverJs("gen$gen"))
        trace(gen, "OBSERVE_RESULTS", "STARTED", result = true)
    }

    private suspend fun observeResultsTick(wv: WebView, gen: Int) {
        if (!BuildConfig.DEBUG || gen != generation) return
        val info = BiometricDiscovery.parseResultsObserver(
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readResultsObserverStateJs()))
        if (info != null) {
            val m = info.matches
            trace(gen, "OBSERVE_RESULTS", "TICK", result = info.status == "working",
                details = "status=${info.status} localizados=${m?.localizados} tables=${m?.tables} rows=${m?.rows} " +
                    "matRows=${m?.matRows} roleTables=${m?.roleTables} roleRows=${m?.roleRows} " +
                    "download=${m?.download} share=${m?.share} snippets=${m?.snippets?.size}")
        }
    }

    private suspend fun stopObserveResults(wv: WebView, gen: Int): Unit {
        TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.stopResultsObserverJs())
        val info = BiometricDiscovery.parseResultsObserver(
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readResultsObserverStateJs()))
        if (info != null) {
            val m = info.matches
            trace(gen, "OBSERVE_RESULTS", "STOPPED", result = true,
                details = "status=${info.status} localizados=${m?.localizados} tables=${m?.tables} rows=${m?.rows} " +
                    "download=${m?.download} share=${m?.share}")
        }
    }

    // ── APPLY: aplicar el periodo (JS) y VERIFICAR (JS independiente) ──────

    private suspend fun applyPeriod(wv: WebView, period: BiometricPeriod, gen: Int): ApplyOutcome {
        val ooad = selectedOoad
            ?: BiometricOoad(BiometricFlowPolicy.DEFAULT_OOAD_VALUE, BiometricFlowPolicy.DEFAULT_OOAD_LABEL)
        val startedAt = System.currentTimeMillis()
        var attempt = 0
        var lastReason = ""
        var controlFound = false
        var overlayOpened: Boolean? = null
        var optionCount: Int? = null
        var optionFound = false
        var clickPerformed = false
        var overlayClosed = false
        var ooadVerified: Boolean? = null
        var ooadText: String? = null
        var availableLabels = emptyList<String>()
        var hitLabel: String? = null

        while (attempt < MAX_APPLY_ATTEMPTS && System.currentTimeMillis() - startedAt < APPLY_BUDGET_MS) {
            if (gen != generation) return ApplyOutcome(false, false, null, null, false, false, false, false, "STALE", null, null, emptyList())
            attempt++
            TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_APPLY_RESULT__=null;window.__LVD_BIO_APPLY_RUNNING__=false;")
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.applyPeriodJs(period.label, period.value, ooad.value, ooad.label))

            var result: JSONObject? = null
            while (result == null && System.currentTimeMillis() - startedAt < APPLY_BUDGET_MS) {
                if (gen != generation) return ApplyOutcome(false, false, null, null, false, false, false, false, "STALE", null, null, emptyList())
                delay(300)
                result = TarjetonDigitalJson.parseObject(TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_APPLY_RESULT__"))
            }
            if (result == null) { lastReason = "TIMEOUT"; break }
            val detail = BiometricDiscovery.parseApplyDetail(TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_APPLY_RESULT__"))
            controlFound = detail?.controlFound == true
            overlayOpened = detail?.overlayOpened
            optionCount = detail?.optionCount
            optionFound = detail?.optionFound == true
            clickPerformed = detail?.clickPerformed == true
            overlayClosed = detail?.overlayClosed == true
            ooadVerified = detail?.ooadVerified
            ooadText = detail?.ooadText
            availableLabels = detail?.availableLabels.orEmpty()
            hitLabel = detail?.hitLabel
            val ok = result.optBoolean("ok")
            lastReason = result.optString("reason", "")

            trace(gen, "APPLY_PERIOD", "CONTROL_FOUND", result = controlFound)
            trace(gen, "APPLY_PERIOD", "OVERLAY_OPENED", result = overlayOpened)
            if (optionCount != null) {
                trace(gen, "APPLY_PERIOD", "OPTIONS", result = optionCount > 0,
                    details = "count=$optionCount samples=${availableLabels.distinct().take(5).joinToString(" | ").take(120)}")
            }
            trace(gen, "APPLY_PERIOD", "OPTION_FOUND", result = optionFound,
                details = "requestedLabel=${period.label} hitLabel=${hitLabel ?: ""}")
            trace(gen, "APPLY_PERIOD", "CLICK", result = clickPerformed)
            trace(gen, "APPLY_PERIOD", "OVERLAY_CLOSED", result = overlayClosed)

            if (ok) {
                // VERIFY: inspección independiente del control. click != selección aplicada.
                setState(TuPerfilBiometricFlowState.VerifyingPeriod, gen)
                val verify = BiometricDiscovery.parseVerifyDetail(
                    TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.verifyPeriodJs(period.label, period.value)))
                val verified = verify?.found == true && verify?.expectedMatch == true
                trace(gen, "APPLY_PERIOD", "VERIFIED", result = verified,
                    details = "portalPeriodText=${verify?.displayText ?: ""}",
                    durationMs = System.currentTimeMillis() - startedAt)
                if (BuildConfig.DEBUG) {
                    Log.i(FLOW_TAG,
                        "applyPeriod controlFound=$controlFound overlayOpened=$overlayOpened optionCount=$optionCount optionFound=$optionFound clickPerformed=$clickPerformed " +
                            "overlayClosed=$overlayClosed ooadVerified=$ooadVerified portalSelectionVerified=$verified " +
                            "displayText=\"${verify?.displayText ?: ""}\" overlayOpen=${verify?.overlayOpen}")
                }
                if (verified) {
                    Log.i(FLOW_TAG, "[$gen] applyPeriod success=true attempt=$attempt verified=true")
                    trace(gen, "APPLY_PERIOD", "SUMMARY", result = true,
                        details = "controlFound=$controlFound overlayOpened=$overlayOpened optionCount=$optionCount " +
                            "optionFound=$optionFound click=$clickPerformed overlayClosed=$overlayClosed verified=true",
                        durationMs = System.currentTimeMillis() - startedAt)
                    return ApplyOutcome(true, controlFound, overlayOpened, optionCount, optionFound, clickPerformed, overlayClosed, true, null, ooadVerified, ooadText, availableLabels)
                }
                lastReason = "PERIOD_NOT_VERIFIED"
            } else if (lastReason.contains("WRONG_OOAD")) {
                // Carrera: la OOAD dejó de ser 17 → volver a ApplyingOoad antes de reintentar.
                Log.w(FLOW_TAG, "[$gen] applyPeriod WRONG_OOAD → reaplicando OOAD")
                if (!ensureOoadReady(wv, gen)) {
                    return ApplyOutcome(false, controlFound, overlayOpened, optionCount, optionFound, clickPerformed, overlayClosed, false, "WRONG_OOAD", ooadVerified, ooadText, availableLabels)
                }
            } else if (BuildConfig.DEBUG && (lastReason.contains("PERIOD_OPTION_NOT_FOUND") || lastReason.contains("PERIOD_OPTIONS_EMPTY"))) {
                logAvailableOptions("AVAILABLE PERIODS", availableLabels)
            }
            Log.w(FLOW_TAG, "[$gen] applyPeriod attempt=$attempt reason=$lastReason")
        }
        Log.w(FLOW_TAG, "[$gen] applyPeriod success=false reason=$lastReason hitLabel=${hitLabel ?: ""}")
        val sampleLabels = availableLabels.distinct().take(5).joinToString(" | ").take(120)
        trace(gen, "APPLY_PERIOD", "SUMMARY", result = false,
            details = "controlFound=$controlFound overlayOpened=$overlayOpened optionCount=$optionCount " +
                "optionFound=$optionFound click=$clickPerformed overlayClosed=$overlayClosed verified=false reason=$lastReason hitLabel=${hitLabel ?: ""} samples=$sampleLabels",
            durationMs = System.currentTimeMillis() - startedAt)
        // También deja las labels en el trace para que Copiar diagnóstico las incluya
        if (availableLabels.isNotEmpty()) {
            trace(gen, "APPLY_PERIOD", "LABELS", result = false, details = availableLabels.distinct().take(8).joinToString(" | ").take(200))
        }
        return ApplyOutcome(false, controlFound, overlayOpened, optionCount, optionFound, clickPerformed, overlayClosed, false, lastReason, ooadVerified, ooadText, availableLabels)
    }

    private suspend fun clickConsult(wv: WebView, gen: Int): JSONObject? {
        // Diagnóstico previo de TODOS los botones visibles (DEBUG).
        if (BuildConfig.DEBUG) logVisibleButtons(wv)
        var result: JSONObject? = null
        var reason = "CONSULT_BUTTON_NOT_FOUND"
        val submitStartedAt = System.currentTimeMillis()
        repeat(2) {
            if (result != null) return@repeat
            val j = TarjetonDigitalJson.parseObject(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.clickConsultJs()))
            if (j?.optBoolean("ok") == true) result = j else reason = j?.optString("reason") ?: reason
            if (result == null) delay(600)
        }
        val clickedOk = result?.optBoolean("ok") == true
        val detail = result?.optString("details", "") ?: ""
        trace(gen, "SUBMIT_QUERY", "CONTROL_FOUND", result = result != null,
            details = "reason=$reason" + if (detail.isEmpty()) "" else " $detail")
        trace(gen, "SUBMIT_QUERY", "CLICKED", result = clickedOk,
            durationMs = System.currentTimeMillis() - submitStartedAt)
        if (result == null) Log.w(FLOW_TAG, "consultClick failed reason=$reason")
        return result
    }

    // ── Diagnóstico DEBUG (sanitizado: NUNCA valores personales) ───────────

    /** Mensaje de error con etapa y código en DEBUG; limpio en release. */
    private fun errorMessage(base: String, stage: String, code: String): String =
        if (BuildConfig.DEBUG) "$base\n\nEtapa: $stage\nCódigo: $code" else base

    /** Volcado estructural completo del DOM de la pantalla de consulta. */
    private suspend fun dumpBiometricDiagnostics(wv: WebView) {
        if (!BuildConfig.DEBUG) return
        val report = BiometricDiscovery.parseDump(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.dumpJs())) ?: return
        Log.i(BiometricDiscovery.DIAG_TAG,
            "BIOMETRIC_DUMP url=${report.url ?: "?"} path=${report.path ?: "?"} title=${report.title ?: "?"} controls=${report.controls.size}")
        report.controls.forEachIndexed { i, c ->
            Log.i(BiometricDiscovery.DIAG_TAG,
                "#$i tag=${c.tag ?: "?"} id=${c.id ?: ""} name=${c.name ?: ""} role=${c.role ?: ""} " +
                    "formcontrolname=${c.formcontrolname ?: ""} ariaLabel=${c.ariaLabel ?: ""} placeholder=${c.placeholder ?: ""} " +
                    "text=\"${c.text ?: ""}\" value=${c.value ?: ""} visible=${c.visible} rect=${c.rect ?: ""} " +
                    "children=${c.children} sensitive=${c.sensitive} cls=${c.cls ?: ""}")
        }
    }

    /** Volcado de botones visibles (antes de pulsar Consultar). */
    private suspend fun logVisibleButtons(wv: WebView) {
        val buttons = BiometricDiscovery.parseButtons(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.dumpButtonsJs()))
        Log.i(BiometricDiscovery.DIAG_TAG, "BIOMETRIC_BUTTONS visible=${buttons.size}")
        buttons.forEachIndexed { i, b ->
            Log.i(BiometricDiscovery.DIAG_TAG,
                "BUTTON #$i tag=${b.tag ?: "?"} id=${b.id ?: ""} type=${b.type ?: ""} text=\"${b.text ?: ""}\" " +
                    "disabled=${b.disabled} ariaDisabled=${b.ariaDisabled ?: ""} cls=${b.cls ?: ""} rect=${b.rect ?: ""}")
        }
    }

    /** Etapas de preparación: ROUTE_READY / FORM_READY / PERIOD_CONTROL_READY / PERIOD_DATA_READY. */
    private suspend fun logReadiness(wv: WebView, gen: Int, stage: String) {
        if (!BuildConfig.DEBUG) return
        val j = TarjetonDigitalJson.parseObject(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readinessJs())) ?: return
        Log.i(FLOW_TAG,
            "[$gen] READY stage=$stage route=${j.optBoolean("routeReady")} form=${j.optBoolean("formReady")} " +
                "periodControl=${j.optBoolean("periodControlReady")} periodData=${j.optBoolean("periodDataReady")} loading=${j.optBoolean("loading")}")
    }

    /** Clasifica TODOS los selectores (OOAD vs Periodo) — MAT_SELECT #0/#1. */
    private suspend fun logClassifyControls(wv: WebView, gen: Int) {
        val report = BiometricDiscovery.parseClassify(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.classifyControlsJs())) ?: return
        Log.i(BiometricDiscovery.DIAG_TAG, "SELECTORS count=${report.controls.size} ooad=${if (report.ooadFound) "found#${report.ooadIndex}(${report.ooadEvidence ?: ""})" else "MISSING"} period=${if (report.periodFound) "found#${report.periodIndex}(${report.periodEvidence ?: ""})" else "MISSING"}")
        report.controls.forEach { c ->
            Log.i(BiometricDiscovery.DIAG_TAG,
                "MAT_SELECT #${c.index} tag=${c.tag ?: "?"} label=${c.label ?: ""} formcontrolname=${c.formcontrolname ?: ""} " +
                    "ariaLabel=${c.ariaLabel ?: ""} placeholder=${c.placeholder ?: ""} text=\"${c.text ?: ""}\" options=${c.options}")
        }
        trace(gen, "DISCOVER_FORM", "SELECTORS",
            result = report.ooadFound && report.periodFound,
            details = "count=${report.controls.size} ooad=#${report.ooadIndex}(${report.ooadEvidence ?: ""}) " +
                "period=#${report.periodIndex}(${report.periodEvidence ?: ""})")
    }

    /** Reporte DEBUG tras resolver la OOAD 17 — Michoacán. */
    private suspend fun logOoadsDiscoveryReport(gen: Int, state: JSONObject, resolved: BiometricOoad) {
        val diag = BiometricDiscovery.DIAG_TAG
        val c = state.optJSONObject("control")
        val count = BiometricJson.parseOoads(state.optJSONArray("ooads")).size
        Log.i(diag, "=== BIOMETRIC PORTAL DISCOVERY (OOAD) ===")
        if (c != null) {
            Log.i(diag, "CONTROL REAL DE OOAD: kind=${c.optString("kind")} tag=${c.optString("tag")} " +
                "id=${c.optString("id")} formcontrolname=${c.optString("formcontrolname")} " +
                "label=\"${c.optString("label")}\" evidence=${c.optString("evidence")}")
        } else {
            Log.i(diag, "CONTROL REAL DE OOAD: (no reportado)")
        }
        Log.i(diag, "TOTAL DE OOAD: $count")
        Log.i(diag, "OOAD RESUELTA: value=\"${resolved.value}\" label=\"${resolved.label}\" (regla: valor real == 17; respaldo label michoacan)")
    }

    /** Lista numerada de opciones disponibles (labels, no sensibles) — DEBUG. */
    private fun logAvailableOptions(title: String, labels: List<String>) {
        Log.i(BiometricDiscovery.DIAG_TAG, "$title count=${labels.size}")
        labels.forEachIndexed { i, l ->
            val t = if (l.length > 60) l.take(60) else l
            Log.i(BiometricDiscovery.DIAG_TAG, "${i + 1}. $t")
        }
    }

    /** Correlación de red tras aplicar OOAD: peticiones que cargan Periodo. */
    private suspend fun logPeriodRefreshNet(wv: WebView, after: Long, gen: Int) {
        val net = BiometricDiscovery.parseNet(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readNetJs()))
        for (e in net.filter { it.startedAt != null && it.startedAt >= after }.takeLast(6)) {
            val path = (e.path ?: "").lowercase()
            if (path.contains("period") || path.contains("quincena") || path.contains("ooad")) {
                Log.i(BiometricDiscovery.NET_TAG,
                    "OOAD_NET method=${e.method ?: "?"} path=${e.path ?: "?"} status=${e.status ?: -1} durationMs=${e.durationMs ?: -1}")
                traceNet(gen, e.method, e.path, e.status, e.durationMs)
            }
        }
    }

    /** Diagnóstico completo del fallo de `applyPeriod` (PERIOD_OPTION_NOT_FOUND y afines). */
    private fun logApplyPeriodDiagnostics(applied: ApplyOutcome, period: BiometricPeriod) {
        val diag = BiometricDiscovery.DIAG_TAG
        Log.i(diag, "APPLY_PERIOD_DETAIL reason=${applied.reason ?: ""}")
        Log.i(diag, "Requested period: \"${period.label}\" value=\"${period.value}\"")
        Log.i(diag, "OOAD: verified=${applied.ooadVerified} text=\"${applied.ooadText ?: ""}\"")
        Log.i(diag, "Period control: found=${applied.controlFound} optionsFound=${applied.optionFound}")
        logAvailableOptions("AVAILABLE PERIODS", applied.availableLabels)
    }

    /** Resumen por intento de descubrimiento: estado cerrado + muestras A/B/C/D. */
    private fun logDiscoveryAttempt(gen: Int, attempt: Int, j: JSONObject, parsedCount: Int) {
        val closed = j.optJSONObject("sampleClosed")
        val closedCount = closed?.optInt("count", -1) ?: -1
        val samples = j.optJSONArray("samples")
        val sampleTxt = StringBuilder()
        if (samples != null) {
            for (i in 0 until samples.length()) {
                val s = samples.optJSONObject(i) ?: continue
                if (sampleTxt.isNotEmpty()) sampleTxt.append(" ")
                sampleTxt.append("S").append(i).append("={where=").append(s.optString("where"))
                    .append(",count=").append(s.optInt("count", -1)).append("}")
            }
        }
        Log.i(FLOW_TAG, "[$gen] readPeriods attempt=$attempt result=ok parsedCount=$parsedCount closedCount=$closedCount $sampleTxt")
    }

    /** Muestra por poll de resultados: estado + conteos estructurales. */
    private fun logResultAttempt(gen: Int, attempt: Int, raw: String) {
        val status = BiometricJson.parseSnapshot(raw)?.status?.name ?: return
        val counts = BiometricDiscovery.snapshotCountsLog(raw) ?: ""
        Log.i(FLOW_TAG, "resultAttempt attempt=$attempt status=$status $counts")
    }

    /** Línea de tiempo de la consulta + últimas peticiones correlacionadas. */
    private suspend fun logQueryTimeline(wv: WebView, startedAt: Long, rowsAt: Long?, gen: Int) {
        val activities = BiometricDiscovery.parseActivity(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readActivityJs()))
        val net = BiometricDiscovery.parseNet(TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readNetJs()))
        Log.i(FLOW_TAG, "TIMELINE ${BiometricDiscovery.buildTimeline(activities, net, startedAt, rowsAt)}")
        for (e in net.filter { it.startedAt != null && it.startedAt >= startedAt }.takeLast(5)) {
            Log.i(BiometricDiscovery.NET_TAG,
                "QUERY_NET method=${e.method ?: "?"} path=${e.path ?: "?"} status=${e.status ?: -1} durationMs=${e.durationMs ?: -1}")
            traceNet(gen, e.method, e.path, e.status, e.durationMs)
        }
    }

    /** Descubrimiento del mecanismo real de "Descargar": elemento + pathway. */
    private suspend fun logDownloadDiscovery(wv: WebView, gen: Int) {
        if (!BuildConfig.DEBUG || gen != generation) return
        val hints = BiometricDiscovery.parseDownloadHints(
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.discoverDownloadJs()))
        if (hints != null) {
            Log.i(BiometricDiscovery.DIAG_TAG,
                "DOWNLOAD_DISCOVERY descargar=${hints.downloads.size} compartir=${hints.shares.size}")
            hintInfo("DOWNLOAD_DESCARGAR", hints.downloads)
            hintInfo("DOWNLOAD_COMPARTIR", hints.shares)
            val mechanisms = hints.downloads.flatMap { hintMechanisms(it) }.distinct()
            trace(gen, "FIND_DOWNLOAD", "CONTROL", result = hints.downloads.isNotEmpty(),
                details = "descargar=${hints.downloads.size} compartir=${hints.shares.size} " +
                    "mechanisms=${mechanisms.joinToString(",")}")
        } else {
            trace(gen, "FIND_DOWNLOAD", "CONTROL", result = false, details = "no se ejecutó el descubrimiento")
        }
        val events = BiometricDiscovery.parseDownloadEvents(
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readDownloadEventsJs()))
        if (events != null && events.isNotEmpty()) {
            events.takeLast(5).forEach { e ->
                trace(gen, "DOWNLOAD_EVENT", e.kind ?: "unknown", result = true,
                    details = "mime=${e.mime ?: ""} download=${e.download ?: ""}")
            }
        }
        traceJsErrors(wv, gen)
    }

    private fun hintMechanisms(h: BiometricDiscovery.DownloadHintInfo): List<String> {
        val m = mutableListOf<String>()
        if (h.tag == "a" && !h.href.isNullOrBlank()) m += "anchor"
        if (h.tag == "button" || h.role == "button") m += "button"
        m += if (h.hasOnclick == true) "onclick" else "listener"
        if (!h.download.isNullOrBlank()) m += "downloadAttr"
        if (m.isEmpty()) m += "unknown"
        return m.distinct()
    }

    private fun hintInfo(title: String, hints: List<BiometricDiscovery.DownloadHintInfo>) {
        if (hints.isEmpty()) { Log.i(BiometricDiscovery.DIAG_TAG, "$title (sin candidatos)"); return }
        Log.i(BiometricDiscovery.DIAG_TAG, "$title count=${hints.size}")
        hints.forEachIndexed { i, h ->
            Log.i(BiometricDiscovery.DIAG_TAG,
                "$title #$i tag=${h.tag ?: "?"} id=${h.id ?: ""} href=${h.href ?: ""} role=${h.role ?: ""} " +
                    "hasOnclick=${h.hasOnclick} downloadAttr=${h.download ?: ""} text=\"${h.text ?: ""}\"")
        }
    }

    /** Reporte `=== BIOMETRIC PORTAL DISCOVERY ===` tras una lectura exitosa. */
    private suspend fun logPeriodsDiscoveryReport(gen: Int, state: JSONObject, wv: WebView) {
        val diag = BiometricDiscovery.DIAG_TAG
        val path = TuPerfilWebBridge.evaluateJs(wv, "location.pathname")?.trim('"') ?: "?"
        val c = state.optJSONObject("control")
        val closed = state.optJSONObject("sampleClosed")
        val samples = state.optJSONArray("samples")
        val count = BiometricJson.parsePeriodArray(state.optJSONArray("periods")).size

        Log.i(diag, "=== BIOMETRIC PORTAL DISCOVERY ===")
        Log.i(diag, "URL final: $path")
        if (c != null) {
            Log.i(diag, "CONTROL REAL DE PERIODO: kind=${c.optString("kind")} tag=${c.optString("tag")} " +
                "id=${c.optString("id")} formcontrolname=${c.optString("formcontrolname")} role=${c.optString("role")} " +
                "label=\"${c.optString("label")}\" evidence=${c.optString("evidence")}")
        } else {
            Log.i(diag, "CONTROL REAL DE PERIODO: (no reportado)")
        }
        val existsClosed = closed?.optBoolean("exists")
        val closedCount = closed?.optInt("count", -1) ?: -1
        Log.i(diag, "¿LAS OPCIONES EXISTEN CON EL SELECT CERRADO? ${if (existsClosed == true) "sí" else "no"} (count=$closedCount)")
        val sampleTxt = StringBuilder()
        if (samples != null) {
            for (i in 0 until samples.length()) {
                val s = samples.optJSONObject(i) ?: continue
                if (sampleTxt.isNotEmpty()) sampleTxt.append(" | ")
                sampleTxt.append("S").append(i).append(" ").append(s.optString("where")).append(" count=").append(s.optInt("count", -1))
            }
        }
        Log.i(diag, "¿DÓNDE APARECEN AL ABRIRLO? ${if (sampleTxt.isEmpty()) "(sin muestras)" else sampleTxt}")
        Log.i(diag, "TOTAL DE QUINCENAS: $count")
        Log.i(diag, "PETICIÓN QUE LAS CARGA: ${matchingPeriodsRequest(wv, count)}")
        Log.i(diag, "CAUSA PROBABLE DEL TIMEOUT ANTERIOR: ${probableCause(closedCount, samples)}")
    }

    /** Relaciona las quincenas con la petición de red que las trajo (best effort). */
    private suspend fun matchingPeriodsRequest(wv: WebView, expectedCount: Int): String {
        val net = BiometricDiscovery.parseNet(
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readNetJs()) ?: "[]")
        if (net.isEmpty()) return "sin red observable"
        val arr = TarjetonDigitalJson.parseArray(
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readNetJs()) ?: "[]") ?: return "sin red observable"
        val jsonEntries = mutableListOf<String>()
        for (i in 0 until arr.length()) {
            val e = arr.optJSONObject(i) ?: continue
            val shape = e.optJSONObject("shape")
            if (shape != null && shape.has("json")) {
                val c = shape.optInt("count", -1)
                val entry = "${e.optString("m")} ${e.optString("p")} status=${e.optInt("s", -1)} " +
                    "json=${shape.optString("json")} count=$c keys=${shape.optJSONArray("keys")?.toString() ?: "[]"}"
                if (c == expectedCount) return "coincide: $entry"
                jsonEntries += entry
            }
        }
        return if (jsonEntries.isEmpty()) {
            "no se observó fetch/XHR con JSON (las quincenas parecen renderizarse vía DOM de Angular)"
        } else {
            "sin coincidencia exacta; candidatos: ${jsonEntries.joinToString(" | ")}"
        }
    }

    private fun probableCause(closedCount: Int?, samples: JSONArray?): String {
        val anyOpen = samples != null && (0 until samples.length()).any {
            (samples.optJSONObject(it)?.optInt("count", -1) ?: -1) > 0
        }
        return when {
            closedCount == null -> "sin datos de estado cerrado (diagnóstico incompleto)"
            closedCount == 0 && anyOpen ->
                "Las quincenas SOLO existen con el selector abierto; el código anterior reinyectaba el IIFE de lectura en cada poll " +
                    "(abriendo/cerrando el mat-select mientras Angular aún hidrataba las opciones). Ahora: start-una-vez + poll de estado con runId."
            closedCount == 0 && !anyOpen ->
                "El selector no mostró opciones en los primeros 750ms; las quincenas probablemente llegan por petición XHR/fetch posterior " +
                    "(ver PETICIÓN QUE LAS CARGA) o el control real es otro (ver volcado BIOMETRIC_DUMP)."
            else ->
                "Las opciones existen con el selector cerrado; el fallo previo era el reinyectado por polling o la elección genérica " +
                    "del primer mat-select (ahora el control se elige por evidencia)."
        }
    }

    /**
     * Harness opcional de estabilidad: abre y lee el selector N veces seguidas
     * registrando `verifyPeriods OPEN #k → N periodos`. Solo se ejecuta si
     * [DISCOVERY_VERIFY_OPENS] > 0 (desarrollo). No consulta registros.
     */
    private suspend fun runDiscoveryVerification(wv: WebView, gen: Int) {
        if (DISCOVERY_VERIFY_OPENS <= 0) return
        Log.i(FLOW_TAG, "[$gen] verifyPeriods start opens=$DISCOVERY_VERIFY_OPENS")
        var stable = true
        for (open in 1..DISCOVERY_VERIFY_OPENS) {
            if (gen != generation) return
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.closeOverlayJs())
            delay(350)
            val runId = "verify$open-gen$gen"
            TuPerfilWebBridge.evaluateJs(wv, "window.__LVD_BIO_DISCOVERY__=null;")
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.startDiscoveryJs(runId))

            var ok = false
            var count = 0
            val t0 = System.currentTimeMillis()
            while (System.currentTimeMillis() - t0 < VERIFY_BUDGET_MS) {
                if (gen != generation) return
                delay(300)
                val raw = TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readDiscoveryStateJs())
                val j = TarjetonDigitalJson.parseObject(raw) ?: continue
                when (j.optString("status")) {
                    "success" -> { count = j.optJSONArray("periods")?.length() ?: 0; ok = true; break }
                    "error" -> break
                }
            }
            Log.i(FLOW_TAG, "[$gen] verifyPeriods OPEN #$open → ${if (ok) "$count periodos" else "FAIL"}")
            if (!ok) { stable = false; break }
        }
        Log.i(FLOW_TAG, "[$gen] verifyPeriods done stable=$stable")
        TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.closeOverlayJs())
    }

    private suspend fun injectMonitors(wv: WebView) {
        if (!BuildConfig.DEBUG) return
        TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.netMonitorJs())
        TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.activityMonitorJs())
        TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.downloadMonitorJs())
        TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.jsErrorMonitorJs())
    }

    /** Errores JS del portal capturados (sanitizados) → traza DEBUG (tag LVD_BIO_JS). */
    private suspend fun traceJsErrors(wv: WebView, gen: Int) {
        if (!BuildConfig.DEBUG || gen != generation) return
        val errors = BiometricDiscovery.parseJsErrors(
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readJsErrorsJs())) ?: return
        errors.takeLast(5).forEach { e ->
            Log.i(BiometricTrace.TRACE_TAG, "LVD_BIO_JS kind=${e.type} msg=${e.message ?: ""} file=${e.file ?: ""} line=${e.line}")
            trace(gen, "JS_ERROR", e.type ?: "error", result = false,
                details = "msg=${e.message ?: ""} file=${e.file ?: ""} line=${e.line}")
        }
        TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.resetJsErrorsJs())
    }

    /** Logs DEBUG de endpoints observados — solo método+URL+status+forma, SIN cuerpos. */
    private suspend fun dumpNetLog(wv: WebView) {
        if (!BuildConfig.DEBUG) return
        val arr = TarjetonDigitalJson.parseArray(
            TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.readNetJs()) ?: "[]") ?: return
        for (i in 0 until arr.length()) {
            val e = arr.optJSONObject(i) ?: continue
            val shape = e.optJSONObject("shape")
            val shapeTxt = when {
                shape == null -> "-"
                shape.has("json") ->
                    "json=${shape.optString("json")} count=${shape.optInt("count", -1)} keys=${shape.optJSONArray("keys")?.toString() ?: "[]"}"
                else -> "textLen=${shape.optInt("textLen", -1)}"
            }
            Log.i(TAG, "BIOMETRIC_NET m=${e.optString("m")} status=${e.optInt("s", -1)} url=${e.optString("p")} " +
                "ct=${e.optString("ct")} sz=${e.opt("sz")} d=${e.opt("d")}ms shape=$shapeTxt")
        }
    }

    /** Captura del contexto al entrar al formulario original (DEBUG). */
    private suspend fun captureManualEntryContext() {
        try {
            val wv = withTimeout(5_000L) { session.awaitWebView() }
            Log.i(FLOW_TAG, "MANUAL_MODE_ENTERED")
            logVisibleButtons(wv)
        } catch (_: Exception) {
        }
    }

    /** Captura del estado del portal al volver del formulario original (DEBUG): comparación ORIGINAL vs NATIVO. */
    private suspend fun captureManualResultContext() {
        try {
            val wv = withTimeout(5_000L) { session.awaitWebView() }
            val raw = TuPerfilWebBridge.evaluateJs(wv, BiometricDiscovery.resultSnapshotJs())
            val snap = BiometricJson.parseSnapshot(raw)
            Log.i(BiometricDiscovery.DIAG_TAG,
                "MANUAL_RESULT_CAPTURE status=${snap?.status?.name ?: "?"} ${BiometricDiscovery.snapshotCountsLog(raw) ?: ""} " +
                    "structure=${BiometricDiscovery.structureLog(raw) ?: "-"}")
            dumpNetLog(wv)
        } catch (_: Exception) {
        }
    }
}
