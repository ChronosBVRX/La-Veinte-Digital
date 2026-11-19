package com.laveintedigital.app.imss.register

/**
 * Modelos y validadores puros para el flujo asistido de registro en Tu Perfil IMSS.
 *
 * Basado en la inspección forense del bundle oficial de producción de Angular
 * (RegisterComponent en AutorizationModule de tuperfil.imss.gob.mx):
 * - Regla oficial de contraseña: 8 a 15 caracteres, al menos 1 mayúscula, 1 minúscula,
 *   1 número y 1 símbolo especial de la lista [@ - + $ ! % * ? & #], sin espacios.
 * - Validación de correo: RFC email pattern.
 * - Validación de CURP: 18 caracteres en mayúsculas.
 * - Validación de RFC: 13 caracteres con homoclave en mayúsculas.
 * - Validación de NSS: 11 dígitos numéricos.
 * - Teléfono de contacto: 10 dígitos numéricos.
 */

data class TuPerfilRegisterInput(
    val ooadCode: String = "",
    val matricula: String = "",
    val curp: String = "",
    val rfc: String = "",
    val nss: String = "",
    val fechaIngreso: String = "", // Formato estándar YYYY-MM-DD
    val telefono: String = "",     // 10 dígitos
    val correoPersonal: String = "",
    val correoInstitucional: String = "",
    val password: String = "",
    val confirmPassword: String = "",
)

data class PasswordCriteria(
    val lengthOk: Boolean = false,
    val hasUpper: Boolean = false,
    val hasLower: Boolean = false,
    val hasNumber: Boolean = false,
    val hasSpecial: Boolean = false,
    val noSpaces: Boolean = true,
) {
    val allMet: Boolean
        get() = lengthOk && hasUpper && hasLower && hasNumber && hasSpecial && noSpaces
}

object TuPerfilRegisterValidator {

    /** Símbolos permitidos por la regla oficial del IMSS: [@ - + $ ! % * ? & #] */
    val SPECIAL_CHARS = setOf('@', '-', '+', '$', '!', '%', '*', '?', '&', '#')

    /** Regex oficial del portal: J.mS en 551.js */
    private val OFFICIAL_PASSWORD_REGEX = Regex("""^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@\-\+$!%*?&#])([A-Za-z\d@\-\+$!%*?&]|[^ ]){8,15}$""")

    /** Regex de correo: J.JZ en 551.js */
    private val OFFICIAL_EMAIL_REGEX = Regex("""^[ ]*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}[ ]*$""")

    /** Regex CURP mexicano estándar (18 caracteres) */
    private val CURP_REGEX = Regex("""^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$""")

    /** Regex RFC mexicano con homoclave (13 caracteres para persona física) */
    private val RFC_REGEX = Regex("""^[A-ZÑ&]{4}\d{6}[A-V1-9][A-Z1-9][0-9A]$""")

    /** Regex NSS (11 dígitos numéricos) */
    private val NSS_REGEX = Regex("""^\d{11}$""")

    /** Regex teléfono (10 dígitos numéricos) */
    private val PHONE_REGEX = Regex("""^\d{10}$""")

    /** Regex fecha YYYY-MM-DD */
    private val DATE_REGEX = Regex("""^\d{4}-\d{2}-\d{2}$""")

    fun checkPasswordCriteria(password: String): PasswordCriteria {
        val len = password.length in 8..15
        val upper = password.any { it.isUpperCase() }
        val lower = password.any { it.isLowerCase() }
        val number = password.any { it.isDigit() }
        val special = password.any { it in SPECIAL_CHARS }
        val noSpaces = !password.contains(' ') && password.isNotEmpty()
        return PasswordCriteria(len, upper, lower, number, special, noSpaces)
    }

    fun isPasswordValid(password: String): Boolean {
        if (password.length !in 8..15) return false
        if (password.contains(' ')) return false
        return OFFICIAL_PASSWORD_REGEX.matches(password)
    }

    fun isEmailValid(email: String): Boolean =
        OFFICIAL_EMAIL_REGEX.matches(email.trim())

    fun isCurpValid(curp: String): Boolean =
        CURP_REGEX.matches(curp.trim().uppercase())

    fun isRfcValid(rfc: String): Boolean =
        RFC_REGEX.matches(rfc.trim().uppercase())

    fun isNssValid(nss: String): Boolean =
        NSS_REGEX.matches(nss.trim())

    fun isPhoneValid(phone: String): Boolean =
        PHONE_REGEX.matches(phone.trim())

    fun isDateValid(date: String): Boolean =
        DATE_REGEX.matches(date.trim())

    fun isMatriculaValid(matricula: String): Boolean {
        val clean = matricula.trim()
        return clean.length in 4..10 && clean.all { it.isDigit() }
    }

    fun isOoadValid(ooad: String): Boolean {
        val clean = ooad.trim()
        return clean.isNotBlank() && clean != "999"
    }

    /**
     * Valida todo el formulario antes de enviarlo. Devuelve null si todo es válido,
     * o un mensaje amigable describiendo el primer campo que requiere atención.
     */
    fun validateInput(input: TuPerfilRegisterInput): String? {
        if (!isOoadValid(input.ooadCode)) return "Selecciona tu OOAD / Delegación."
        if (!isMatriculaValid(input.matricula)) return "Ingresa una matrícula válida (4 a 10 dígitos)."
        if (!isCurpValid(input.curp)) return "El CURP debe tener 18 caracteres válidos."
        if (!isRfcValid(input.rfc)) return "El RFC debe tener 13 caracteres con homoclave."
        if (!isNssValid(input.nss)) return "El NSS debe tener 11 dígitos numéricos."
        if (!isDateValid(input.fechaIngreso)) return "Ingresa una fecha de ingreso válida (AAAA-MM-DD)."
        if (!isPhoneValid(input.telefono)) return "El número de contacto debe ser a 10 dígitos."
        if (!isEmailValid(input.correoPersonal)) return "Ingresa un correo electrónico personal válido."
        if (!isPasswordValid(input.password)) return "La contraseña debe tener 8 a 15 caracteres, mayúscula, minúscula, número y un símbolo (@-+$!%*?&#)."
        if (input.password != input.confirmPassword) return "Las contraseñas no coinciden."
        return null
    }
}
