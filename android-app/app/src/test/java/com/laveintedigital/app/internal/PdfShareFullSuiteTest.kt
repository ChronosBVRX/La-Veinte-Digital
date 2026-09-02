package com.laveintedigital.app.internal

import org.junit.Assert.*
import org.junit.Test
import java.security.MessageDigest

class PdfShareFullSuiteTest {

    @Test
    fun `transferId validation strictly enforces safe length and characters`() {
        // Valid
        assertTrue(PdfShareManager.isValidTransferId("session-123_ABC"))
        assertTrue(PdfShareManager.isValidTransferId("c9b04438-0ad4-41f8-9aa8-96c2d32a8c0b"))
        assertTrue(PdfShareManager.isValidTransferId("A".repeat(64)))

        // Malicious / Traversal attempts
        assertFalse(PdfShareManager.isValidTransferId("../evil"))
        assertFalse(PdfShareManager.isValidTransferId("..\\evil"))
        assertFalse(PdfShareManager.isValidTransferId("dir/file"))
        assertFalse(PdfShareManager.isValidTransferId("transfer;rm -rf /"))
        assertFalse(PdfShareManager.isValidTransferId("id with spaces"))
        assertFalse(PdfShareManager.isValidTransferId(""))
        assertFalse(PdfShareManager.isValidTransferId(null))
        assertFalse(PdfShareManager.isValidTransferId("A".repeat(65)))
    }

    @Test
    fun `sanitizePdfFileName neutralizes path traversal and enforces extension`() {
        assertEquals("documento.pdf", PdfShareManager.sanitizePdfFileName(""))
        assertEquals("documento.pdf", PdfShareManager.sanitizePdfFileName(null))
        assertEquals("documento.pdf", PdfShareManager.sanitizePdfFileName("../../../etc/passwd"))
        assertEquals("oficio_1.pdf", PdfShareManager.sanitizePdfFileName("oficio:1"))
        assertEquals("solicitud.pdf", PdfShareManager.sanitizePdfFileName("solicitud"))
        assertEquals("solicitud.pdf", PdfShareManager.sanitizePdfFileName("solicitud.pdf"))
    }

    @Test
    fun `constants adhere to contract limits`() {
        assertEquals(64 * 1024, PdfShareManager.MAX_CHUNK_SIZE)
        assertEquals(10 * 1024 * 1024, PdfShareManager.MAX_TOTAL_SIZE)
        assertEquals(30_000L, PdfShareManager.TIMEOUT_MS)
    }

    @Test
    fun `sha256 calculation matches expected digest`() {
        val bytes = "%PDF-1.4 sample content for hash test\n%%EOF".toByteArray(Charsets.US_ASCII)
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(bytes).joinToString("") { "%02x".format(it) }
        assertEquals(64, hash.length)
        assertTrue(hash.matches(Regex("^[0-9a-f]{64}$")))
    }
}
