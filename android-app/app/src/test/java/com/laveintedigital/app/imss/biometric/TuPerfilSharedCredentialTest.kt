package com.laveintedigital.app.imss.biometric

import com.laveintedigital.app.imss.credentials.ImssPortal
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Garantiza que "Registros biométricos" y "Tarjetones de Tu Perfil" comparten
 * EXACTAMENTE la misma identidad de credenciales: `ImssPortal.TU_PERFIL`.
 *
 * No debe existir TU_PERFIL_BIOMETRICS ni una segunda bóveda: si este test
 * falla es porque alguien intentó dividir el acceso.
 */
class TuPerfilSharedCredentialTest {

    @Test
    fun `la boveda tiene exactamente las dos identidades conocidas`() {
        assertEquals(
            listOf("tuperfil", "tarjetondigital"),
            ImssPortal.entries.map { it.id },
        )
    }

    @Test
    fun `no existe identidad separada para biometricos`() {
        val ids = ImssPortal.entries.map { it.id }
        assertFalse(ids.contains("tuperfil_biometrics"))
        assertFalse(ids.contains("TU_PERFIL_BIOMETRICS"))
        assertFalse(ids.any { it.contains("biometric") })
    }

    @Test
    fun `la identidad de Tu Perfil es unica y compartida`() {
        // Tarjetones y Biométricos resuelven la MISMA instancia.
        val byId = ImssPortal.entries.first { it.id == "tuperfil" }
        assertSame(ImssPortal.TU_PERFIL, byId)
        assertEquals("tuperfil", ImssPortal.TU_PERFIL.id)
    }

    @Test
    fun `la url de biometricos pertenece al mismo portal Tu Perfil`() {
        val url = "https://tuperfil.imss.gob.mx/guitpei-web/app/administration/biometric/consult-period"
        val host = url.substringAfter("https://").substringBefore("/")
        assertEquals(ImssPortal.TU_PERFIL.host, host)
        assertTrue(url.startsWith("https://"))
    }
}
