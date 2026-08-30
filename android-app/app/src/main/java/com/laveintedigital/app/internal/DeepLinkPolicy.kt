package com.laveintedigital.app.internal

import com.laveintedigital.app.routing.Domains

/**
 * Security policy for externally-authored deep links delivered to the internal WebView.
 *
 * The privileged internal WebView must never load arbitrary content from a deep link. Only:
 *  - our own `laveinte://` bridge protocol, and
 *  - `https://` deep links whose host is one of La Veinte Digital's OWN domains (the verified
 *    Android App Link and the OAuth callback).
 * are allowed. Any other host, any `http://`, and dangerous schemes (`file://`, `javascript://`,
 * `content://`, `intent://`, random custom schemes) are rejected so a malicious link cannot execute
 * JS, open local files, load a phishing page inside our chrome, or drive a third-party app from
 * inside our shell.
 */
internal fun isDeepLinkLoadAllowed(scheme: String?, host: String?, url: String): Boolean {
    // The bridge protocol is intrinsic to the app; it carries no host of its own.
    if (url.lowercase().startsWith("laveinte://")) return true
    val s = scheme?.lowercase()
    if (s != "https") return false
    // An https deep link is only trusted when it points at one of OUR own verified domains.
    return Domains.isInternal(host?.lowercase())
}
