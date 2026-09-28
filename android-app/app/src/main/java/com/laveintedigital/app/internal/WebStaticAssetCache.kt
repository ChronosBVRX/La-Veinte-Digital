package com.laveintedigital.app.internal

import android.content.Context
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import com.laveintedigital.app.routing.Domains
import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.MessageDigest

/**
 * Caché nativa en disco para activos estáticos inmutables con hash (`/_next/static/` y `/vendor/`).
 *
 * Garantía contra contenido obsoleto ("Zero Stale Data"):
 * - NUNCA intercepta documentos HTML (`isForMainFrame == true`), rutas RSC (`_rsc=`), ni APIs (`/api/`).
 * - Solo intercepta `GET` hacia orígenes propios ([Domains.isInternal]) cuya ruta sea inmutable
 *   (`/_next/static/` donde Next.js incluye un hash único por compilación en cada nombre de archivo,
 *   o `/vendor/` para los binarios de PDF.js / OCR).
 * - Cuando se publica una nueva versión en producción, el HTML pide nuevos nombres con nuevo hash,
 *   por lo que el usuario SIEMPRE ejecuta la última versión sin necesidad de borrar caché manualmente.
 */
object WebStaticAssetCache {

    private const val CACHE_DIR_NAME = "web-static-cache"
    private const val MAX_CACHE_BYTES = 40L * 1024L * 1024L // 40 MB máximo con purga LRU
    private const val MAX_SINGLE_ASSET_BYTES = 6 * 1024 * 1024 // 6 MB por archivo estático
    private const val CONNECT_TIMEOUT_MS = 4_000
    private const val READ_TIMEOUT_MS = 6_000

    private val IMMUTABLE_EXTENSIONS = listOf(
        ".js",
        ".mjs",
        ".css",
        ".woff2",
        ".woff",
        ".ttf",
        ".wasm",
        ".gz",
    )

    /**
     * Clasificador puro (100% testeable en JVM sin Android framework) que decide si una URL
     * corresponde a un activo estático inmutable seguro de cachear localmente.
     */
    fun isCacheableImmutableAsset(
        rawUrl: String?,
        method: String?,
        isForMainFrame: Boolean,
    ): Boolean {
        if (isForMainFrame) return false
        if (!method.equals("GET", ignoreCase = true)) return false
        val url = rawUrl?.trim().orEmpty()
        if (url.isEmpty()) return false

        val parsed = runCatching { URI(url) }.getOrNull() ?: return false
        val scheme = parsed.scheme?.lowercase() ?: return false
        if (scheme != "https" && scheme != "http") return false

        val host = parsed.host?.lowercase() ?: return false
        if (!Domains.isInternal(host)) return false

        val query = parsed.rawQuery.orEmpty()
        // Jamás interceptar payloads RSC ni peticiones con tokens dinámicos
        if (query.contains("_rsc=", ignoreCase = true) || query.contains("token=", ignoreCase = true)) {
            return false
        }

        val path = parsed.rawPath ?: return false
        if (path.contains("..")) return false

        val isImmutablePrefix = path.startsWith("/_next/static/") || path.startsWith("/vendor/")
        if (!isImmutablePrefix) return false

        val lowerPath = path.lowercase()
        return IMMUTABLE_EXTENSIONS.any { lowerPath.endsWith(it) }
    }

    /** Determina el MIME type canónico según la extensión del activo estático. */
    fun resolveMimeType(path: String): String {
        val lower = path.lowercase()
        return when {
            lower.endsWith(".js") || lower.endsWith(".mjs") -> "application/javascript"
            lower.endsWith(".css") -> "text/css"
            lower.endsWith(".woff2") -> "font/woff2"
            lower.endsWith(".woff") -> "font/woff"
            lower.endsWith(".ttf") -> "font/ttf"
            lower.endsWith(".wasm") -> "application/wasm"
            lower.endsWith(".gz") -> "application/gzip"
            else -> "application/octet-stream"
        }
    }

    /** Clave determinista de archivo en caché basada en SHA-256 de la ruta estática. */
    fun cacheKeyForUrl(rawUrl: String): String {
        val parsed = runCatching { URI(rawUrl.trim()) }.getOrNull()
        val canonical = if (parsed != null) {
            "${parsed.host?.lowercase()}${parsed.rawPath}${parsed.rawQuery?.let { "?$it" }.orEmpty()}"
        } else {
            rawUrl.trim()
        }
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(canonical.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    fun interceptIfImmutable(
        context: Context?,
        request: WebResourceRequest?,
    ): WebResourceResponse? {
        if (context == null || request == null) return null
        val urlStr = request.url?.toString() ?: return null
        if (!isCacheableImmutableAsset(urlStr, request.method, request.isForMainFrame)) {
            return null
        }

        // Nunca interceptar si los headers piden explícitamente RSC
        val reqHeaders = request.requestHeaders
        if (reqHeaders != null && (reqHeaders.containsKey("RSC") || reqHeaders.containsKey("rsc"))) {
            return null
        }

        return runCatching {
            val cacheDir = File(context.applicationContext.cacheDir, CACHE_DIR_NAME).apply { mkdirs() }
            val key = cacheKeyForUrl(urlStr)
            val path = request.url?.path ?: urlStr
            val mimeType = resolveMimeType(path)
            val cachedFile = File(cacheDir, key)

            if (cachedFile.exists() && cachedFile.length() in 1..MAX_SINGLE_ASSET_BYTES) {
                val bytes = cachedFile.readBytes()
                cachedFile.setLastModified(System.currentTimeMillis())
                return@runCatching buildResponse(mimeType, bytes)
            }

            // Descargar una vez y persistir atómicamente para siguientes navegaciones
            val conn = (URL(urlStr).openConnection() as? HttpURLConnection) ?: return@runCatching null
            conn.requestMethod = "GET"
            conn.connectTimeout = CONNECT_TIMEOUT_MS
            conn.readTimeout = READ_TIMEOUT_MS
            conn.instanceFollowRedirects = true
            try {
                val code = conn.responseCode
                if (code != HttpURLConnection.HTTP_OK) return@runCatching null
                val bytes = conn.inputStream.use { it.readBytes() }
                if (bytes.isEmpty() || bytes.size > MAX_SINGLE_ASSET_BYTES) return@runCatching null

                val tmpFile = File(cacheDir, "$key.tmp")
                tmpFile.writeBytes(bytes)
                if (!tmpFile.renameTo(cachedFile)) {
                    tmpFile.copyTo(cachedFile, overwrite = true)
                    tmpFile.delete()
                }
                pruneIfNeeded(cacheDir)
                buildResponse(mimeType, bytes)
            } finally {
                conn.disconnect()
            }
        }.getOrNull()
    }

    private fun buildResponse(mimeType: String, bytes: ByteArray): WebResourceResponse {
        val encoding = if (mimeType.startsWith("text/") || mimeType == "application/javascript") "UTF-8" else null
        return WebResourceResponse(
            mimeType,
            encoding,
            200,
            "OK",
            mapOf(
                "Cache-Control" to "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin" to "*",
            ),
            ByteArrayInputStream(bytes),
        )
    }

    private fun pruneIfNeeded(cacheDir: File) {
        runCatching {
            val files = cacheDir.listFiles()?.filter { it.isFile } ?: return
            var total = files.sumOf { it.length() }
            if (total <= MAX_CACHE_BYTES) return
            val sortedOldestFirst = files.sortedBy { it.lastModified() }
            for (f in sortedOldestFirst) {
                val len = f.length()
                if (f.delete()) {
                    total -= len
                }
                if (total <= (MAX_CACHE_BYTES * 80) / 100) break
            }
        }
    }
}
