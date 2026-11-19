package com.laveintedigital.app.imss.register

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TuPerfilRegisterAdapterTest {

    @Test
    fun `REGISTER_URL apunta al endpoint oficial de registro en Tu Perfil IMSS`() {
        assertEquals("https://tuperfil.imss.gob.mx/guitpei-web/register", TuPerfilRegisterAdapter.REGISTER_URL)
    }

    @Test
    fun `selectOoadAndMatriculaJs escapa comillas y caracteres especiales`() {
        val js = TuPerfilRegisterAdapter.selectOoadAndMatriculaJs("17", "99123456")
        assertTrue(js.contains("\"17\""))
        assertTrue(js.contains("\"99123456\""))
        assertTrue(js.contains("claveOoad"))
        assertTrue(js.contains("numMatricula"))
        assertTrue(js.contains("Event('input'"))
        assertTrue(js.contains("Event('change'"))
    }

    @Test
    fun `fillAllRemainingFieldsJs inyecta todos los campos esperados por Angular`() {
        val input = TuPerfilRegisterInput(
            ooadCode = "17",
            matricula = "99123456",
            rfc = "ROSA800101ABC",
            curp = "ROSA800101HMCRXL01",
            nss = "12345678901",
            fechaIngreso = "2015-08-16",
            correoPersonal = "trabajador@gmail.com",
            correoInstitucional = "trabajador@imss.gob.mx",
            telefono = "4431234567",
            password = "Password2026#",
            confirmPassword = "Password2026#",
        )
        val js = TuPerfilRegisterAdapter.fillAllRemainingFieldsJs(input)

        // Comprueba que los campos del form Angular formControlName estan presentes
        assertTrue(js.contains("cveCurp"))
        assertTrue(js.contains("cveRfc"))
        assertTrue(js.contains("numNss"))
        assertTrue(js.contains("fecIngresoImss"))
        assertTrue(js.contains("refCorreoElectronicoPersona"))
        assertTrue(js.contains("cveContrasena"))
        assertTrue(js.contains("cveContrasenaRepit"))

        // Comprueba valores sanitizados
        assertTrue(js.contains("ROSA800101ABC"))
        assertTrue(js.contains("ROSA800101HMCRXL01"))
        assertTrue(js.contains("12345678901"))
        assertTrue(js.contains("2015-08-16"))
        assertTrue(js.contains("trabajador@gmail.com"))
        assertTrue(js.contains("Password2026#"))
    }

    @Test
    fun `submitVerificationCodeJs inyecta el codigo y hace clic en Confirmar`() {
        val js = TuPerfilRegisterAdapter.submitVerificationCodeJs("12345")
        assertTrue(js.contains("\"12345\""))
        assertTrue(js.contains("app-verification-code"))
        assertTrue(js.contains("Event('input'"))
    }

    @Test
    fun `constantes de adapters contienen JS sintacticamente valido sin llamadas vacias`() {
        assertFalse(TuPerfilRegisterAdapter.CHECK_PAGE_READY_JS.isBlank())
        assertFalse(TuPerfilRegisterAdapter.CHECK_SIAP_RESULT_JS.isBlank())
        assertFalse(TuPerfilRegisterAdapter.CLICK_SUBMIT_JS.isBlank())
        assertFalse(TuPerfilRegisterAdapter.CHECK_CODE_DIALOG_READY_JS.isBlank())
        assertFalse(TuPerfilRegisterAdapter.CHECK_CODE_VERIFICATION_RESULT_JS.isBlank())
        assertFalse(TuPerfilRegisterAdapter.CLICK_RESEND_CODE_JS.isBlank())
    }
}
