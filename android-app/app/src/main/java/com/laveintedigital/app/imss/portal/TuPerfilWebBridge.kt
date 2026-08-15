package com.laveintedigital.app.imss.portal

import android.webkit.WebView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * Helpers suspend de interacción con el WebView del portal Tu Perfil IMSS.
 * Compartidos por el motor de sesión y por los controladores de función
 * (tarjetones / biométricos) para no duplicar el boilerplate de
 * `evaluateJavascript` / `loadUrl`.
 */
object TuPerfilWebBridge {

    suspend fun evaluateJs(wv: WebView, script: String): String? =
        withContext(Dispatchers.Main.immediate) {
            suspendCoroutine { cont -> wv.evaluateJavascript(script) { raw -> cont.resume(raw ?: "null") } }
        }

    suspend fun loadUrl(wv: WebView, url: String) =
        withContext(Dispatchers.Main.immediate) { wv.loadUrl(url) }
}
