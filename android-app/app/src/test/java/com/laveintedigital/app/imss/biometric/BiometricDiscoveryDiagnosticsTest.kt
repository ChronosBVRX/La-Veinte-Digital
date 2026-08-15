package com.laveintedigital.app.imss.biometric

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BiometricDiscoveryDiagnosticsTest {

    // ── parseResultsObserver ────────────────────────────────────────────────

    @Test
    fun `results observer missing se reporta como tal`() {
        val info = BiometricDiscovery.parseResultsObserver("""{"status":"missing"}""")
        assertNotNull(info)
        assertEquals("missing", info!!.status)
        assertNull(info.matches)
    }

    @Test
    fun `results observer working con localizados y tabla`() {
        val info = BiometricDiscovery.parseResultsObserver(
            """{"status":"working","runId":"gen5","matches":{"localizados":true,"tables":2,"rows":12,
               "matRows":0,"roleTables":0,"roleRows":0,"download":true,"share":false,"snippets":["Registros localizados: 12 datos"]}}""")
        assertNotNull(info)
        assertEquals("working", info!!.status)
        val m = info.matches!!
        assertEquals(true, m.localizados)
        assertEquals(2, m.tables)
        assertEquals(12, m.rows)
        assertEquals(true, m.download)
        assertEquals(false, m.share)
        assertEquals(listOf("Registros localizados: 12 datos"), m.snippets)
    }

    @Test
    fun `results observer stopped conserva las coincidencias`() {
        val info = BiometricDiscovery.parseResultsObserver(
            """{"status":"stopped","runId":"gen5","matches":{"localizados":false,"tables":0,"rows":0,"snippets":[]}}""")
        assertNotNull(info)
        assertEquals("stopped", info!!.status)
        assertEquals(false, info.matches!!.localizados)
        assertTrue(info.matches!!.snippets.isEmpty())
    }

    @Test
    fun `results observer nulo o array no son validos`() {
        assertNull(BiometricDiscovery.parseResultsObserver(null))
        assertNull(BiometricDiscovery.parseResultsObserver("[]"))
    }

    // ── parseDownloadEvents ─────────────────────────────────────────────────

    @Test
    fun `eventos de descarga se parsean con url sanitizada`() {
        val events = BiometricDiscovery.parseDownloadEvents(
            """[{"kind":"blob","url":"blob:https://tuperfil.imss.gob.mx/abc","download":"","mime":"application/pdf"},
               {"kind":"anchor","url":"https://tuperfil.imss.gob.mx/export","download":"registros.pdf","mime":""}]""")
        assertEquals(2, events.size)
        assertEquals("blob", events[0].kind)
        assertEquals("application/pdf", events[0].mime)
        assertEquals("anchor", events[1].kind)
        assertEquals("registros.pdf", events[1].download)
    }

    @Test
    fun `sin eventos de descarga devuelve lista vacia`() {
        assertTrue(BiometricDiscovery.parseDownloadEvents(null).isEmpty())
        assertTrue(BiometricDiscovery.parseDownloadEvents("[]").isEmpty())
    }

    // ── parseDownloadHints ──────────────────────────────────────────────────

    @Test
    fun `hints separan descargar de compartir`() {
        val hints = BiometricDiscovery.parseDownloadHints(
            """{"downloads":[{"tag":"button","id":"btnDescargar","role":"button","hasOnclick":true,"download":"","text":"Descargar"}],
               "shares":[{"tag":"a","id":"","href":"/share","role":"","hasOnclick":false,"download":"","text":"Compartir"}]}""")
        assertNotNull(hints)
        assertEquals(1, hints!!.downloads.size)
        assertEquals("btnDescargar", hints.downloads[0].id)
        assertEquals(true, hints.downloads[0].hasOnclick)
        assertEquals("a", hints.shares[0].tag)
        assertEquals("/share", hints.shares[0].href)
    }

    @Test
    fun `sin hints devuelve listas vacias no nulas`() {
        val hints = BiometricDiscovery.parseDownloadHints("""{"downloads":[],"shares":[]}""")
        assertNotNull(hints)
        assertTrue(hints!!.downloads.isEmpty())
        assertTrue(hints.shares.isEmpty())
        assertNull(BiometricDiscovery.parseDownloadHints(null))
    }

    // ── parseJsErrors ───────────────────────────────────────────────────────

    @Test
    fun `errores JS sanitizados se parsean por tipo`() {
        val errors = BiometricDiscovery.parseJsErrors(
            """[{"type":"error","msg":"Cannot read properties of undefined","file":"main.js","line":42,"col":7},
               {"type":"rejection","msg":"network error","file":"","line":0,"col":0},
               {"type":"console","msg":"failed to load resource","file":"","line":0,"col":0}]""")
        assertEquals(3, errors.size)
        assertEquals("error", errors[0].type)
        assertEquals("Cannot read properties of undefined", errors[0].message)
        assertEquals("main.js", errors[0].file)
        assertEquals(42, errors[0].line)
        assertEquals(7, errors[0].column)
        assertEquals("rejection", errors[1].type)
        assertEquals("console", errors[2].type)
    }

    @Test
    fun `sin errores JS devuelve lista vacia`() {
        assertTrue(BiometricDiscovery.parseJsErrors(null).isEmpty())
        assertTrue(BiometricDiscovery.parseJsErrors("null").isEmpty())
    }

    // ── Composición de scripts (cada etapa tiene su propio IIFE) ────────────

    @Test
    fun `startResultsObserverJs crea un MutationObserver dedicado`() {
        val js = BiometricDiscovery.startResultsObserverJs("gen1")
        assertTrue(js.contains("MutationObserver"))
        assertTrue(js.contains("gen1"))
        assertTrue(js.contains("registros localizados"))
        assertTrue(js.contains("descargar"))
        assertTrue(js.contains("compartir"))
    }

    @Test
    fun `downloadMonitorJs observa window open blob y anchor sin alterarlos`() {
        val js = BiometricDiscovery.downloadMonitorJs()
        assertTrue(js.contains("window.open"))
        assertTrue(js.contains("URL.createObjectURL"))
        assertTrue(js.contains("HTMLAnchorElement.prototype.click"))
        assertTrue(js.contains("__LVD_BIO_DL_HOOKED__"))
    }

    @Test
    fun `discoverDownloadJs inspecciona botones y enlaces visibles`() {
        val js = BiometricDiscovery.discoverDownloadJs()
        assertTrue(js.contains("descargar"))
        assertTrue(js.contains("compartir"))
        assertTrue(js.contains("querySelectorAll"))
    }

    @Test
    fun `jsErrorMonitorJs captura onerror unhandledrejection y console error`() {
        val js = BiometricDiscovery.jsErrorMonitorJs()
        assertTrue(js.contains("window.addEventListener('error'"))
        assertTrue(js.contains("unhandledrejection"))
        assertTrue(js.contains("console.error"))
    }

    @Test
    fun `resetJsErrorsJs vacia el buffer y queda llave de reinicio`() {
        assertEquals("1", BiometricDiscovery.resetJsErrorsJs().substringAfter("__LVD_BIO_JSERR__=[];return '").take(1))
        val js = BiometricDiscovery.resetJsErrorsJs()
        assertTrue(js.contains("__LVD_BIO_JSERR__=[]"))
        assertTrue(js.contains("__LVD_BIO_JSERR_HOOKED__") == false)
    }

    @Test
    fun `script de observacion de resultados usa runId para no reinstalar`() {
        val js1 = BiometricDiscovery.startResultsObserverJs("gen3")
        assertTrue(js1.contains("\"gen3\""))
        assertFalse(js1.contains("\"gen4\""))
    }
}