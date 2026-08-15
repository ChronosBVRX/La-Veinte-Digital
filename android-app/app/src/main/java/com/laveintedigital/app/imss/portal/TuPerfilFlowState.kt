package com.laveintedigital.app.imss.portal

import com.laveintedigital.app.imss.tarjeton.ImssPeriodOption
import com.laveintedigital.app.imss.tarjeton.PortalOoad

/**
 * Clasificación de errores detectados en el login de Tu Perfil IMSS.
 * No todos deben mostrarse igual:
 * - [FIELDS_REQUIRED]: fallo interno de automatización (Angular ve vacíos) →
 *   rellenar y reintentar, NUNCA culpar al usuario.
 * - [BAD_CREDENTIALS]: matrícula/contraseña incorrectas → "Revisar datos".
 * - [ACCOUNT_LOCKED_OR_UNREGISTERED]: cuenta bloqueada / no registrada.
 * - [SERVICE_UNAVAILABLE]: portal caído / servicio no disponible.
 * - [UNKNOWN]: mensaje del IMSS no clasificado → mostrar el texto detectado.
 * - [TIMEOUT]: el servidor no respondió.
 */
enum class PortalLoginErrorKind {
    FIELDS_REQUIRED,
    BAD_CREDENTIALS,
    ACCOUNT_LOCKED_OR_UNREGISTERED,
    SERVICE_UNAVAILABLE,
    UNKNOWN,
    TIMEOUT,
}

sealed interface TuPerfilFlowState {
    data object CheckingSession : TuPerfilFlowState
    data object LoginRequired : TuPerfilFlowState
    data object WaitingForm : TuPerfilFlowState
    data object FillingForm : TuPerfilFlowState
    data object VerifyingForm : TuPerfilFlowState
    data object LoadingLoginPage : TuPerfilFlowState
    data object ApplyingCredentials : TuPerfilFlowState
    data object SubmittingLogin : TuPerfilFlowState
    data object WaitingAuthentication : TuPerfilFlowState
    data object Authenticated : TuPerfilFlowState
    data object OpeningCardPage : TuPerfilFlowState
    data object PreparingCardForm : TuPerfilFlowState
    data class Ready(
        val ooadOptions: List<PortalOoad>,
        val selectedOoad: PortalOoad?,
        val periodOptions: List<ImssPeriodOption>,
        val selectedPeriod: ImssPeriodOption?,
    ) : TuPerfilFlowState
    data object GeneratingTarjeton : TuPerfilFlowState
    data object SavingTarjeton : TuPerfilFlowState
    data class TarjetonSaved(
        val documentId: Long,
        val localPath: String,
        val wasDuplicate: Boolean,
        val ooadLabel: String,
        val periodLabel: String,
    ) : TuPerfilFlowState
    data class Completed(val message: String = "Tarjetón guardado") : TuPerfilFlowState
    data class LoginError(
        val kind: PortalLoginErrorKind,
        val portalMessage: String? = null,
    ) : TuPerfilFlowState
    data class Error(val reason: String) : TuPerfilFlowState
}
