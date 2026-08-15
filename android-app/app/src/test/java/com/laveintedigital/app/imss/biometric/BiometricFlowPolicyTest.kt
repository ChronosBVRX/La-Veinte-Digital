package com.laveintedigital.app.imss.biometric

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BiometricFlowPolicyTest {

    // ── Entrada / credenciales compartidas ─────────────────────────────────

    @Test
    fun `con sesion vigente entra directo sin login`() {
        assertEquals(BiometricFlowPolicy.EntryAction.USE_SESSION,
            BiometricFlowPolicy.entryAction(authenticatedPath = true, hasCredentials = false))
    }

    @Test
    fun `sin sesion y con credenciales TU_PERFIL hace auto login`() {
        assertEquals(BiometricFlowPolicy.EntryAction.AUTO_LOGIN,
            BiometricFlowPolicy.entryAction(authenticatedPath = false, hasCredentials = true))
    }

    @Test
    fun `sin sesion y sin credenciales pide login`() {
        assertEquals(BiometricFlowPolicy.EntryAction.LOGIN_REQUIRED,
            BiometricFlowPolicy.entryAction(authenticatedPath = false, hasCredentials = false))
    }

    @Test
    fun `olvidar acceso implica que ninguna funcion encuentre credenciales`() {
        // "Olvidar acceso" elimina la ÚNICA identidad TU_PERFIL; ambas funciones
        // (Tarjetones y Biométricos) leen de la misma bóveda, por lo que ambas
        // caen en LOGIN_REQUIRED.
        assertEquals(BiometricFlowPolicy.EntryAction.LOGIN_REQUIRED,
            BiometricFlowPolicy.entryAction(authenticatedPath = false, hasCredentials = false))
        assertEquals(BiometricFlowPolicy.EntryAction.LOGIN_REQUIRED,
            BiometricFlowPolicy.entryAction(authenticatedPath = false, hasCredentials = false))
    }

    // ── Reautenticación (anti-loop) ────────────────────────────────────────

    @Test
    fun `se permite una reautenticacion por operacion`() {
        assertTrue(BiometricFlowPolicy.canReauth(0))
        assertFalse(BiometricFlowPolicy.canReauth(1))
        assertFalse(BiometricFlowPolicy.canReauth(2))
    }

    // ── Periodos ───────────────────────────────────────────────────────────

    @Test
    fun `periodo por defecto es el ultimo que ofrece el portal`() {
        val periods = listOf(
            BiometricPeriod("2026071", "1ª quincena de julio 2026"),
            BiometricPeriod("2026072", "2ª quincena de julio 2026"),
        )
        assertEquals(BiometricPeriod("2026072", "2ª quincena de julio 2026"),
            BiometricFlowPolicy.defaultPeriod(periods))
    }

    @Test
    fun `sin periodos no hay periodo por defecto`() {
        assertNull(BiometricFlowPolicy.defaultPeriod(emptyList()))
    }

    @Test
    fun `restaura periodo por valor y label exactos`() {
        val periods = listOf(
            BiometricPeriod("2026071", "1ª quincena de julio 2026"),
            BiometricPeriod("2026072", "2ª quincena de julio 2026"),
        )
        assertEquals(BiometricPeriod("2026072", "2ª quincena de julio 2026"),
            BiometricFlowPolicy.restorePeriod(periods, BiometricPeriod("2026072", "2ª quincena de julio 2026")))
    }

    @Test
    fun `restaura periodo por valor si el label cambio`() {
        val periods = listOf(BiometricPeriod("2026072", "Segunda quincena de julio de 2026"))
        assertEquals(BiometricPeriod("2026072", "Segunda quincena de julio de 2026"),
            BiometricFlowPolicy.restorePeriod(periods, BiometricPeriod("2026072", "2ª quincena de julio 2026")))
    }

    @Test
    fun `no restaura periodo que ya no existe`() {
        val periods = listOf(BiometricPeriod("2026071", "1ª quincena de julio 2026"))
        assertNull(BiometricFlowPolicy.restorePeriod(periods, BiometricPeriod("2026062", "2ª quincena de junio 2026")))
    }

    // ── Clasificación de fallos de lectura de periodos ─────────────────────

    @Test
    fun `selector no encontrado se clasifica como formulario no reconocido`() {
        assertEquals(BiometricErrorKind.DOM_NOT_RECOGNIZED,
            BiometricFlowPolicy.periodsFailureKind(BiometricFlowPolicy.PeriodsFailure.CONTROL_NOT_FOUND))
    }

    @Test
    fun `selector encontrado pero vacio se clasifica como periodos no legibles`() {
        assertEquals(BiometricErrorKind.PERIODS_NOT_READABLE,
            BiometricFlowPolicy.periodsFailureKind(BiometricFlowPolicy.PeriodsFailure.EMPTY_OPTIONS))
    }

    @Test
    fun `timeout de lectura se clasifica como timeout de periodos`() {
        assertEquals(BiometricErrorKind.PERIODS_TIMEOUT,
            BiometricFlowPolicy.periodsFailureKind(BiometricFlowPolicy.PeriodsFailure.TIMEOUT))
        assertEquals(BiometricErrorKind.PERIODS_TIMEOUT,
            BiometricFlowPolicy.periodsFailureKind(null))
    }

    // ── OOAD 17 — Michoacán (1.0.63) ───────────────────────────────────────

    @Test
    fun `normalize quita acentos y colapsa espacios`() {
        assertEquals("michoacan", BiometricFlowPolicy.normalize("Michoacán"))
        assertEquals("segunda quincena julio 2026", BiometricFlowPolicy.normalize(" Segunda   quincena Julio 2026 "))
        assertEquals("", BiometricFlowPolicy.normalize(null))
    }

    @Test
    fun `resuelve OOAD por valor real 17`() {
        val ooads = listOf(
            BiometricOoad("16", "Puebla"),
            BiometricOoad("17", "Michoacán"),
            BiometricOoad("18", "Guanajuato"),
        )
        assertEquals(BiometricOoad("17", "Michoacán"), BiometricFlowPolicy.selectOoad(ooads))
    }

    @Test
    fun `resuelve OOAD por label michoacan cuando el valor no es 17`() {
        val ooads = listOf(
            BiometricOoad("016", "PUEBLA"),
            BiometricOoad("MICH-1", "Michoacán"),
        )
        assertEquals(BiometricOoad("MICH-1", "Michoacán"), BiometricFlowPolicy.selectOoad(ooads))
    }

    @Test
    fun `acepta valor 017 con cero a la izquierda como 17`() {
        val ooads = listOf(BiometricOoad("017", "Michoacán"))
        assertEquals(BiometricOoad("017", "Michoacán"), BiometricFlowPolicy.selectOoad(ooads))
    }

    @Test
    fun `sin 17 ni michoacan no resuelve OOAD`() {
        assertNull(BiometricFlowPolicy.selectOoad(listOf(BiometricOoad("16", "Puebla"))))
        assertNull(BiometricFlowPolicy.selectOoad(emptyList()))
    }
}
