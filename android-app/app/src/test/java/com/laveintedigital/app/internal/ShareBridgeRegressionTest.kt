package com.laveintedigital.app.internal

import org.junit.Assert.*
import org.junit.Test

class ShareBridgeRegressionTest {

    @Test
    fun `handleBridgeUrl preserves share and shareNativeDocument routes`() {
        var sharedTitle: String? = null
        var sharedText: String? = null
        BridgeHandler.onShare = { title, text ->
            sharedTitle = title
            sharedText = text
        }

        var sharedNativePath: String? = null
        var sharedNativeTitle: String? = null
        BridgeHandler.onShareNativeDocument = { path, title ->
            sharedNativePath = path
            sharedNativeTitle = title
        }

        // Test /share
        val shareUrl = "laveinte://bridge/share?title=Tarjeton&text=Documento%20Oficial"
        val handledShare = handleBridgeUrl(shareUrl, null)
        assertTrue(handledShare)
        assertEquals("Tarjeton", sharedTitle)
        assertEquals("Documento Oficial", sharedText)

        // Test /shareNativeDocument
        val nativeUrl = "laveinte://bridge/shareNativeDocument?path=%2Fdata%2Fdocs%2Ftarjeton_1.pdf&title=Mi%20Tarjeton"
        val handledNative = handleBridgeUrl(nativeUrl, null)
        assertTrue(handledNative)
        assertEquals("/data/docs/tarjeton_1.pdf", sharedNativePath)
        assertEquals("Mi Tarjeton", sharedNativeTitle)
    }
}
