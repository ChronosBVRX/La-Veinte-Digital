package com.laveintedigital.app.downloads

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LaVeinteDownloadListenerTest {

    @Test
    fun `resolveFilename extracts standard filename from content disposition`() {
        val cd = "attachment; filename=\"expediente-12345.pdf\""
        val name = LaVeinteDownloadListener.resolveFilename("https://laveinte.digital/api/doc", cd, "application/pdf")
        assertEquals("expediente-12345.pdf", name)
    }

    @Test
    fun `resolveFilename handles RFC 5987 encoded filename with spaces and accents`() {
        val cd = "attachment; filename*=UTF-8''oficio%20licencia%20m%C3%A9dica.docx"
        val name = LaVeinteDownloadListener.resolveFilename("https://laveinte.digital/api/doc", cd, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        assertEquals("oficio licencia médica.docx", name)
    }

    @Test
    fun `resolveFilename sanitizes dangerous path traversal characters`() {
        val cd = "attachment; filename=\"../../../../etc/passwd.pdf\""
        val name = LaVeinteDownloadListener.resolveFilename("https://laveinte.digital/api/doc", cd, "application/pdf")
        assertFalse(name.contains(".."))
        assertFalse(name.contains("/"))
        assertTrue(name.endsWith(".pdf"))
    }

    @Test
    fun `resolveFilename extracts last path segment for regular HTTP URLs`() {
        val url = "https://laveinte.digital/static/normativa/cct-2025-2027.pdf"
        val name = LaVeinteDownloadListener.resolveFilename(url, null, "application/pdf")
        assertEquals("cct-2025-2027.pdf", name)
    }

    @Test
    fun `resolveFilename generates synthetic filename with correct extension for blob URLs`() {
        val url = "blob:https://laveinte.digital/1234-5678-abcd"
        val name = LaVeinteDownloadListener.resolveFilename(url, null, "application/vnd.ms-excel.sheet.macroEnabled.12")
        assertTrue(name.startsWith("la-veinte-"))
        assertTrue(name.endsWith(".xlsm"))
    }

    @Test
    fun `resolveMimeType detects correct MIME for common work formats`() {
        assertEquals(
            "application/pdf",
            LaVeinteDownloadListener.resolveMimeType("documento.pdf", null),
        )
        assertEquals(
            "application/vnd.ms-excel.sheet.macroEnabled.12",
            LaVeinteDownloadListener.resolveMimeType("licencia.xlsm", null),
        )
        assertEquals(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            LaVeinteDownloadListener.resolveMimeType("reporte.xlsx", null),
        )
        assertEquals(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            LaVeinteDownloadListener.resolveMimeType("oficio.docx", null),
        )
        assertEquals(
            "image/png",
            LaVeinteDownloadListener.resolveMimeType("captura.png", null),
        )
        assertEquals(
            "text/csv",
            LaVeinteDownloadListener.resolveMimeType("datos.csv", null),
        )
    }

    @Test
    fun `buildBlobFetchJs escapes URLs and filenames safely with quotes`() {
        val js = LaVeinteDownloadListener.buildBlobFetchJs(
            "blob:https://laveinte.digital/test-uuid",
            "licencia \"2026\".xlsm",
            "application/vnd.ms-excel.sheet.macroEnabled.12",
        )
        assertTrue(js.contains("blob:https://laveinte.digital/test-uuid"))
        assertTrue(js.contains("licencia \\\"2026\\\".xlsm"))
        assertTrue(js.contains("LaVeinteBlobReceiver.onBlobData"))
        assertTrue(js.contains("LaVeinteBlobReceiver.onBlobFailed"))
    }
}
