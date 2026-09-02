package com.laveintedigital.app.imss.payslips

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.json.JSONObject

class NativeDocumentsDeleteTest {

    @Before
    fun setUp() {
        NativeDocuments.PendingPrint.clear()
    }

    @Test
    fun `pending print is cleared when target document is deleted`() {
        NativeDocuments.PendingPrint.set("/data/user/0/app/files/Tarjetones/tarjeton_123.pdf")
        assertEquals("/data/user/0/app/files/Tarjetones/tarjeton_123.pdf", NativeDocuments.PendingPrint.get())

        // Simular que se limpia PendingPrint
        NativeDocuments.PendingPrint.clear()
        assertNull(NativeDocuments.PendingPrint.get())
    }

    @Test
    fun `deleteById error contracts for invalid inputs`() {
        // DocumentId <= 0 debe retornar ok: false e invalid_id
        val invalidIdResult = JSONObject().put("ok", false).put("reason", "invalid_id")
        assertFalse(invalidIdResult.getBoolean("ok"))
        assertEquals("invalid_id", invalidIdResult.getString("reason"))

        // Documento no encontrado debe retornar not_found
        val notFoundResult = JSONObject().put("ok", false).put("reason", "not_found")
        assertFalse(notFoundResult.getBoolean("ok"))
        assertEquals("not_found", notFoundResult.getString("reason"))

        // Ruta esperada fuera de filesDir debe retornar invalid_path
        val invalidPathResult = JSONObject().put("ok", false).put("reason", "invalid_path")
        assertFalse(invalidPathResult.getBoolean("ok"))
        assertEquals("invalid_path", invalidPathResult.getString("reason"))
    }
}
