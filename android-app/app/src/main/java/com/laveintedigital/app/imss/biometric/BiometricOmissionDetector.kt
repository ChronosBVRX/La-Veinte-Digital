package com.laveintedigital.app.imss.biometric

import java.time.LocalDate

/**
 * Tipo de omisión detectada en una jornada laboral.
 */
enum class BiometricOmissionType(val label: String) {
    FALTA_ENTRADA("Falta entrada"),
    FALTA_SALIDA("Falta salida"),
}

/**
 * Representa una omisión detectada en una jornada.
 */
data class BiometricOmission(
    val date: LocalDate?,
    val rawDate: String,
    val displayDate: String,
    val omissionType: BiometricOmissionType,
    val recordedPunch: BiometricPunch,
    val shiftDescription: String,
    val explanation: String,
    val recommendation: String,
)

/**
 * Reporte integral de auditoría de omisiones para un periodo.
 */
data class BiometricAuditReport(
    val totalDaysChecked: Int,
    val totalPunches: Int,
    val completeShiftsCount: Int,
    val omissions: List<BiometricOmission>,
    val hasOmissions: Boolean = omissions.isNotEmpty(),
    val summaryMessage: String,
)

/**
 * Motor detector de omisiones de checada de Tu Perfil IMSS.
 *
 * Considera de forma determinista y normativa:
 * 1. Jornadas Diurnas y Vespertinas (inicio y fin en el mismo día natural).
 * 2. Jornadas Nocturnas (inician en la noche de un día y concluyen a la mañana siguiente).
 * 3. Jornadas Acumuladas / Fines de semana (los días sin checada son descansos, no omisiones).
 * 4. Dobles turnos / registros múltiples en el mismo día.
 */
object BiometricOmissionDetector {

    // Franja horaria nocturna de entrada: 19:00 hrs en adelante (>= 1140 minutos)
    const val NIGHT_ENTRY_START_MINUTES = 19 * 60

    // Franja horaria matutina de salida de jornada nocturna: antes de las 11:00 hrs (< 660 minutos)
    const val NIGHT_EXIT_END_MINUTES = 11 * 60

    // Umbral de corte mañana/tarde para jornadas en un mismo día (13:00 hrs = 780 minutos)
    const val DAY_AFTERNOON_THRESHOLD_MINUTES = 13 * 60

    /**
     * Analiza las checadas agrupadas por día y genera el reporte de omisiones.
     */
    fun analyze(
        dayGroups: List<BiometricDayGroup>,
    ): BiometricAuditReport {
        if (dayGroups.isEmpty()) {
            return BiometricAuditReport(
                totalDaysChecked = 0,
                totalPunches = 0,
                completeShiftsCount = 0,
                omissions = emptyList(),
                summaryMessage = "No hay registros disponibles para auditar en este periodo.",
            )
        }

        val totalPunches = dayGroups.sumOf { it.punches.size }
        val omissions = mutableListOf<BiometricOmission>()
        var completeShifts = 0

        data class DayEntry(
            val dayGroup: BiometricDayGroup,
            val date: LocalDate?,
            val punches: List<BiometricPunch>,
        )

        val days = dayGroups.map { group ->
            DayEntry(
                dayGroup = group,
                date = BiometricGrouping.parseDate(group.rawDate),
                punches = group.punches,
            )
        }

        val consumedPunches = mutableSetOf<BiometricPunch>()

        // ── FASE 1: Detección de jornadas completas en el mismo día ───────────
        // Si un día tiene 2 o más checadas donde la primera inicia antes de las 16:00
        // (matutina, vespertina o acumulada diurna 12 hrs), forman una jornada completa en el mismo día.
        for (day in days) {
            val unconsumed = day.punches.filter { it !in consumedPunches }
            if (unconsumed.size >= 2) {
                val firstPunch = unconsumed.first()
                val lastPunch = unconsumed.last()
                val firstMins = firstPunch.minutesOfDay ?: 0

                // Si inicia en la mañana o tarde (< 18:00) y concluye más tarde en el mismo día
                if (firstMins < 18 * 60) {
                    consumedPunches.addAll(unconsumed)
                    completeShifts++
                }
            }
        }

        // ── FASE 2: Emparejamiento de Jornadas Nocturnas (noche Día N -> mañana Día N+1) ──
        for (i in days.indices) {
            val currentDay = days[i]
            val nextDay = days.getOrNull(i + 1)

            val nightPunches = currentDay.punches.filter {
                (it.minutesOfDay ?: 0) >= NIGHT_ENTRY_START_MINUTES && it !in consumedPunches
            }

            for (nightPunch in nightPunches) {
                val isNextDayCalendar = if (currentDay.date != null && nextDay?.date != null) {
                    nextDay.date == currentDay.date.plusDays(1)
                } else {
                    nextDay != null
                }

                // Buscar salida matutina en el día siguiente
                val nextDayMorningExit = if (isNextDayCalendar && nextDay != null) {
                    nextDay.punches.firstOrNull {
                        it !in consumedPunches && (it.minutesOfDay ?: 1440) < NIGHT_EXIT_END_MINUTES
                    }
                } else null

                if (nextDayMorningExit != null) {
                    // ¡Jornada nocturna completa!
                    consumedPunches.add(nightPunch)
                    consumedPunches.add(nextDayMorningExit)
                    completeShifts++
                } else {
                    // Falta salida en la jornada nocturna iniciada
                    consumedPunches.add(nightPunch)
                    omissions.add(
                        BiometricOmission(
                            date = currentDay.date,
                            rawDate = currentDay.dayGroup.rawDate,
                            displayDate = currentDay.dayGroup.displayDate,
                            omissionType = BiometricOmissionType.FALTA_SALIDA,
                            recordedPunch = nightPunch,
                            shiftDescription = "Jornada nocturna",
                            explanation = "Se registró la entrada nocturna a las ${nightPunch.formattedTime} hrs, pero no aparece la checada de salida matutina al día siguiente.",
                            recommendation = "Acude de inmediato con tu Delegado Sindical o la Oficina de Personal para ingresar la justificación oficial de salida por omisión de checada.",
                        )
                    )
                }
            }
        }

        // ── FASE 3: Checadas individuales restantes (omisiones en jornadas diurnas/vespertinas) ──
        for (i in days.indices) {
            val currentDay = days[i]
            val unconsumed = currentDay.punches.filter { it !in consumedPunches }

            if (unconsumed.isEmpty()) continue

            if (unconsumed.size >= 2) {
                consumedPunches.addAll(unconsumed)
                completeShifts++
            } else {
                val singlePunch = unconsumed[0]
                consumedPunches.add(singlePunch)

                val mins = singlePunch.minutesOfDay
                if (mins != null && mins >= DAY_AFTERNOON_THRESHOLD_MINUTES) {
                    // Checada solitaria por la tarde/noche sin entrada previa
                    omissions.add(
                        BiometricOmission(
                            date = currentDay.date,
                            rawDate = currentDay.dayGroup.rawDate,
                            displayDate = currentDay.dayGroup.displayDate,
                            omissionType = BiometricOmissionType.FALTA_ENTRADA,
                            recordedPunch = singlePunch,
                            shiftDescription = "Jornada diurna o vespertina",
                            explanation = "Se registró la salida a las ${singlePunch.formattedTime} hrs, pero no aparece tu checada de entrada correspondiente a este turno.",
                            recommendation = "Solicita a tu Delegado Sindical el formato de justificación de checada de entrada ante la Oficina de Personal para evitar afectación en tu estímulo de puntualidad (Concepto 033).",
                        )
                    )
                } else {
                    // Checada solitaria por la mañana sin salida
                    val isFirstDayEarly = i == 0 && (mins ?: 0) < 540
                    val shiftDesc = if (isFirstDayEarly) "Jornada matutina o guardia previa" else "Jornada diurna"

                    omissions.add(
                        BiometricOmission(
                            date = currentDay.date,
                            rawDate = currentDay.dayGroup.rawDate,
                            displayDate = currentDay.dayGroup.displayDate,
                            omissionType = BiometricOmissionType.FALTA_SALIDA,
                            recordedPunch = singlePunch,
                            shiftDescription = shiftDesc,
                            explanation = "Se registró tu entrada a las ${singlePunch.formattedTime} hrs, pero no se detectó el registro de salida de la jornada.",
                            recommendation = "Acude con tu Delegado Sindical o la Oficina de Personal para justificar la omisión de salida con la firma de tu jefe de servicio.",
                        )
                    )
                }
            }
        }

        val summary = when {
            omissions.isEmpty() -> "Sin omisiones detectadas. Todas tus jornadas en este periodo cuentan con entrada y salida correspondientes."
            omissions.size == 1 -> "Se detectó 1 omisión de checada en este periodo. Te sugerimos aclararla a la brevedad con la Oficina de Personal."
            else -> "Se detectaron ${omissions.size} omisiones de checada en este periodo. Te sugerimos aclararlas a la brevedad con la Oficina de Personal."
        }

        return BiometricAuditReport(
            totalDaysChecked = dayGroups.size,
            totalPunches = totalPunches,
            completeShiftsCount = completeShifts,
            omissions = omissions,
            summaryMessage = summary,
        )
    }
}
