package com.laveintedigital.app.imss.portal

import com.laveintedigital.app.imss.tarjeton.TarjetonCaptureSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest

class ImssPdfCaptureDeduplicationTest {

    @Test
    fun `processedHashes in capture session prevents duplicate processing of identical PDF`() {
        val session = TarjetonCaptureSession(
            id = "sess_1",
            portalId = "TU_PERFIL",
            ooadCode = "09",
            ooadLabel = "DF NORTE",
            periodCode = "202605",
            periodLabel = "1ª quincena de marzo de 2026",
        )

        val samplePdfBytes = "%PDF-1.4 sample content".toByteArray()
        val sha = MessageDigest.getInstance("SHA-256").digest(samplePdfBytes).joinToString("") { "%02x".format(it) }

        // Primer intento: el hash no ha sido procesado
        assertFalse(sha in session.processedHashes)
        session.processedHashes += sha

        // Segundo intento con los mismos bytes: el hash ya está en la sesión
        assertTrue(sha in session.processedHashes)
    }

    @Test
    fun `session tracks canonical tarjeton vs concepts auxiliary pdf`() {
        val session = TarjetonCaptureSession(
            id = "sess_2",
            portalId = "TU_PERFIL",
            ooadCode = "09",
            ooadLabel = "DF NORTE",
            periodCode = "202605",
            periodLabel = "1ª quincena de marzo de 2026",
        )

        // Inicialmente no hay ID de documento asignado
        assertEquals(null, session.tarjetonDocumentId)

        // Se guarda el primer PDF como Tarjetón
        session.tarjetonDocumentId = 101L
        assertEquals(101L, session.tarjetonDocumentId)

        // El segundo PDF se asocia como conceptos del tarjetonDocumentId
        val secondPdfBytes = "%PDF-1.4 concepts content".toByteArray()
        val sha2 = MessageDigest.getInstance("SHA-256").digest(secondPdfBytes).joinToString("") { "%02x".format(it) }
        session.processedHashes += sha2

        assertTrue(session.tarjetonDocumentId != null)
        assertTrue(sha2 in session.processedHashes)
    }
}
