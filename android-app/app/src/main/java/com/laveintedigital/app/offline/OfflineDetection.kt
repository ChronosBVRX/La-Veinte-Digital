package com.laveintedigital.app.offline

/**
 * Clasificación de errores de WebView para el modo offline.
 *
 * Solo los fallos de CONECTIVIDAD del marco principal activan el fallback offline.
 * Un HTTP 401/403/404/500 del servidor NUNCA se interpreta como "sin Internet"
 * (esos llegan por `onReceivedHttpError`, que no dispara este camino).
 *
 * Códigos = constantes de `android.webkit.WebViewClient` (API 23+):
 *  ERROR_UNKNOWN=-1, ERROR_HOST_LOOKUP=-2, ERROR_CONNECT=-6, ERROR_IO=-7, ERROR_TIMEOUT=-8.
 */
object OfflineDetection {

    const val ERROR_UNKNOWN = -1
    const val ERROR_HOST_LOOKUP = -2
    const val ERROR_CONNECT = -6
    const val ERROR_IO = -7
    const val ERROR_TIMEOUT = -8

    private val CONNECTIVITY_ERRORS = setOf(
        ERROR_UNKNOWN,
        ERROR_HOST_LOOKUP,
        ERROR_CONNECT,
        ERROR_IO,
        ERROR_TIMEOUT,
    )

    /**
     * ¿Este error del marco principal indica pérdida real de conectividad?
     * Errores de archivo, esquema, autenticación, SSL o redirección → false.
     */
    fun isMainFrameConnectivityError(errorCode: Int): Boolean =
        errorCode in CONNECTIVITY_ERRORS

    /** Buckets de la pantalla offline a partir del `source` de Room. */
    enum class DocBucket { TARJETON, CHECADAS, ESCRITO, OTRO }

    fun bucketFor(source: String): DocBucket = when {
        source.contains("BIOMETRIC") -> DocBucket.CHECADAS
        source == "ESCRITO" -> DocBucket.ESCRITO
        source == "TU_PERFIL" || source == "TARJETON_DIGITAL" -> DocBucket.TARJETON
        else -> DocBucket.OTRO
    }

    fun bucketLabel(bucket: DocBucket): String = when (bucket) {
        DocBucket.TARJETON -> "Tarjetón"
        DocBucket.CHECADAS -> "Checadas"
        DocBucket.ESCRITO -> "Escrito"
        DocBucket.OTRO -> "Documento"
    }
}
