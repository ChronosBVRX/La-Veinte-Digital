package com.laveintedigital.app.imss.portal

import com.laveintedigital.app.imss.tarjeton.TarjetonDigitalDelegaciones

/**
 * Periodo de comprobante disponible en la pantalla "Generar Tarjetón"
 * (jqGrid `#jqGridTarjetones`). `code` es el valor que se asigna a `#hdnPeriodo`.
 */
data class TarjetonPeriod(
    val code: String,
    val fechas: String = "",
    val observaciones: String = "",
) {
    val displayLabel: String
        get() = buildString {
            append(code)
            if (fechas.isNotBlank()) append(" · ").append(fechas)
        }
}

/**
 * Máquina de estados del flujo de Tarjetón Digital IMSS.
 *
 * Login: CheckingSession → LoadingPage → WaitingIframe → WaitingDom →
 * FillingForm → VerifyingForm → Submitting → WaitingAuthResult →
 * Authenticated (éxito) | LoginError (error clasificado).
 *
 * `MissingFields` justo después de rellenar se trata como fallo de automatización
 * (retry), nunca como culpa del usuario.
 */
sealed interface TarjetonDigitalFlowState {
    data object CheckingSession : TarjetonDigitalFlowState
    data object LoginRequired : TarjetonDigitalFlowState
    data object LoadingPage : TarjetonDigitalFlowState
    data object WaitingIframe : TarjetonDigitalFlowState
    data object WaitingDom : TarjetonDigitalFlowState
    data object FillingForm : TarjetonDigitalFlowState
    data object VerifyingForm : TarjetonDigitalFlowState
    data object Submitting : TarjetonDigitalFlowState
    data object WaitingAuthResult : TarjetonDigitalFlowState
    data object Authenticated : TarjetonDigitalFlowState
    data object ManualMode : TarjetonDigitalFlowState

    data object OpeningTarjetonPage : TarjetonDigitalFlowState
    data class TarjetonReady(
        val periods: List<TarjetonPeriod>,
        val selectedPeriod: TarjetonPeriod?,
        val delegaciones: List<TarjetonDigitalDelegaciones.Delegacion>,
    ) : TarjetonDigitalFlowState
    data object GeneratingTarjeton : TarjetonDigitalFlowState
    data object SavingTarjeton : TarjetonDigitalFlowState
    data class TarjetonSaved(
        val documentId: Long,
        val localPath: String,
        val wasDuplicate: Boolean,
        val periodLabel: String,
    ) : TarjetonDigitalFlowState

    data class LoginError(
        val result: TarjetonDigitalLoginResult,
        val portalMessage: String? = null,
    ) : TarjetonDigitalFlowState
    data class Error(val reason: String) : TarjetonDigitalFlowState
    /** Fallo en la fase de consulta de tarjetones (ya autenticado). NO es un error de login. */
    data class TarjetonError(val reason: String) : TarjetonDigitalFlowState
}
