package com.laveintedigital.app.util

import android.webkit.WebSettings
import android.webkit.WebView

/**
 * Configures a WebView the way La Veinte Digital needs it:
 *  - JavaScript enabled (required — the Next.js app is a SPA).
 *  - DOM storage enabled (localStorage / sessionStorage).
 *  - Database storage enabled.
 *  - Media playback without user gesture.
 *  - File access enabled (so the PDF picker can pass local files to the web).
 *  - A custom User-Agent that ends with "LaVeinteDigitalAndroid/<version>" so the web can
 *    detect the native shell.
 */
fun WebSettings.configureForLaVeinte(appVersion: String) {
    javaScriptEnabled = true
    domStorageEnabled = true
    databaseEnabled = true
    allowFileAccess = true
    allowContentAccess = true
    mediaPlaybackRequiresUserGesture = false
    cacheMode = WebSettings.LOAD_DEFAULT
    loadsImagesAutomatically = true
    // target="_blank" and window.open() navigate in the same WebView instead of creating
    // new windows. Simpler and more predictable than implementing onCreateWindow.
    setSupportMultipleWindows(false)
    // Append our signature to the existing UA so feature detection in JS works:
    val base = userAgentString ?: ""
    val tag = "LaVeinteDigitalAndroid/$appVersion"
    if (!base.contains(tag)) {
        userAgentString = base.trimEnd() + " $tag"
    }
}
