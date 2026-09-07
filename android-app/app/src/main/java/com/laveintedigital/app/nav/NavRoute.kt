package com.laveintedigital.app.nav

/**
 * Routes used in the Compose Navigation graph.
 */
sealed class NavRoute(val route: String) {
    data object Internal : NavRoute("internal")
    data object External : NavRoute("external/{url}") {
        fun create(url: String) = "external/${android.net.Uri.encode(url)}"
    }
    data object OfficialPayslips : NavRoute("official_payslips")
    data object TuPerfilBiometrics : NavRoute("tu_perfil_biometrics")
    data object ImssPortal : NavRoute("imss_portal/{portalId}/{autoLogin}") {
        fun create(portalId: String, autoLogin: Boolean = false) =
            "imss_portal/$portalId/$autoLogin"
    }
    data object ImssSaveCreds : NavRoute("imss_save_creds/{portalId}") {
        fun create(portalId: String) = "imss_save_creds/$portalId"
    }
    data object PayslipHistory : NavRoute("payslip_history")
    data object PayslipViewer : NavRoute("payslip_viewer/{filePath}?title={title}") {
        fun create(filePath: String, title: String? = null) =
            "payslip_viewer/${android.net.Uri.encode(filePath)}" + (if (!title.isNullOrBlank()) "?title=${android.net.Uri.encode(title)}" else "")
    }
    data object ManageImssCreds : NavRoute("manage_imss_creds")
    /** Pantalla nativa de documentos offline (sin WebView ni red). */
    data object OfflineDocuments : NavRoute("offline_documents")
}
