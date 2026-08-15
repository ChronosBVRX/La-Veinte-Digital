package com.laveintedigital.app.routing

/**
 * Where a URL should be opened.
 *
 * - [INTERNAL]:  inside the persistent La Veinte Digital WebView (full-screen, no chrome).
 * - [EXTERNAL]:  inside the integrated external browser screen (minimal La Veinte chrome on top).
 * - [CUSTOM_TAB]: opened via Android Custom Tabs (for OAuth / banks / sites that need the system browser).
 * - [INTENT]:    handed to Android via Intent (tel:, mailto:, geo:, whatsapp:, apps, etc).
 * - [BLOCK]:     ignored (e.g. about:blank or disallowed schemes).
 */
sealed class NavigationTarget {
    data class Internal(val url: String) : NavigationTarget()
    data class External(val url: String) : NavigationTarget()
    data class CustomTab(val url: String) : NavigationTarget()
    data class Intent(val url: String) : NavigationTarget()
    data object Block : NavigationTarget()
}
