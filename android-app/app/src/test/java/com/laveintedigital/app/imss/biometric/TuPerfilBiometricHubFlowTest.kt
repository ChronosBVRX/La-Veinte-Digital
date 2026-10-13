package com.laveintedigital.app.imss.biometric

import com.laveintedigital.app.nav.NavRoute
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TuPerfilBiometricHubFlowTest {

    @Test
    fun `ruta del hub biometrico es consistente`() {
        assertEquals("tu_perfil_biometrics_hub", NavRoute.TuPerfilBiometricsHub.route)
    }

    @Test
    fun `rutas de los dos modos del hub se crean correctamente`() {
        val routeConsultar = NavRoute.TuPerfilBiometrics.create("consultar")
        assertEquals("tu_perfil_biometrics?mode=consultar", routeConsultar)

        val routeQuincena = NavRoute.TuPerfilBiometrics.create("revisar_quincena")
        assertEquals("tu_perfil_biometrics?mode=revisar_quincena", routeQuincena)
    }

    @Test
    fun `flujo automatico resuelve el ultimo periodo disponible`() {
        val periods = listOf(
            BiometricPeriod("2026081", "1ª quincena de agosto 2026"),
            BiometricPeriod("2026082", "2ª quincena de agosto 2026"),
            BiometricPeriod("2026091", "1ª quincena de septiembre 2026"),
            BiometricPeriod("2026092", "2ª quincena de septiembre 2026"),
        )
        val latest = BiometricFlowPolicy.defaultPeriod(periods)
        assertNotNull(latest)
        assertEquals("2026092", latest?.value)
        assertEquals("2ª quincena de septiembre 2026", latest?.label)
    }

    @Test
    fun `flujo automatico y selector enfocan el mas reciente aunque 2025001 venga al final del portal`() {
        val portalPeriods = listOf(
            BiometricPeriod("2026019 (1ra - OCTUBRE)", "2026019 (1ra - OCTUBRE)"),
            BiometricPeriod("2026018 (2da - SEPTIEMBRE)", "2026018 (2da - SEPTIEMBRE)"),
            BiometricPeriod("2025001 (1ra - ENERO)", "2025001 (1ra - ENERO)"),
        )
        val latest = BiometricFlowPolicy.defaultPeriod(portalPeriods)
        val sorted = BiometricFlowPolicy.sortNewestFirst(portalPeriods)
        assertNotNull(latest)
        assertEquals("2026019 (1ra - OCTUBRE)", latest?.label)
        assertEquals("2026019 (1ra - OCTUBRE)", sorted.first().label)
    }

    @Test
    fun `flujo automatico con lista vacia devuelve null`() {
        val emptyPeriods = emptyList<BiometricPeriod>()
        val latest = BiometricFlowPolicy.defaultPeriod(emptyPeriods)
        assertNull(latest)
    }

    @Test
    fun `reporte de auditoria para resumen exclusivo detecta quincena limpia`() {
        val cols = listOf(
            BiometricColumn("c0", "Fecha"),
            BiometricColumn("c1", "Hora"),
        )
        // Jornada matutina completa (07:00 y 15:00)
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-09-15", "c1" to "07:02")),
            BiometricRecord(mapOf("c0" to "2026-09-15", "c1" to "15:03")),
        )
        val dayGroups = BiometricGrouping.groupByDays(cols, records)
        val report = BiometricOmissionDetector.analyze(dayGroups)

        assertFalse(report.hasOmissions)
        assertEquals(0, report.omissions.size)
        assertEquals(1, report.completeShiftsCount)
    }

    @Test
    fun `reporte de auditoria para resumen exclusivo detecta omision de salida`() {
        val cols = listOf(
            BiometricColumn("c0", "Fecha"),
            BiometricColumn("c1", "Hora"),
        )
        // Solo checada de entrada matutina sin salida
        val records = listOf(
            BiometricRecord(mapOf("c0" to "2026-09-18", "c1" to "07:05")),
        )
        val dayGroups = BiometricGrouping.groupByDays(cols, records)
        val report = BiometricOmissionDetector.analyze(dayGroups)

        assertTrue(report.hasOmissions)
        assertEquals(1, report.omissions.size)
        assertEquals(BiometricOmissionType.FALTA_SALIDA, report.omissions[0].omissionType)
    }
}
