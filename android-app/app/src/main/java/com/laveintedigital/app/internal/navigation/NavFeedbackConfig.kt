package com.laveintedigital.app.internal.navigation

/**
 * Constantes del feedback nativo de navegación (único lugar donde viven los
 * umbrales; sin números mágicos dispersos).
 *
 * Solo controlan animación/feedback visual: NUNCA retrasan la navegación real.
 */
internal object NavFeedbackConfig {
    /** Retraso antes de mostrar el overlay: navegaciones rápidas no parpadean. */
    const val SHOW_DELAY_MS = 180L

    /** Tiempo mínimo visible una vez que el overlay alcanzó a mostrarse. */
    const val MIN_VISIBLE_MS = 300L

    /** A partir de aquí el texto cambia a "La conexión está tardando un poco…". */
    const val SLOW_THRESHOLD_MS = 2_500L

    /** Watchdog SOLO para intenciones sintéticas SPA sin confirmación posterior. */
    const val SYNTHETIC_WATCHDOG_MS = 12_000L

    /** Longitud máxima aceptada para un path del protocolo (higiene del mensaje). */
    const val MAX_PATH_LENGTH = 512
}
