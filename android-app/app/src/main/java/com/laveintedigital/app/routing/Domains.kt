package com.laveintedigital.app.routing

/**
 * Host allowlists for routing.
 *
 * Anything ending with [INTERNAL_HOSTS] is opened inside the persistent internal WebView.
 * Government and SNTSS sites that we want to keep "inside La Veinte" are routed to the
 * integrated external browser screen (still our chrome, just a minimal top bar).
 * OAuth / login / payment providers go to Custom Tabs so the system browser handles cookies,
 * credential manager and redirects properly.
 */
object Domains {

    // Hosts that are part of La Veinte Digital itself.
    // When the WebView navigates to any of these, we stay in the internal full-screen WebView.
    val INTERNAL_HOSTS: List<String> = listOf(
        "la-veinte-digital.vercel.app",
        "laveinte-digital.vercel.app",
        "la-veinte-digital.pages.dev",
        "la-veinte-digital.localhost",
        "la20.com.mx",
        "www.la20.com.mx",
    )

    // Hosts whose pages we want to display inside the La Veinte integrated external browser
    // (minimal top bar with back / domain / close). Keep this list narrow and intentional.
    val EXTERNAL_WEBVIEW_HOSTS: List<String> = listOf(
        "imss.gob.mx",
        "www.imss.gob.mx",
        "sat.gob.mx",
        "www.sat.gob.mx",
        "sntss.org.mx",
        "www.sntss.org.mx",
        "gob.mx",
        "www.gob.mx",
        "stps.gob.mx",
        "www.stps.gob.mx",
        "condusef.gob.mx",
        "www.condusef.gob.mx",
        "infonavit.gob.mx",
        "www.infonavit.gob.mx",
        "prosperabit.gob.mx",
        "www.prosperabit.gob.mx",
    )

    // Hosts that must open as Custom Tabs (system browser engine) because they need the user's
    // browser cookies / credential manager / proper OAuth redirects, or they're known to refuse
    // embedded WebViews.
    val CUSTOM_TAB_HOSTS: List<String> = listOf(
        "accounts.google.com",
        "accounts.youtube.com",
        "login.microsoftonline.com",
        "login.live.com",
        "facebook.com",
        "www.facebook.com",
        "m.facebook.com",
        "fb.com",
        "www.fb.com",
        "auth.twitter.com",
        "twitter.com",
        "x.com",
        "www.x.com",
        "appleid.apple.com",
        "github.com",
        "oauth.telegram.org",
        "mercadopago.com.mx",
        "www.mercadopago.com.mx",
        "checkout.stripe.com",
        "pay.stripe.com",
        "api.telegram.org",
        "wa.me",
        "www.wa.me",
    )

    // Schemes handled via Android Intent (open external app).
    val INTENT_SCHEMES: List<String> = listOf(
        "tel",
        "mailto",
        "sms",
        "smsto",
        "geo",
        "whatsapp",
        "intent",
        "market",
        "vnd.youtube",
        "maps",
        "lyft",
        "uber",
        "waze",
    )

    // Schemes that are never opened by our app.
    val BLOCKED_SCHEMES: List<String> = listOf(
        "javascript",
        "file",
        "content",
        "about",
    )

    fun isInternal(host: String?): Boolean = host != null && host in INTERNAL_HOSTS

    fun isExternalWebview(host: String?): Boolean = host != null && host in EXTERNAL_WEBVIEW_HOSTS

    fun isCustomTab(host: String?): Boolean = host != null && host in CUSTOM_TAB_HOSTS
}
