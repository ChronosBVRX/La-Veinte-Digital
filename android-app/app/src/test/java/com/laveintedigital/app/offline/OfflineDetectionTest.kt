package com.laveintedigital.app.offline

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OfflineDetectionTest {

    @Test
    fun `connectivity errors trigger offline mode`() {
        assertTrue(OfflineDetection.isMainFrameConnectivityError(OfflineDetection.ERROR_UNKNOWN))
        assertTrue(OfflineDetection.isMainFrameConnectivityError(OfflineDetection.ERROR_HOST_LOOKUP))
        assertTrue(OfflineDetection.isMainFrameConnectivityError(OfflineDetection.ERROR_CONNECT))
        assertTrue(OfflineDetection.isMainFrameConnectivityError(OfflineDetection.ERROR_IO))
        assertTrue(OfflineDetection.isMainFrameConnectivityError(OfflineDetection.ERROR_TIMEOUT))
    }

    @Test
    fun `non connectivity errors never trigger offline mode`() {
        // WebViewClient codes: FILE=-13, FILE_NOT_FOUND=-14, TOO_MANY_REQUESTS=-15,
        // BAD_URL=-12, UNSUPPORTED_SCHEME=-10, REDIRECT_LOOP=-9, AUTH=-4, SSL=-11.
        listOf(-13, -14, -15, -12, -10, -9, -4, -5, -3, -11, 0, 404, 500).forEach { code ->
            assertFalse(
                "code $code must not be treated as offline",
                OfflineDetection.isMainFrameConnectivityError(code),
            )
        }
    }

    @Test
    fun `http status codes are never offline`() {
        listOf(401, 403, 404, 500, 502, 503).forEach { code ->
            assertFalse(OfflineDetection.isMainFrameConnectivityError(code))
        }
    }

    @Test
    fun `bucket classification by source`() {
        assertEquals(OfflineDetection.DocBucket.TARJETON, OfflineDetection.bucketFor("TU_PERFIL"))
        assertEquals(OfflineDetection.DocBucket.TARJETON, OfflineDetection.bucketFor("TARJETON_DIGITAL"))
        assertEquals(OfflineDetection.DocBucket.CHECADAS, OfflineDetection.bucketFor("TU_PERFIL_BIOMETRIC"))
        assertEquals(OfflineDetection.DocBucket.ESCRITO, OfflineDetection.bucketFor("ESCRITO"))
        assertEquals(OfflineDetection.DocBucket.NORMATIVA, OfflineDetection.bucketFor("NORMATIVA"))
        assertEquals(OfflineDetection.DocBucket.OTRO, OfflineDetection.bucketFor("UNKNOWN_X"))
    }

    @Test
    fun `owner id validation`() {
        assertTrue(NativeSessionOwner.isValidOwnerId("123e4567-e89b-12d3-a456-426614174000"))
        assertTrue(NativeSessionOwner.isValidOwnerId("anonymous"))
        assertFalse(NativeSessionOwner.isValidOwnerId(null))
        assertFalse(NativeSessionOwner.isValidOwnerId(""))
        assertFalse(NativeSessionOwner.isValidOwnerId("   "))
        assertFalse(NativeSessionOwner.isValidOwnerId("../escape"))
        assertFalse(NativeSessionOwner.isValidOwnerId("a".repeat(129)))
    }

    @Test
    fun `chromium net error descriptions trigger offline mode`() {
        assertTrue(
            OfflineDetection.isMainFrameConnectivityError(
                0,
                "net::ERR_INTERNET_DISCONNECTED",
            ),
        )
        assertTrue(
            OfflineDetection.isMainFrameConnectivityError(
                0,
                "net::ERR_NAME_NOT_RESOLVED",
            ),
        )
        assertTrue(
            OfflineDetection.isMainFrameConnectivityError(
                0,
                "net::ERR_CONNECTION_TIMED_OUT",
            ),
        )
        assertFalse(
            OfflineDetection.isMainFrameConnectivityError(
                -11,
                "net::ERR_CERT_AUTHORITY_INVALID",
            ),
        )
    }

    @Test
    fun `internal error urls are detected`() {
        assertTrue(OfflineDetection.isInternalErrorUrl(null))
        assertTrue(OfflineDetection.isInternalErrorUrl(""))
        assertTrue(OfflineDetection.isInternalErrorUrl("chrome-error://chromewebdata/"))
        assertTrue(OfflineDetection.isInternalErrorUrl("about:blank"))
        assertFalse(OfflineDetection.isInternalErrorUrl("https://la-veinte-digital.vercel.app/"))
    }

    @Test
    fun `navigation tracker prevents onPageFinished from clearing offline after main frame error`() {
        val tracker = OfflineNavigationTracker()
        val url = "https://la-veinte-digital.vercel.app/"

        // 1. Cold start without internet: onPageStarted -> onReceivedError -> onPageFinished
        tracker.onPageStarted(url)
        assertFalse(tracker.hasOfflineError)

        tracker.onMainFrameConnectivityError()
        assertTrue(tracker.hasOfflineError)

        // Chromium fires onPageFinished right after onReceivedError with either the failing URL
        // or chrome-error://chromewebdata/. Neither may commit online state.
        assertFalse(tracker.shouldCommitOnlineOnPageFinished(url, isInternalHost = true))
        assertFalse(
            tracker.shouldCommitOnlineOnPageFinished(
                "chrome-error://chromewebdata/",
                isInternalHost = false,
            ),
        )
        assertTrue(tracker.hasOfflineError)

        // 2. Subsequent retry when internet is restored: onPageStarted resets error for real URL
        tracker.onPageStarted(url)
        assertFalse(tracker.hasOfflineError)
        assertTrue(tracker.shouldCommitOnlineOnPageFinished(url, isInternalHost = true))
    }
}
