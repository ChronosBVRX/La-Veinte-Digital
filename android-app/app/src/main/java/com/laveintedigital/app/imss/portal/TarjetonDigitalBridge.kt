package com.laveintedigital.app.imss.portal

import android.webkit.JavascriptInterface
import com.laveintedigital.app.util.Hosts

/**
 * Puente JS para Tarjetón Digital IMSS.
 *
 * Recibe la URL del reporte PDF que el portal abre vía `window.open`
 * (`wfrReporteTarjeton.aspx`). La URL solo se acepta si pertenece al host
 * oficial [ALLOWED_HOST]; cualquier otra llamada se descarta.
 *
 * Nunca se transportan credenciales por este puente.
 */
class TarjetonDigitalBridge(
    private val onReportUrl: (String) -> Unit,
) {
    companion object {
        const val NAME = "TarjetonDigitalBridge"
        const val ALLOWED_HOST = "rh.imss.gob.mx"
    }

    @JavascriptInterface
    fun onReport(url: String?) {
        if (url.isNullOrBlank()) return
        val host = Hosts.hostOf(url) ?: return
        if (host != ALLOWED_HOST) return
        onReportUrl(url)
    }
}
