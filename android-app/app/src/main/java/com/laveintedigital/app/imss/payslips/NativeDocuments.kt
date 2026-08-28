package com.laveintedigital.app.imss.payslips

import android.content.Context
import android.util.Base64
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
/**
 * Exposes the native saved documents (tarjetones + checadas) from Room to the web, as a
 * JSON array (no file contents) and as base64 content for a single document (for transfer).
 *
 * Bridge contract:
 *  - list → `[ { id, name, localPath, source, fileSize, downloadedAt, mimeType } ]`
 *  - read (localPath) → `{ name, data: <base64>, mimeType }` or null if missing/unreadable.
 */
object NativeDocuments {

    private const val TAG = "NativeDocuments"
    private const val MAX_B64_DOC = 10 * 1024 * 1024

    suspend fun list(context: Context): JSONArray {
        val db = PayslipDatabase.getInstance(context)
        val docs = db.payslipDao().getAll()
        val arr = JSONArray()
        for (d in docs) {
            val file = File(d.localPath)
            if (!file.exists()) continue
            arr.put(
                JSONObject()
                    .put("id", d.id)
                    .put("name", d.displayName)
                    .put("localPath", d.localPath)
                    .put("source", d.source)
                    .put("fileSize", file.length())
                    .put("downloadedAt", d.downloadedAt)
                    .put("mimeType", d.mimeType)
            )
        }
        return arr
    }

    fun read(context: Context, localPath: String): JSONObject? {
        if (localPath.isBlank()) return null
        // Guard against path traversal: only allow files under filesDir.
        val base = context.filesDir
        val file = try { java.io.File(localPath).canonicalFile } catch (e: Exception) { return null }
        java.io.File(base, "tarjetones").mkdirs()
        val allowedRoot = java.io.File(base, "tarjetones").canonicalFile
        if (!file.path.startsWith(allowedRoot.path)) {
            Log.w(TAG, "read rejected: outside tarjetones dir: ${file.path}")
            return null
        }
        if (!file.exists() || file.length() == 0L) return null
        if (file.length() > MAX_B64_DOC) {
            Log.w(TAG, "read rejected: too large ${file.length()}")
            return null
        }
        return try {
            val bytes = file.readBytes()
            val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            JSONObject()
                .put("name", file.name)
                .put("mimeType", "application/pdf")
                .put("data", b64)
        } catch (e: Exception) {
            Log.e(TAG, "read failed", e)
            null
        }
    }

    /**
     * The document the user asked to "Imprimir" (send via QR) — stored by the native viewer so the
     * web `/transfer?print=1` flow can auto-send exactly that file after scanning. It must be
     * cleared once used. Kept in a process-wide holder; survives only while the app is alive.
     */
    object PendingPrint {
        @Volatile private var path: String? = null

        /** Wired by InternalWebScreen so the native viewer can load /transfer?print=1. */
        @Volatile var navigator: ((String) -> Unit)? = null

        fun set(localPath: String) { path = localPath }
        fun get(): String? = path
        fun clear() { path = null }

        /**
         * Marks [localPath] as the document to send and asks the internal WebView to open the
         * transfer send flow. Safe to call from any native screen.
         */
        fun setAndOpen(localPath: String, internalOrigin: String) {
            path = localPath
            navigator?.invoke("$internalOrigin/transfer?print=1")
        }
    }
}
