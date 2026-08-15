package com.laveintedigital.app.imss.biometric

/**
 * Modelos de la función "Registros biométricos" (checadas de Tu Perfil IMSS).
 *
 * Los modelos son deliberadamente genéricos: la estructura REAL del portal se
 * descubre en tiempo de ejecución (ver `TuPerfilBiometricFlowController` y los
 * diagnósticos DEBUG). No se inventan columnas como "Entrada/Salida/Retardo"
 * hasta que el portal las confirme; `BiometricRecord.fields` conserva cualquier
 * combinación de columnas y permite que cambios menores del portal no rompan
 * la lectura.
 */

/**
 * Periodo consultable ofrecido por el portal.
 *
 * @param value valor interno que el portal usa para la selección (ej. valor
 *   de la opción del mat-select / <option>).
 * @param label texto bonito mostrado al trabajador.
 */
data class BiometricPeriod(
    val value: String,
    val label: String,
)

/**
 * Oficina de Operación Administrativa Desconcentrada (OOAD) del formulario
 * original de Biométricos.
 *
 * El formulario real requiere seleccionar PRIMERO la OOAD y DESPUÉS el
 * periodo (el selector de Periodo es dependiente de la OOAD y se repuebla al
 * cambiar de delegación). Nuestra OOAD preferida por defecto es
 * **17 — Michoacán** (ver [BiometricFlowPolicy.DEFAULT_OOAD_VALUE]).
 */
data class BiometricOoad(
    val value: String,
    val label: String,
)

/** Columna estable de la tabla de registros del portal. */
data class BiometricColumn(
    val key: String,
    val label: String,
)

/** Un registro (checada) con sus celdas indexadas por la clave de columna. */
data class BiometricRecord(
    val fields: Map<String, String>,
)

/** Estados reconocidos en el snapshot de resultados del portal. */
enum class BiometricQueryStatus {
    IDLE,
    LOADING,
    ROWS,
    EMPTY,
    ERROR,
    UNAUTHENTICATED,
}

/** Snapshot del estado de resultados leído del DOM del portal. */
data class BiometricQuerySnapshot(
    val status: BiometricQueryStatus,
    val columns: List<BiometricColumn> = emptyList(),
    val rows: List<BiometricRecord> = emptyList(),
    val emptyMessage: String? = null,
    val errorMessage: String? = null,
)

/**
 * Errores PROPIOS de la función biométricos (el login conserva su propia
 * clasificación `PortalLoginErrorKind`).
 */
enum class BiometricErrorKind {
    /** La página de consulta no presentó los controles esperados. */
    DOM_NOT_RECOGNIZED,

    /** El selector de periodos existe pero no se pudieron leer sus opciones. */
    PERIODS_NOT_READABLE,

    /** Los periodos no estuvieron disponibles dentro del tiempo esperado. */
    PERIODS_TIMEOUT,

    /** No se pudo leer/resolver la OOAD real del formulario (17 Michoacán). */
    OOAD_NOT_READABLE,

    /** No se pudo aplicar/verificar la OOAD en el portal (pre-requisito del periodo). */
    OOAD_REJECTED,

    /** No se pudo aplicar el periodo o pulsar el botón de consulta. */
    QUERY_REJECTED,

    /** No se encontró el control/mecanismo que dispara la consulta. */
    QUERY_CONTROL_NOT_FOUND,

    /** El control de consulta existe pero no provocó ninguna actividad/petición. */
    QUERY_NOT_TRIGGERED,

    /** El portal respondió pero con una estructura no reconocida. */
    RESULT_NOT_RECOGNIZED,

    /** No se encontró el contenedor de resultados esperado. */
    RESULT_CONTAINER_NOT_FOUND,

    /** Los resultados se detectaron pero no se pudieron extraer (parseo). */
    RESULT_PARSE_FAILED,

    /** La consulta no respondió dentro del tiempo esperado. */
    QUERY_TIMEOUT,

    /** No se encontró el control "Descargar" del documento de resultados. */
    DOWNLOAD_CONTROL_NOT_FOUND,

    /** El botón Descargar se pulsó pero no se generó ninguna descarga observable. */
    DOWNLOAD_NOT_TRIGGERED,

    /** El mecanismo de descarga del portal no está soportado todavía. */
    DOWNLOAD_UNSUPPORTED,

    /** La descarga no produjo un documento válido (status/mime/magic bytes). */
    DOWNLOAD_INVALID_DOCUMENT,

    /** Otro fallo (conexión, WebView, etc.). */
    UNKNOWN,
}
