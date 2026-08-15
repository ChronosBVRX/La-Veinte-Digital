package com.laveintedigital.app.imss.portal

import com.laveintedigital.app.imss.biometric.BiometricErrorKind
import com.laveintedigital.app.imss.biometric.BiometricPeriod
import com.laveintedigital.app.imss.biometric.BiometricRecord

/**
 * Máquina de estados explícita de la función "Registros biométricos".
 *
 * La AUTENTICACIÓN es compartida: los estados de login viven en
 * [TuPerfilSessionController]/[TuPerfilSessionState] y aquí se resumen como
 * [Authenticating]/[LoginRequired]/[LoginError]. Todo lo demás es exclusivo
 * de la consulta de checadas.
 */
sealed interface TuPerfilBiometricFlowState {

    /** Comprobando si ya existe una sesión válida de Tu Perfil IMSS. */
    data object CheckingSession : TuPerfilBiometricFlowState

    /** No hay credenciales guardadas; se muestra el diálogo compartido de login. */
    data object LoginRequired : TuPerfilBiometricFlowState

    /** Auto-login o login con credenciales en curso. */
    data object Authenticating : TuPerfilBiometricFlowState

    /** Navegando a /app/administration/biometric/consult-period. */
    data object OpeningBiometrics : TuPerfilBiometricFlowState

    /** Esperando el DOM de la página de consulta (Angular). */
    data object WaitingBiometricDom : TuPerfilBiometricFlowState

    /** Descubriendo el control real de OOAD y sus opciones (17 Michoacán). */
    data object ReadingOoads : TuPerfilBiometricFlowState

    /** Aplicando la OOAD preferida (17 — Michoacán) y verificándola. */
    data object ApplyingOoad : TuPerfilBiometricFlowState

    /** Esperando a que Angular repueble el selector de Periodo tras la OOAD. */
    data object WaitingPeriodsForOoad : TuPerfilBiometricFlowState

    /** Abriendo el selector y leyendo los periodos del portal (ya con OOAD). */
    data object ReadingPeriods : TuPerfilBiometricFlowState

    /** Periodos disponibles; el trabajador elige. */
    data class PeriodSelection(
        val periods: List<BiometricPeriod>,
    ) : TuPerfilBiometricFlowState

    /** Aplicando el periodo elegido en el selector del portal. */
    data object ApplyingPeriod : TuPerfilBiometricFlowState

    /** Verificando que el periodo quedó seleccionado (script independiente). */
    data object VerifyingPeriod : TuPerfilBiometricFlowState

    /** Pulsando el botón de consulta. */
    data object SubmittingQuery : TuPerfilBiometricFlowState

    /** Esperando la respuesta del portal (tabla / vacío / error). */
    data object WaitingResults : TuPerfilBiometricFlowState

    /** Extrayendo y normalizando los registros del DOM. */
    data object ReadingResults : TuPerfilBiometricFlowState

    /** Resultados extraídos y listos para mostrar en Compose. */
    data class Results(
        val period: BiometricPeriod,
        val records: List<BiometricRecord>,
    ) : TuPerfilBiometricFlowState

    /** El portal respondió correctamente pero sin checadas. */
    data class Empty(
        val period: BiometricPeriod,
    ) : TuPerfilBiometricFlowState

    /** Error propio de la consulta (no de login). */
    data class Error(
        val kind: BiometricErrorKind,
        val message: String,
    ) : TuPerfilBiometricFlowState

    /** Error de login clasificado (reutiliza `PortalLoginErrorKind`). */
    data class LoginError(
        val kind: PortalLoginErrorKind,
        val portalMessage: String? = null,
    ) : TuPerfilBiometricFlowState

    /** La sesión venció en plena operación (o la reautenticación falló). */
    data object SessionExpired : TuPerfilBiometricFlowState

    /** Fallback: el trabajador usa directamente el formulario original del portal. */
    data object ManualMode : TuPerfilBiometricFlowState
}
