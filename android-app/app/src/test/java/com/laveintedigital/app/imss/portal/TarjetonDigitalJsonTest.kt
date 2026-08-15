package com.laveintedigital.app.imss.portal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class TarjetonDigitalJsonTest {

    @Test
    fun `parseArray acepta array directo`() {
        val arr = TarjetonDigitalJson.parseArray("""[{"code":"2026015","fechas":"a","observaciones":"b"}]""")
        assertNotNull(arr)
        assertEquals(1, arr!!.length())
        assertEquals("2026015", arr.getJSONObject(0).getString("code"))
    }

    @Test
    fun `parseArray acepta string con doble serializacion`() {
        // Simula lo que devuelve evaluateJavascript tras JSON.stringify(array):
        val raw = "\"[{\\\"code\\\":\\\"2026015\\\",\\\"fechas\\\":\\\"a\\\",\\\"observaciones\\\":\\\"b\\\"}]\""
        val arr = TarjetonDigitalJson.parseArray(raw)
        assertNotNull(arr)
        assertEquals(1, arr!!.length())
        assertEquals("2026015", arr.getJSONObject(0).getString("code"))
    }

    @Test
    fun `parseArray vacio devuelve array vacio no null`() {
        val arr = TarjetonDigitalJson.parseArray("\"[]\"")
        assertNotNull(arr)
        assertEquals(0, arr!!.length())
    }

    @Test
    fun `parseArray nulo devuelve null`() {
        assertNull(TarjetonDigitalJson.parseArray(null))
        assertNull(TarjetonDigitalJson.parseArray("null"))
        assertNull(TarjetonDigitalJson.parseArray("undefined"))
    }

    @Test
    fun `parseObject acepta string con doble serializacion`() {
        val raw = "\"{\\\"page\\\":\\\"tarjeton\\\",\\\"message\\\":\\\"\\\"}\""
        val obj = TarjetonDigitalJson.parseObject(raw)
        assertNotNull(obj)
        assertEquals("tarjeton", obj!!.getString("page"))
    }

    @Test
    fun `parseObject nulo devuelve null`() {
        assertNull(TarjetonDigitalJson.parseObject(null))
        assertNull(TarjetonDigitalJson.parseObject("null"))
    }
}
