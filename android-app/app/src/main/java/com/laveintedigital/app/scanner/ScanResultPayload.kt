package com.laveintedigital.app.scanner

import org.json.JSONArray
import org.json.JSONObject

/** Una página ya decodificada y recomprimida lista para viajar al WebView. */
data class ScannedPageData(
    val base64: String,
    val mimeType: String,
    val width: Int,
    val height: Int,
)

/**
 * Serialización del resultado del scanner nativo hacia la web.
 *
 * Éxito: `{ ok: true, engine: "mlkit", pages: [{ base64, mimeType, width, height }, ...] }`
 * Fallo: `{ ok: false, reason: "<motivo>" }`
 *
 * Nunca se incluyen datos personales ni rutas del dispositivo, solo los bytes de imagen.
 */
object ScanResultPayload {

    const val ENGINE = "mlkit"

    fun success(pages: List<ScannedPageData>): String {
        val array = JSONArray()
        for (page in pages) {
            array.put(
                JSONObject()
                    .put("base64", page.base64)
                    .put("mimeType", page.mimeType)
                    .put("width", page.width)
                    .put("height", page.height)
            )
        }
        return JSONObject()
            .put("ok", true)
            .put("engine", ENGINE)
            .put("pages", array)
            .toString()
    }

    fun failure(reason: String): String =
        JSONObject()
            .put("ok", false)
            .put("reason", reason)
            .toString()

    /**
     * Motivos estables compartidos con la web:
     * unsupported | play_services_unavailable | cancelled | permission_denied |
     * busy | too_large | invalid_options | failed
     */
    fun mapFailureReason(error: Throwable?): String {
        if (error == null) return "failed"
        val name = error.javaClass.name
        val message = error.message.orEmpty()
        return when {
            name.contains("MlKitException") && message.contains("UNSUPPORTED", ignoreCase = true) -> "unsupported"
            name.contains("MlKitException") -> "unsupported"
            name.contains("GooglePlayServices") || name.contains("ApiException") -> "play_services_unavailable"
            error is SecurityException -> "permission_denied"
            error is java.io.IOException -> "failed"
            else -> "failed"
        }
    }
}
