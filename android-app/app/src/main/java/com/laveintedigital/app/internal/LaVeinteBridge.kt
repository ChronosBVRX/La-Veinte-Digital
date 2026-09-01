package com.laveintedigital.app.internal

import android.net.Uri
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.laveintedigital.app.BuildConfig

/**
 * Bridge exposed to the La Veinte Digital JavaScript as `window.LaVeinteApp` — but ONLY when
 * the WebView's current URL is on the La Veinte Digital domain.
 */
class LaVeinteBridge(
    private val onOpenExternal: (String) -> Unit,
    private val onPickPdf: (String?) -> Unit,
    private val onShare: (String?, String?) -> Unit,
    private val onHaptic: () -> Unit,
    private val onAuthenticated: () -> Unit = {},
    private val onLoggedOut: () -> Unit = {},
    private val hasBiometrics: () -> Boolean = { false },
    private val isBiometricsEnabled: () -> Boolean = { false },
    private val onOpenOfficialPayslips: () -> Unit = {},
    private val onOpenBiometrics: () -> Unit = {},
    private val onHasImssCredentials: (String) -> Boolean = { false },
    private val onCheckForUpdate: () -> Unit = {},
) {
    @JavascriptInterface
    fun appPlatform(): String = "android"

    @JavascriptInterface
    fun appVersion(): String = APP_VERSION

    @JavascriptInterface
    fun sdkVersion(): Int = android.os.Build.VERSION.SDK_INT

    @JavascriptInterface
    fun packageName(): String = APP_PACKAGE

    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun hasBiometrics(): Boolean = hasBiometrics()

    @JavascriptInterface
    fun isBiometricsEnabled(): Boolean = isBiometricsEnabled()

    @JavascriptInterface
    fun openExternal(url: String) {
        if (url.isBlank()) return
        runCatching { onOpenExternal(url) }
    }

    @JavascriptInterface
    fun pickPdf(acceptHint: String?) {
        runCatching { onPickPdf(acceptHint) }
    }

    @JavascriptInterface
    fun share(title: String?, text: String?) {
        runCatching { onShare(title, text) }
    }

    @JavascriptInterface
    fun haptic() {
        runCatching { onHaptic() }
    }

    @JavascriptInterface
    fun log(message: String) {
        if (BuildConfig.DEBUG) Log.d(TAG, "[web] $message")
    }

    @JavascriptInterface
    fun onAuthenticated() {
        runCatching { onAuthenticated() }
    }

    @JavascriptInterface
    fun onLoggedOut() {
        runCatching { onLoggedOut() }
    }

    @JavascriptInterface
    fun openOfficialPayslips() {
        runCatching { onOpenOfficialPayslips() }
    }

    @JavascriptInterface
    fun openBiometrics() {
        runCatching { onOpenBiometrics() }
    }

    @JavascriptInterface
    fun hasImssCredentials(portalId: String): Boolean = onHasImssCredentials(portalId)

    @JavascriptInterface
    fun checkForUpdate() {
        runCatching { onCheckForUpdate() }
    }

    companion object {
        const val JS_OBJECT_NAME = "LaVeinteApp"
        private const val TAG = "LaVeinteBridge"
        private val APP_VERSION: String get() = BuildConfig.VERSION_NAME ?: "1.0.0"
        const val APP_PACKAGE = "com.laveintedigital.app"
    }
}

/**
 * Install bridge in onPageStarted — primary method via addJavascriptInterface.
 */
internal fun WebView.installLaVeinteBridgeFor(bridge: LaVeinteBridge, url: String?) {
    val host = url?.let { runCatching { Uri.parse(it).host?.lowercase() }.getOrNull() }
    val allowed = listOf(
        "la-veinte-digital.vercel.app", "laveinte-digital.vercel.app",
        "la-veinte-digital.pages.dev", "la-veinte-digital.localhost",
    )
    if (host == null || host !in allowed) return
    addJavascriptInterface(bridge, LaVeinteBridge.JS_OBJECT_NAME)
}

/**
 * Safety net: re-add bridge in onPageFinished in case onPageStarted missed it.
 */
internal fun WebView.injectBridgeFallback(bridge: LaVeinteBridge, url: String?) {
    val host = url?.let { runCatching { Uri.parse(it).host?.lowercase() }.getOrNull() }
    val allowed = listOf(
        "la-veinte-digital.vercel.app", "laveinte-digital.vercel.app",
        "la-veinte-digital.pages.dev", "la-veinte-digital.localhost",
    )
    if (host == null || host !in allowed) return
    addJavascriptInterface(bridge, LaVeinteBridge.JS_OBJECT_NAME)
}
