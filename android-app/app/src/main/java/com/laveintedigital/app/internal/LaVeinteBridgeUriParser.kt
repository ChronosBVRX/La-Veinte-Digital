package com.laveintedigital.app.internal

import java.net.URLDecoder

data class ParsedBridgeUri(
    val scheme: String,
    val host: String,
    val path: String,
    val queryParams: Map<String, String>
)

object LaVeinteBridgeUriParser {
    fun parse(url: String): ParsedBridgeUri? {
        val trimmed = url.trim()
        val schemeIdx = trimmed.indexOf("://")
        if (schemeIdx <= 0) return null
        val scheme = trimmed.substring(0, schemeIdx)
        val rest = trimmed.substring(schemeIdx + 3)

        val queryIdx = rest.indexOf('?')
        val authorityAndPath = if (queryIdx >= 0) rest.substring(0, queryIdx) else rest
        val queryString = if (queryIdx >= 0) rest.substring(queryIdx + 1) else ""

        val pathIdx = authorityAndPath.indexOf('/')
        val host = if (pathIdx >= 0) authorityAndPath.substring(0, pathIdx) else authorityAndPath
        val path = if (pathIdx >= 0) authorityAndPath.substring(pathIdx) else ""

        val queryParams = mutableMapOf<String, String>()
        if (queryString.isNotBlank()) {
            for (part in queryString.split('&')) {
                if (part.isBlank()) continue
                val eqIdx = part.indexOf('=')
                val key = if (eqIdx >= 0) part.substring(0, eqIdx) else part
                val value = if (eqIdx >= 0) part.substring(eqIdx + 1) else ""
                val decodedKey = runCatching { URLDecoder.decode(key, "UTF-8") }.getOrDefault(key)
                val decodedVal = runCatching { URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)
                queryParams[decodedKey] = decodedVal
            }
        }

        return ParsedBridgeUri(scheme, host, path, queryParams)
    }
}
