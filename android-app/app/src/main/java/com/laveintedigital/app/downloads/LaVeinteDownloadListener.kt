package com.laveintedigital.app.downloads

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.webkit.DownloadListener
import android.webkit.WebView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.laveintedigital.app.LaVeinteApplication
import com.laveintedigital.app.R

/**
 * Handles downloads triggered from the WebView (PDFs, generated docs, etc).
 *
 * - For Android 10+ (we are minSdk 29) we use the system DownloadManager via
 *   [android.provider.Downloads] so the file lands in the public Downloads folder
 *   and the system handles storage permissions / notifications for us.
 * - We post a low-priority notification on our channel [LaVeinteApplication.CHANNEL_DOWNLOADS]
 *   so the user can see the progress without a foreground service.
 */
class LaVeinteDownloadListener(
    private val context: Context,
) : DownloadListener {

    override fun onDownloadStart(
        url: String?,
        userAgent: String?,
        contentDisposition: String?,
        mimetype: String?,
        contentLength: Long,
    ) {
        if (url.isNullOrBlank()) return
        val filename = resolveFilename(url, contentDisposition, mimetype)
        try {
            startDownloadWithDownloadManager(url, filename, mimetype, contentDisposition)
        } catch (t: Throwable) {
            // Fallback: ask the system to open the URL externally so the user's browser handles
            // the download.
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
        mimetype: String?,
        contentDisposition: String?,
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
            val mime = mimetype?.takeIf { it.isNotBlank() } ?: "*/*"
            setMimeType(mime)
            // Save to app-private external files dir (no storage permission required on API 29+).
            setDestinationInExternalFilesDir(
                context,
                Environment.DIRECTORY_DOWNLOADS,
                "La Veinte Digital/${filename}",
            )
        }
        dm.enqueue(req)
        notifyStart(filename)
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
        val builder = NotificationCompat.Builder(context, LaVeinteApplication.CHANNEL_DOWNLOADS)
            .setSmallIcon(R.drawable.ic_notification_laveinte)
            .setColor(android.graphics.Color.parseColor("#2563EB"))
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText(context.getString(R.string.download_in_progress, filename))
            .setOngoing(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
        nm.notify(NOTIFICATION_ID, builder.build())
    }

    private fun resolveFilename(
        url: String,
        contentDisposition: String?,
        mimetype: String?,
    ): String {
        // Try "filename=foo.pdf" inside content-disposition
        val cd = contentDisposition.orEmpty()
        val idx = cd.indexOf("filename=")
        if (idx >= 0) {
            val rest = cd.substring(idx + "filename=".length).trim()
            val cleaned = rest.removeSurrounding("\"").trim()
            val name = cleaned.substringBefore(';').trim()
            if (name.isNotBlank()) return name
        }
        // Otherwise, last URL path segment
        val fromUrl = try {
            Uri.parse(url).lastPathSegment
        } catch (_: Throwable) { null }
        if (!fromUrl.isNullOrBlank() && fromUrl.contains('.')) return fromUrl
        // Otherwise synthesize with a known extension
        val ext = when (mimetype) {
            "application/pdf" -> ".pdf"
            "image/png" -> ".png"
            "image/jpeg" -> ".jpg"
            "application/zip" -> ".zip"
            "text/plain" -> ".txt"
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> ".docx"
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" -> ".xlsx"
            else -> ""
        }
        return "la-veinte-${System.currentTimeMillis()}$ext"
    }

    companion object {
        const val NOTIFICATION_ID = 7701
    }
}

/**
 * Convenience: attach this listener to a WebView.
 */
fun WebView.attachDownloadListener(context: Context) {
    setDownloadListener(LaVeinteDownloadListener(context))
}
