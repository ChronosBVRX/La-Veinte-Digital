package com.laveintedigital.app.imss.biometric

import java.text.Normalizer
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Tipo de checada detectada por lógica de horario.
 */
enum class BiometricPunchType(val label: String) {
    ENTRADA("Entrada"),
    SALIDA("Salida"),
    INTERMEDIA("Intermedia"),
}

/**
 * Una checada individual clasificada dentro de un día.
 */
data class BiometricPunch(
    val record: BiometricRecord,
    val rawTime: String,
    val minutesOfDay: Int?,
    val type: BiometricPunchType,
    val formattedTime: String = rawTime,
    val extraFields: Map<String, String> = emptyMap(),
)

/**
 * Grupo de checadas correspondiente a una fecha/día específico.
 */
data class BiometricDayGroup(
    val rawDate: String,
    val dateKey: String,
    val displayDate: String,
    val punches: List<BiometricPunch>,
)

/**
 * Lógica pura de agrupación de checadas por días y detección de Entrada/Salida por horario.
 */
object BiometricGrouping {

    /**
     * Umbral para checada única en un día: 13:00 hrs (1:00 PM = 780 minutos desde medianoche).
     * Antes de las 13:00 hrs se clasifica como ENTRADA.
     * De las 13:00 hrs en adelante se clasifica como SALIDA.
     */
    const val SINGLE_PUNCH_AFTERNOON_THRESHOLD_MINUTES = 13 * 60

    private val SPANISH_LOCALE = Locale.forLanguageTag("es-MX")
    private val DISPLAY_DATE_FORMATTER = DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM 'de' yyyy", SPANISH_LOCALE)

    private val SPANISH_MONTHS = mapOf(
        "enero" to 1, "febrero" to 2, "marzo" to 3, "abril" to 4,
        "mayo" to 5, "junio" to 6, "julio" to 7, "agosto" to 8,
        "septiembre" to 9, "setiembre" to 9, "octubre" to 10,
        "noviembre" to 11, "diciembre" to 12
    )

    private val MONTH_NAMES_PATTERN = SPANISH_MONTHS.keys.joinToString("|")

    /**
     * Normaliza un texto para comparaciones (minúsculas, sin acentos).
     */
    fun normalize(text: String?): String = (text ?: "")
        .let { Normalizer.normalize(it, Normalizer.Form.NFD) }
        .replace(Regex("[\\u0300-\\u036f]"), "")
        .trim()
        .lowercase()
        .replace(Regex("\\s+"), " ")

    /**
     * Agrupa una lista de registros biométricos por día y clasifica cada checada como
     * ENTRADA, SALIDA o INTERMEDIA según su horario.
     */
    fun groupByDays(
        columns: List<BiometricColumn>,
        records: List<BiometricRecord>,
    ): List<BiometricDayGroup> {
        if (records.isEmpty()) return emptyList()

        val (dateColKey, timeColKey) = resolveDateAndTimeKeys(columns, records)

        // Agrupación preservando orden de aparición de los días (LinkedHashMap)
        val dayBuckets = linkedMapOf<String, DayAccumulator>()

        for (record in records) {
            val rawDateVal = dateColKey?.let { record.fields[it] }?.trim().orEmpty()
            val rawTimeVal = timeColKey?.let { record.fields[it] }?.trim().orEmpty()

            val (extractedDate, extractedTime) = extractDateAndTime(
                rawDate = rawDateVal,
                rawTime = rawTimeVal,
                sameColumn = dateColKey != null && dateColKey == timeColKey,
            )

            val parsedDate = parseDate(extractedDate)
            val dateKey = parsedDate?.toString() ?: normalize(extractedDate).ifBlank { "sin_fecha" }
            val displayDate = formatDisplayDate(extractedDate, parsedDate)

            val minutes = parseMinutesOfDay(extractedTime)
            val formattedTime = formatTime(extractedTime, minutes)

            // Campos adicionales que no son la fecha ni la hora
            val extraFields = linkedMapOf<String, String>()
            columns.forEach { col ->
                if (col.key != dateColKey && col.key != timeColKey) {
                    val v = record.fields[col.key]?.trim()
                    if (!v.isNullOrEmpty()) {
                        extraFields[col.label.ifBlank { col.key }] = v
                    }
                }
            }

            val rawPunch = RawPunch(
                record = record,
                rawTime = extractedTime,
                minutesOfDay = minutes,
                formattedTime = formattedTime,
                extraFields = extraFields,
            )

            val acc = dayBuckets.getOrPut(dateKey) {
                DayAccumulator(
                    rawDate = extractedDate,
                    dateKey = dateKey,
                    displayDate = displayDate,
                    parsedDate = parsedDate,
                )
            }
            acc.punches.add(rawPunch)
        }

        // Para cada día, ordenar cronológicamente y asignar ENTRADA / SALIDA / INTERMEDIA
        return dayBuckets.values.map { acc ->
            val classifiedPunches = classifyDayPunches(acc.punches)
            BiometricDayGroup(
                rawDate = acc.rawDate,
                dateKey = acc.dateKey,
                displayDate = acc.displayDate,
                punches = classifiedPunches,
            )
        }
    }

    /**
     * Clasifica las checadas de un solo día según su horario:
     * - Si hay 2 o más: la más temprana es ENTRADA, la más tardía es SALIDA, intermedias son INTERMEDIA.
     * - Si hay 1 sola: según la hora (antes de las 13:00 -> ENTRADA, a partir de las 13:00 -> SALIDA).
     */
    fun classifyDayPunches(punches: List<RawPunch>): List<BiometricPunch> {
        if (punches.isEmpty()) return emptyList()

        // Orden cronológico por minutesOfDay (si no tiene minutos, se coloca al final)
        val sorted = punches.sortedWith(
            compareBy<RawPunch> { it.minutesOfDay ?: Int.MAX_VALUE }
                .thenBy { it.rawTime }
        )

        val size = sorted.size
        return sorted.mapIndexed { index, p ->
            val type = when {
                size >= 2 -> {
                    when (index) {
                        0 -> BiometricPunchType.ENTRADA
                        size - 1 -> BiometricPunchType.SALIDA
                        else -> BiometricPunchType.INTERMEDIA
                    }
                }
                else -> { // size == 1
                    val mins = p.minutesOfDay
                    if (mins != null) {
                        if (mins < SINGLE_PUNCH_AFTERNOON_THRESHOLD_MINUTES) {
                            BiometricPunchType.ENTRADA
                        } else {
                            BiometricPunchType.SALIDA
                        }
                    } else {
                        // Fallback si no se pudo parsear la hora
                        BiometricPunchType.ENTRADA
                    }
                }
            }

            BiometricPunch(
                record = p.record,
                rawTime = p.rawTime,
                minutesOfDay = p.minutesOfDay,
                type = type,
                formattedTime = p.formattedTime,
                extraFields = p.extraFields,
            )
        }
    }

    /**
     * Resuelve las claves de columna correspondientes a la Fecha y a la Hora.
     */
    fun resolveDateAndTimeKeys(
        columns: List<BiometricColumn>,
        records: List<BiometricRecord>,
    ): Pair<String?, String?> {
        var dateKey: String? = null
        var timeKey: String? = null

        // 1. Detección por etiquetas de columna
        for (col in columns) {
            val normLabel = normalize(col.label)
            if (dateKey == null && (normLabel.contains("fecha") || normLabel.contains("dia") || normLabel.contains("date"))) {
                dateKey = col.key
            }
            if (timeKey == null && (normLabel.contains("hora") || normLabel.contains("horario") || normLabel.contains("time") || normLabel.contains("marca"))) {
                timeKey = col.key
            }
        }

        // 2. Detección por inspección de valores si aún falta alguno
        if (dateKey == null || timeKey == null) {
            val sample = records.take(5)
            for (col in columns) {
                val values = sample.mapNotNull { it.fields[col.key]?.trim() }.filter { it.isNotEmpty() }
                if (dateKey == null && values.any { isLikelyDateString(it) }) {
                    dateKey = col.key
                }
                if (timeKey == null && values.any { isLikelyTimeString(it) }) {
                    timeKey = col.key
                }
            }
        }

        // 3. Fallbacks por posición si no se identificaron
        if (dateKey == null && columns.isNotEmpty()) {
            dateKey = columns[0].key
        }
        if (timeKey == null) {
            timeKey = if (columns.size > 1 && columns[1].key != dateKey) {
                columns[1].key
            } else {
                dateKey // Misma columna (ej. compound date+time)
            }
        }

        return Pair(dateKey, timeKey)
    }

    /**
     * Extrae fecha y hora cuando están en columnas separadas o combinadas en una sola.
     */
    private fun extractDateAndTime(
        rawDate: String,
        rawTime: String,
        sameColumn: Boolean,
    ): Pair<String, String> {
        if (!sameColumn && rawTime.isNotBlank()) {
            return Pair(rawDate, rawTime)
        }

        val combined = if (rawDate.isNotBlank()) rawDate else rawTime
        val timeMatch = Regex("""\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[aApP][mM])?)\b""").find(combined)

        return if (timeMatch != null) {
            val time = timeMatch.groupValues[1].trim()
            val date = combined.removeRange(timeMatch.range).trim()
                .trim('-', '—', ',', ' ')
            Pair(date, time)
        } else {
            Pair(combined, rawTime)
        }
    }

    /**
     * Parsea una fecha a [LocalDate] desde diversos formatos comunes en México e IMSS.
     */
    fun parseDate(raw: String?): LocalDate? {
        if (raw.isNullOrBlank()) return null
        val clean = raw.trim()

        // 1. YYYY-MM-DD o YYYY/MM/DD
        Regex("""\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b""").find(clean)?.let { m ->
            val y = m.groupValues[1].toInt()
            val mo = m.groupValues[2].toInt()
            val d = m.groupValues[3].toInt()
            runCatching { return LocalDate.of(y, mo, d) }
        }

        // 2. DD/MM/YYYY o DD-MM-YYYY
        Regex("""\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b""").find(clean)?.let { m ->
            val d = m.groupValues[1].toInt()
            val mo = m.groupValues[2].toInt()
            val y = m.groupValues[3].toInt()
            runCatching { return LocalDate.of(y, mo, d) }
        }

        // 3. Formato textual en español (ej. "12 de agosto, 2026", "Miércoles 12 de agosto de 2026")
        Regex(
            """\b(\d{1,2})\s+de\s+($MONTH_NAMES_PATTERN)(?:[,\s]+de)?\s+(\d{4})\b""",
            RegexOption.IGNORE_CASE
        ).find(clean)?.let { m ->
            val d = m.groupValues[1].toInt()
            val monthName = m.groupValues[2].lowercase()
            val mo = SPANISH_MONTHS[monthName] ?: 1
            val y = m.groupValues[3].toInt()
            runCatching { return LocalDate.of(y, mo, d) }
        }

        return null
    }

    /**
     * Parsea una hora a minutos desde la medianoche (0..1439).
     * Soporta formatos de 24 horas (07:58, 15:02) y de 12 horas con AM/PM (07:58 AM, 03:02 PM).
     */
    fun parseMinutesOfDay(timeStr: String?): Int? {
        if (timeStr.isNullOrBlank()) return null
        val match = Regex("""\b(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([aApP][mM]))?\b""").find(timeStr.trim())
            ?: return null

        var hours = match.groupValues[1].toIntOrNull() ?: return null
        val minutes = match.groupValues[2].toIntOrNull() ?: return null
        val ampm = match.groupValues[3].uppercase()

        if (ampm == "PM" && hours < 12) hours += 12
        if (ampm == "AM" && hours == 12) hours = 0

        if (hours !in 0..23 || minutes !in 0..59) return null
        return hours * 60 + minutes
    }

    /**
     * Formatea la fecha de visualización en español ("Lunes, 10 de agosto de 2026").
     */
    fun formatDisplayDate(rawDate: String, parsedDate: LocalDate?): String {
        if (parsedDate != null) {
            val formatted = parsedDate.format(DISPLAY_DATE_FORMATTER)
            return formatted.replaceFirstChar { if (it.isLowerCase()) it.titlecase(SPANISH_LOCALE) else it.toString() }
        }
        return rawDate.ifBlank { "Fecha sin especificar" }
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase(SPANISH_LOCALE) else it.toString() }
    }

    /**
     * Formato limpio de hora (HH:mm).
     */
    private fun formatTime(rawTime: String, minutes: Int?): String {
        if (minutes != null) {
            val h = minutes / 60
            val m = minutes % 60
            return String.format(Locale.US, "%02d:%02d", h, m)
        }
        return rawTime.ifBlank { "—" }
    }

    private fun isLikelyDateString(s: String): Boolean {
        return parseDate(s) != null ||
            Regex("""\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b""").containsMatchIn(s) ||
            Regex("""\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b""").containsMatchIn(s)
    }

    private fun isLikelyTimeString(s: String): Boolean {
        return parseMinutesOfDay(s) != null
    }

    /**
     * Estructura temporal interna para acumular registros por día antes de clasificarlos.
     */
    data class RawPunch(
        val record: BiometricRecord,
        val rawTime: String,
        val minutesOfDay: Int?,
        val formattedTime: String,
        val extraFields: Map<String, String>,
    )

    private class DayAccumulator(
        val rawDate: String,
        val dateKey: String,
        val displayDate: String,
        val parsedDate: LocalDate?,
        val punches: MutableList<RawPunch> = mutableListOf(),
    )
}
