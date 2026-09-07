package com.laveintedigital.app.internal

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import androidx.core.content.FileProvider
import androidx.webkit.JavaScriptReplyProxy
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

object PdfShareManager {
    private const val TAG = "PdfShareManager"
    const val MAX_CHUNK_SIZE = 64 * 1024 // 64 KB
    const val MAX_TOTAL_SIZE = 10 * 1024 * 1024 // 10 MB
    const val TIMEOUT_MS = 30_000L // 30 seconds
    private const val SHARE_AUTHORITY_SUFFIX = ".fileprovider"
    private val TRANSFER_ID_REGEX = Regex("^[A-Za-z0-9_-]{1,64}$")

    private data class Session(
        val transferId: String,
        val sanitizedFileName: String,
        val partFile: File,
        var nextExpectedIndex: Long = 0L,
        var receivedBytes: Long = 0L,
        var timeoutRunnable: Runnable? = null,
        var replyProxy: JavaScriptReplyProxy? = null,
        /** SHARE = abrir hoja de compartir (comportamiento histórico); SAVE = persistir en Room/filesDir. */
        val mode: TransferMode = TransferMode.SHARE,
        val ownerId: String? = null,
        val externalKey: String? = null,
        val periodLabel: String? = null,
    )

    private enum class TransferMode { SHARE, SAVE }

    private val mainHandler = Handler(Looper.getMainLooper())
    // Ejecutor de un solo hilo para procesar start, chunk y commit de forma estrictamente secuencial
    private val sequentialDispatcher = java.util.concurrent.Executors.newSingleThreadExecutor().asCoroutineDispatcher()
    private val sequentialScope = CoroutineScope(sequentialDispatcher + SupervisorJob())
    private val sessions = ConcurrentHashMap<String, Session>()

    fun isValidTransferId(transferId: String?): Boolean {
        if (transferId.isNullOrBlank()) return false
        return TRANSFER_ID_REGEX.matches(transferId)
    }

    fun sanitizePdfFileName(rawName: String?): String {
        var name = (rawName ?: "documento").trim()
        val slashIdx = maxOf(name.lastIndexOf('/'), name.lastIndexOf('\\'))
        if (slashIdx >= 0 && slashIdx < name.length - 1) {
            name = name.substring(slashIdx + 1)
        }
        name = name.replace("..", "").replace(Regex("[\\\\/:*?\"<>|]"), "_")
        name = name.trim().trim('.', '_', ' ')
        if (name.isBlank() || name == "passwd") name = "documento"
        if (!name.endsWith(".pdf", ignoreCase = true)) {
            name += ".pdf"
        }
        return name
    }

    private fun postResult(replyProxy: JavaScriptReplyProxy?, responseJson: JSONObject) {
        val payloadStr = responseJson.toString()
        if (replyProxy != null) {
            try {
                replyProxy.postMessage(payloadStr)
                return
            } catch (e: Exception) {
                Log.w(TAG, "postMessage to JavaScriptReplyProxy failed", e)
            }
        }
    }

    fun handleWebMessage(
        context: Context,
        message: String,
        replyProxy: JavaScriptReplyProxy?,
        sourceOrigin: String?,
        isMainFrame: Boolean
    ) {
        if (!isMainFrame) {
            Log.w(TAG, "Rejected message from non-main frame: $sourceOrigin")
            val errObj = JSONObject().apply {
                put("ok", false)
                put("code", "UNSUPPORTED")
                put("message", "Mensaje rechazado: origen o contexto no permitido.")
            }
            postResult(replyProxy, errObj)
            return
        }

        sequentialScope.launch {
            try {
                val json = JSONObject(message)
                val action = json.optString("action")

                // setOwner no usa transferId (es señal de sesión, no transferencia).
                // En APKs que no conocen esta acción se responde INVALID_REQUEST sin efectos.
                if (action == "setOwner") {
                    handleSetOwner(context, replyProxy, json.optString("userId"))
                    return@launch
                }

                val transferId = json.optString("transferId", json.optString("reqId"))

                if (!isValidTransferId(transferId)) {
                    sendErrorResponse(context, replyProxy, "INVALID_REQUEST", "Identificador de transferencia no válido.", transferId)
                    return@launch
                }

                when (action) {
                    "start" -> {
                        val fileName = json.optString("fileName", "documento.pdf")
                        start(context, replyProxy, transferId, fileName)
                    }
                    // saveStart/saveChunk/saveCommit persisten el PDF en Room/filesDir (modo offline
                    // de escritos). Los fragmentos y el commit reutilizan el protocolo "chunk"/"commit":
                    // la sesión guarda su modo y el commit decide. Desconocido en APKs viejas →
                    // INVALID_REQUEST inocuo, jamás abre la hoja de compartir.
                    "saveStart" -> {
                        val rawName = json.optString("title", json.optString("fileName", "documento.pdf"))
                        start(
                            context, replyProxy, transferId, rawName,
                            mode = TransferMode.SAVE,
                            ownerId = json.optString("ownerId").ifBlank { null },
                            externalKey = json.optString("escritoId").ifBlank { null },
                            periodLabel = json.optString("fecha").ifBlank { null },
                        )
                    }
                    "chunk" -> {
                        val index = json.optLong("index", -1L).toString()
                        val chunkData = json.optString("chunk")
                        chunk(context, replyProxy, transferId, index, chunkData)
                    }
                    "commit" -> {
                        val sha256 = json.optString("sha256")
                        val totalSize = json.optLong("totalSize", 0L).toString()
                        commit(context, replyProxy, transferId, sha256, totalSize)
                    }
                    "cancel" -> {
                        val reason = json.optString("reason", "cancelled")
                        cancel(transferId, reason)
                        val cancelObj = JSONObject().apply {
                            put("ok", false)
                            put("code", "CANCELLED")
                            put("message", "Transferencia cancelada.")
                            put("transferId", transferId)
                        }
                        postResult(replyProxy, cancelObj)
                    }
                    else -> {
                        sendErrorResponse(context, replyProxy, "INVALID_REQUEST", "Acción desconocida en el puente de documentos.", transferId)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling bridge payload", e)
                val errObj = JSONObject().apply {
                    put("ok", false)
                    put("code", "INVALID_REQUEST")
                    put("message", "Formato de mensaje no válido.")
                }
                postResult(replyProxy, errObj)
            }
        }
    }

    private fun start(
        context: Context,
        replyProxy: JavaScriptReplyProxy?,
        transferId: String,
        fileName: String,
        mode: TransferMode = TransferMode.SHARE,
        ownerId: String? = null,
        externalKey: String? = null,
        periodLabel: String? = null,
    ) {
        if (sessions.isNotEmpty()) {
            val existing = sessions.values.firstOrNull()
            if (existing != null && existing.transferId != transferId) {
                sendErrorResponse(context, replyProxy, "BUSY", "Hay otra transferencia en curso. Inténtalo de nuevo.", transferId)
                return
            }
        }

        try {
            val sanitized = sanitizePdfFileName(fileName)
            val sharedDocsDir = File(context.cacheDir, "shared-documents").apply { mkdirs() }
            val partFile = File(sharedDocsDir, "$transferId.part")
            if (partFile.exists()) {
                partFile.delete()
            }
            partFile.createNewFile()

            val session = Session(
                transferId = transferId,
                sanitizedFileName = sanitized,
                partFile = partFile,
                nextExpectedIndex = 0L,
                receivedBytes = 0L,
                replyProxy = replyProxy,
                mode = mode,
                ownerId = ownerId?.trim()?.ifBlank { null },
                externalKey = externalKey?.trim()?.ifBlank { null },
                periodLabel = periodLabel?.trim()?.ifBlank { null },
            )
            sessions[transferId] = session
            scheduleTimeout(context, replyProxy, transferId)

            val ackObj = JSONObject().apply {
                put("ok", true)
                put("status", "ready")
                put("transferId", transferId)
            }
            postResult(replyProxy, ackObj)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting transfer $transferId", e)
            sendErrorResponse(context, replyProxy, "INTERNAL_ERROR", "No se pudo iniciar la transferencia del documento.", transferId)
            cancel(transferId, "start_exception")
        }
    }

    private fun chunk(context: Context, replyProxy: JavaScriptReplyProxy?, transferId: String, indexStr: String, base64Chunk: String) {
        val session = sessions[transferId]
        if (session == null) {
            sendErrorResponse(context, replyProxy, "INVALID_REQUEST", "No hay una transferencia activa.", transferId)
            return
        }

        session.replyProxy = replyProxy
        scheduleTimeout(context, replyProxy, transferId)

        try {
            val index = indexStr.toLongOrNull()
            if (index == null || index != session.nextExpectedIndex) {
                sendErrorResponse(context, replyProxy, "CHUNK_OUT_OF_ORDER", "Fragmento fuera de orden.", transferId)
                cancel(transferId, "out_of_order")
                return
            }

            val chunkBytes = Base64.decode(base64Chunk, Base64.DEFAULT)
            if (chunkBytes.isEmpty() || chunkBytes.size > MAX_CHUNK_SIZE) {
                sendErrorResponse(context, replyProxy, "INVALID_PDF", "Tamaño de fragmento no válido.", transferId)
                cancel(transferId, "invalid_chunk_size")
                return
            }

            if (session.receivedBytes + chunkBytes.size > MAX_TOTAL_SIZE) {
                sendErrorResponse(context, replyProxy, "FILE_TOO_LARGE", "El PDF supera el límite de 10 MB.", transferId)
                cancel(transferId, "too_large")
                return
            }

            RandomAccessFile(session.partFile, "rw").use { raf ->
                raf.seek(session.receivedBytes)
                raf.write(chunkBytes)
            }

            session.receivedBytes += chunkBytes.size
            session.nextExpectedIndex += 1L
        } catch (e: Exception) {
            Log.e(TAG, "Error appending chunk for transfer $transferId", e)
            sendErrorResponse(context, replyProxy, "WRITE_FAILED", "No se pudo guardar el fragmento del archivo.", transferId)
            cancel(transferId, "write_failed")
        }
    }

    private suspend fun commit(context: Context, replyProxy: JavaScriptReplyProxy?, transferId: String, expectedSha256: String, totalSizeStr: String) {
        val session = sessions[transferId]
        if (session == null) {
            sendErrorResponse(context, replyProxy, "INVALID_REQUEST", "No hay una transferencia activa.", transferId)
            return
        }

        session.replyProxy = replyProxy
        session.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }

        try {
            val expectedSize = totalSizeStr.toLongOrNull()
            if (expectedSize == null || session.receivedBytes != expectedSize || session.receivedBytes == 0L) {
                sendErrorResponse(context, replyProxy, "INVALID_PDF", "Tamaño recibido no coincide.", transferId)
                cancel(transferId, "size_mismatch")
                return
            }

            if (session.partFile.length() < 5) {
                sendErrorResponse(context, replyProxy, "INVALID_PDF", "El archivo transferido no es un PDF válido.", transferId)
                cancel(transferId, "too_small")
                return
            }

            val header = ByteArray(5)
            session.partFile.inputStream().use { it.read(header) }
            val headerStr = String(header, Charsets.US_ASCII)
            if (headerStr != "%PDF-") {
                sendErrorResponse(context, replyProxy, "INVALID_PDF", "El archivo transferido no tiene encabezado PDF válido.", transferId)
                cancel(transferId, "invalid_header")
                return
            }

            val digest = MessageDigest.getInstance("SHA-256")
            session.partFile.inputStream().use { fis ->
                val buffer = ByteArray(8192)
                var read: Int
                while (fis.read(buffer).also { read = it } != -1) {
                    digest.update(buffer, 0, read)
                }
            }
            val computedHash = digest.digest().joinToString("") { "%02x".format(it) }
            if (!computedHash.equals(expectedSha256, ignoreCase = true)) {
                sendErrorResponse(context, replyProxy, "CHECKSUM_MISMATCH", "No se pudo verificar el archivo. Inténtalo de nuevo.", transferId)
                cancel(transferId, "checksum_mismatch")
                return
            }

            // Modo SAVE: persistir en Room/filesDir para consulta offline. Jamás abre compartir.
            if (session.mode == TransferMode.SAVE) {
                commitSave(context, replyProxy, session, transferId, computedHash)
                return
            }

            val finalFile = File(session.partFile.parentFile, session.sanitizedFileName)
            if (finalFile.exists()) finalFile.delete()
            val renamed = session.partFile.renameTo(finalFile)
            if (!renamed) {
                try {
                    session.partFile.copyTo(finalFile, overwrite = true)
                    session.partFile.delete()
                } catch (ce: Exception) {
                    sendErrorResponse(context, replyProxy, "WRITE_FAILED", "No se pudo finalizar el archivo PDF.", transferId)
                    cancel(transferId, "rename_failed")
                    return
                }
            }

            val uri = FileProvider.getUriForFile(
                context,
                context.packageName + SHARE_AUTHORITY_SUFFIX,
                finalFile
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TITLE, session.sanitizedFileName)
                clipData = ClipData.newRawUri(session.sanitizedFileName, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, session.sanitizedFileName).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            mainHandler.post {
                try {
                    context.startActivity(chooser)
                    sendSuccessResponse(replyProxy, transferId, session.sanitizedFileName, session.receivedBytes, computedHash)
                    sessions.remove(transferId)
                } catch (e: ActivityNotFoundException) {
                    Log.w(TAG, "No app available to handle ACTION_SEND", e)
                    sendErrorResponse(context, replyProxy, "NO_APP_AVAILABLE", "No hay aplicaciones disponibles para compartir este PDF.", transferId)
                    cancel(transferId, "no_app_available")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start chooser", e)
                    sendErrorResponse(context, replyProxy, "INTERNAL_ERROR", "Error al abrir el selector para compartir.", transferId)
                    cancel(transferId, "chooser_failed")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error committing transfer $transferId", e)
            sendErrorResponse(context, replyProxy, "INTERNAL_ERROR", "Error al procesar el archivo PDF.", transferId)
            cancel(transferId, "commit_exception")
        }
    }

    /**
     * Finaliza una transferencia SAVE: lee los bytes del .part y los persiste vía
     * [NativeDocuments.saveExternalPdf] (misma Room + filesDir que tarjetones/checadas).
     * Limpia el .part temporal en todos los caminos.
     */
    private suspend fun commitSave(
        context: Context,
        replyProxy: JavaScriptReplyProxy?,
        session: Session,
        transferId: String,
        computedHash: String,
    ) {
        try {
            val bytes = withContext(Dispatchers.IO) { session.partFile.readBytes() }
            val owner = session.ownerId
                ?: com.laveintedigital.app.offline.NativeSessionOwner.current(context)
            val docId = com.laveintedigital.app.imss.payslips.NativeDocuments.saveExternalPdf(
                context = context,
                bytes = bytes,
                displayName = session.sanitizedFileName,
                source = com.laveintedigital.app.imss.payslips.NativeDocuments.SOURCE_ESCRITO,
                externalKey = session.externalKey,
                ownerId = owner,
                periodLabel = session.periodLabel,
            )
            sessions.remove(transferId)
            runCatching { if (session.partFile.exists()) session.partFile.delete() }
            if (docId <= 0) {
                sendErrorResponse(context, replyProxy, "INVALID_PDF", "No se pudo guardar el documento.", transferId)
                return
            }
            android.util.Log.i(
                com.laveintedigital.app.offline.OfflineLog.TAG,
                "${com.laveintedigital.app.offline.OfflineLog.EVENT_DOC_SAVED} id=$docId size=${bytes.size}",
            )
            postResult(replyProxy, JSONObject().apply {
                put("ok", true)
                put("status", "saved")
                put("transferId", transferId)
                put("fileName", session.sanitizedFileName)
                put("byteLength", bytes.size.toLong())
                put("sha256", computedHash)
                put("docId", docId)
            })
        } catch (e: Exception) {
            Log.e(TAG, "Error committing SAVE transfer $transferId", e)
            sendErrorResponse(context, replyProxy, "INTERNAL_ERROR", "Error al guardar el documento.", transferId)
            cancel(transferId, "save_commit_exception")
        }
    }

    /**
     * Señal de sesión: fija el propietario lógico actual para documentos guardados
     * (best-effort; userId vacío limpia). Responde ack inocuo en APKs que lo soportan.
     */
    private fun handleSetOwner(context: Context, replyProxy: JavaScriptReplyProxy?, rawUserId: String?) {
        val clean = rawUserId?.trim().orEmpty()
        if (clean.isNotEmpty() && !com.laveintedigital.app.offline.NativeSessionOwner.isValidOwnerId(clean)) {
            sendErrorResponse(context, replyProxy, "INVALID_REQUEST", "Identificador de usuario no válido.", null)
            return
        }
        com.laveintedigital.app.offline.NativeSessionOwner.set(context, clean.ifBlank { null })
        postResult(replyProxy, JSONObject().apply {
            put("ok", true)
            put("status", "owner_set")
        })
    }

    fun cancel(transferId: String, reason: String) {
        val session = sessions.remove(transferId) ?: return
        session.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        try {
            if (session.partFile.exists()) {
                session.partFile.delete()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error cleaning up part file for $transferId", e)
        }
    }

    private fun scheduleTimeout(context: Context, replyProxy: JavaScriptReplyProxy?, transferId: String) {
        val session = sessions[transferId] ?: return
        session.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }

        val runnable = Runnable {
            Log.w(TAG, "Transfer $transferId timed out after ${TIMEOUT_MS}ms")
            sendErrorResponse(context, session.replyProxy ?: replyProxy, "TIMEOUT", "Tiempo de espera agotado al transferir el documento.", transferId)
            cancel(transferId, "timeout")
        }
        session.timeoutRunnable = runnable
        mainHandler.postDelayed(runnable, TIMEOUT_MS)
    }

    private fun sendErrorResponse(
        context: Context,
        replyProxy: JavaScriptReplyProxy?,
        code: String,
        userMessage: String,
        transferId: String? = null
    ) {
        val response = JSONObject().apply {
            put("ok", false)
            put("code", code)
            put("message", userMessage)
            if (transferId != null) put("transferId", transferId)
        }
        postResult(replyProxy, response)
    }

    private fun sendSuccessResponse(
        replyProxy: JavaScriptReplyProxy?,
        transferId: String,
        fileName: String,
        byteLength: Long,
        sha256: String
    ) {
        val response = JSONObject().apply {
            put("ok", true)
            put("status", "chooser_opened")
            put("transferId", transferId)
            put("fileName", fileName)
            put("byteLength", byteLength)
            put("sha256", sha256)
        }
        postResult(replyProxy, response)
    }

    fun cleanupOld(context: Context) {
        sequentialScope.launch {
            try {
                val dir = File(context.cacheDir, "shared-documents")
                if (!dir.exists() || !dir.isDirectory) return@launch
                val now = System.currentTimeMillis()
                val oneDayMs = 24 * 60 * 60 * 1000L
                dir.listFiles()?.forEach { file ->
                    if (now - file.lastModified() > oneDayMs) {
                        file.delete()
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error running 24h cleanup", e)
            }
        }
    }
}
