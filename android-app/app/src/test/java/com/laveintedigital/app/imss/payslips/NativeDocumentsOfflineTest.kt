package com.laveintedigital.app.imss.payslips

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeDocumentsOfflineTest {

    @Test
    fun `visibility without known session owner shows everything`() {
        assertTrue(NativeDocuments.isVisibleTo(null, null))
        assertTrue(NativeDocuments.isVisibleTo("owner-a", null))
        assertTrue(NativeDocuments.isVisibleTo(null, ""))
    }

    @Test
    fun `visibility with known session owner isolates users`() {
        // Propios visibles.
        assertTrue(NativeDocuments.isVisibleTo("owner-a", "owner-a"))
        // Legacy sin atribuir visibles (política conservadora: nunca se oculta por migración).
        assertTrue(NativeDocuments.isVisibleTo(null, "owner-a"))
        assertTrue(NativeDocuments.isVisibleTo("", "owner-a"))
        // Documentos de otro usuario ocultos.
        assertFalse(NativeDocuments.isVisibleTo("owner-b", "owner-a"))
    }

    @Test
    fun `display name sanitization blocks path traversal`() {
        assertEquals("documento.pdf", NativeDocuments.sanitizeDisplayName(null))
        assertEquals("documento.pdf", NativeDocuments.sanitizeDisplayName("   "))
        assertEquals("escrito.pdf", NativeDocuments.sanitizeDisplayName("../../escrito.pdf"))
        assertEquals("escrito.pdf", NativeDocuments.sanitizeDisplayName("mi/escrito"))
        assertEquals("titulo.pdf", NativeDocuments.sanitizeDisplayName("titulo"))
        assertEquals("titulo.pdf", NativeDocuments.sanitizeDisplayName("titulo.pdf"))
        assertTrue(NativeDocuments.sanitizeDisplayName("a".repeat(200)).length <= 124)
    }
}
