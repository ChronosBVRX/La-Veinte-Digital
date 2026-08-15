package com.laveintedigital.app.imss.tarjeton

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TarjetonDigitalDelegacionesTest {

    @Test
    fun `prettify genera nombres amigables con acentos`() {
        assertEquals("Michoacán", TarjetonDigitalDelegaciones.prettify("MICHOACAN"))
        assertEquals("Nuevo León", TarjetonDigitalDelegaciones.prettify("NUEVO LEON"))
        assertEquals("Querétaro", TarjetonDigitalDelegaciones.prettify("QUERETARO"))
        assertEquals("Estado de México Oriente", TarjetonDigitalDelegaciones.prettify("ESTADO DE MEXICO ORIENTE"))
        assertEquals("San Luis Potosí", TarjetonDigitalDelegaciones.prettify("SAN LUIS POTOSI"))
    }

    @Test
    fun `prettify respeta particulas en minuscula`() {
        assertEquals("Baja California Sur", TarjetonDigitalDelegaciones.prettify("BAJA CALIFORNIA SUR"))
        assertEquals("Veracruz Norte", TarjetonDigitalDelegaciones.prettify("VERACRUZ NORTE"))
        assertEquals("Oficinas Centrales", TarjetonDigitalDelegaciones.prettify("OFICINAS CENTRALES"))
    }

    @Test
    fun `catalogo de respaldo contiene michoacan con valor 17`() {
        val michoacan = TarjetonDigitalDelegaciones.FALLBACK.find { it.label == "MICHOACAN" }
        assertEquals("17", michoacan?.value)
        assertEquals("Michoacán", michoacan?.displayName)
    }

    @Test
    fun `catalogo de respaldo tiene 38 delegaciones`() {
        assertEquals(38, TarjetonDigitalDelegaciones.FALLBACK.size)
    }

    @Test
    fun `valores del catalogo son unicos`() {
        val values = TarjetonDigitalDelegaciones.FALLBACK.map { it.value }
        assertEquals(values.size, values.toSet().size)
    }
}
