package com.laveintedigital.app.imss.register

import android.content.Context
import android.util.Log
import android.webkit.WebView
import com.laveintedigital.app.imss.credentials.ImssCredentialPayload
import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.credentials.ImssVaultManager
import com.laveintedigital.app.imss.portal.TarjetonDigitalJson
import com.laveintedigital.app.imss.portal.TuPerfilWebBridge
import com.laveintedigital.app.offline.OfflineSnapshotStore
import kotlinx.coroutines.CompletableDeferred
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

/**
 * Orquestador del flujo asistido de registro en Tu Perfil IMSS.
 *
 * Automatiza la interacción con el formulario Angular y los modales en WebView,
 * mientras expone una máquina de estados reactiva limpia a la UI de Jetpack Compose.
 */
class TuPerfilRegisterController(
    private val scope: CoroutineScope,
    private val context: Context,
) {
    companion object {
        private const val TAG = "TuPerfilRegisterCtrl"
        private const val NAV_TIMEOUT_MS = 20_000L
        private const val SIAP_TIMEOUT_MS = 15_000L
        private const val SUBMIT_TIMEOUT_MS = 25_000L
        private const val VERIFY_TIMEOUT_MS = 15_000L
    }

    private val _state = MutableStateFlow<TuPerfilRegisterFlowState>(
        TuPerfilRegisterFlowState.Editing(input = TuPerfilRegisterInput())
    )
    val state: StateFlow<TuPerfilRegisterFlowState> = _state.asStateFlow()

    private val webViewReady = CompletableDeferred<WebView>()
    private var currentJob: Job? = null
    private var activeInput: TuPerfilRegisterInput = TuPerfilRegisterInput()

    init {
        // Carga inicial no bloqueante de datos previos para pre-llenado
        scope.launch(Dispatchers.IO) {
            val prefill = discoverPrefillData(context)
            withContext(Dispatchers.Main) {
                activeInput = prefill
                _state.value = TuPerfilRegisterFlowState.Editing(
                    input = activeInput,
                    fromTarjetonPrefill = prefill.matricula.isNotBlank() && prefill.rfc.isNotBlank(),
                )
            }
        }
    }

    fun attachWebView(wv: WebView) {
        if (!webViewReady.isCompleted) webViewReady.complete(wv)
    }

    fun updateInput(input: TuPerfilRegisterInput) {
        activeInput = input
        val current = _state.value
        if (current is TuPerfilRegisterFlowState.Editing) {
            _state.value = current.copy(input = input, validationError = null)
        }
    }

    /**
     * Inicia la orquestación del registro automático en el portal.
     */
    fun startRegistration() {
        val validation = TuPerfilRegisterValidator.validateInput(activeInput)
        if (validation != null) {
            _state.value = TuPerfilRegisterFlowState.Editing(
                input = activeInput,
                validationError = validation,
            )
            return
        }

        if (currentJob?.isActive == true) return

        currentJob = scope.launch {
            try {
                executeRegistrationFlow(activeInput)
            } catch (e: Exception) {
                Log.e(TAG, "Error durante el flujo de registro", e)
                _state.value = TuPerfilRegisterFlowState.Error(
                    message = "No pudimos completar el registro: ${e.message ?: "Error de conexión"}",
                    canRetry = true,
                )
            }
        }
    }

    private suspend fun executeRegistrationFlow(input: TuPerfilRegisterInput) {
        _state.value = TuPerfilRegisterFlowState.Submitting("Conectando con Tu Perfil IMSS…")
        val wv = webViewReady.await()

        // 1. Navegar a /register
        TuPerfilWebBridge.loadUrl(wv, TuPerfilRegisterAdapter.REGISTER_URL)

        // 2. Esperar que el formulario Angular esté listo
        _state.value = TuPerfilRegisterFlowState.Submitting("Cargando formulario oficial…")
        val pageReady = awaitCondition(wv, timeoutMs = NAV_TIMEOUT_MS) {
            val r = TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.CHECK_PAGE_READY_JS)
            TarjetonDigitalJson.parseObject(r)?.optBoolean("ready") == true
        }

        if (!pageReady) {
            _state.value = TuPerfilRegisterFlowState.Error(
                message = "El portal oficial Tu Perfil IMSS no respondió a tiempo. Intenta nuevamente.",
                failedStep = "PAGE_LOAD_TIMEOUT",
            )
            return
        }

        // 3. Inyectar OOAD y Matrícula para activar consulta SIAP
        _state.value = TuPerfilRegisterFlowState.Submitting("Consultando registro en SIAP…")
        delay(400)
        TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.selectOoadAndMatriculaJs(input.ooadCode, input.matricula))

        // 4. Esperar resultado de SIAP (detectar si la cuenta ya existe)
        val siapResult = awaitSiapCheck(wv, timeoutMs = SIAP_TIMEOUT_MS)
        if (siapResult == "ALREADY_REGISTERED") {
            Log.i(TAG, "Matrícula ${input.matricula} ya tiene cuenta en Tu Perfil IMSS")
            _state.value = TuPerfilRegisterFlowState.AccountAlreadyExists(
                matricula = input.matricula,
            )
            return
        }

        // 5. Inyectar todos los datos restantes
        _state.value = TuPerfilRegisterFlowState.Submitting("Preparando tus datos laborales…")
        delay(600)
        val fillResult = TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.fillAllRemainingFieldsJs(input))
        val fillOk = TarjetonDigitalJson.parseObject(fillResult)?.optBoolean("ok") == true
        if (!fillOk) {
            Log.w(TAG, "Advertencia: Algunos campos requirieron reintento: $fillResult")
        }

        // 6. Enviar formulario
        _state.value = TuPerfilRegisterFlowState.Submitting("Enviando solicitud al IMSS…")
        delay(500)
        TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.CLICK_SUBMIT_JS)

        // 7. Esperar diálogo de código OTP
        _state.value = TuPerfilRegisterFlowState.Submitting("Generando código de confirmación…")
        val codeModalAppeared = awaitCondition(wv, timeoutMs = SUBMIT_TIMEOUT_MS) {
            val r = TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.CHECK_CODE_DIALOG_READY_JS)
            val obj = TarjetonDigitalJson.parseObject(r)
            obj?.optBoolean("ready") == true
        }

        if (!codeModalAppeared) {
            // Verificar si el portal arrojó un error visible en el formulario
            val r = TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.CHECK_CODE_DIALOG_READY_JS)
            val err = TarjetonDigitalJson.parseObject(r)?.optString("error")
            _state.value = TuPerfilRegisterFlowState.Error(
                message = if (!err.isNullOrBlank()) err else "El IMSS no abrió la confirmación. Verifica que tus datos coincidan con los de tu nómina.",
                failedStep = "CODE_MODAL_TIMEOUT",
            )
            return
        }

        // 8. Listo para recibir el código de 5 dígitos del trabajador
        _state.value = TuPerfilRegisterFlowState.AwaitingVerificationCode(
            matricula = input.matricula,
            personalEmail = input.correoPersonal,
            remainingSeconds = 300,
        )
    }

    /**
     * Valida el código de 5 dígitos ingresado por el compañero.
     */
    fun submitVerificationCode(code: String) {
        val cleanCode = code.trim()
        if (cleanCode.length != 5 || !cleanCode.all { it.isDigit() }) {
            val current = _state.value
            if (current is TuPerfilRegisterFlowState.AwaitingVerificationCode) {
                _state.value = current.copy(codeError = "El código debe ser de 5 dígitos numéricos.")
            }
            return
        }

        scope.launch {
            try {
                _state.value = TuPerfilRegisterFlowState.VerifyingCode(cleanCode)
                val wv = webViewReady.await()

                TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.submitVerificationCodeJs(cleanCode))

                // Esperar resultado de verificación
                var isSuccess = false
                var errorMessage: String? = null

                try {
                    withTimeout(VERIFY_TIMEOUT_MS) {
                        while (true) {
                            delay(400)
                            val r = TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.CHECK_CODE_VERIFICATION_RESULT_JS)
                            val status = TarjetonDigitalJson.parseObject(r)?.optString("status")
                            if (status == "SUCCESS") {
                                isSuccess = true
                                break
                            } else if (status == "INVALID_CODE") {
                                errorMessage = TarjetonDigitalJson.parseObject(r)?.optString("message") ?: "El código no coincide. Verifica tu correo."
                                break
                            }
                        }
                    }
                } catch (_: TimeoutCancellationException) {
                    errorMessage = "Tiempo de espera agotado al verificar el código."
                }

                if (isSuccess) {
                    // Guardar credenciales de forma segura en la bóveda
                    withContext(Dispatchers.IO) {
                        ImssVaultManager.saveCredentials(
                            context,
                            ImssPortal.TU_PERFIL,
                            ImssCredentialPayload(
                                username = activeInput.matricula.trim(),
                                password = activeInput.password.trim(),
                            )
                        )
                    }
                    _state.value = TuPerfilRegisterFlowState.Success(matricula = activeInput.matricula)
                } else {
                    _state.value = TuPerfilRegisterFlowState.AwaitingVerificationCode(
                        matricula = activeInput.matricula,
                        personalEmail = activeInput.correoPersonal,
                        codeError = errorMessage ?: "Código no válido. Revisa que esté escrito exactamente como en tu correo.",
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error validando código de verificación", e)
                _state.value = TuPerfilRegisterFlowState.AwaitingVerificationCode(
                    matricula = activeInput.matricula,
                    personalEmail = activeInput.correoPersonal,
                    codeError = "Error al conectar: ${e.message}",
                )
            }
        }
    }

    /**
     * Solicita al portal el reenvío del código al correo.
     */
    fun resendVerificationCode() {
        val current = _state.value
        if (current !is TuPerfilRegisterFlowState.AwaitingVerificationCode) return
        _state.value = current.copy(isResending = true)

        scope.launch {
            try {
                val wv = webViewReady.await()
                TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.CLICK_RESEND_CODE_JS)
                delay(800)
                _state.value = current.copy(
                    isResending = false,
                    remainingSeconds = 300,
                    codeError = null,
                )
            } catch (_: Exception) {
                _state.value = current.copy(isResending = false)
            }
        }
    }

    fun backToEditing() {
        _state.value = TuPerfilRegisterFlowState.Editing(input = activeInput)
    }

    fun reset() {
        currentJob?.cancel()
        currentJob = null
        _state.value = TuPerfilRegisterFlowState.Editing(
            input = activeInput,
            fromTarjetonPrefill = activeInput.matricula.isNotBlank() && activeInput.rfc.isNotBlank(),
        )
    }

    private suspend fun awaitCondition(wv: WebView, timeoutMs: Long, check: suspend () -> Boolean): Boolean {
        return try {
            withTimeout(timeoutMs) {
                while (true) {
                    if (check()) return@withTimeout true
                    delay(350)
                }
                false
            }
        } catch (_: TimeoutCancellationException) {
            false
        }
    }

    private suspend fun awaitSiapCheck(wv: WebView, timeoutMs: Long): String {
        return try {
            withTimeout(timeoutMs) {
                while (true) {
                    val r = TuPerfilWebBridge.evaluateJs(wv, TuPerfilRegisterAdapter.CHECK_SIAP_RESULT_JS)
                    val status = TarjetonDigitalJson.parseObject(r)?.optString("status") ?: ""
                    if (status == "ALREADY_REGISTERED" || status == "READY_TO_FILL" || status == "MATRICULA_ERROR") {
                        return@withTimeout status
                    }
                    delay(400)
                }
                ""
            }
        } catch (_: TimeoutCancellationException) {
            ""
        }
    }

    /**
     * Intenta descubrir datos disponibles del trabajador en la base de datos local y bóveda.
     */
    private suspend fun discoverPrefillData(context: Context): TuPerfilRegisterInput {
        var matricula = ""
        var ooad = ""

        // 1. Tarjetón clásico si ya está en la bóveda
        val tarjetonCreds = try {
            ImssVaultManager.decryptCredentials(context, ImssPortal.TARJETON_DIGITAL)
        } catch (_: Exception) { null }

        if (tarjetonCreds != null) {
            if (tarjetonCreds.username.isNotBlank()) matricula = tarjetonCreds.username.trim()
            if (!tarjetonCreds.delegacionValue.isNullOrBlank()) ooad = tarjetonCreds.delegacionValue.trim()
        }

        // 2. Snapshot offline
        if (matricula.isBlank()) {
            val snap = try { OfflineSnapshotStore.loadForCurrentOwner(context) } catch (_: Exception) { null }
            if (!snap?.profile?.matricula.isNullOrBlank()) {
                matricula = snap!!.profile.matricula!!.trim()
            }
        }

        return TuPerfilRegisterInput(
            matricula = matricula,
            ooadCode = ooad,
        )
    }
}
