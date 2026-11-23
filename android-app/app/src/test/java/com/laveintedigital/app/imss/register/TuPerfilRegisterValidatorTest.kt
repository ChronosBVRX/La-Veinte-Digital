package com.laveintedigital.app.imss.register

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TuPerfilRegisterValidatorTest {

    @Test
    fun `contraseña que cumple con todas las reglas de Angular es valida`() {
        val criteria = TuPerfilRegisterValidator.checkPasswordCriteria("Sindicato20#")
        assertTrue(criteria.lengthOk)
        assertTrue(criteria.hasUpper)
        assertTrue(criteria.hasLower)
        assertTrue(criteria.hasNumber)
        assertTrue(criteria.hasSpecial)
        assertTrue(criteria.noSpaces)
        assertTrue(criteria.allMet)
        assertTrue(TuPerfilRegisterValidator.isPasswordValid("Sindicato20#"))
    }

    @Test
    fun `contraseña menor a 8 caracteres es rechazada`() {
        val criteria = TuPerfilRegisterValidator.checkPasswordCriteria("Ab1#xyz")
        assertEquals(7, "Ab1#xyz".length)
        assertFalse(criteria.lengthOk)
        assertFalse(criteria.allMet)
        assertFalse(TuPerfilRegisterValidator.isPasswordValid("Ab1#xyz"))
    }

    @Test
    fun `contraseña mayor a 15 caracteres es rechazada segun regla oficial`() {
        val criteria = TuPerfilRegisterValidator.checkPasswordCriteria("Abcdefghij12345#")
        assertEquals(16, "Abcdefghij12345#".length)
        assertFalse(criteria.lengthOk)
        assertFalse(criteria.allMet)
        assertFalse(TuPerfilRegisterValidator.isPasswordValid("Abcdefghij12345#"))
    }

    @Test
    fun `contraseña sin mayuscula es rechazada`() {
        val criteria = TuPerfilRegisterValidator.checkPasswordCriteria("sindicato20#")
        assertFalse(criteria.hasUpper)
        assertFalse(criteria.allMet)
        assertFalse(TuPerfilRegisterValidator.isPasswordValid("sindicato20#"))
    }

    @Test
    fun `contraseña sin minuscula es rechazada`() {
        val criteria = TuPerfilRegisterValidator.checkPasswordCriteria("SINDICATO20#")
        assertFalse(criteria.hasLower)
        assertFalse(criteria.allMet)
        assertFalse(TuPerfilRegisterValidator.isPasswordValid("SINDICATO20#"))
    }

    @Test
    fun `contraseña sin digito es rechazada`() {
        val criteria = TuPerfilRegisterValidator.checkPasswordCriteria("Sindicato##")
        assertFalse(criteria.hasNumber)
        assertFalse(criteria.allMet)
        assertFalse(TuPerfilRegisterValidator.isPasswordValid("Sindicato##"))
    }

    @Test
    fun `contraseña sin caracter especial permitido es rechazada`() {
        val criteria = TuPerfilRegisterValidator.checkPasswordCriteria("Sindicato2024")
        assertFalse(criteria.hasSpecial)
        assertFalse(criteria.allMet)
        assertFalse(TuPerfilRegisterValidator.isPasswordValid("Sindicato2024"))
    }

    @Test
    fun `contraseña con espacios es rechazada`() {
        val criteria = TuPerfilRegisterValidator.checkPasswordCriteria("Sindic ato20#")
        assertFalse(criteria.noSpaces)
        assertFalse(criteria.allMet)
        assertFalse(TuPerfilRegisterValidator.isPasswordValid("Sindic ato20#"))
    }

    @Test
    fun `caracteres especiales oficiales son aceptados`() {
        // Portal regex: [@\-\+$!%*?&#]
        val specials = listOf("@", "-", "+", "$", "!", "%", "*", "?", "&", "#")
        for (char in specials) {
            val pwd = "Test1${char}valido"
            assertTrue("Debe aceptar caracter especial $char en $pwd", TuPerfilRegisterValidator.isPasswordValid(pwd))
        }
    }

    @Test
    fun `email oficial debe ser valido`() {
        assertTrue(TuPerfilRegisterValidator.isEmailValid("trabajador.imss@gmail.com"))
        assertTrue(TuPerfilRegisterValidator.isEmailValid("axel_rosete@outlook.com"))
        assertTrue(TuPerfilRegisterValidator.isEmailValid("usuario123@imss.gob.mx"))

        assertFalse(TuPerfilRegisterValidator.isEmailValid("trabajador"))
        assertFalse(TuPerfilRegisterValidator.isEmailValid("trabajador@"))
        assertFalse(TuPerfilRegisterValidator.isEmailValid("trabajador@gmail"))
        assertFalse(TuPerfilRegisterValidator.isEmailValid("@gmail.com"))
    }

    @Test
    fun `CURP y RFC y NSS validan longitudes oficiales`() {
        assertTrue(TuPerfilRegisterValidator.isCurpValid("ROSA800101HMCRXL01"))
        assertFalse(TuPerfilRegisterValidator.isCurpValid("ROSA800101HMCRXL0")) // 17
        assertFalse(TuPerfilRegisterValidator.isCurpValid("ROSA800101HMCRXL019")) // 19

        assertTrue(TuPerfilRegisterValidator.isRfcValid("ROSA800101AB1"))
        assertFalse(TuPerfilRegisterValidator.isRfcValid("ROSA800101AB")) // 12 sin homoclave
        assertFalse(TuPerfilRegisterValidator.isRfcValid("ROSA800101ABCD")) // 14

        assertTrue(TuPerfilRegisterValidator.isNssValid("12345678901"))
        assertFalse(TuPerfilRegisterValidator.isNssValid("1234567890")) // 10
        assertFalse(TuPerfilRegisterValidator.isNssValid("123456789012")) // 12
        assertFalse(TuPerfilRegisterValidator.isNssValid("1234567890A")) // con letra
    }

    @Test
    fun `fecha de ingreso valida formato YYYY-MM-DD`() {
        assertTrue(TuPerfilRegisterValidator.isDateValid("2015-08-16"))
        assertFalse(TuPerfilRegisterValidator.isDateValid("16/08/2015"))
        assertFalse(TuPerfilRegisterValidator.isDateValid("2015-8-16"))
    }

    @Test
    fun `formulario completo valido pasa validacion`() {
        val input = TuPerfilRegisterInput(
            ooadCode = "17",
            matricula = "99123456",
            rfc = "ROSA800101AB1",
            curp = "ROSA800101HMCRXL01",
            nss = "12345678901",
            fechaIngreso = "2015-08-16",
            correoPersonal = "trabajador@gmail.com",
            correoInstitucional = "trabajador@imss.gob.mx",
            telefono = "4431234567",
            password = "Password2026#",
            confirmPassword = "Password2026#",
        )
        assertNull(TuPerfilRegisterValidator.validateInput(input))
    }

    @Test
    fun `formulario con contraseñas que no coinciden es detectado`() {
        val input = TuPerfilRegisterInput(
            ooadCode = "17",
            matricula = "99123456",
            rfc = "ROSA800101AB1",
            curp = "ROSA800101HMCRXL01",
            nss = "12345678901",
            fechaIngreso = "2015-08-16",
            telefono = "4431234567",
            correoPersonal = "trabajador@gmail.com",
            password = "Password2026#",
            confirmPassword = "DifferentPassword2026#",
        )
        val err = TuPerfilRegisterValidator.validateInput(input)
        assertNotNull(err)
        assertTrue(err?.contains("no coinciden", ignoreCase = true) == true)
    }

    @Test
    fun `formulario sin matricula u ooad es detectado`() {
        val inputWithoutOoad = TuPerfilRegisterInput(
            ooadCode = "",
            matricula = "99123456",
        )
        assertEquals("Selecciona tu OOAD / Delegación.", TuPerfilRegisterValidator.validateInput(inputWithoutOoad))

        val inputWithoutMatricula = TuPerfilRegisterInput(
            ooadCode = "17",
            matricula = "",
        )
        assertEquals("Ingresa una matrícula válida (4 a 10 dígitos).", TuPerfilRegisterValidator.validateInput(inputWithoutMatricula))
    }
}
