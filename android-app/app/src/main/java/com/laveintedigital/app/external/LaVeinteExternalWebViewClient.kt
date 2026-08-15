package com.laveintedigital.app.external

import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.laveintedigital.app.intents.IntentLauncher
import com.laveintedigital.app.routing.Domains
import com.laveintedigital.app.routing.NavigationRouter
import com.laveintedigital.app.routing.NavigationTarget

/**
 * WebViewClient for the integrated external browser screen.
 *
 * Behavior:
 *  - Any link that points back to the La Veinte Digital internal domain is intercepted and
 *    the caller is notified via [onReturnToLaVeinte] so the host can pop this screen and return
 *    to the internal WebView (which has kept its state).
 *  - Any link that points to a domain known to refuse WebViews (Custom Tab hosts) is opened in
 *    a Custom Tab.
 *  - Any other link is loaded inside this same external WebView so the user keeps our chrome.
 */
class LaVeinteExternalWebViewClient(
    private val onReturnToLaVeinte: () -> Unit,
    private val onUrlChanged: (String?) -> Unit,
    private val onTitleChanged: (String) -> Unit,
    private val onPageLoadStateChanged: (Boolean) -> Unit,
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString() ?: return false
        val host = runCatching { Uri.parse(url).host?.lowercase() }.getOrNull()
        if (Domains.isInternal(host)) {
            onReturnToLaVeinte()
            return true
        }
        val target = NavigationRouter.resolve(url)
        if (target is NavigationTarget.CustomTab || target is NavigationTarget.Intent) {
            view?.context?.let { ctx ->
                if (target is NavigationTarget.CustomTab) {
                    IntentLauncher.launchCustomTab(ctx, url)
                } else {
                    IntentLauncher.launchScheme(ctx, url)
                }
            }
            return true
        }
        return false
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        onPageLoadStateChanged(true)
        onUrlChanged(url)
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        onPageLoadStateChanged(false)
        onUrlChanged(url)
        view?.title?.let { onTitleChanged(it) }
    }

    override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
        onUrlChanged(url)
    }
}
