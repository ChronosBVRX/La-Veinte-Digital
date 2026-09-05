package com.laveintedigital.app.internal.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Parser puro del protocolo mínimo. Nunca lanza ante mensajes corruptos:
 * lo inválido se ignora silenciosamente en el listener.
 */
class NavFeedbackEventsTest {

    @Test
    fun `intent valido se acepta con path y gen`() {
        val event = NavFeedbackEvents.parse("""{"event":"intent","path":"/calculadoras","gen":3}""")
        assertEquals(NavFeedbackEvent.Intent("/calculadoras", 3L), event)
    }

    @Test
    fun `commit valido se acepta sin gen`() {
        val event = NavFeedbackEvents.parse("""{"event":"commit","path":"/guia/mi-quincena"}""")
        assertEquals(NavFeedbackEvent.Commit("/guia/mi-quincena", null), event)
    }

    @Test
    fun `campos extra se ignoran sin invalidar`() {
        val event = NavFeedbackEvents.parse(
            """{"event":"intent","path":"/a","gen":1,"cookies":"x","token":"y","extra":{}}""",
        )
        assertEquals(NavFeedbackEvent.Intent("/a", 1L), event)
    }

    @Test
    fun `path vacio es invalido`() {
        assertTrue(NavFeedbackEvents.parse("""{"event":"intent","path":""}""") is NavFeedbackEvent.Invalid)
    }

    @Test
    fun `path sin slash inicial es invalido`() {
        assertTrue(
            NavFeedbackEvents.parse("""{"event":"commit","path":"https://evil.example/x"}""")
                is NavFeedbackEvent.Invalid,
        )
    }

    @Test
    fun `path con espacios es invalido`() {
        assertTrue(
            NavFeedbackEvents.parse("""{"event":"intent","path":"/a b"}""") is NavFeedbackEvent.Invalid,
        )
    }

    @Test
    fun `JSON invalido es invalido`() {
        assertTrue(NavFeedbackEvents.parse("""{"event":"intent","path":/rota""") is NavFeedbackEvent.Invalid)
        assertTrue(NavFeedbackEvents.parse("no-json") is NavFeedbackEvent.Invalid)
        assertTrue(NavFeedbackEvents.parse("") is NavFeedbackEvent.Invalid)
        assertTrue(NavFeedbackEvents.parse(null) is NavFeedbackEvent.Invalid)
    }

    @Test
    fun `evento desconocido es invalido`() {
        assertTrue(
            NavFeedbackEvents.parse("""{"event":"loadUrl","path":"/x"}""") is NavFeedbackEvent.Invalid,
        )
        assertTrue(
            NavFeedbackEvents.parse("""{"event":"eval","code":"1+1"}""") is NavFeedbackEvent.Invalid,
        )
    }

    @Test
    fun `evento ausente es invalido`() {
        assertTrue(NavFeedbackEvents.parse("""{"path":"/x"}""") is NavFeedbackEvent.Invalid)
    }

    @Test
    fun `gen negativo es invalido`() {
        assertTrue(
            NavFeedbackEvents.parse("""{"event":"intent","path":"/x","gen":-2}""")
                is NavFeedbackEvent.Invalid,
        )
    }

    @Test
    fun `path demasiado largo es invalido`() {
        val long = "/" + "a".repeat(NavFeedbackConfig.MAX_PATH_LENGTH)
        assertTrue(
            NavFeedbackEvents.parse("""{"event":"intent","path":"$long"}""") is NavFeedbackEvent.Invalid,
        )
    }
}
