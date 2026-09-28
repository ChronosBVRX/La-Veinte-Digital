package com.laveintedigital.app.imss.portal

/**
 * Política pura de protección contra bloqueo de cuentas en los portales del IMSS
 * (`Tu Perfil IMSS` y `Tarjetón Digital`).
 *
 * Ambos portales oficiales bloquean la cuenta del trabajador tras varios intentos
 * fallidos consecutivos. Dado que muchos trabajadores confunden la contraseña de
 * `Tu Perfil IMSS` (`tuperfil.imss.gob.mx`) con la de `Tarjetón Digital`
 * (`rh.imss.gob.mx`) o con la de `La Veinte Digital`, esta política aplica dos
 * barreras de seguridad:
 *
 * 1. **Auto-limpieza en fallo de auto-login**: Si la bóveda tenía guardada una
 *    contraseña obsoleta o incorrecta y el portal la rechaza (`BAD_CREDENTIALS` /
 *    `InvalidCredentials`), se elimina de inmediato para que reabrir la pantalla
 *    no siga disparando intentos automáticos que bloqueen la cuenta.
 * 2. **Freno preventivo anti-bloqueo (`MAX_SAFE_ATTEMPTS = 2`)**: Al alcanzar 2
 *    intentos fallidos de credenciales en la sesión, se activa el freno preventivo
 *    para detener reintentos automáticos a ciegas y dirigir al usuario a cambiar
 *    de portal o verificar directamente en el portal oficial.
 */
object ImssLoginProtectionPolicy {

    /**
     * Número máximo de intentos fallidos de credenciales antes de activar el
     * freno preventivo anti-bloqueo.
     */
    const val MAX_SAFE_ATTEMPTS = 2

    fun countsAsTuPerfilCredentialFailure(kind: PortalLoginErrorKind): Boolean =
        kind == PortalLoginErrorKind.BAD_CREDENTIALS ||
            kind == PortalLoginErrorKind.ACCOUNT_LOCKED_OR_UNREGISTERED

    fun countsAsTarjetonDigitalCredentialFailure(result: TarjetonDigitalLoginResult): Boolean =
        result is TarjetonDigitalLoginResult.InvalidCredentials ||
            result is TarjetonDigitalLoginResult.AccountLocked

    fun nextFailedAttempts(currentFailedAttempts: Int, isCredentialFailure: Boolean): Int =
        if (isCredentialFailure) currentFailedAttempts + 1 else currentFailedAttempts

    fun shouldClearSavedTuPerfilCredentials(
        wasAutoLogin: Boolean,
        kind: PortalLoginErrorKind,
    ): Boolean = wasAutoLogin && countsAsTuPerfilCredentialFailure(kind)

    fun shouldClearSavedTarjetonDigitalCredentials(
        wasAutoLogin: Boolean,
        result: TarjetonDigitalLoginResult,
    ): Boolean = wasAutoLogin && countsAsTarjetonDigitalCredentialFailure(result)

    fun isLockoutGuardActive(failedAttempts: Int): Boolean =
        failedAttempts >= MAX_SAFE_ATTEMPTS
}
