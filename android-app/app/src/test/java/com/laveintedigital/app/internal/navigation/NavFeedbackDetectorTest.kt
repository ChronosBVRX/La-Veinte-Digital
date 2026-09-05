package com.laveintedigital.app.internal.navigation

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * El detector solo observa: clicks en enlaces internos + History API.
 * Estos tests verifican el contrato del script inyectado y la allowlist sin
 * necesidad de un WebView real.
 */
class NavFeedbackDetectorTest {

    private val script = NavFeedbackDetector.script()

    @Test
    fun `script detecta clicks en enlaces`() {
        assertTrue(script.contains("closest('a')"))
        assertTrue(script.contains("postMessage"))
    }

    @Test
    fun `script observa history API y popstate`() {
        assertTrue(script.contains("pushState"))
        assertTrue(script.contains("replaceState"))
        assertTrue(script.contains("popstate"))
    }

    @Test
    fun `script nunca interfiere con la navegacion`() {
        assertFalse(script.contains("preventDefault"))
        assertFalse(script.contains("stopPropagation"))
        assertFalse(script.contains("history.back"))
        assertFalse(script.contains("history.go"))
        assertFalse(script.contains("location.href ="))
        assertFalse(script.contains("location.assign"))
        assertFalse(script.contains("location.replace"))
        assertFalse(script.contains("loadUrl"))
    }

    @Test
    fun `script excluye esquemas y destinos no navegables`() {
        assertTrue(script.contains("download"))
        assertTrue(script.contains("_blank"))
        assertTrue(script.contains("http:"))
        assertTrue(script.contains("https:"))
    }

    @Test
    fun `script compara clave real de navegacion e ignora hash`() {
        assertTrue(script.contains("pathname"))
        // La instalación es idempotente por documento.
        assertTrue(script.contains("__laveinteNavFeedbackInstalled"))
    }

    @Test
    fun `script usa bridge independiente del PDF bridge`() {
        assertTrue(script.contains("laVeinteNavFeedbackBridge"))
        assertFalse(script.contains("laVeintePdfBridge"))
        assertFalse(script.contains("LaVeinteApp"))
    }

    @Test
    fun `allowlist contiene los origenes internos de produccion`() {
        val allowed = NavFeedbackDetector.allowedOrigins()
        assertTrue(allowed.contains("https://la-veinte-digital.vercel.app"))
        assertTrue(allowed.contains("https://laveinte-digital.vercel.app"))
        assertTrue(allowed.contains("https://la-veinte-digital.pages.dev"))
        assertTrue(allowed.contains("https://la20.com.mx"))
        assertTrue(allowed.contains("https://www.la20.com.mx"))
    }

    @Test
    fun `origen permitido en main frame se acepta`() {
        val allowed = NavFeedbackDetector.allowedOrigins()
        assertTrue(
            NavFeedbackDetector.isMessageAllowed(
                "https://la-veinte-digital.vercel.app",
                true,
                allowed,
            ),
        )
    }

    @Test
    fun `origen externo se rechaza`() {
        val allowed = NavFeedbackDetector.allowedOrigins()
        assertFalse(
            NavFeedbackDetector.isMessageAllowed(
                "https://evil.example.com",
                true,
                allowed,
            ),
        )
    }

    @Test
    fun `iframe no principal se rechaza aunque el origen coincida`() {
        val allowed = NavFeedbackDetector.allowedOrigins()
        assertFalse(
            NavFeedbackDetector.isMessageAllowed(
                "https://la-veinte-digital.vercel.app",
                false,
                allowed,
            ),
        )
    }

    @Test
    fun `origen nulo se rechaza`() {
        val allowed = NavFeedbackDetector.allowedOrigins()
        assertFalse(NavFeedbackDetector.isMessageAllowed(null, true, allowed))
    }
}
