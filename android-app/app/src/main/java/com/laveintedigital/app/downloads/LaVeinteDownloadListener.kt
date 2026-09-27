package com.laveintedigital.app.downloads

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.laveintedigital.app.LaVeinteApplication
import com.laveintedigital.app.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Handles downloads triggered from the WebView (PDFs, Excel/Word spreadsheets, generated docs, etc).
 *
 * - On Android 10+ (minSdk 29) files are saved into the public Downloads directory via [MediaStore.Downloads]
 *   or the system DownloadManager so they are immediately visible in the user's Downloads folder
 *   and can be opened by external viewer apps without storage permissions.
 * - Handles client-side in-memory `blob:` URLs by extracting the Blob data via JavaScript and
 *   saving it directly through [BlobDownloadReceiver].
 * - Handles `data:` URLs by decoding the base64/payload directly.
 * - For HTTP/HTTPS URLs, forwards active session cookies and User-Agent so authenticated endpoints
 *   download without 401 errors.
 * - Requests POST_NOTIFICATIONS on Android 13+ so the user sees download completion status.
 */
class LaVeinteDownloadListener(
    private val context: Context,
    private val webView: WebView? = null,
    private val onRequestNotificationPermission: (() -> Unit)? = null,
) : DownloadListener {

    override fun onDownloadStart(
        url: String?,
        userAgent: String?,
        contentDisposition: String?,
        mimetype: String?,
        contentLength: Long,
    ) {
        if (url.isNullOrBlank()) return

        // Proactively ask for notification permission on Android 13+ if needed
        onRequestNotificationPermission?.invoke()

        val filename = resolveFilename(url, contentDisposition, mimetype)
        val mime = resolveMimeType(filename, mimetype)

        // Case 1: In-memory blob: URL generated in JavaScript (e.g. URL.createObjectURL(blob))
        if (url.startsWith("blob:", ignoreCase = true)) {
            val wv = webView
            if (wv == null) {
                Log.w(TAG, "Cannot download blob URL without WebView reference: $url")
                Toast.makeText(
                    context,
                    context.getString(R.string.download_failed, filename),
                    Toast.LENGTH_LONG,
                ).show()
                return
            }
            Toast.makeText(
                context,
                context.getString(R.string.download_in_progress, filename),
                Toast.LENGTH_SHORT,
            ).show()
            val js = buildBlobFetchJs(url, filename, mime)
            wv.post { wv.evaluateJavascript(js, null) }
            return
        }

        // Case 2: data: URL (e.g. data:application/pdf;base64,...)
        if (url.startsWith("data:", ignoreCase = true)) {
            Toast.makeText(
                context,
                context.getString(R.string.download_in_progress, filename),
                Toast.LENGTH_SHORT,
            ).show()
            saveDataUrlAsync(url, filename, mime)
            return
        }

        // Case 3: HTTP / HTTPS URL
        try {
            startDownloadWithDownloadManager(url, filename, mime, userAgent)
        } catch (t: Throwable) {
            Log.e(TAG, "DownloadManager failed for $url", t)
            // Fallback: ask system to open URL externally so the user's browser handles the download
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                context.startActivity(intent)
            } catch (_: Throwable) {
                Toast.makeText(
                    context,
                    context.getString(R.string.download_failed, filename),
                    Toast.LENGTH_LONG,
                ).show()
            }
        }
    }

    private fun startDownloadWithDownloadManager(
        url: String,
        filename: String,
        mime: String,
        userAgent: String?,
    ) {
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
        val req = android.app.DownloadManager.Request(Uri.parse(url)).apply {
            setTitle(filename)
            setDescription(context.getString(R.string.app_name))
            setNotificationVisibility(
                android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED,
            )
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
            setMimeType(mime)

            // Forward session cookies so authenticated API endpoints don't fail with 401
            val cookie = CookieManager.getInstance().getCookie(url)
            if (!cookie.isNullOrBlank()) {
                addRequestHeader("Cookie", cookie)
            }
            if (!userAgent.isNullOrBlank()) {
                addRequestHeader("User-Agent", userAgent)
            }

            // Save to public Downloads directory (accessible to user and external apps, no permission on API 29+)
            setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                filename,
            )
        }
        dm.enqueue(req)
        Toast.makeText(
            context,
            context.getString(R.string.download_in_progress, filename),
            Toast.LENGTH_SHORT,
        ).show()
        notifyStart(filename)
    }

    private fun saveDataUrlAsync(dataUrl: String, filename: String, mime: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val base64 = if (dataUrl.contains(",")) dataUrl.substringAfter(",") else dataUrl
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                val cleanFilename = sanitizeFilename(filename)
                val savedUri = saveBytesToDownloads(context, bytes, cleanFilename, mime)
                withContext(Dispatchers.Main) {
                    if (savedUri != null) {
                        Toast.makeText(
                            context,
                            context.getString(R.string.download_complete, cleanFilename),
                            Toast.LENGTH_LONG,
                        ).show()
                        notifyCompleted(context, cleanFilename, savedUri, mime)
                    } else {
                        Toast.makeText(
                            context,
                            context.getString(R.string.download_failed, cleanFilename),
                            Toast.LENGTH_LONG,
                        ).show()
                    }
                }
            } catch (e: Throwable) {
                Log.e(TAG, "Failed saving data URL: $filename", e)
                withContext(Dispatchers.Main) {
                    Toast.makeText(
                        context,
                        context.getString(R.string.download_failed, filename),
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }
    }

    private fun notifyStart(filename: String) {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val largeIcon = runCatching {
            BitmapFactory.decodeResource(context.resources, R.drawable.brand_logo)
        }.getOrNull()

        val builder = NotificationCompat.Builder(context, com.laveintedigital.app.push.LaVeinteNotificationManager.CHANNEL_DOWNLOADS)
            .setSmallIcon(R.drawable.ic_notification_laveinte)
            .setColor(android.graphics.Color.parseColor("#2563EB"))
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText(context.getString(R.string.download_in_progress, filename))
            .setOngoing(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .apply {
                if (largeIcon != null) setLargeIcon(largeIcon)
            }
        nm.notify(NOTIFICATION_ID, builder.build())
    }

    companion object {
        private const val TAG = "LaVeinteDownload"
        const val NOTIFICATION_ID = 7701

        /**
         * Resolves the filename from content-disposition header, URL path, or mimetype.
         * Handles RFC 5987 / RFC 6266 filename*= encoding as well as standard filename=.
         */
        fun resolveFilename(
            url: String,
            contentDisposition: String?,
            mimetype: String?,
        ): String {
            val cd = contentDisposition.orEmpty()

            // 1. Try RFC 5987 / RFC 6266 filename*=UTF-8''foo%20bar.ext
            if (cd.contains("filename*=", ignoreCase = true)) {
                val idx = cd.indexOf("filename*=", ignoreCase = true)
                val rest = cd.substring(idx + 10).trim()
                val rawPart = rest.substringBefore(';').trim().removeSurrounding("\"")
                val actual = if (rawPart.contains("''")) rawPart.substringAfter("''") else rawPart
                val decoded = runCatching { java.net.URLDecoder.decode(actual, "UTF-8") }.getOrNull()
                    ?: runCatching { Uri.decode(actual) }.getOrNull()
                if (!decoded.isNullOrBlank()) return sanitizeFilename(decoded)
            }

            // 2. Try standard filename="foo.ext"
            if (cd.contains("filename=", ignoreCase = true)) {
                val idx = cd.indexOf("filename=", ignoreCase = true)
                val rest = cd.substring(idx + 9).trim()
                val name = rest.removeSurrounding("\"").substringBefore(';').trim()
                if (name.isNotBlank()) return sanitizeFilename(name)
            }

            // 3. Otherwise, last URL path segment (if not blob / data)
            if (!url.startsWith("blob:", ignoreCase = true) && !url.startsWith("data:", ignoreCase = true)) {
                val rawSegment = url.substringBefore('?').substringBefore('#').substringAfterLast('/', "")
                val decodedSegment = runCatching { java.net.URLDecoder.decode(rawSegment, "UTF-8") }.getOrDefault(rawSegment)
                if (decodedSegment.isNotBlank() && decodedSegment.contains('.')) return sanitizeFilename(decodedSegment)
            }

            // 4. Otherwise synthesize with known extension based on MIME
            val ext = when (mimetype) {
                "application/pdf" -> ".pdf"
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" -> ".xlsx"
                "application/vnd.ms-excel.sheet.macroEnabled.12" -> ".xlsm"
                "application/vnd.ms-excel" -> ".xls"
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> ".docx"
                "application/msword" -> ".doc"
                "image/png" -> ".png"
                "image/jpeg" -> ".jpg"
                "application/zip" -> ".zip"
                "text/plain" -> ".txt"
                "text/csv" -> ".csv"
                else -> ""
            }
            return "la-veinte-${System.currentTimeMillis()}$ext"
        }

        fun sanitizeFilename(name: String): String {
            var cleaned = name.trim().replace("..", "").replace(Regex("[\\\\/:*?\"<>|]"), "_")
            if (cleaned.isBlank()) cleaned = "descarga-${System.currentTimeMillis()}"
            return cleaned
        }

        fun resolveMimeType(filename: String, mimetype: String?): String {
            if (!mimetype.isNullOrBlank() && mimetype != "*/*" && mimetype != "application/octet-stream") {
                return mimetype
            }
            val ext = filename.substringAfterLast('.', "").lowercase()
            return when (ext) {
                "pdf" -> "application/pdf"
                "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                "xlsm" -> "application/vnd.ms-excel.sheet.macroEnabled.12"
                "xls" -> "application/vnd.ms-excel"
                "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                "doc" -> "application/msword"
                "png" -> "image/png"
                "jpg", "jpeg" -> "image/jpeg"
                "zip" -> "application/zip"
                "txt" -> "text/plain"
                "csv" -> "text/csv"
                else -> mimetype?.takeIf { it.isNotBlank() } ?: "*/*"
            }
        }

        /**
         * Builds the JavaScript snippet evaluated inside WebView to fetch an in-memory blob URL
         * and pass its base64 content to [BlobDownloadReceiver].
         */
        fun buildBlobFetchJs(blobUrl: String, filename: String, mimetype: String): String {
            val safeUrl = JSONObject.quote(blobUrl)
            val safeFilename = JSONObject.quote(filename)
            val safeMime = JSONObject.quote(mimetype)
            return """
                (function() {
                    try {
                        fetch($safeUrl)
                            .then(function(res) {
                                if (!res.ok) throw new Error('status ' + res.status);
                                return res.blob();
                            })
                            .then(function(blob) {
                                var reader = new FileReader();
                                reader.onloadend = function() {
                                    var dataUrl = reader.result;
                                    if (window.LaVeinteBlobReceiver && typeof window.LaVeinteBlobReceiver.onBlobData === 'function') {
                                        window.LaVeinteBlobReceiver.onBlobData(dataUrl, $safeFilename, $safeMime);
                                    }
                                };
                                reader.readAsDataURL(blob);
                            })
                            .catch(function(err) {
                                console.error('[LaVeinte] Failed to read blob for download', err);
                                if (window.LaVeinteBlobReceiver && typeof window.LaVeinteBlobReceiver.onBlobFailed === 'function') {
                                    window.LaVeinteBlobReceiver.onBlobFailed($safeFilename, err ? (err.message || String(err)) : 'Unknown error');
                                }
                            });
                    } catch(e) {
                        console.error('[LaVeinte] Blob fetch exception', e);
                        if (window.LaVeinteBlobReceiver && typeof window.LaVeinteBlobReceiver.onBlobFailed === 'function') {
                            window.LaVeinteBlobReceiver.onBlobFailed($safeFilename, e ? (e.message || String(e)) : 'Execution failed');
                        }
                    }
                })();
            """.trimIndent()
        }

        /**
         * Saves binary data directly into the public Downloads directory via MediaStore.Downloads.
         * On Android 10+ (API 29+) this requires zero storage permissions.
         */
        fun saveBytesToDownloads(
            context: Context,
            bytes: ByteArray,
            filename: String,
            mimeType: String,
        ): Uri? {
            return try {
                val resolver = context.contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, filename)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: return null

                resolver.openOutputStream(uri)?.use { stream ->
                    stream.write(bytes)
                    stream.flush()
                }

                contentValues.clear()
                contentValues.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)
                uri
            } catch (e: Throwable) {
                Log.e(TAG, "Failed saving bytes to MediaStore.Downloads: $filename", e)
                null
            }
        }

        /**
         * Posts a completion notification so the user can tap to open the downloaded file.
         */
        fun notifyCompleted(context: Context, filename: String, fileUri: Uri, mimeType: String) {
            val nm = context.getSystemService(NotificationManager::class.java) ?: return
            val openIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(fileUri, mimeType)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                filename.hashCode(),
                openIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val largeIcon = runCatching {
                BitmapFactory.decodeResource(context.resources, R.drawable.brand_logo)
            }.getOrNull()

            val builder = NotificationCompat.Builder(
                context,
                com.laveintedigital.app.push.LaVeinteNotificationManager.CHANNEL_DOWNLOADS_COMPLETED,
            )
                .setSmallIcon(R.drawable.ic_notification_laveinte)
                .setColor(android.graphics.Color.parseColor("#2563EB"))
                .setContentTitle(filename)
                .setContentText(context.getString(R.string.download_complete, filename))
                .setOngoing(false)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .apply {
                    if (largeIcon != null) setLargeIcon(largeIcon)
                }
            nm.notify(filename.hashCode(), builder.build())
        }
    }
}

/**
 * JavaScriptInterface receiver that receives base64 data extracted from blob: URLs or direct web calls.
 */
class BlobDownloadReceiver(
    private val context: Context,
    private val onDownloadComplete: ((String, Uri) -> Unit)? = null,
) {
    @JavascriptInterface
    fun onBlobData(dataUrl: String, filename: String, mimetype: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val base64 = if (dataUrl.contains(",")) dataUrl.substringAfter(",") else dataUrl
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                val cleanFilename = LaVeinteDownloadListener.sanitizeFilename(filename)
                val mime = LaVeinteDownloadListener.resolveMimeType(cleanFilename, mimetype.ifBlank { null })
                val savedUri = LaVeinteDownloadListener.saveBytesToDownloads(context, bytes, cleanFilename, mime)
                withContext(Dispatchers.Main) {
                    if (savedUri != null) {
                        Toast.makeText(
                            context,
                            context.getString(R.string.download_complete, cleanFilename),
                            Toast.LENGTH_LONG,
                        ).show()
                        LaVeinteDownloadListener.notifyCompleted(context, cleanFilename, savedUri, mime)
                        onDownloadComplete?.invoke(cleanFilename, savedUri)
                    } else {
                        Toast.makeText(
                            context,
                            context.getString(R.string.download_failed, cleanFilename),
                            Toast.LENGTH_LONG,
                        ).show()
                    }
                }
            } catch (e: Throwable) {
                Log.e("BlobDownloadReceiver", "Error saving blob download: $filename", e)
                withContext(Dispatchers.Main) {
                    Toast.makeText(
                        context,
                        context.getString(R.string.download_failed, filename),
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }
    }

    @JavascriptInterface
    fun onBlobFailed(filename: String, reason: String) {
        Log.w("BlobDownloadReceiver", "Blob download failed for $filename: $reason")
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(
                context,
                context.getString(R.string.download_failed, filename),
                Toast.LENGTH_LONG,
            ).show()
        }
    }
}

/**
 * Convenience: attach this listener and its Blob receiver to a WebView.
 */
fun WebView.attachDownloadListener(
    context: Context,
    onRequestNotificationPermission: (() -> Unit)? = null,
) {
    addJavascriptInterface(BlobDownloadReceiver(context), "LaVeinteBlobReceiver")
    setDownloadListener(
        LaVeinteDownloadListener(
            context = context,
            webView = this,
            onRequestNotificationPermission = onRequestNotificationPermission,
        )
    )
}
