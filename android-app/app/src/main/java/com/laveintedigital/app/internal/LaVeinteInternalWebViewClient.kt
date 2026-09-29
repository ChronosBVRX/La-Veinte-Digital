package com.laveintedigital.app.internal

import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.laveintedigital.app.offline.OfflineDetection
import com.laveintedigital.app.offline.OfflineNavigationTracker
import com.laveintedigital.app.routing.Domains
import com.laveintedigital.app.routing.NavigationTarget

/**
 * El fallback offline ([onOffline]) se dispara SOLO ante errores de conectividad del marco
 * principal (sin red, DNS, timeout). Los HTTP 401/403/404/500 llegan por [onReceivedHttpError]
 * y jamás activan el modo offline. Ver [OfflineDetection] y [OfflineNavigationTracker].
 */

class LaVeinteInternalWebViewClient(
    private val onExternalNavigation: (NavigationTarget) -> Unit,
    private val onCustomTab: (String) -> Unit,
    private val onUrlChanged: (String?) -> Unit,
    private val onTitleChanged: (String) -> Unit,
    private val onPageLoadStateChanged: (Boolean) -> Unit,
    private val onSslError: () -> Unit = {},
    private val onOffline: () -> Unit = {},
    private val onOnline: () -> Unit = {},
) : WebViewClient() {

    private val offlineTracker = OfflineNavigationTracker()

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString() ?: return false
        // Bridge URLs have highest priority
        if (handleBridgeUrl(url, view)) return true

        val host = request.url?.host?.lowercase()
        val scheme = request.url?.scheme?.lowercase().orEmpty()

        if (scheme in KNOWN_INTENT_SCHEMES) {
            onExternalNavigation(NavigationTarget.Intent(url))
            return true
        }
        // OAuth / banks / third-party auth → Custom Tab so Chrome handles cookies & credential manager
        if (Domains.isCustomTab(host)) {
            onCustomTab(url)
            return true
        }
        // Government / trusted external sites → integrated external browser with our chrome
        if (Domains.isExternalWebview(host)) {
            onExternalNavigation(NavigationTarget.External(url))
            return true
        }
        // Everything else (including unknown sites) loads in the WebView
        return false
    }

    @Suppress("DEPRECATION")
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        if (url == null) return false
        if (handleBridgeUrl(url, view)) return true
        val host = runCatching { Uri.parse(url).host?.lowercase() }.getOrNull()
        if (Domains.isCustomTab(host)) {
            onCustomTab(url)
            return true
        }
        if (Domains.isExternalWebview(host)) {
            onExternalNavigation(NavigationTarget.External(url))
            return true
        }
        return false
    }

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?,
    ): android.webkit.WebResourceResponse? {
        return WebStaticAssetCache.interceptIfImmutable(view?.context, request)
            ?: super.shouldInterceptRequest(view, request)
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        offlineTracker.onPageStarted(url)
        onPageLoadStateChanged(true)
        onUrlChanged(url)
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        val host = url?.let { runCatching { Uri.parse(it).host?.lowercase() }.getOrNull() }
        val isInternal = Domains.isInternal(host)
        if (offlineTracker.shouldCommitOnlineOnPageFinished(url, isInternal)) {
            view?.visibility = android.view.View.VISIBLE
            onOnline()
            if (view != null) {
                LaVeinteBridgeInjector.inject(view)
                view.evaluateJavascript(
                    "(function(){try{window.dispatchEvent(new Event('laveinte:native-ready'));}catch(e){}})();",
                    null,
                )
            }
        } else if (offlineTracker.hasOfflineError) {
            view?.visibility = android.view.View.INVISIBLE
            onOffline()
        }
        onPageLoadStateChanged(false)
        onUrlChanged(url)
    }

    override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
        onUrlChanged(url)
    }

    override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
        handler?.cancel()
        onSslError()
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?,
    ) {
        if (request?.isForMainFrame == true) {
            // Solo pérdida real de conectividad → offline. Otros errores del marco principal
            // (esquema, archivo, etc.) no deben atrapar al usuario en la pantalla offline.
            val isConnErr = error == null || OfflineDetection.isMainFrameConnectivityError(
                error.errorCode,
                error.description,
            )
            if (isConnErr) {
                offlineTracker.onMainFrameConnectivityError()
                view?.visibility = android.view.View.INVISIBLE
                onOffline()
            }
            onPageLoadStateChanged(false)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onReceivedError(
        view: WebView?,
        errorCode: Int,
        description: String?,
        failingUrl: String?,
    ) {
        if (OfflineDetection.isMainFrameConnectivityError(errorCode, description)) {
            offlineTracker.onMainFrameConnectivityError()
            view?.visibility = android.view.View.INVISIBLE
            onOffline()
        }
        onPageLoadStateChanged(false)
    }

    override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        errorResponse: android.webkit.WebResourceResponse?,
    ) {
        if (request?.isForMainFrame == true) {
            onPageLoadStateChanged(false)
        }
    }

    companion object {
        private val KNOWN_INTENT_SCHEMES = setOf("tel", "mailto", "sms", "smsto", "whatsapp", "geo", "market", "intent")
    }
}

