package com.laveintedigital.app.internal

import org.junit.Assert.assertEquals
import org.junit.Test

/** Verifies origin extraction used to build /transfer?print=1 URLs. */
class LaVeinteOriginTest {

    @Test
    fun `bare origin keeps scheme and authority`() {
        assertEquals(
            "https://la-veinte-digital.vercel.app",
            laveinteOrigin("https://la-veinte-digital.vercel.app"),
        )
    }

    @Test
    fun `url with path strips only the path`() {
        assertEquals(
            "https://la-veinte-digital.vercel.app",
            laveinteOrigin("https://la-veinte-digital.vercel.app/login"),
        )
    }

    @Test
    fun `never produces a bare https-scheme host`() {
        val origin = laveinteOrigin("https://la-veinte-digital.vercel.app")
        assertEquals("https://la-veinte-digital.vercel.app", origin)
        // "https:/" alone (no authority) must never occur.
        org.junit.Assert.assertNotEquals("https:", origin)
        org.junit.Assert.assertNotEquals("https:/", origin)
        org.junit.Assert.assertTrue(origin.startsWith("https://"))
    }

    @Test
    fun `www production domain is preserved`() {
        assertEquals(
            "https://www.la20.com.mx",
            laveinteOrigin("https://www.la20.com.mx/transfer"),
        )
    }
}
