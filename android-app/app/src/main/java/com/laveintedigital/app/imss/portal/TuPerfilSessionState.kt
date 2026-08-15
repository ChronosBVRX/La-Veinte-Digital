package com.laveintedigital.app.imss.portal

/**
 * Estados del motor de SESIÓN compartido de Tu Perfil IMSS.
 *
 * Una sola cuenta de Tu Perfil IMSS alimenta a Tarjetones y a Registros
 * biométricos. Este estado solo describe la autenticación; cada función
 * (tarjetones / biométricos) mapea estos estados a su propia máquina.
 */
sealed interface TuPerfilSessionState {
    data object CheckingSession : TuPerfilSessionState
    data object LoginRequired : TuPerfilSessionState
    data object WaitingForm : TuPerfilSessionState
    data object FillingForm : TuPerfilSessionState
    data object VerifyingForm : TuPerfilSessionState
    data object SubmittingLogin : TuPerfilSessionState
    data object WaitingAuthentication : TuPerfilSessionState
    data object Authenticated : TuPerfilSessionState
    data class LoginError(
        val kind: PortalLoginErrorKind,
        val portalMessage: String? = null,
    ) : TuPerfilSessionState
    data class Error(val reason: String) : TuPerfilSessionState
}
