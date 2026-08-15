package com.laveintedigital.app.imss.portal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TarjetonDigitalLoginErrorParserTest {

    private val p = TarjetonDigitalLoginErrorParser

    @Test
    fun `contraseña incorrecta se clasifica como credenciales invalidas`() {
        val r = p.classify("Contraseña incorrecta, intenté nuevamente")
        assertEquals(TarjetonDigitalLoginResult.InvalidCredentials, r)
    }

    @Test
    fun `datos del usuario incorrectos se clasifica como credenciales invalidas`() {
        val r = p.classify("Datos del usuario incorrectos, favor de validar")
        assertEquals(TarjetonDigitalLoginResult.InvalidCredentials, r)
    }

    @Test
    fun `trabajador no encontrado en delegacion es credenciales invalidas`() {
        val r = p.classify("Trabajador no encontrado en la delegación seleccionada.")
        assertEquals(TarjetonDigitalLoginResult.InvalidCredentials, r)
    }

    @Test
    fun `usuario no encontrado es credenciales invalidas`() {
        val r = p.classify("Usuario no encontrado es necesario realizar Nuevo Registro.")
        assertEquals(TarjetonDigitalLoginResult.InvalidCredentials, r)
    }

    @Test
    fun `campos requeridos se clasifican como campos faltantes`() {
        assertEquals(TarjetonDigitalLoginResult.MissingFields, p.classify("Es necesario seleccionar la delegación."))
        assertEquals(TarjetonDigitalLoginResult.MissingFields, p.classify("Es necesario capturar el Usuario."))
        assertEquals(TarjetonDigitalLoginResult.MissingFields, p.classify("Es necesario capturar la Contraseña."))
    }

    @Test
    fun `trabajador no activo es cuenta bloqueada`() {
        assertEquals(TarjetonDigitalLoginResult.AccountLocked, p.classify("Trabajador no activo."))
        assertEquals(TarjetonDigitalLoginResult.AccountLocked, p.classify("Administrador no activo o no autorizado."))
    }

    @Test
    fun `sesion expirada se clasifica`() {
        assertEquals(
            TarjetonDigitalLoginResult.SessionExpired,
            p.classify("Su sesión ha expirado, \nPara continuar debe firmarse nuevamente"),
        )
    }

    @Test
    fun `servicio no disponible se clasifica`() {
        assertEquals(TarjetonDigitalLoginResult.ServiceUnavailable, p.classify("No es posible acceder a la página. Intente más tarde."))
        assertEquals(TarjetonDigitalLoginResult.ServiceUnavailable, p.classify("Sistema ocupado, favor de intentarlo mas tarde."))
    }

    @Test
    fun `tipo de contratacion no permitido es error de portal con mensaje`() {
        val r = p.classify("Tipo de Contratación no permitido.")
        assertTrue(r is TarjetonDigitalLoginResult.PortalError)
        assertEquals("Tipo de Contratación no permitido.", (r as TarjetonDigitalLoginResult.PortalError).originalMessage)
    }

    @Test
    fun `mensaje desconocido es UnknownError`() {
        val r = p.classify("Cualquier mensaje raro del portal")
        assertTrue(r is TarjetonDigitalLoginResult.UnknownError)
    }

    @Test
    fun `mensaje nulo o vacio devuelve null`() {
        assertNull(p.classify(null))
        assertNull(p.classify(""))
        assertNull(p.classify("   "))
    }

    @Test
    fun `isPortalFault solo para fallos del portal`() {
        assertTrue(p.isPortalFault(TarjetonDigitalLoginResult.ServiceUnavailable))
        assertTrue(p.isPortalFault(TarjetonDigitalLoginResult.SessionExpired))
        assertTrue(!p.isPortalFault(TarjetonDigitalLoginResult.InvalidCredentials))
        assertTrue(!p.isPortalFault(TarjetonDigitalLoginResult.MissingFields))
    }

    @Test
    fun `normalize quita acentos y colapsa espacios`() {
        assertEquals("es necesario capturar la contrasena.", p.normalize(" Es necesario capturar la Contraseña.  "))
    }
}
