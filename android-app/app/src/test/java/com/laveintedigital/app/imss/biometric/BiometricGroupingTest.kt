package com.laveintedigital.app.imss.biometric

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BiometricGroupingTest {

    private val columnsStandard = listOf(
        BiometricColumn("c0", "Fecha"),
        BiometricColumn("c1", "Hora"),
        BiometricColumn("c2", "Checada"),
    )

    // ── Clasificación dentro de un día ────────────────────────────────────────

    @Test
    fun `dos checadas en el mismo dia se clasifican como entrada y salida por horario`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "07:58", "c2" to "CH1")),
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "15:02", "c2" to "CH2")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(1, groups.size)
        val day = groups[0]
        assertEquals(2, day.punches.size)

        assertEquals("07:58", day.punches[0].formattedTime)
        assertEquals(BiometricPunchType.ENTRADA, day.punches[0].type)

        assertEquals("15:02", day.punches[1].formattedTime)
        assertEquals(BiometricPunchType.SALIDA, day.punches[1].type)
    }

    @Test
    fun `checadas en orden inverso del portal se ordenan cronologicamente`() {
        // El portal devolvió la salida primero y la entrada después
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "15:05")),
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "07:50")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(1, groups.size)
        val day = groups[0]
        assertEquals(2, day.punches.size)

        // Se ordena cronológicamente: primero la entrada, después la salida
        assertEquals("07:50", day.punches[0].formattedTime)
        assertEquals(BiometricPunchType.ENTRADA, day.punches[0].type)

        assertEquals("15:05", day.punches[1].formattedTime)
        assertEquals(BiometricPunchType.SALIDA, day.punches[1].type)
    }

    @Test
    fun `tres o mas checadas marcan primera entrada, ultima salida e intermedias`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "07:55")),
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "08:00")),
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "12:30")),
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "15:05")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(1, groups.size)
        val day = groups[0]
        assertEquals(4, day.punches.size)

        assertEquals(BiometricPunchType.ENTRADA, day.punches[0].type)
        assertEquals("07:55", day.punches[0].formattedTime)

        assertEquals(BiometricPunchType.INTERMEDIA, day.punches[1].type)
        assertEquals("08:00", day.punches[1].formattedTime)

        assertEquals(BiometricPunchType.INTERMEDIA, day.punches[2].type)
        assertEquals("12:30", day.punches[2].formattedTime)

        assertEquals(BiometricPunchType.SALIDA, day.punches[3].type)
        assertEquals("15:05", day.punches[3].formattedTime)
    }

    // ── Checada única en el día ───────────────────────────────────────────────

    @Test
    fun `checada unica antes de las 13 hrs se clasifica como entrada`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "07:58")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(1, groups.size)
        val punch = groups[0].punches[0]
        assertEquals("07:58", punch.formattedTime)
        assertEquals(BiometricPunchType.ENTRADA, punch.type)
    }

    @Test
    fun `checada unica a partir de las 13 hrs se clasifica como salida`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "15:30")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(1, groups.size)
        val punch = groups[0].punches[0]
        assertEquals("15:30", punch.formattedTime)
        assertEquals(BiometricPunchType.SALIDA, punch.type)
    }

    @Test
    fun `umbral de las 13 hrs clasifica exactamente 12_59 como entrada y 13_00 como salida`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "12:59")),
            BiometricRecord(mapOf("c0" to "2026-08-11", "c1" to "13:00")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(2, groups.size)
        assertEquals(BiometricPunchType.ENTRADA, groups[0].punches[0].type)
        assertEquals(BiometricPunchType.SALIDA, groups[1].punches[0].type)
    }

    // ── Agrupación en múltiples días ──────────────────────────────────────────

    @Test
    fun `agrupa multiples registros en sus respectivos dias`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "07:58")),
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "15:02")),
            BiometricRecord(mapOf("c0" to "2026-08-11", "c1" to "08:05")),
            BiometricRecord(mapOf("c0" to "2026-08-11", "c1" to "15:10")),
            BiometricRecord(mapOf("c0" to "2026-08-12", "c1" to "07:50")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(3, groups.size)
        assertEquals("2026-08-10", groups[0].dateKey)
        assertEquals(2, groups[0].punches.size)

        assertEquals("2026-08-11", groups[1].dateKey)
        assertEquals(2, groups[1].punches.size)

        assertEquals("2026-08-12", groups[2].dateKey)
        assertEquals(1, groups[2].punches.size)
        assertEquals(BiometricPunchType.ENTRADA, groups[2].punches[0].type)
    }

    // ── Formatos de fechas y horas ────────────────────────────────────────────

    @Test
    fun `soporta fechas en formato DD_MM_YYYY`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "10/08/2026", "c1" to "08:00")),
            BiometricRecord(mapOf("c0" to "10/08/2026", "c1" to "15:00")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(1, groups.size)
        assertEquals("2026-08-10", groups[0].dateKey)
        assertTrue(groups[0].displayDate.contains("agosto", ignoreCase = true))
    }

    @Test
    fun `soporta horas con AM y PM`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "07:45 AM")),
            BiometricRecord(mapOf("c0" to "2026-08-10", "c1" to "03:15 PM")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(1, groups.size)
        val punches = groups[0].punches
        assertEquals(2, punches.size)
        assertEquals("07:45", punches[0].formattedTime)
        assertEquals(BiometricPunchType.ENTRADA, punches[0].type)
        assertEquals("15:15", punches[1].formattedTime)
        assertEquals(BiometricPunchType.SALIDA, punches[1].type)
    }

    @Test
    fun `soporta texto compuesto con fecha y hora en una sola celda`() {
        val colsSingle = listOf(BiometricColumn("c0", "Registro"))
        val records = listOf(
            BiometricRecord(mapOf("c0" to "Miércoles 12 de agosto, 2026 — Checada (N°) 07:59")),
            BiometricRecord(mapOf("c0" to "Miércoles 12 de agosto, 2026 — Checada (N°) 15:30")),
        )

        val groups = BiometricGrouping.groupByDays(colsSingle, records)

        assertEquals(1, groups.size)
        val punches = groups[0].punches
        assertEquals(2, punches.size)
        assertEquals("07:59", punches[0].formattedTime)
        assertEquals(BiometricPunchType.ENTRADA, punches[0].type)
        assertEquals("15:30", punches[1].formattedTime)
        assertEquals(BiometricPunchType.SALIDA, punches[1].type)
    }

    // ── Preservación de información adicional y casos límite ──────────────────

    @Test
    fun `conserva campos adicionales en extraFields`() {
        val cols = listOf(
            BiometricColumn("c0", "Fecha"),
            BiometricColumn("c1", "Hora"),
            BiometricColumn("c2", "Lector"),
            BiometricColumn("c3", "Observaciones"),
        )
        val records = listOf(
            BiometricRecord(mapOf(
                "c0" to "2026-08-10",
                "c1" to "07:58",
                "c2" to "Biométrico 02 - Urgencias",
                "c3" to "A tiempo",
            ))
        )

        val groups = BiometricGrouping.groupByDays(cols, records)
        val punch = groups[0].punches[0]

        assertEquals("Biométrico 02 - Urgencias", punch.extraFields["Lector"])
        assertEquals("A tiempo", punch.extraFields["Observaciones"])
    }

    @Test
    fun `lista vacia de registros devuelve lista vacia sin error`() {
        val groups = BiometricGrouping.groupByDays(columnsStandard, emptyList())
        assertTrue(groups.isEmpty())
    }

    @Test
    fun `registros sin fecha reconocible caen en grupo fallback sin lanzar excepcion`() {
        val records = listOf(
            BiometricRecord(mapOf("c0" to "", "c1" to "08:15")),
        )

        val groups = BiometricGrouping.groupByDays(columnsStandard, records)

        assertEquals(1, groups.size)
        assertEquals(1, groups[0].punches.size)
        assertNotNull(groups[0].displayDate)
    }
}
