package com.laveintedigital.app.updates

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

object UpdateDownloader {

    private const val TAG = "UpdateDownloader"

    /**
     * Downloads an APK directly via HTTP and saves it to filesDir/updates/.
     * Reports download progress (0-100) via [onProgress] when the server sends
     * a Content-Length. Returns the file on success, or throws on failure.
     */
    suspend fun download(
        context: Context,
        manifest: UpdateManifest,
        onProgress: (Int) -> Unit = {},
    ): Result<File> = withContext(Dispatchers.IO) {
        val dir = File(context.filesDir, "updates").also { it.mkdirs() }
        val file = File(dir, "LaVeinteDigital-${manifest.versionName}.apk")
        if (file.exists()) file.delete()

        try {
            val conn = URL(manifest.apk.url).openConnection() as HttpURLConnection
            conn.connectTimeout = 30_000
            conn.readTimeout = 300_000
            conn.requestMethod = "GET"
            conn.instanceFollowRedirects = true
            conn.setRequestProperty("User-Agent", "LaVeinteDigitalAndroid/1.0.0")

            val code = conn.responseCode
            if (code != 200) {
                conn.disconnect()
                return@withContext Result.failure(Exception("Error del servidor: HTTP $code"))
            }

            val total = conn.contentLengthLong
            var downloaded = 0L
            var lastReported = -1

            FileOutputStream(file).use { fos ->
                conn.inputStream.use { input ->
                    val buffer = ByteArray(8192)
                    var bytesRead: Int
                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        fos.write(buffer, 0, bytesRead)
                        downloaded += bytesRead
                        if (total > 0) {
                            val percent = ((downloaded * 100) / total).toInt().coerceIn(0, 100)
                            if (percent != lastReported) {
                                lastReported = percent
                                onProgress(percent)
                            }
                        }
                    }
                }
            }
            conn.disconnect()

            if (file.exists() && file.length() > 0) {
                Log.d(TAG, "Downloaded: ${file.length()} bytes to ${file.name}")
                Result.success(file)
            } else {
                Result.failure(Exception("Archivo descargado vacío"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Download failed", e)
            Result.failure(e)
        }
    }
}
