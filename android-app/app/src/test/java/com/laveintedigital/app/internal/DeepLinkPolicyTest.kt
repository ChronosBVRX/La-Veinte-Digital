package com.laveintedigital.app.internal

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeepLinkPolicyTest {

    @Test
    fun `https on our own domain is allowed`() {
        assertTrue(
            isDeepLinkLoadAllowed(
                "https",
                "la-veinte-digital.vercel.app",
                "https://la-veinte-digital.vercel.app/callback?code=abc",
            ),
        )
    }

    @Test
    fun `https app link on internal domain with subdomain allowed`() {
        assertTrue(
            isDeepLinkLoadAllowed(
                "https",
                "la-veinte-digital.vercel.app",
                "https://la-veinte-digital.vercel.app/x",
            ),
        )
    }

    @Test
    fun `our bridge protocol is allowed`() {
        assertTrue(isDeepLinkLoadAllowed("laveinte", "bridge", "laveinte://bridge/openOfficialPayslips"))
        assertTrue(isDeepLinkLoadAllowed(null, null, "LAVEINTE://BRIDGE/x"))
    }

    @Test
    fun `https on a foreign host is rejected`() {
        assertFalse(isDeepLinkLoadAllowed("https", "evil.example.com", "https://evil.example.com/phish"))
        assertFalse(isDeepLinkLoadAllowed("https", "imss.gob.mx", "https://imss.gob.mx/x"))
    }

    @Test
    fun `dangerous schemes are rejected`() {
        assertFalse(isDeepLinkLoadAllowed("file", null, "file:///data/data/com.laveintedigital.app/secret"))
        assertFalse(isDeepLinkLoadAllowed("javascript", null, "javascript:alert(1)"))
        assertFalse(isDeepLinkLoadAllowed("content", null, "content://provider/doc"))
        assertFalse(isDeepLinkLoadAllowed("intent", null, "intent://evil"))
        assertFalse(isDeepLinkLoadAllowed("com.laveintedigital.app", "evil", "com.laveintedigital.app://evil"))
    }

    @Test
    fun `plain http and null scheme are rejected`() {
        assertFalse(isDeepLinkLoadAllowed("http", "la-veinte-digital.vercel.app", "http://la-veinte-digital.vercel.app/x"))
        assertFalse(isDeepLinkLoadAllowed(null, "la-veinte-digital.vercel.app", "https://la-veinte-digital.vercel.app/x"))
    }
}
