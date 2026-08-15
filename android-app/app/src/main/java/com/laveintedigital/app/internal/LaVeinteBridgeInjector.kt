package com.laveintedigital.app.internal

import android.net.Uri
import android.webkit.WebView

/**
 * Injects JavaScript that creates window.LaVeinteApp directly in the page.
 * This is more reliable than addJavascriptInterface across Android versions.
 *
 * Methods communicate back to native via custom URL scheme interception:
 * laveinte://bridge/openOfficialPayslips
 * laveinte://bridge/checkForUpdate
 * laveinte://bridge/hasImssCredentials?portalId=...
 * laveinte://bridge/onAuthenticated
 * laveinte://bridge/onLoggedOut
 */
object LaVeinteBridgeInjector {

    fun inject(webView: WebView) {
        val js = """
(function() {
  if (window.LaVeinteApp) return;
  window.LaVeinteApp = {
    appPlatform: function() { return 'android'; },
    appVersion: function() { return '1.0.1'; },
    sdkVersion: function() { return ${android.os.Build.VERSION.SDK_INT}; },
    packageName: function() { return 'com.laveintedigital.app'; },
    isNativeApp: function() { return true; },
    hasBiometrics: function() { return false; },
    isBiometricsEnabled: function() { return false; },
    openExternal: function(url) { window.location.href = 'laveinte://bridge/openExternal?url=' + encodeURIComponent(url); },
    openOfficialPayslips: function() { window.location.href = 'laveinte://bridge/openOfficialPayslips'; },
    checkForUpdate: function() { window.location.href = 'laveinte://bridge/checkForUpdate'; },
    hasImssCredentials: function(portalId) {
      window.location.href = 'laveinte://bridge/hasImssCredentials?portalId=' + portalId;
      return false;
    },
    onAuthenticated: function() { window.location.href = 'laveinte://bridge/onAuthenticated'; },
    onLoggedOut: function() { window.location.href = 'laveinte://bridge/onLoggedOut'; },
    log: function(msg) { console.log('[LaVeinte] ' + msg); }
  };
  window.dispatchEvent(new Event('laveinte:native-ready'));
})();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }
}

/**
 * Called from LaVeinteInternalWebViewClient.shouldOverrideUrlLoading when a bridge URL is detected.
 * Returns true if the URL was handled.
 */
fun handleBridgeUrl(url: String): Boolean {
    val uri = Uri.parse(url) ?: return false
    if (uri.scheme != "laveinte" || uri.host != "bridge") return false

    val path = uri.path ?: return false
    when (path) {
        "/openOfficialPayslips" -> BridgeHandler.onOpenOfficialPayslips?.invoke()
        "/checkForUpdate" -> BridgeHandler.onCheckForUpdate?.invoke()
        "/onAuthenticated" -> BridgeHandler.onAuthenticated?.invoke()
        "/onLoggedOut" -> BridgeHandler.onLoggedOut?.invoke()
        "/hasImssCredentials" -> {
            val portalId = uri.getQueryParameter("portalId") ?: return true
            // Just consume, the JS side doesn't need the result
        }
        else -> return false
    }
    return true
}

/**
 * Global bridge handlers set by InternalWebScreen.
 */
object BridgeHandler {
    var onOpenOfficialPayslips: (() -> Unit)? = null
    var onCheckForUpdate: (() -> Unit)? = null
    var onAuthenticated: (() -> Unit)? = null
    var onLoggedOut: (() -> Unit)? = null
}
