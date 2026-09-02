package com.laveintedigital.app.imss.payslips

import android.content.Context
import android.util.Base64
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Expone los documentos guardados nativamente (tarjetones + checadas) desde Room a la web,
 * como un array JSON de metadatos y como base64 para operaciones de lectura/transferencia.
 *
 * Bridge contract:
 *  - list → `[ { id, name, localPath, source, fileSize, downloadedAt, mimeType } ]`
 *  - read (localPath) → `{ name, data: <base64>, mimeType }` o null si no existe.
 *  - deleteById (id, expectedPath) → `{ ok: boolean, reason?: string }`
 *  - delete (localPath) → boolean (fallback de compatibilidad)
 */
object NativeDocuments {

    private const val TAG = "NativeDocuments"
    private const val MAX_B64_DOC = 10 * 1024 * 1024

    suspend fun list(context: Context): JSONArray {
        // Ejecutar reparación preventiva de duplicados/blobs heredados
        PayslipDatabase.repairLegacyBlobRecords(context)

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
        val base = context.filesDir.canonicalFile
        val file = try { File(localPath).canonicalFile } catch (e: Exception) { return null }
        if (!file.path.startsWith(base.path)) {
            Log.w(TAG, "read rejected: outside filesDir: ${file.path}")
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
     * Elimina un documento guardado nativamente por su ID estable de Room.
     * Borra el PDF principal, el PDF auxiliar de conceptos (si existe) y la fila de Room.
     * Si el archivo físico ya no existía, limpia la fila huérfana de Room y devuelve éxito.
     */
    suspend fun deleteById(
        context: Context,
        documentId: Long,
        expectedLocalPath: String? = null,
    ): JSONObject {
        if (documentId <= 0L) {
            return JSONObject().put("ok", false).put("reason", "invalid_id")
        }
        val db = PayslipDatabase.getInstance(context)
        val doc = db.payslipDao().findById(documentId)
        if (doc == null) {
            Log.i(TAG, "deleteById: documento no encontrado en Room id=$documentId")
            return JSONObject().put("ok", false).put("reason", "not_found")
        }

        val base = context.filesDir.canonicalFile

        // Validación de seguridad si se proporcionó una ruta esperada
        if (!expectedLocalPath.isNullOrBlank()) {
            val expectedFile = runCatching { File(expectedLocalPath).canonicalFile }.getOrNull()
            if (expectedFile == null || !expectedFile.path.startsWith(base.path)) {
                Log.w(TAG, "deleteById rejected: ruta esperada fuera de filesDir: $expectedLocalPath")
                return JSONObject().put("ok", false).put("reason", "invalid_path")
            }
        }

        // 1. Borrar archivo principal si existe dentro de filesDir
        if (doc.localPath.isNotBlank()) {
            val mainFile = runCatching { File(doc.localPath).canonicalFile }.getOrNull()
            if (mainFile != null && mainFile.path.startsWith(base.path)) {
                runCatching { if (mainFile.exists()) mainFile.delete() }
            }
            if (PendingPrint.get() == doc.localPath || PendingPrint.get() == mainFile?.path) {
                PendingPrint.clear()
            }
        }

        // 2. Borrar archivo de conceptos si existe dentro de filesDir
        if (!doc.conceptsPath.isNullOrBlank()) {
            val conceptsFile = runCatching { File(doc.conceptsPath).canonicalFile }.getOrNull()
            if (conceptsFile != null && conceptsFile.path.startsWith(base.path)) {
                runCatching { if (conceptsFile.exists()) conceptsFile.delete() }
            }
        }

        // 3. Eliminar la fila de Room
        db.payslipDao().deleteById(doc.id)
        Log.i(TAG, "doc_deleted_by_id id=${doc.id}")
        return JSONObject().put("ok", true)
    }

    /**
     * Fallback de eliminación por ruta. Devuelve true si se eliminó el documento o si
     * se limpió una fila huérfana.
     */
    suspend fun delete(context: Context, localPath: String): Boolean {
        if (localPath.isBlank()) return false
        val base = context.filesDir.canonicalFile
        val file = runCatching { File(localPath).canonicalFile }.getOrNull() ?: return false
        if (!file.path.startsWith(base.path)) {
            Log.w(TAG, "delete rejected: outside filesDir: ${file.path}")
            return false
        }
        val db = PayslipDatabase.getInstance(context)
        val allDocs = db.payslipDao().getAll()
        val doc = allDocs.firstOrNull {
            it.localPath == file.path ||
                    it.localPath == localPath ||
                    runCatching { File(it.localPath).canonicalPath }.getOrNull() == file.canonicalPath
        } ?: return false

        db.payslipDao().delete(doc)
        doc.conceptsPath?.takeIf { it.isNotBlank() }?.let { runCatching { File(it).delete() } }
        runCatching { if (file.exists()) file.delete() }

        if (PendingPrint.get() == doc.localPath || PendingPrint.get() == file.path) {
            PendingPrint.clear()
        }

        Log.i(TAG, "doc_deleted path=${file.path}")
        return true
    }

    /**
     * Documento que el usuario solicitó "Imprimir" (enviar vía QR sindical).
     */
    object PendingPrint {
        @Volatile private var path: String? = null
        @Volatile private var generation: Long = 0L
        @Volatile private var lastConsumedGeneration: Long = -1L

        /** Marca [localPath] como documento a transferir. */
        fun set(localPath: String) {
            path = localPath
            generation++
            lastConsumedGeneration = -1L
        }

        fun get(): String? = path

        /** Retorna la generación pendiente si no ha sido consumida. */
        fun pendingGeneration(): Long = generation

        /** Confirma que [generation] fue procesada. */
        fun consume(generation: Long) { lastConsumedGeneration = generation }

        fun alreadyConsumed(generation: Long): Boolean = generation == lastConsumedGeneration

        /** Limpia el documento pendiente tras subida o cancelación explícita. */
        fun clear() {
            path = null
            generation++
        }
    }
}
