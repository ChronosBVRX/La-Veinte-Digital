package com.laveintedigital.app.imss.biometric

import java.text.Normalizer

/**
 * Decisiones puras del flujo biométricos — separadas del controlador para que
 * sean comprobables en tests unitarios sin WebView.
 */
object BiometricFlowPolicy {

    /** Máximo de reautenticaciones automáticas por operación (anti-loop). */
    const val MAX_REAUTHS = 1

    /** OOAD preferida por defecto: 17 — Michoacán. */
    const val DEFAULT_OOAD_VALUE = "17"
    const val DEFAULT_OOAD_LABEL = "Michoacán"

    enum class EntryAction { USE_SESSION, AUTO_LOGIN, LOGIN_REQUIRED }

    /**
     * Normaliza texto para comparar selectores del portal: NFD (separa
     * diacríticos), minúsculas, sin acentos y con espacios colapsados.
     */
    fun normalize(text: String?): String = (text ?: "")
        .let { Normalizer.normalize(it, Normalizer.Form.NFD) }
        .replace(Regex("[\\u0300-\\u036f]"), "")
        .trim()
        .lowercase()
        .replace(Regex("\\s+"), " ")

    /**
     * Resuelve la OOAD preferida (17 — Michoacán) desde las opciones REALES
     * del portal. Regla: primero por valor real == "17"; como respaldo, label
     * normalizado que contenga "michoacan". Nunca inventa posiciones
     * (`mat-option:nth-child(17)` ni similares).
     */
    fun selectOoad(ooads: List<BiometricOoad>): BiometricOoad? {
        val byValue = ooads.firstOrNull { normalize(it.value) == DEFAULT_OOAD_VALUE }
            ?: ooads.firstOrNull { normalize(it.value) == "0$DEFAULT_OOAD_VALUE" }
        if (byValue != null) return byValue
        return ooads.firstOrNull { "michoacan" in normalize(it.label) }
    }

    /**
     * Decide la entrada a la función biométricos.
     * La sesión y las credenciales son las MISMAS que usa Tarjetones
     * (identidad única `ImssPortal.TU_PERFIL`).
     */
    fun entryAction(authenticatedPath: Boolean, hasCredentials: Boolean): EntryAction = when {
        authenticatedPath -> EntryAction.USE_SESSION
        hasCredentials -> EntryAction.AUTO_LOGIN
        else -> EntryAction.LOGIN_REQUIRED
    }

    private val PERIOD_CODE_7_REGEX = Regex("""\b(20\d{2})(\d{3})\b""")
    private val PERIOD_CODE_6_REGEX = Regex("""\b(20\d{2})(\d{2})\b""")
    private val YEAR_REGEX = Regex("""\b(20\d{2})\b""")

    private val MONTH_MAP = mapOf(
        "enero" to 1,
        "febrero" to 2,
        "marzo" to 3,
        "abril" to 4,
        "mayo" to 5,
        "junio" to 6,
        "julio" to 7,
        "agosto" to 8,
        "septiembre" to 9,
        "setiembre" to 9,
        "octubre" to 10,
        "noviembre" to 11,
        "diciembre" to 12,
    )

    /**
     * Extrae una clave numérica cronológica (mayor = más reciente) para un
     * periodo del portal IMSS.
     *
     * Soporta:
     *  - Código oficial de 7 dígitos `YYYYPPP` (ej. `2026019 (1ra - OCTUBRE)` o `2025001 (1ra - ENERO)`).
     *  - Código de 6 dígitos `YYYYPP` (ej. `202619`).
     *  - Texto en español con año, mes y quincena (ej. `2ª quincena de septiembre 2026`).
     */
    fun periodSortKey(period: BiometricPeriod): Long? {
        val combined = "${period.value} ${period.label}"
        PERIOD_CODE_7_REGEX.find(combined)?.let { m ->
            val year = m.groupValues[1].toLongOrNull()
            val seq = m.groupValues[2].toLongOrNull()
            if (year != null && seq != null) return year * 1000L + seq
        }
        PERIOD_CODE_6_REGEX.find(combined)?.let { m ->
            val year = m.groupValues[1].toLongOrNull()
            val seq = m.groupValues[2].toLongOrNull()
            if (year != null && seq != null) return year * 1000L + seq
        }
        val norm = normalize(combined)
        val year = YEAR_REGEX.find(norm)?.groupValues?.get(1)?.toLongOrNull() ?: return null
        val month = MONTH_MAP.entries.firstOrNull { (name, _) -> norm.contains(name) }?.value ?: return null
        val half = when {
            norm.contains("2da") || norm.contains("2a") || norm.contains("2ª") || norm.contains("segunda") -> 2L
            else -> 1L
        }
        val quincenaOfYear = (month - 1) * 2L + half
        return year * 1000L + quincenaOfYear
    }

    /**
     * Ordena la lista de periodos dejando SIEMPRE el más reciente al principio
     * (índice 0). Si el portal devuelve códigos cronológicos, ordena de mayor a
     * menor; si no hay claves reconocibles, conserva el orden original.
     */
    fun sortNewestFirst(periods: List<BiometricPeriod>): List<BiometricPeriod> {
        if (periods.size <= 1) return periods
        val hasAnyKey = periods.any { periodSortKey(it) != null }
        if (!hasAnyKey) return periods
        return periods.sortedByDescending { periodSortKey(it) ?: Long.MIN_VALUE }
    }

    /**
     * Periodo por defecto: SIEMPRE el más reciente disponible en el portal
     * (nunca el más antiguo como `2025001 (1ra - ENERO)` al final de la lista).
     */
    fun defaultPeriod(periods: List<BiometricPeriod>): BiometricPeriod? =
        sortNewestFirst(periods).firstOrNull()

    /**
     * Restaura el periodo previo tras una reautenticación. Prioriza igualdad
     * exacta de valor+label, luego valor, luego label.
     */
    fun restorePeriod(periods: List<BiometricPeriod>, previous: BiometricPeriod?): BiometricPeriod? {
        if (previous == null) return null
        return periods.firstOrNull { it.value == previous.value && it.label == previous.label }
            ?: periods.firstOrNull { it.value == previous.value }
            ?: periods.firstOrNull { it.label == previous.label }
    }

    /** ¿Todavía se permite una reautenticación automática? */
    fun canReauth(reauthCount: Int): Boolean = reauthCount < MAX_REAUTHS

    /**
     * Cómo falló la lectura de periodos tras agotar los reintentos. Sirve para
     * distinguir el error correcto (nunca "el portal cambió" a la primera).
     */
    enum class PeriodsFailure { CONTROL_NOT_FOUND, EMPTY_OPTIONS, TIMEOUT }

    /** Traduce el modo de fallo de lectura de periodos al error adecuado. */
    fun periodsFailureKind(failure: PeriodsFailure?): BiometricErrorKind = when (failure) {
        PeriodsFailure.CONTROL_NOT_FOUND -> BiometricErrorKind.DOM_NOT_RECOGNIZED
        PeriodsFailure.EMPTY_OPTIONS -> BiometricErrorKind.PERIODS_NOT_READABLE
        else -> BiometricErrorKind.PERIODS_TIMEOUT
    }
}
