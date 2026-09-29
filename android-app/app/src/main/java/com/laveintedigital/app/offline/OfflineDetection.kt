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

    /**
     * Sobrecarga que también inspecciona la descripción textual de Chromium
     * (por ejemplo `net::ERR_INTERNET_DISCONNECTED`, `net::ERR_NAME_NOT_RESOLVED`,
     * `net::ERR_CONNECTION_TIMED_OUT`, `net::ERR_ADDRESS_UNREACHABLE`) por si algún
     * WebView OEM reporta `ERROR_UNKNOWN` u otro código en desconexión total.
     */
    fun isMainFrameConnectivityError(errorCode: Int, description: CharSequence?): Boolean {
        if (errorCode in CONNECTIVITY_ERRORS) return true
        val desc = description?.toString()?.uppercase() ?: return false
        return desc.contains("ERR_INTERNET_DISCONNECTED") ||
            desc.contains("ERR_NAME_NOT_RESOLVED") ||
            desc.contains("ERR_ADDRESS_UNREACHABLE") ||
            desc.contains("ERR_NETWORK_CHANGED") ||
            desc.contains("ERR_CONNECTION_") ||
            desc.contains("ERR_TUNNEL_CONNECTION_FAILED")
    }

    /**
     * ¿La URL corresponde a la página interna de error de Chromium (`chrome-error://`)
     * o a una página en blanco (`about:blank`)?
     */
    fun isInternalErrorUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return true
        val normalized = url.trim().lowercase()
        return normalized.startsWith("chrome-error://") ||
            normalized == "about:blank" ||
            normalized.startsWith("data:")
    }

    /** Buckets de la pantalla offline a partir del `source` de Room. */
    enum class DocBucket { TARJETON, CHECADAS, ESCRITO, NORMATIVA, OTRO }

    fun bucketFor(source: String): DocBucket = when {
        source.contains("BIOMETRIC") -> DocBucket.CHECADAS
        source == "ESCRITO" -> DocBucket.ESCRITO
        source == "NORMATIVA" -> DocBucket.NORMATIVA
        source == "TU_PERFIL" || source == "TARJETON_DIGITAL" -> DocBucket.TARJETON
        else -> DocBucket.OTRO
    }

    fun bucketLabel(bucket: DocBucket): String = when (bucket) {
        DocBucket.TARJETON -> "Tarjetón"
        DocBucket.CHECADAS -> "Checadas"
        DocBucket.ESCRITO -> "Escrito"
        DocBucket.NORMATIVA -> "Normativa"
        DocBucket.OTRO -> "Documento"
    }
}

/**
 * Rastreador puro del ciclo de navegación del marco principal para evitar que el
 * `onPageFinished` posterior a un `onReceivedError` (cuando Chromium termina de
 * renderizar `chrome-error://chromewebdata/`) limpie por accidente el estado
 * `isOffline = true` y deje visible la pantalla cruda `net::ERR_INTERNET_DISCONNECTED`.
 */
class OfflineNavigationTracker {
    @Volatile
    var hasOfflineError: Boolean = false
        private set

    fun onPageStarted(url: String?) {
        if (!OfflineDetection.isInternalErrorUrl(url)) {
            hasOfflineError = false
        }
    }

    fun onMainFrameConnectivityError() {
        hasOfflineError = true
    }

    fun shouldCommitOnlineOnPageFinished(url: String?, isInternalHost: Boolean): Boolean {
        if (hasOfflineError) return false
        if (OfflineDetection.isInternalErrorUrl(url)) return false
        return isInternalHost
    }
}

