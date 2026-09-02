package com.laveintedigital.app.internal

import org.junit.Assert.*
import org.junit.Test

class PdfShareManagerStrictTest {

    @Test
    fun `transferId validation accepts valid UUID and safe alphanumeric keys`() {
        assertTrue(PdfShareManager.isValidTransferId("123e4567-e89b-12d3-a456-426614174000"))
        assertTrue(PdfShareManager.isValidTransferId("req_12345-abc_DEF"))
        assertTrue(PdfShareManager.isValidTransferId("session1"))

        assertFalse(PdfShareManager.isValidTransferId("../traversal"))
        assertFalse(PdfShareManager.isValidTransferId("foo/bar"))
        assertFalse(PdfShareManager.isValidTransferId(""))
        assertFalse(PdfShareManager.isValidTransferId("a".repeat(65)))
        assertFalse(PdfShareManager.isValidTransferId("id with spaces"))
        assertFalse(PdfShareManager.isValidTransferId("id;semicolon"))
    }

    @Test
    fun `sanitizePdfFileName neutralizes path traversal`() {
        assertEquals("documento.pdf", PdfShareManager.sanitizePdfFileName("../../../etc/passwd"))
        assertEquals("1.pdf", PdfShareManager.sanitizePdfFileName("escrito/1"))
        assertEquals("solicitud.pdf", PdfShareManager.sanitizePdfFileName("solicitud"))
    }
}
