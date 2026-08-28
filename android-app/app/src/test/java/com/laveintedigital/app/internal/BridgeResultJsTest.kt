package com.laveintedigital.app.internal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifies the async bridge reply is delivered as a valid JS expression so the promise never hangs.
 * The old naive interpolation broke when a localPath or base64 data contained `'`, `"`, `\n`, `/`,
 * `+`, `=` — leaving the scanner stuck on "Preparando…".
 */
class BridgeResultJsTest {

    @Test
    fun `plain payload is wrapped as a JS string literal`() {
        val js = bridgeResultJs("req1", "{\"localPath\":\"/a/b\"}")
        assertEquals(
            "window.__laveinteBridgeResult(\"req1\", \"{\\\"localPath\\\":\\\"/a/b\\\"}\")",
            js,
        )
    }

    @Test
    fun `a path with a single quote is escaped and does not break the expression`() {
        val path = "/data/user/0/app/files/Tarjetones/o'brien/tarjeton_1.pdf"
        val payload = "{\"localPath\":\"$path\"}"
        val js = bridgeResultJs("req2", payload)
        assertTrue(js.contains("\\'") || js.contains("o\\u0027brien") || js.contains("o'brien"))
        // The whole thing must remain one valid, balanced JS call.
        assertTrue(js.startsWith("window.__laveinteBridgeResult("))
        assertTrue(js.endsWith(")"))
    }

    @Test
    fun `base64 payload with slashes plus and equals is left intact inside a quoted string`() {
        val b64 = "JVBERi0xLjQKJcOkw7zDtsOfCg==/+/eQ=="
        val payload = "{\"name\":\"tarjeton.pdf\",\"data\":\"$b64\"}"
        val js = bridgeResultJs("req3", payload)
        assertTrue(js.contains("JVBERi0xLjQKJcOkw7zDtsOfCg==/+/eQ=="))
        // Balanced parens / quote counts.
        assertEquals(1, js.count { it == '(' })
        assertEquals(1, js.count { it == ')' })
    }

    @Test
    fun `payload with newline and backslash does not produce an unterminated string`() {
        val payload = "{\"data\":\"line1\\nline2\\\\end\"}"
        val js = bridgeResultJs("req4", payload)
        assertTrue(js.contains("\\n"))
        assertTrue(js.contains("\\\\"))
    }
}
