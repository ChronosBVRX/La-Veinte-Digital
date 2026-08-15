package com.laveintedigital.app.imss.biometric

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BiometricJsonTest {

    // ── Periodos ────────────────────────────────────────────────────────────

    @Test
    fun `parsePeriods lista normal`() {
        val raw = """{"ok":true,"done":true,"periods":[{"value":"2026072","label":"2ª quincena de julio 2026"},{"value":"2026071","label":"1ª quincena de julio 2026"}]}"""
        val periods = BiometricJson.parsePeriods(raw)
        assertEquals(2, periods.size)
        assertEquals("2026072", periods[0].value)
        assertEquals("2ª quincena de julio 2026", periods[0].label)
    }

    @Test
    fun `parsePeriods lista vacia`() {
        val periods = BiometricJson.parsePeriods("""{"ok":true,"done":true,"periods":[]}""")
        assertTrue(periods.isEmpty())
    }

    @Test
    fun `parsePeriods caracteres acentuados`() {
        val raw = """{"ok":true,"done":true,"periods":[{"value":"2026062","label":"2ª quincena de junio 2026"},{"value":"2026052","label":"Período extraordinario — ÁREA 5"}]}"""
        val periods = BiometricJson.parsePeriods(raw)
        assertEquals(2, periods.size)
        assertEquals("2ª quincena de junio 2026", periods[0].label)
        assertEquals("Período extraordinario — ÁREA 5", periods[1].label)
    }

    @Test
    fun `parsePeriods valores diferentes de labels`() {
        val raw = """{"ok":true,"done":true,"periods":[{"value":"1","label":"Segunda quincena de julio 2026"},{"value":"2","label":"Primera quincena de julio 2026"}]}"""
        val periods = BiometricJson.parsePeriods(raw)
        assertEquals("1", periods[0].value)
        assertEquals("Segunda quincena de julio 2026", periods[0].label)
    }

    @Test
    fun `parsePeriods doble serializacion de evaluateJavascript`() {
        // evaluateJavascript devuelve JSON.stringify(objeto) como string JSON.
        val raw = "\"{\\\"ok\\\":true,\\\"done\\\":true,\\\"periods\\\":[{\\\"value\\\":\\\"2026072\\\",\\\"label\\\":\\\"2ª quincena de julio 2026\\\"}]}\""
        val periods = BiometricJson.parsePeriods(raw)
        assertEquals(1, periods.size)
        assertEquals("2026072", periods[0].value)
    }

    @Test
    fun `parsePeriods valor nulo`() {
        assertTrue(BiometricJson.parsePeriods(null).isEmpty())
        assertTrue(BiometricJson.parsePeriods("null").isEmpty())
        assertTrue(BiometricJson.parsePeriods("undefined").isEmpty())
        assertTrue(BiometricJson.parsePeriods("").isEmpty())
    }

    // ── Resultados ──────────────────────────────────────────────────────────

    private val oneRowRaw = """{"status":"rows","columns":[{"key":"c0","label":"Fecha"},{"key":"c1","label":"Hora"},{"key":"c2","label":"Checada"}],"rows":[["2026-08-10","08:01","ENTRADA"]]}"""

    @Test
    fun `parseSnapshot una fila`() {
        val snap = BiometricJson.parseSnapshot(oneRowRaw)
        assertNotNull(snap)
        assertEquals(BiometricQueryStatus.ROWS, snap!!.status)
        assertEquals(3, snap.columns.size)
        assertEquals(1, snap.rows.size)
        assertEquals("Fecha", snap.columns[0].label)
        assertEquals("2026-08-10", snap.rows[0].fields["c0"])
        assertEquals("ENTRADA", snap.rows[0].fields["c2"])
    }

    @Test
    fun `parseSnapshot multiples filas`() {
        val raw = """{"status":"rows","columns":[{"key":"c0","label":"Fecha"},{"key":"c1","label":"Hora"}],"rows":[["2026-08-10","08:01"],["2026-08-11","07:58"],["2026-08-12","08:05"]]}"""
        val snap = BiometricJson.parseSnapshot(raw)
        assertNotNull(snap)
        assertEquals(3, snap!!.rows.size)
        assertEquals("2026-08-12", snap.rows[2].fields["c0"])
    }

    @Test
    fun `parseSnapshot resultado vacio`() {
        val snap = BiometricJson.parseSnapshot("""{"status":"empty","message":""}""")
        assertNotNull(snap)
        assertEquals(BiometricQueryStatus.EMPTY, snap!!.status)
        assertTrue(snap.rows.isEmpty())
    }

    @Test
    fun `parseSnapshot columnas adicionales`() {
        val raw = """{"status":"rows","columns":[{"key":"c0","label":"A"},{"key":"c1","label":"B"}],"rows":[["1","2","3","4"]]}"""
        val snap = BiometricJson.parseSnapshot(raw)
        assertNotNull(snap)
        val fields = snap!!.rows[0].fields
        assertEquals("3", fields["extra_2"])
        assertEquals("4", fields["extra_3"])
    }

    @Test
    fun `parseSnapshot celdas vacias`() {
        val raw = """{"status":"rows","columns":[{"key":"c0","label":"A"},{"key":"c1","label":"B"}],"rows":[["1",""],["","2"]]}"""
        val snap = BiometricJson.parseSnapshot(raw)
        assertNotNull(snap)
        assertEquals("", snap!!.rows[0].fields["c1"])
        assertEquals("", snap.rows[1].fields["c0"])
    }

    @Test
    fun `parseSnapshot caracteres especiales`() {
        val raw = """{"status":"rows","columns":[{"key":"c0","label":"Fecha"}],"rows":[["Miércoles 12 de agosto, 2026 — Checada (N°) 07:59"]]}"""
        val snap = BiometricJson.parseSnapshot(raw)
        assertNotNull(snap)
        assertEquals("Miércoles 12 de agosto, 2026 — Checada (N°) 07:59", snap!!.rows[0].fields["c0"])
    }

    @Test
    fun `parseSnapshot doble serializacion`() {
        val raw = "\"{\\\"status\\\":\\\"rows\\\",\\\"columns\\\":[{\\\"key\\\":\\\"c0\\\",\\\"label\\\":\\\"Fecha\\\"}],\\\"rows\\\":[[\\\"2026-08-10\\\"]]}\""
        val snap = BiometricJson.parseSnapshot(raw)
        assertNotNull(snap)
        assertEquals(BiometricQueryStatus.ROWS, snap!!.status)
        assertEquals("2026-08-10", snap.rows[0].fields["c0"])
    }

    @Test
    fun `parseSnapshot error con mensaje`() {
        val snap = BiometricJson.parseSnapshot("""{"status":"error","message":"Servicio no disponible"}""")
        assertNotNull(snap)
        assertEquals(BiometricQueryStatus.ERROR, snap!!.status)
        assertEquals("Servicio no disponible", snap.errorMessage)
    }

    @Test
    fun `parseSnapshot estado loading`() {
        val snap = BiometricJson.parseSnapshot("""{"status":"loading"}""")
        assertNotNull(snap)
        assertEquals(BiometricQueryStatus.LOADING, snap!!.status)
    }

    @Test
    fun `parseSnapshot no autenticado`() {
        val snap = BiometricJson.parseSnapshot("""{"status":"unauth"}""")
        assertNotNull(snap)
        assertEquals(BiometricQueryStatus.UNAUTHENTICATED, snap!!.status)
    }

    @Test
    fun `parseSnapshot nulo`() {
        assertNull(BiometricJson.parseSnapshot(null))
        assertNull(BiometricJson.parseSnapshot("null"))
        assertNull(BiometricJson.parseSnapshot("undefined"))
    }

    @Test
    fun `parseSnapshot status waiting se mapea a idle`() {
        val snap = BiometricJson.parseSnapshot("""{"status":"waiting","counts":{"tables":0,"matTables":1,"rows":0,"matRows":0}}""")
        assertNotNull(snap)
        assertEquals(BiometricQueryStatus.IDLE, snap!!.status)
        assertTrue(snap.rows.isEmpty())
    }

    @Test
    fun `parseSnapshot status results con counts se mapea a rows`() {
        val raw = """{"status":"results","columns":[{"key":"c0","label":"Fecha"}],"rows":[["2026-08-10"]],"counts":{"tables":1,"matTables":0,"rows":1,"matRows":0}}"""
        val snap = BiometricJson.parseSnapshot(raw)
        assertNotNull(snap)
        assertEquals(BiometricQueryStatus.ROWS, snap!!.status)
        assertEquals("2026-08-10", snap.rows[0].fields["c0"])
    }

    @Test
    fun `parseSnapshot rows sin filas nunca ocurre desde el portal`() {
        // El snapshot v3 usa 'results' solo con dataRows>0; un 'rows' vacío
        // (compatibilidad) no debe romper el parser.
        val snap = BiometricJson.parseSnapshot("""{"status":"rows","columns":[],"rows":[]}""")
        assertNotNull(snap)
        assertEquals(BiometricQueryStatus.ROWS, snap!!.status)
        assertTrue(snap.rows.isEmpty())
    }
}
