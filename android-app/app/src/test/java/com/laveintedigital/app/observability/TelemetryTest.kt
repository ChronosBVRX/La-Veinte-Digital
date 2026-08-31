package com.laveintedigital.app.observability

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TelemetryTest {

    @Test
    fun `sanitize redacts sensitive keys`() {
        val raw = mapOf(
            "screen" to "ProfileScreen",
            "password" to "mySecretPassword",
            "token" to "eyJhbGciOi...",
            "curp" to "ABCD900101HDFR01",
            "rfc" to "ABCD9001011A2",
            "nss" to "12345678901",
            "matricula" to "998877",
            "status" to "success"
        )

        val sanitized = Telemetry.sanitize(raw)

        assertEquals("ProfileScreen", sanitized["screen"])
        assertEquals("success", sanitized["status"])
        assertEquals("[REDACTED]", sanitized["password"])
        assertEquals("[REDACTED]", sanitized["token"])
        assertEquals("[REDACTED]", sanitized["curp"])
        assertEquals("[REDACTED]", sanitized["rfc"])
        assertEquals("[REDACTED]", sanitized["nss"])
        assertEquals("[REDACTED]", sanitized["matricula"])
    }

    @Test
    fun `sanitize truncates long text values`() {
        val longVal = "a".repeat(400)
        val raw = mapOf("details" to longVal)
        val sanitized = Telemetry.sanitize(raw)
        assertEquals(300, sanitized["details"]?.length)
    }
}
