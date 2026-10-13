package com.laveintedigital.app.imss.biometric

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BiometricOmissionDetectorTest {

    private val columnsStandard = listOf(
        BiometricColumn("c0", "Fecha"),
        BiometricColumn("c1", "Hora"),
        BiometricColumn("c2", "Checada"),
    )

    @Test
    fun `sin omisiones en jornadas diurnas completas`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "07:55")),
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "15:05")),
            BiometricRecord(mapOf("c0" to "2026-08-11", "c1" to "07:58")),
            BiometricRecord(mapOf("c0" to "2026-08-11", "c1" to "15:02")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)
        val report = BiometricOmissionDetector.analyze(groups)

        assertFalse(report.hasOmissions)
        assertEquals(0, report.omissions.size)
        assertEquals(2, report.completeShiftsCount)
    }

    @Test
    fun `sin omisiones en jornadas nocturnas que cruzan la medianoche`() {
        // Trabajador nocturno: entra a las 20:30 el 10-ago y sale a las 07:15 el 11-ago
        // entra a las 20:45 el 12-ago y sale a las 07:20 el 13-ago
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "20:30")),
            BiometricRecord(mapOf("c0" to "2026-08-11", "c1" to "07:15")),
            BiometricRecord(mapOf("c0" to "2026-08-12", "c1" to "20:45")),
            BiometricRecord(mapOf("c0" to "2026-08-13", "c1" to "07:20")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)
        val report = BiometricOmissionDetector.analyze(groups)

        assertFalse(report.hasOmissions)
        assertEquals(0, report.omissions.size)
        assertEquals(2, report.completeShiftsCount)
    }

    @Test
    fun `sin omisiones en jornadas acumuladas de fin de semana`() {
        // Trabajador de fin de semana (Jornada Acumulada Diurna: sábado y domingo)
        // Lunes a viernes no checa (descanso), solo sábado y domingo
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-15", "c1" to "07:45")), // Sábado
            BiometricRecord(mapOf("c0" to "2026-08-15", "c1" to "19:45")),
            BiometricRecord(mapOf("c0" to "2026-08-16", "c1" to "07:50")), // Domingo
            BiometricRecord(mapOf("c0" to "2026-08-16", "c1" to "19:50")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)
        val report = BiometricOmissionDetector.analyze(groups)

        assertFalse(report.hasOmissions)
        assertEquals(0, report.omissions.size)
        assertEquals(2, report.completeShiftsCount)
    }

    @Test
    fun `detecta omision de salida en jornada diurna`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "07:58")), // Solo entrada
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)
        val report = BiometricOmissionDetector.analyze(groups)

        assertTrue(report.hasOmissions)
        assertEquals(1, report.omissions.size)
        val om = report.omissions[0]
        assertEquals(BiometricOmissionType.FALTA_SALIDA, om.omissionType)
        assertEquals("07:58", om.recordedPunch.formattedTime)
        assertTrue(om.recommendation.contains("Personal") || om.recommendation.contains("Delegado"))
    }

    @Test
    fun `detecta omision de entrada en jornada diurna`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "15:02")), // Solo salida
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)
        val report = BiometricOmissionDetector.analyze(groups)

        assertTrue(report.hasOmissions)
        assertEquals(1, report.omissions.size)
        val om = report.omissions[0]
        assertEquals(BiometricOmissionType.FALTA_ENTRADA, om.omissionType)
        assertEquals("15:02", om.recordedPunch.formattedTime)
        assertTrue(om.recommendation.contains("Personal") || om.recommendation.contains("Delegado"))
    }

    @Test
    fun `detecta omision de salida en jornada nocturna`() {
        // Entrada nocturna a las 20:30, pero al día siguiente no hay checada en la mañana
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "20:30")),
            // El 11 no hay registro en la mañana, sino hasta la tarde o ninguno
            BiometricRecord(mapOf("c0" to "2026-08-12", "c1" to "07:58")),
            BiometricRecord(mapOf("c0" to "2026-08-12", "c1" to "15:02")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)
        val report = BiometricOmissionDetector.analyze(groups)

        assertTrue(report.hasOmissions)
        assertEquals(1, report.omissions.size)
        val om = report.omissions[0]
        assertEquals(BiometricOmissionType.FALTA_SALIDA, om.omissionType)
        assertTrue(om.shiftDescription.contains("nocturna", ignoreCase = true))
        assertEquals("20:30", om.recordedPunch.formattedTime)
    }

    @Test
    fun `reporte con lista vacia devuelve cero omisiones`() {
        val report = BiometricOmissionDetector.analyze(emptyList())
        assertFalse(report.hasOmissions)
        assertEquals(0, report.omissions.size)
    }
}
