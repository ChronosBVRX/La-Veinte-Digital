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

    /**
     * Periodo por defecto: el último que ofrece el portal (el orden del portal
     * es el único criterio fiable sin información adicional).
     */
    fun defaultPeriod(periods: List<BiometricPeriod>): BiometricPeriod? = periods.lastOrNull()

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
