package com.laveintedigital.app.scanner

import org.json.JSONObject

/**
 * Opciones normalizadas que la web envía al scanner nativo.
 *
 * Contrato (`window.LaVeinteApp.scanDocument(options)`):
 * ```
 * { mode: "document" | "ine-front" | "ine-back", allowGallery: boolean, pageLimit: number }
 * ```
 *
 * Este parser es puro (unit-testeable en JVM) y tolera payloads incompletos:
 * un modo inválido devuelve `null` y el puente responde `invalid_options` sin abrir UI.
 */
data class ScanDocumentOptions(
    val mode: String,
    val allowGallery: Boolean,
    val pageLimit: Int,
) {
    val isIne: Boolean
        get() = mode == MODE_INE_FRONT || mode == MODE_INE_BACK

    val isIneFront: Boolean
        get() = mode == MODE_INE_FRONT

    companion object {
        const val MODE_DOCUMENT = "document"
        const val MODE_INE_FRONT = "ine-front"
        const val MODE_INE_BACK = "ine-back"

        const val MAX_PAGE_LIMIT = 30
        const val DEFAULT_PAGE_LIMIT = 10

        val VALID_MODES = setOf(MODE_DOCUMENT, MODE_INE_FRONT, MODE_INE_BACK)

        /** Modo por defecto cuando el payload no trae `mode` (compatibilidad). */
        const val MODE_DEFAULT = MODE_DOCUMENT

        fun parse(rawJson: String?): ScanDocumentOptions? {
            val json = runCatching { JSONObject(rawJson ?: "{}") }.getOrNull() ?: JSONObject()
            val mode = json.optString("mode", MODE_DEFAULT).ifBlank { MODE_DEFAULT }
            if (mode !in VALID_MODES) return null
            val allowGallery = json.optBoolean("allowGallery", true)
            val rawLimit = json.optInt("pageLimit", DEFAULT_PAGE_LIMIT)
            val pageLimit = if (rawLimit <= 0) DEFAULT_PAGE_LIMIT else rawLimit.coerceAtMost(MAX_PAGE_LIMIT)
            // INE siempre es una sola captura por cara.
            val effectiveLimit = if (mode == MODE_DOCUMENT) pageLimit else 1
            return ScanDocumentOptions(mode = mode, allowGallery = allowGallery, pageLimit = effectiveLimit)
        }
    }
}
