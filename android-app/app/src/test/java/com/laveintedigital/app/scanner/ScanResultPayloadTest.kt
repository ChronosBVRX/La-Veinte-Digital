package com.laveintedigital.app.scanner

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ScanResultPayloadTest {

    @Test
    fun `success serializa páginas como base64 sin rutas ni datos personales`() {
        val payload = ScanResultPayload.success(
            listOf(
                ScannedPageData(base64 = "AAAA", mimeType = "image/jpeg", width = 1200, height = 1600),
                ScannedPageData(base64 = "BBBB", mimeType = "image/jpeg", width = 1200, height = 1600),
            )
        )
        val json = JSONObject(payload)
        assertTrue(json.getBoolean("ok"))
        assertEquals("mlkit", json.getString("engine"))
        val pages = json.getJSONArray("pages")
        assertEquals(2, pages.length())
        val first = pages.getJSONObject(0)
        assertEquals("AAAA", first.getString("base64"))
        assertEquals("image/jpeg", first.getString("mimeType"))
        assertEquals(1200, first.getInt("width"))
        assertEquals(1600, first.getInt("height"))
        assertFalse(payload.contains("filesDir"))
        assertFalse(payload.contains("content://"))
    }

    @Test
    fun `failure serializa motivo estable`() {
        val json = JSONObject(ScanResultPayload.failure("cancelled"))
        assertFalse(json.getBoolean("ok"))
        assertEquals("cancelled", json.getString("reason"))
    }

    @Test
    fun `mapFailureReason clasifica errores de ML Kit como unsupported`() {
        val mlKitError = com.google.mlkit.common.MlKitException(
            "MlKitException: UNSUPPORTED",
            com.google.mlkit.common.MlKitException.UNSUPPORTED,
        )
        assertEquals("unsupported", ScanResultPayload.mapFailureReason(mlKitError))
    }

    @Test
    fun `mapFailureReason clasifica Play services ausente`() {
        val error = com.google.android.gms.common.api.ApiException(
            com.google.android.gms.common.api.Status(16, "API not available")
        )
        assertEquals("play_services_unavailable", ScanResultPayload.mapFailureReason(error))
    }

    @Test
    fun `mapFailureReason clasifica errores desconocidos como failed`() {
        assertEquals("failed", ScanResultPayload.mapFailureReason(IllegalStateException("boom")))
        assertEquals("failed", ScanResultPayload.mapFailureReason(null))
    }

    @Test
    fun `mapFailureReason clasifica SecurityException como permission_denied`() {
        assertEquals("permission_denied", ScanResultPayload.mapFailureReason(SecurityException("denied")))
    }
}
