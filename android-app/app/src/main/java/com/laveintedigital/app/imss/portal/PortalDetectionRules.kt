package com.laveintedigital.app.imss.portal

/**
 * Portal-specific detection rules for login and post-login detection.
 */
object PortalDetectionRules {

    data class RuleSet(
        val loginSelectors: List<String>,       // CSS selectors that indicate login page
        val postLoginSelectors: List<String>,   // CSS selectors that indicate authenticated
        val postLoginTextPatterns: List<String>, // Text patterns in body that indicate authenticated
        val pdfUrlPatterns: List<String>,       // URL patterns that likely produce PDFs
    )

    val TU_PERFIL = RuleSet(
        loginSelectors = listOf(
            "input[type=\"password\"]",
            "input[name*=\"password\" i]",
            "input[name*=\"clave\" i]",
            "input[id*=\"password\" i]",
        ),
        postLoginSelectors = listOf(
            "a[href*=\"logout\" i]",
            "a[href*=\"cerrar\" i]",
            "[id*=\"logout\" i]",
            "[class*=\"logout\" i]",
            "[class*=\"menu-usuario\" i]",
            "[class*=\"user-info\" i]",
            ".navbar", ".header-user",
        ),
        postLoginTextPatterns = listOf(
            "cerrar sesión", "cerrar sesion", "salir del sistema",
            "bienvenido", "mis datos", "mi perfil",
        ),
        pdfUrlPatterns = listOf(".pdf", "tarjeton", "comprobante", "constancia", "reporte"),
    )

    val TARJETON_DIGITAL = RuleSet(
        loginSelectors = listOf(
            "input[type=\"password\"]",
            "input[name*=\"password\" i]",
            "input[name*=\"user\" i]",
            "input[name*=\"usuario\" i]",
        ),
        postLoginSelectors = listOf(
            "a[href*=\"logout\" i]",
            "a[href*=\"cerrar\" i]",
            "[id*=\"logout\" i]",
            "[class*=\"menu\" i]",
            "[class*=\"dashboard\" i]",
            ".navbar", ".header",
        ),
        postLoginTextPatterns = listOf(
            "cerrar sesión", "cerrar sesion", "salir",
            "bienvenido", "tarjetón digital", "consulta",
        ),
        pdfUrlPatterns = listOf(".pdf", "tarjeton", "descargar", "imprimir", "reporte"),
    )
}
