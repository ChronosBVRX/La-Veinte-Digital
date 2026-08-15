package com.laveintedigital.app.imss.biometric

import android.util.Log
import com.laveintedigital.app.BuildConfig

/**
 * Logger estructurado de la función "Registros biométricos" (SOLO DEBUG).
 *
 * Cada evento tiene: timestamp, operationId (`BIO#N`), generation, stage,
 * event, result y details SANITIZADOS (nunca contraseñas, cookies, tokens,
 * matrícula, nombre, IP biométrico, horarios ni contenido de documentos).
 *
 * - Logcat: tag `LVD_BIOMETRIC_TRACE` en formato clave=valor (op=41
 *   stage=APPLY_OOAD event=OPTION_SEARCH result=true d=420ms).
 * - Memoria: buffer circular de los últimos [CAPACITY] eventos; en DEBUG la
 *   UI puede copiar [copySanitizedReport] desde el teléfono sin Android
 *   Studio (botón "Copiar diagnóstico").
 * - En release todas las funciones son no-op.
 */
object BiometricTrace {

    /** Tag de Logcat de la traza estructurada. */
    const val TRACE_TAG = "LVD_BIOMETRIC_TRACE"

    /** Máximo de eventos en memoria. */
    const val CAPACITY = 200

    private val ENABLED = BuildConfig.DEBUG

    /** Un evento estructurado de la traza. */
    data class TraceEvent(
        val at: Long,
        val op: Int?,
        val gen: Int?,
        val stage: String,
        val event: String,
        val result: Boolean?,
        val details: String?,
        val durationMs: Long?,
    ) {
        /** Línea clave=valor para Logcat. */
        fun toLogLine(): String = buildString {
            append("op=").append(op ?: "-")
            append(" gen=").append(gen ?: "-")
            append(" stage=").append(stage)
            append(" event=").append(event)
            result?.let { append(" result=").append(it) }
            durationMs?.let { append(" d=").append(it).append("ms") }
            details?.let { append(" details=").append(it) }
        }
    }

    private val ring = ArrayDeque<TraceEvent>()

    /** Limpia el buffer (al entrar a la pantalla). */
    fun reset() {
        if (!ENABLED) return
        synchronized(ring) { ring.clear() }
    }

    /**
     * Registra un evento de traza. Todos los campos opcionales deben estar
     * SANITIZADOS antes de llegar aquí.
     */
    fun trace(
        op: Int?,
        gen: Int?,
        stage: String,
        event: String,
        result: Boolean? = null,
        details: String? = null,
        durationMs: Long? = null,
    ) {
        if (!ENABLED) return
        val e = TraceEvent(
            at = System.currentTimeMillis(),
            op = op,
            gen = gen,
            stage = stage,
            event = event,
            result = result,
            details = details?.take(600),
            durationMs = durationMs,
        )
        synchronized(ring) {
            ring.addLast(e)
            while (ring.size > CAPACITY) ring.removeFirst()
        }
        Log.i(TRACE_TAG, e.toLogLine())
    }

    /** Último operationId registrado (o null si no hay eventos). */
    fun lastOperation(): Int? = synchronized(ring) { ring.lastOrNull()?.op }

    /** Copia inmutable de los eventos (para reportes/tests). */
    fun events(): List<TraceEvent> = synchronized(ring) { ring.toList() }

    /**
     * Reporte diagnóstico SANITIZADO en memoria, listo para copiar al
     * portapapeles. Formato agregado, sin datos personales.
     */
    fun copySanitizedReport(): String = synchronized(ring) {
        if (!ENABLED) return "=== LVD BIOMETRIC TRACE ===\n(disponible solo en builds DEBUG)"
        val events = ring.toList()
        if (events.isEmpty()) return "=== LVD BIOMETRIC TRACE ===\nsin eventos registrados"
        buildReport(events)
    }

    /* ── Reporte agregado (sin datos personales) ─────────────────────────── */

    private fun buildReport(events: List<TraceEvent>): String {
        val sb = StringBuilder()
        sb.appendLine("=== LVD BIOMETRIC TRACE ===")
        sb.appendLine("buildType=debug")

        // Operaciones presentes (en orden).
        val ops = events.mapNotNull { it.op }.distinct()
        val lastOp = ops.lastOrNull()
        sb.appendLine(if (ops.isEmpty()) "operations=-" else "operations=${ops.joinToString(",") { "BIO#$it" }}")
        if (lastOp != null) sb.appendLine("operation=$lastOp")
        sb.appendLine()

        // Timeline de transiciones de la última operación.
        val lastOpEvents = events.filter { it.op == lastOp }.takeLast(60)
        val transitions = lastOpEvents.filter { it.event == "TRANSITION" }
        if (transitions.isNotEmpty()) {
            sb.appendLine("TRANSITIONS:")
            sb.appendLine("  ${(listOf("BIO#$lastOp") + transitions.map { it.stage }).joinToString(" → ")}")
            sb.appendLine()
        }

        // Secciones por etapa (primer/último evento relevante por sección).
        sb.appendLine("ROUTE:")
        appendBoolSection(sb, events, "ROUTE", "ROUTE_READY", okText = "OK", failText = "FAIL")
        appendKvSection(sb, events, "ROUTE", "READINESS")

        sb.appendLine("FORM:")
        appendBoolSection(sb, events, "FORM", "FORM_READY", okText = "OK", failText = "FAIL")

        sb.appendLine("OOAD:")
        appendKvSection(sb, events, "OOAD", "CONTROL_INFO")
        appendKvSection(sb, events, "OOAD", "READ", prefix = "  ")
        appendKvSection(sb, events, "OOAD", "VERIFIED", prefix = "  ")
        sb.appendLine("  control=${findResult(events, "OOAD", "CONTROL_FOUND")}")
        sb.appendLine("  option=${findResult(events, "OOAD", "OPTION_FOUND")}")
        sb.appendLine("  verified=${findResult(events, "OOAD", "VERIFIED")}")

        sb.appendLine("PERIODS:")
        appendKvSection(sb, events, "PERIODS", "DISCOVERED", prefix = "  ")

        sb.appendLine("NATIVE_SELECTION:")
        appendKvSection(sb, events, "NATIVE_SELECTION", "PERIOD_SELECTED", prefix = "  ")

        sb.appendLine("APPLY_PERIOD:")
        appendKvSection(sb, events, "APPLY_PERIOD", "SUMMARY", prefix = "  ")
        sb.appendLine("  control=${findResult(events, "APPLY_PERIOD", "CONTROL_FOUND")}")
        sb.appendLine("  overlay=${findResult(events, "APPLY_PERIOD", "OVERLAY_OPENED")}")
        sb.appendLine("  options=${findKv(events, "APPLY_PERIOD", "OPTIONS", "count") ?: "?"}")
        sb.appendLine("  target=${findResult(events, "APPLY_PERIOD", "OPTION_FOUND")}")
        sb.appendLine("  verified=${findResult(events, "APPLY_PERIOD", "VERIFIED")}")

        sb.appendLine("QUERY:")
        appendKvSection(sb, events, "SUBMIT", "DONE", prefix = "  ")
        appendKvSection(sb, events, "QUERY_ACTIVITY")
        appendKvSection(sb, events, "RESULTS", "DETECTED", prefix = "  ")

        sb.appendLine("DOWNLOAD:")
        appendKvSection(sb, events, "FIND_DOWNLOAD")
        appendKvSection(sb, events, "DOWNLOAD")

        sb.appendLine("JS_ERRORS:")
        appendKvSection(sb, events, "JS")

        val failed = lastOpEvents.firstOrNull { it.event == "FAILED" }
        sb.appendLine()
        sb.appendLine("RESULT:")
        if (failed != null) {
            sb.appendLine("  FAILED stage=${failed.stage} code=${failed.details?.removePrefix("code=") ?: "?"}")
        } else {
            val done = lastOpEvents.firstOrNull { it.event == "TRANSITION" && it.stage == "Results" }
            sb.appendLine("  ${if (done != null) "results=detected" else "results=?"}")
        }

        sb.appendLine()
        sb.appendLine("NETWORK (últimas 12):")
        val netEvents = events.filter { it.stage == "NET" }.takeLast(12)
        if (netEvents.isEmpty()) {
            sb.appendLine("  sin peticiones observadas")
        } else {
            netEvents.forEach { e ->
                sb.appendLine("  ${e.details ?: "-"}${e.durationMs?.let { " d=${it}ms" } ?: ""}")
            }
            sb.appendLine("  ${netEvents.size} peticiones en buffer")
        }
        return sb.toString()
    }

    private fun appendBoolSection(sb: StringBuilder, events: List<TraceEvent>, stage: String, event: String, okText: String, failText: String) {
        val e = events.lastOrNull { it.stage == stage && it.event == event }
        sb.append("  ").appendLine(if (e?.result == true) okText else if (e?.result == false) failText else "?")
    }

    private fun appendKvSection(sb: StringBuilder, events: List<TraceEvent>, stage: String, event: String? = null, prefix: String = "  ") {
        val e = if (event != null) events.lastOrNull { it.stage == stage && it.event == event }
        else events.lastOrNull { it.stage == stage && it.details != null }
        val details = e?.details ?: return
        sb.append(prefix).appendLine(details)
    }

    private fun findResult(events: List<TraceEvent>, stage: String, event: String): Boolean? =
        events.lastOrNull { it.stage == stage && it.event == event }?.result

    private fun findKv(events: List<TraceEvent>, stage: String, event: String, key: String): String? =
        events.lastOrNull { it.stage == stage && it.event == event }?.details
            ?.split(" ")
            ?.firstOrNull { it.startsWith("$key=") }
            ?.substringAfter("=")
}