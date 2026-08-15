package com.laveintedigital.app.imss.portal

/**
 * Resultado clasificado de un intento de login en Tarjetón Digital IMSS.
 * La clasificación se hace a partir del texto exacto que devuelve el portal
 * (ver [TarjetonDigitalLoginErrorParser]).
 */
sealed interface TarjetonDigitalLoginResult {

    data object Success : TarjetonDigitalLoginResult

    /** Contraseña/usuario/delegación incorrectos. */
    data object InvalidCredentials : TarjetonDigitalLoginResult

    /** Faltan campos (delegación/usuario/contraseña vacíos). */
    data object MissingFields : TarjetonDigitalLoginResult

    /** Cuenta bloqueada, no activa o no autorizada. */
    data object AccountLocked : TarjetonDigitalLoginResult

    /** La sesión expiró. */
    data object SessionExpired : TarjetonDigitalLoginResult

    /** Portal caído / no disponible / ocupado. */
    data object ServiceUnavailable : TarjetonDigitalLoginResult

    /** Mensaje del portal no clasificado, pero real (se muestra tal cual). */
    data class PortalError(val originalMessage: String) : TarjetonDigitalLoginResult

    /** Sin mensaje o mensaje irreconocible. */
    data class UnknownError(val originalMessage: String?) : TarjetonDigitalLoginResult
}

/**
 * Parser puro de mensajes de error de Tarjetón Digital IMSS.
 * No toca red ni DOM: recibe el texto detectado y devuelve la clasificación.
 *
 * Los textos se obtuvieron del `jsAcceso.js` real del portal (fnValidaUsuario /
 * fnMuestraMensaje). No se inventan.
 */
object TarjetonDigitalLoginErrorParser {

    /** Indica si el resultado es responsabilidad del portal (no del usuario). */
    fun isPortalFault(result: TarjetonDigitalLoginResult): Boolean =
        result is TarjetonDigitalLoginResult.ServiceUnavailable ||
                result is TarjetonDigitalLoginResult.SessionExpired

    fun classify(message: String?): TarjetonDigitalLoginResult? {
        if (message.isNullOrBlank()) return null
        val m = normalize(message)
        fun has(vararg keys: String) = keys.any { m.contains(normalize(it)) }

        return when {
            has("contraseña incorrecta", "contraseña incorrecta, intenté nuevamente", "intente nuevamente") ->
                TarjetonDigitalLoginResult.InvalidCredentials
            has("datos del usuario incorrectos", "trabajador no encontrado", "administrador no pertenece") ->
                TarjetonDigitalLoginResult.InvalidCredentials
            has("usuario no encontrado", "nuevo registro") ->
                TarjetonDigitalLoginResult.InvalidCredentials
            has("es necesario seleccionar la delegación", "es necesario capturar el usuario", "es necesario capturar la contraseña") ->
                TarjetonDigitalLoginResult.MissingFields
            has("trabajador no activo", "no autorizado", "administrador no activo", "cuenta desactivada", "bloqueada", "bloqueado") ->
                TarjetonDigitalLoginResult.AccountLocked
            has("sesión ha expirado", "sesion ha expirado", "sesión expirada", "sesion expirada", "firmarse nuevamente") ->
                TarjetonDigitalLoginResult.SessionExpired
            has("no es posible acceder a la página", "intente más tarde", "sistema ocupado", "intentarlo mas tarde", "servicio no disponible", "no disponible") ->
                TarjetonDigitalLoginResult.ServiceUnavailable
            has("tipo de contratación no permitido", "tipo de contratacion no permitido", "aun no cuenta con algun tarjeton", "tarjeton digital para consultar") ->
                TarjetonDigitalLoginResult.PortalError(message)
            else -> TarjetonDigitalLoginResult.UnknownError(message)
        }
    }

    /** Normaliza para comparación: minúsculas, sin acentos, espacios colapsados. */
    fun normalize(message: String): String =
        message.lowercase()
            .replace("á", "a").replace("é", "e").replace("í", "i")
            .replace("ó", "o").replace("ú", "u").replace("ü", "u").replace("ñ", "n")
            .replace(Regex("""\s+"""), " ")
            .trim()
}
