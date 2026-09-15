package com.laveintedigital.app.scanner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScanDocumentOptionsTest {

    @Test
    fun `parse document mode con valores completos`() {
        val options = ScanDocumentOptions.parse(
            """{"mode":"document","allowGallery":false,"pageLimit":5}"""
        )
        assertEquals(ScanDocumentOptions.MODE_DOCUMENT, options?.mode)
        assertEquals(false, options?.allowGallery)
        assertEquals(5, options?.pageLimit)
        assertFalse(options!!.isIne)
    }

    @Test
    fun `parse document por defecto cuando el payload está vacío`() {
        val options = ScanDocumentOptions.parse("{}")
        assertEquals(ScanDocumentOptions.MODE_DOCUMENT, options?.mode)
        assertEquals(true, options?.allowGallery)
        assertEquals(ScanDocumentOptions.DEFAULT_PAGE_LIMIT, options?.pageLimit)
    }

    @Test
    fun `parse tolera json inválido sin lanzar`() {
        val options = ScanDocumentOptions.parse("no-es-json")
        assertEquals(ScanDocumentOptions.MODE_DOCUMENT, options?.mode)
    }

    @Test
    fun `parse rechaza modo desconocido`() {
        assertNull(ScanDocumentOptions.parse("""{"mode":"pasaporte"}"""))
    }

    @Test
    fun `modo ine-front normaliza pageLimit a 1 y marca isIneFront`() {
        val options = ScanDocumentOptions.parse(
            """{"mode":"ine-front","allowGallery":true,"pageLimit":10}"""
        )
        assertEquals(ScanDocumentOptions.MODE_INE_FRONT, options?.mode)
        assertEquals(1, options?.pageLimit)
        assertTrue(options!!.isIne)
        assertTrue(options.isIneFront)
    }

    @Test
    fun `modo ine-back normaliza pageLimit a 1 y no marca isIneFront`() {
        val options = ScanDocumentOptions.parse("""{"mode":"ine-back"}""")
        assertEquals(ScanDocumentOptions.MODE_INE_BACK, options?.mode)
        assertEquals(1, options?.pageLimit)
        assertTrue(options!!.isIne)
        assertFalse(options.isIneFront)
    }

    @Test
    fun `pageLimit se acota al máximo permitido`() {
        val options = ScanDocumentOptions.parse(
            """{"mode":"document","pageLimit":500}"""
        )
        assertEquals(ScanDocumentOptions.MAX_PAGE_LIMIT, options?.pageLimit)
    }

    @Test
    fun `pageLimit inválido usa el valor por defecto`() {
        val options = ScanDocumentOptions.parse(
            """{"mode":"document","pageLimit":0}"""
        )
        assertEquals(ScanDocumentOptions.DEFAULT_PAGE_LIMIT, options?.pageLimit)
    }

    @Test
    fun `parse acepta null`() {
        val options = ScanDocumentOptions.parse(null)
        assertEquals(ScanDocumentOptions.MODE_DOCUMENT, options?.mode)
    }
}
