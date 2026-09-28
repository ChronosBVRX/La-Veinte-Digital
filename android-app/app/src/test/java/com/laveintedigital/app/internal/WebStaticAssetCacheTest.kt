package com.laveintedigital.app.internal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebStaticAssetCacheTest {

    @Test
    fun `allows immutable _next static and vendor GET subresources on internal host`() {
        assertTrue(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/_next/static/chunks/main-a1b2c3d4.js",
                method = "GET",
                isForMainFrame = false,
            ),
        )
        assertTrue(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/_next/static/css/9f8e7d6c.css",
                method = "GET",
                isForMainFrame = false,
            ),
        )
        assertTrue(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/_next/static/media/inter-latin.woff2",
                method = "GET",
                isForMainFrame = false,
            ),
        )
        assertTrue(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/vendor/pdf.worker.min.mjs",
                method = "GET",
                isForMainFrame = false,
            ),
        )
        assertTrue(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/vendor/spa.traineddata.gz",
                method = "GET",
                isForMainFrame = false,
            ),
        )
    }

    @Test
    fun `never caches HTML pages, RSC payloads, APIs, auth routes, or external domains`() {
        // Main frame navigation
        assertFalse(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/_next/static/chunks/main.js",
                method = "GET",
                isForMainFrame = true,
            ),
        )
        // RSC payload query
        assertFalse(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/calculadoras?_rsc=1a2b3",
                method = "GET",
                isForMainFrame = false,
            ),
        )
        // Even if someone appended _rsc to a static path
        assertFalse(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/_next/static/chunks/main.js?_rsc=1a2b3",
                method = "GET",
                isForMainFrame = false,
            ),
        )
        // API endpoints
        assertFalse(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/api/worker-context",
                method = "GET",
                isForMainFrame = false,
            ),
        )
        // Non-GET requests
        assertFalse(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/_next/static/chunks/main.js",
                method = "POST",
                isForMainFrame = false,
            ),
        )
        // External domain
        assertFalse(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://evil.example.com/_next/static/chunks/main.js",
                method = "GET",
                isForMainFrame = false,
            ),
        )
        // Path traversal attempt
        assertFalse(
            WebStaticAssetCache.isCacheableImmutableAsset(
                rawUrl = "https://la-veinte-digital.vercel.app/_next/static/../api/secret.js",
                method = "GET",
                isForMainFrame = false,
            ),
        )
    }

    @Test
    fun `resolveMimeType returns accurate content types`() {
        assertEquals("application/javascript", WebStaticAssetCache.resolveMimeType("/_next/static/chunks/a.js"))
        assertEquals("application/javascript", WebStaticAssetCache.resolveMimeType("/vendor/pdf.worker.min.mjs"))
        assertEquals("text/css", WebStaticAssetCache.resolveMimeType("/_next/static/css/app.css"))
        assertEquals("font/woff2", WebStaticAssetCache.resolveMimeType("/_next/static/media/font.woff2"))
        assertEquals("application/wasm", WebStaticAssetCache.resolveMimeType("/vendor/tesseract-core.wasm"))
    }
}
