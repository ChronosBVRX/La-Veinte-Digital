package com.laveintedigital.app.imss.register

/**
 * Máquina de estados para el flujo asistido de registro en Tu Perfil IMSS.
 */
sealed interface TuPerfilRegisterFlowState {

    /** Formulario interactivo en pantalla nativa */
    data class Editing(
        val input: TuPerfilRegisterInput,
        val validationError: String? = null,
        val isCheckingSiap: Boolean = false,
        val fromTarjetonPrefill: Boolean = false,
    ) : TuPerfilRegisterFlowState

    /** El portal del IMSS reportó que la matrícula ya tiene cuenta activa */
    data class AccountAlreadyExists(
        val matricula: String,
        val message: String = "La matrícula que ingresaste ya cuenta con registro en Tu Perfil IMSS.",
    ) : TuPerfilRegisterFlowState

    /** Conectando con el portal oficial y enviando la solicitud */
    data class Submitting(
        val stepMessage: String = "Conectando con Tu Perfil IMSS…",
    ) : TuPerfilRegisterFlowState

    /** Solicitud aceptada por el IMSS; esperando el código de 5 dígitos del correo */
    data class AwaitingVerificationCode(
        val matricula: String,
        val personalEmail: String,
        val remainingSeconds: Int = 300,
        val codeError: String? = null,
        val isResending: Boolean = false,
    ) : TuPerfilRegisterFlowState

    /** Verificando el código de 5 dígitos en el portal */
    data class VerifyingCode(
        val code: String,
    ) : TuPerfilRegisterFlowState

    /** Cuenta activada con éxito y credenciales guardadas en la bóveda */
    data class Success(
        val matricula: String,
        val message: String = "¡Tu cuenta ha sido creada y activada con éxito!",
    ) : TuPerfilRegisterFlowState

    /** Error reportado por el portal oficial */
    data class Error(
        val message: String,
        val canRetry: Boolean = true,
        val failedStep: String = "",
    ) : TuPerfilRegisterFlowState
}
