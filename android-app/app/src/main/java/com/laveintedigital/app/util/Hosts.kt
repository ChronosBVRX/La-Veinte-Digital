package com.laveintedigital.app.util

import android.net.Uri

object Hosts {
    fun hostOf(url: String?): String? {
        if (url.isNullOrBlank()) return null
        return try {
            Uri.parse(url).host?.lowercase()
        } catch (t: Throwable) {
            null
        }
    }

    fun prettyHost(url: String?): String {
        val h = hostOf(url) ?: return ""
        // strip leading www.
        return if (h.startsWith("www.")) h.substring(4) else h
    }
}
