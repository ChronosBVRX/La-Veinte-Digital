package com.laveintedigital.app.routing

import android.net.Uri
import android.util.Log

/**
 * Decides where a URL should be opened.
 *
 * The hierarchy is:
 *  1. The URL's host is in [Domains.INTERNAL_HOSTS]      -> [NavigationTarget.Internal]
 *  2. The scheme is http/https and the host is in
 *     [Domains.EXTERNAL_WEBVIEW_HOSTS]                   -> [NavigationTarget.External]
 *  3. The scheme is http/https and the host is in
 *     [Domains.CUSTOM_TAB_HOSTS]                          -> [NavigationTarget.CustomTab]
 *  4. The scheme is in [Domains.INTENT_SCHEMES]           -> [NavigationTarget.Intent]
 *  5. The scheme is in [Domains.BLOCKED_SCHEMES]          -> [NavigationTarget.Block]
 *  6. Any other http(s) host                              -> [NavigationTarget.External]
 *     (integrated external browser screen — we keep the user inside La Veinte)
 *  7. Anything else                                       -> [NavigationTarget.Block]
 *
 * A request that looks like a WebView-blocked site (e.g. one that refuses the default UA) is
 * also pushed to Custom Tabs. See [shouldOverrideExternal].
 */
object NavigationRouter {

    private const val TAG = "NavigationRouter"

    /**
     * Resolve [url] to a [NavigationTarget]. Pure function: same input -> same output.
     * Safe to call from any thread.
     */
    fun resolve(url: String?): NavigationTarget {
        if (url.isNullOrBlank()) return NavigationTarget.Block
        val u = try {
            Uri.parse(url)
        } catch (t: Throwable) {
            Log.w(TAG, "could not parse url=$url", t)
            return NavigationTarget.Block
        }
        val scheme = u.scheme?.lowercase().orEmpty()
        val host = u.host?.lowercase().orEmpty()

        if (scheme in Domains.BLOCKED_SCHEMES) return NavigationTarget.Block

        if (Domains.isInternal(host)) return NavigationTarget.Internal(url)

        if (scheme == "http" || scheme == "https") {
            if (Domains.isExternalWebview(host)) return NavigationTarget.External(url)
            if (Domains.isCustomTab(host)) return NavigationTarget.CustomTab(url)
            // Default for any other http(s) external site: integrated external browser
            return NavigationTarget.External(url)
        }

        if (scheme in Domains.INTENT_SCHEMES) return NavigationTarget.Intent(url)

        return NavigationTarget.Block
    }

    /**
     * Should the WebView actually keep loading [url] itself, or should the host app intercept?
     * Returns true if our host app handled the navigation (so the WebView must NOT load it),
     * false to let the WebView proceed normally.
     *
     * Used by [android.webkit.WebViewClient.shouldOverrideUrlLoading].
     */
    fun shouldOverride(url: String?): Boolean {
        val target = resolve(url)
        return target !is NavigationTarget.Internal
    }

    /**
     * True if this URL must be opened in a Custom Tab because the host is known to refuse a
     * WebView (e.g. Google Accounts, banks). Currently the same as [Domains.isCustomTab] plus
     * a couple of heuristics, kept here for future expansion (Safe Browsing, etc).
     */
    fun shouldUseCustomTab(url: String?): Boolean {
        val target = resolve(url)
        return target is NavigationTarget.CustomTab
    }

    /**
     * Convenience: is this URL part of the La Veinte Digital property?
     */
    fun isLaVeinte(url: String?): Boolean {
        val u = url ?: return false
        val host = try { Uri.parse(u).host?.lowercase() } catch (t: Throwable) { null } ?: return false
        return Domains.isInternal(host)
    }
}
