package com.laveintedigital.app.imss.payslips

import android.content.Context
import android.util.Base64
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Expone los documentos guardados nativamente (tarjetones + checadas + escritos) desde Room a la web,
 * como un array JSON de metadatos y como base64 para operaciones de lectura/transferencia.
 *
 * Bridge contract:
 *  - list → `[ { id, name, localPath, source, fileSize, downloadedAt, mimeType, escritoId? } ]`
 *  - read (localPath) → `{ name, data: <base64>, mimeType }` o null si no existe.
 *  - deleteById (id, expectedPath) → `{ ok: boolean, reason?: string }`
 *  - delete (localPath) → boolean (fallback de compatibilidad)
 *
 * Aislamiento por usuario: [list] filtra por el propietario de sesión actual
 * ([NativeSessionOwner]) cuando se conoce; los documentos legacy sin propietario (ownerId NULL)
 * permanecen visibles (política conservadora documentada en docs/ANDROID_OFFLINE_DOCUMENTS.md).
 */
object NativeDocuments {

    private const val TAG = "NativeDocuments"
    private const val MAX_B64_DOC = 10 * 1024 * 1024

    /** Fuente Room para copias nativas de escritos generados en la web. */
    const val SOURCE_ESCRITO = "ESCRITO"

    suspend fun list(context: Context): JSONArray {
        // Ejecutar reparación preventiva de duplicados/blobs heredados
        PayslipDatabase.repairLegacyBlobRecords(context)

        val db = PayslipDatabase.getInstance(context)
        val docs = db.payslipDao().getAll()
        val currentOwner = com.laveintedigital.app.offline.NativeSessionOwner.current(context)
        val arr = JSONArray()
        for (d in docs) {
            if (!isVisibleTo(d.ownerId, currentOwner)) continue
            val file = File(d.localPath)
            if (!file.exists()) continue
            val obj = JSONObject()
                .put("id", d.id)
                .put("name", d.displayName)
                .put("localPath", d.localPath)
                .put("source", d.source)
                .put("fileSize", file.length())
                .put("downloadedAt", d.downloadedAt)
                .put("mimeType", d.mimeType)
            // Clave externa solo para escritos (la web la usa para sincronizar/eliminar copias).
            if (d.source == SOURCE_ESCRITO && !d.externalKey.isNullOrBlank()) {
                obj.put("escritoId", d.externalKey)
            }
            arr.put(obj)
        }
        return arr
    }

    /**
     * Política de visibilidad por propietario (pura, unit-testeable).
     * Sin propietario de sesión conocido → todo visible (comportamiento histórico).
     * Con sesión conocida → visibles los propios + los legacy sin atribuir.
     */
    fun isVisibleTo(docOwnerId: String?, currentOwnerId: String?): Boolean {
        if (currentOwnerId.isNullOrBlank()) return true
        if (docOwnerId.isNullOrBlank()) return true
        return docOwnerId == currentOwnerId
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
     * Persiste bytes PDF ya validados (%PDF-) como documento externo (p. ej. escrito generado
     * en la web) en filesDir/escritos + Room, reutilizando la única fuente de verdad.
     *
     * Upsert por (source, externalKey): si el escrito ya tenía copia nativa, reemplaza el
     * archivo y actualiza la fila en lugar de duplicar. Deduplica además por sha256 global.
     * Devuelve el id de Room o -1 si el contenido era inválido.
     */
    suspend fun saveExternalPdf(
        context: Context,
        bytes: ByteArray,
        displayName: String,
        source: String = SOURCE_ESCRITO,
        externalKey: String? = null,
        ownerId: String? = null,
        periodLabel: String? = null,
    ): Long {
        if (bytes.size < 5 || String(bytes, 0, 5) != "%PDF-") {
            Log.w(TAG, "saveExternalPdf rejected: invalid header size=${bytes.size}")
            return -1L
        }
        val appContext = context.applicationContext
        val safeName = sanitizeDisplayName(displayName)
        val sha = sha256Bytes(bytes)
        val db = PayslipDatabase.getInstance(appContext)
        val base = appContext.filesDir.canonicalFile

        // 1. Upsert por clave externa estable.
        val cleanKey = externalKey?.trim().orEmpty()
        if (cleanKey.isNotEmpty()) {
            val prev = db.payslipDao().findByExternalKey(source, cleanKey)
            if (prev != null) {
                if (prev.sha256 == sha) {
                    val f = runCatching { File(prev.localPath).canonicalFile }.getOrNull()
                    if (f != null && f.path.startsWith(base.path) && f.exists()) return prev.id
                }
                val dir = File(appContext.filesDir, "escritos").also { it.mkdirs() }
                val file = atomicWritePdf(dir, safeName, bytes) ?: return -1L
                deleteFileIfInsideBase(base, prev.localPath, keep = file.absolutePath)
                db.payslipDao().deleteById(prev.id)
                val id = db.payslipDao().insert(prev.copy(
                    displayName = safeName,
                    localPath = file.absolutePath,
                    downloadedAt = System.currentTimeMillis(),
                    fileSize = bytes.size.toLong(),
                    sha256 = sha,
                    periodLabel = periodLabel ?: prev.periodLabel,
                    ownerId = ownerId?.trim()?.ifBlank { null } ?: prev.ownerId,
                ))
                Log.i(TAG, "OFFLINE_DOC_SAVED source=$source id=$id updated=true size=${bytes.size}")
                return id
            }
        }

        // 2. Deduplicación global por contenido.
        val dup = db.payslipDao().findByHash(sha)
        if (dup != null) {
            val f = runCatching { File(dup.localPath).canonicalFile }.getOrNull()
            if (f != null && f.path.startsWith(base.path) && f.exists()) return dup.id
        }

        // 3. Inserción nueva.
        val dir = File(appContext.filesDir, "escritos").also { it.mkdirs() }
        val file = atomicWritePdf(dir, safeName, bytes) ?: return -1L
        val id = db.payslipDao().insert(PayslipDocument(
            source = source,
            displayName = safeName,
            localPath = file.absolutePath,
            fileSize = bytes.size.toLong(),
            sha256 = sha,
            mimeType = "application/pdf",
            periodLabel = periodLabel,
            ownerId = ownerId?.trim()?.ifBlank { null },
            externalKey = cleanKey.ifBlank { null },
        ))
        if (id <= 0) {
            val rec = db.payslipDao().findByHash(sha)
            if (rec != null) return rec.id
        }
        Log.i(TAG, "OFFLINE_DOC_SAVED source=$source id=$id updated=false size=${bytes.size}")
        return id
    }

    /**
     * Elimina las copias nativas asociadas a una clave externa (p. ej. al borrar un escrito
     * en la web). Mantiene sincronizados archivo físico + fila Room. Devuelve cuántas eliminó.
     */
    suspend fun deleteByExternalKey(context: Context, source: String, key: String): Int {
        if (key.isBlank()) return 0
        val db = PayslipDatabase.getInstance(context)
        val docs = db.payslipDao().findAllByExternalKey(source, key)
        if (docs.isEmpty()) return 0
        var removed = 0
        for (d in docs) {
            val res = deleteById(context, d.id, d.localPath)
            if (runCatching { res.getBoolean("ok") }.getOrDefault(false)) removed++
        }
        return removed
    }

    /**
     * Purga filas Room cuyo archivo físico ya no existe. Conservadora: solo actúa sobre filas
     * con archivo ausente; nunca toca archivos. Devuelve los ids purgados (para diagnóstico).
     */
    suspend fun pruneMissingFiles(context: Context): List<Long> {
        val pruned = mutableListOf<Long>()
        try {
            val db = PayslipDatabase.getInstance(context)
            for (d in db.payslipDao().getAll()) {
                val exists = runCatching { File(d.localPath).exists() }.getOrDefault(false)
                if (!exists) {
                    Log.i(TAG, "OFFLINE_FILE_MISSING id=${d.id} source=${d.source}")
                    db.payslipDao().deleteById(d.id)
                    pruned.add(d.id)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "pruneMissingFiles failed", e)
        }
        return pruned
    }

    /** Nombre de archivo seguro para persistir en filesDir (sin rutas ni caracteres hostiles). */
    fun sanitizeDisplayName(raw: String?): String {
        var name = (raw ?: "documento").trim().ifBlank { "documento" }
        val slashIdx = maxOf(name.lastIndexOf('/'), name.lastIndexOf('\\'))
        if (slashIdx >= 0 && slashIdx < name.length - 1) name = name.substring(slashIdx + 1)
        name = name.replace("..", "").replace(Regex("[\\\\/:*?\"<>|]"), "_").trim().trim('.', '_', ' ')
        if (name.isBlank()) name = "documento"
        if (name.length > 120) name = name.take(120).trimEnd('.', '_', ' ')
        if (!name.endsWith(".pdf", ignoreCase = true)) name += ".pdf"
        return name
    }

    private fun sha256Bytes(bytes: ByteArray): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        digest.update(bytes)
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun atomicWritePdf(dir: File, displayName: String, bytes: ByteArray): File? {
        return try {
            dir.mkdirs()
            val stamp = System.currentTimeMillis()
            val rand = (0..9999).random()
            val tmp = File(dir, ".tmp_${stamp}_$rand.pdf")
            tmp.outputStream().use { it.write(bytes) }
            var target = File(dir, displayName)
            if (target.exists()) {
                val stem = displayName.removeSuffix(".pdf").removeSuffix(".PDF")
                target = File(dir, "${stem}_$stamp.pdf")
            }
            if (tmp.renameTo(target)) target
            else {
                tmp.copyTo(target, overwrite = true)
                tmp.delete()
                target
            }
        } catch (e: Exception) {
            Log.w(TAG, "atomicWritePdf failed", e)
            null
        }
    }

    private fun deleteFileIfInsideBase(base: File, path: String?, keep: String?) {
        if (path.isNullOrBlank() || path == keep) return
        val f = runCatching { File(path).canonicalFile }.getOrNull() ?: return
        if (!f.path.startsWith(base.path) || f.path == keep) return
        runCatching { if (f.exists()) f.delete() }
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
