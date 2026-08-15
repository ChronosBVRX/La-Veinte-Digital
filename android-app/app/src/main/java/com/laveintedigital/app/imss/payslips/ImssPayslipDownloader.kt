package com.laveintedigital.app.imss.payslips

import android.content.Context
import android.os.Environment
import android.util.Log
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import com.laveintedigital.app.imss.credentials.ImssPortal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * DownloadListener for IMSS portals. Detects PDFs, downloads them via authenticated
 * HTTP (using WebView cookies), validates, and stores in private app storage + Room.
 */
class ImssPayslipDownloader(
    private val context: Context,
    private val portal: ImssPortal,
    private val scope: CoroutineScope,
    private val onPayslipSaved: (PayslipDocument) -> Unit = {},
    private val onError: (String) -> Unit = {},
) : DownloadListener {

    private val outputDir = File(context.filesDir, "tarjetones").also { it.mkdirs() }

    override fun onDownloadStart(
        url: String?,
        userAgent: String?,
        contentDisposition: String?,
        mimetype: String?,
        contentLength: Long,
    ) {
        if (url == null) return

        val isPdf = mimetype?.contains("pdf") == true ||
                contentDisposition?.contains(".pdf") == true ||
                url.endsWith(".pdf", ignoreCase = true)

        if (!isPdf) return

        scope.launch {
            try {
                val file = downloadAuthenticated(url, userAgent)
                if (file != null) {
                    val sha = sha256(file)
                    val db = PayslipDatabase.getInstance(context)
                    val existing = db.payslipDao().findByHash(sha)
                    if (existing != null) {
                        file.delete()
                        onError("Este tarjetón ya estaba guardado")
                        return@launch
                    }
                    val doc = PayslipDocument(
                        source = if (portal == ImssPortal.TU_PERFIL) "TU_PERFIL" else "TARJETON_DIGITAL",
                        displayName = URLUtil.guessFileName(url, contentDisposition, mimetype) ?: "Tarjetón",
                        localPath = file.absolutePath,
                        fileSize = file.length(),
                        sha256 = sha,
                        mimeType = "application/pdf",
                        sourceHost = portal.host,
                    )
                    db.payslipDao().insert(doc)
                    onPayslipSaved(doc)
                } else {
                    onError("No se pudo descargar el PDF")
                }
            } catch (e: Exception) {
                Log.e("ImssDownloader", "Download failed", e)
                onError("Error al descargar")
            }
        }
    }

    private suspend fun downloadAuthenticated(
        downloadUrl: String,
        userAgent: String?,
    ): File? = withContext(Dispatchers.IO) {
        try {
            val cookies = CookieManager.getInstance().getCookie(downloadUrl)
            val conn = URL(downloadUrl).openConnection() as HttpURLConnection
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.setRequestProperty("User-Agent", userAgent ?: "LaVeinteDigitalAndroid/1.0.0")
            if (cookies != null) conn.setRequestProperty("Cookie", cookies)
            conn.setRequestProperty("Referer", "https://${portal.host}/")
            conn.instanceFollowRedirects = true

            if (conn.responseCode != 200) return@withContext null
            val contentType = conn.contentType
            if (contentType != null && contentType != "application/pdf") {
                conn.disconnect()
                return@withContext null
            }

            // Validate magic header
            val buffer = ByteArray(5)
            conn.inputStream.read(buffer)
            if (String(buffer) != "%PDF-") {
                conn.disconnect()
                return@withContext null
            }

            val filename = "tarjeton_${System.currentTimeMillis()}.pdf"
            val file = File(outputDir, filename)
            FileOutputStream(file).use { fos ->
                fos.write(buffer)
                conn.inputStream.copyTo(fos)
            }
            conn.disconnect()

            if (file.length() == 0L) { file.delete(); return@withContext null }
            file
        } catch (e: Exception) {
            null
        }
    }
}

private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input ->
        val buffer = ByteArray(8192)
        var read: Int
        while (input.read(buffer).also { read = it } != -1) digest.update(buffer, 0, read)
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
}
