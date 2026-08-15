package com.laveintedigital.app.imss.biometric

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BiometricTraceTest {

    @Test
    fun `buffer en memoria conserva el orden de eventos`() {
        BiometricTrace.reset()
        BiometricTrace.trace(op = 41, gen = 1, stage = "ROUTE", event = "ROUTE_READY", result = true)
        BiometricTrace.trace(op = 41, gen = 1, stage = "FORM", event = "FORM_READY", result = true)
        BiometricTrace.trace(op = 41, gen = 1, stage = "OOAD", event = "READ", result = false, details = "code=OOAD_NOT_RESOLVED")
        val events = BiometricTrace.events()
        assertEquals(3, events.size)
        assertEquals("ROUTE", events[0].stage)
        assertEquals("OOAD", events[2].stage)
        assertEquals("code=OOAD_NOT_RESOLVED", events[2].details)
        assertEquals(false, events[2].result)
    }

    @Test
    fun `buffer circular descarta los eventos mas antiguos`() {
        BiometricTrace.reset()
        for (i in 1..(BiometricTrace.CAPACITY + 25)) {
            BiometricTrace.trace(op = 42, gen = 1, stage = "APPLY_PERIOD", event = "attempt$i", result = null)
        }
        val events = BiometricTrace.events()
        assertEquals(BiometricTrace.CAPACITY, events.size)
        assertEquals("attempt26", events.first().event)
        assertEquals("attempt${BiometricTrace.CAPACITY + 25}", events.last().event)
    }

    @Test
    fun `reset limpia el buffer`() {
        BiometricTrace.reset()
        BiometricTrace.trace(op = 1, gen = 1, stage = "ROUTE", event = "START", result = true)
        assertEquals(1, BiometricTrace.events().size)
        BiometricTrace.reset()
        assertTrue(BiometricTrace.events().isEmpty())
        assertNull(BiometricTrace.lastOperation())
    }

    @Test
    fun `copySanitizedReport sin eventos dice sin eventos`() {
        BiometricTrace.reset()
        assertEquals("=== LVD BIOMETRIC TRACE ===\nsin eventos registrados", BiometricTrace.copySanitizedReport())
    }

    @Test
    fun `copySanitizedReport agrega operaciones y secciones`() {
        BiometricTrace.reset()
        BiometricTrace.trace(op = 45, gen = 2, stage = "Transitioning", event = "TRANSITION", result = null, details = "ReadingPeriods")
        BiometricTrace.trace(op = 45, gen = 2, stage = "ROUTE", event = "ROUTE_READY", result = true)
        BiometricTrace.trace(op = 45, gen = 2, stage = "FORM", event = "FORM_READY", result = false)
        BiometricTrace.trace(op = 45, gen = 2, stage = "SUBMIT", event = "DONE", result = false, details = "code=SUBMIT_FAILED")
        BiometricTrace.trace(op = 45, gen = 2, stage = "WAIT_RESULTS", event = "FAILED", result = false, details = "code=RESULT_TIMEOUT")
        BiometricTrace.trace(op = 45, gen = 2, stage = "NET", event = "XHR", result = true, details = "method=GET path=/api/biometric status=200")

        val report = BiometricTrace.copySanitizedReport()
        assertTrue(report.contains("operations=BIO#45"))
        assertTrue(report.contains("operation=45"))
        assertTrue(report.contains("ROUTE:"))
        assertTrue(report.contains("FORM:"))
        assertTrue(report.contains("QUERY:"))
        assertTrue(report.contains("DOWNLOAD:"))
        assertTrue(report.contains("JS_ERRORS:"))
        assertTrue(report.contains("NETWORK (últimas 12):"))
        assertTrue(report.contains("path=/api/biometric status=200"))
        assertTrue(report.contains("RESULT:"))
        assertTrue(report.contains("FAILED stage=WAIT_RESULTS code=RESULT_TIMEOUT"))
        assertTrue(report.contains("TRANSITIONS:"))
    }

    @Test
    fun `el reporte nunca guarda el ratio completo de eventos si hay OK y FAIL del mismo evento`() {
        BiometricTrace.reset()
        BiometricTrace.trace(op = 46, gen = 3, stage = "APPLY_PERIOD", event = "SUMMARY", result = false, details = "verified=false")
        val single = BiometricTrace.copySanitizedReport()
        assertTrue(single.contains("verified=false"))
        assertFalse(single.contains("verified=true"))
    }
}