package com.laveintedigital.app.internal.navigation

/**
 * Protocolo mínimo del detector SPA inyectado (ver [NavFeedbackDetector]).
 *
 * Solo viaja información de navegación mínima:
 * `{"event":"intent","path":"/calculadoras"}` o
 * `{"event":"commit","path":"/calculadoras"}` con `gen` opcional.
 *
 * NUNCA viajan cookies, tokens, queries sensibles ni datos laborales: el path
 * se valida (mismo formato que una ruta interna) y todo lo demás se ignora.
 */
internal sealed interface NavFeedbackEvent {
    data class Intent(val path: String, val pageGen: Long?) : NavFeedbackEvent
    data class Commit(val path: String, val pageGen: Long?) : NavFeedbackEvent
    data object Invalid : NavFeedbackEvent
}

internal object NavFeedbackEvents {

    fun parse(raw: String?): NavFeedbackEvent {
        if (raw.isNullOrBlank()) return NavFeedbackEvent.Invalid
        val event = extractString(raw, "event") ?: return NavFeedbackEvent.Invalid
        if (event != "intent" && event != "commit") return NavFeedbackEvent.Invalid
        val path = extractString(raw, "path") ?: return NavFeedbackEvent.Invalid
        if (!isUsablePath(path)) return NavFeedbackEvent.Invalid
        val pageGen = extractLong(raw, "gen")
        if (pageGen != null && pageGen < 0) return NavFeedbackEvent.Invalid
        return if (event == "intent") NavFeedbackEvent.Intent(path, pageGen)
        else NavFeedbackEvent.Commit(path, pageGen)
    }

    private fun isUsablePath(path: String): Boolean {
        if (path.isEmpty() || path.length > NavFeedbackConfig.MAX_PATH_LENGTH) return false
        if (!path.startsWith("/")) return false
        // Sin espacios ni caracteres de control: solo una ruta interna simple.
        return path.none { it.isWhitespace() || it < ' ' }
    }

    /** Extrae un valor string JSON `"key":"value"` sin librerías (nunca lanza). */
    private fun extractString(raw: String, key: String): String? {
        val needle = "\"$key\""
        var idx = raw.indexOf(needle)
        while (idx >= 0) {
            var i = idx + needle.length
            while (i < raw.length && raw[i].isWhitespace()) i++
            if (i < raw.length && raw[i] == ':') {
                i++
                while (i < raw.length && raw[i].isWhitespace()) i++
                if (i < raw.length && raw[i] == '"') {
                    val out = StringBuilder()
                    i++
                    while (i < raw.length) {
                        val c = raw[i]
                        if (c == '\\' && i + 1 < raw.length) {
                            // Solo se aceptan escapes simples; lo demás invalida.
                            val e = raw[i + 1]
                            if (e == '"' || e == '\\' || e == '/') {
                                out.append(e)
                                i += 2
                                continue
                            }
                            return null
                        }
                        if (c == '"') return out.toString()
                        out.append(c)
                        i++
                    }
                    return null
                }
                return null
            }
            idx = raw.indexOf(needle, idx + 1)
        }
        return null
    }

    private fun extractLong(raw: String, key: String): Long? {
        val needle = "\"$key\""
        var idx = raw.indexOf(needle)
        while (idx >= 0) {
            var i = idx + needle.length
            while (i < raw.length && raw[i].isWhitespace()) i++
            if (i < raw.length && raw[i] == ':') {
                i++
                while (i < raw.length && raw[i].isWhitespace()) i++
                // Un signo negativo es basura explícita (luego se invalida).
                if (i < raw.length && raw[i] == '-') return -1L
                val start = i
                while (i < raw.length && (raw[i].isDigit())) i++
                if (start == i) return null
                return raw.substring(start, i).toLongOrNull()
            }
            idx = raw.indexOf(needle, idx + 1)
        }
        return null
    }
}
