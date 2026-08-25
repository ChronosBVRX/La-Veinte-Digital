package com.laveintedigital.app.imss.portal

import android.content.Context
import android.util.Base64
import android.util.Log
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.WebView
import com.laveintedigital.app.imss.credentials.ImssPortal
import com.laveintedigital.app.imss.payslips.PayslipDatabase
import com.laveintedigital.app.imss.payslips.PayslipDocument
import com.laveintedigital.app.imss.tarjeton.ImssPeriodOption
import com.laveintedigital.app.imss.tarjeton.PortalOoad
import com.laveintedigital.app.imss.tarjeton.TarjetonCaptureSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

object ImssPdfCaptureCoordinator {

    private const val TAG = "ImssPdfCapture"
    @Volatile var activeSession: TarjetonCaptureSession? = null

    sealed interface PdfCaptureEvent {
        data class PdfDetected(val sequence: Int, val size: Int) : PdfCaptureEvent
        data class TarjetonSaved(
            val documentId: Long,
            val localPath: String,
            val wasDuplicate: Boolean,
        ) : PdfCaptureEvent
        data object ConceptsSaved : PdfCaptureEvent
        data class CaptureError(val reason: String) : PdfCaptureEvent
    }

    /** Creates and activates a capture session. Returns null if one is already active. */
    fun startCaptureSession(
        portal: ImssPortal,
        ooad: PortalOoad?,
        period: ImssPeriodOption,
    ): TarjetonCaptureSession? = startCaptureSession(
        portal = portal,
        ooadCode = ooad?.code ?: "17",
        ooadLabel = ooad?.displayLabel ?: "Michoacán",
        periodCode = period.code,
        periodLabel = period.displayLabel,
    )

    /** Generalized session factory (used by Tarjetón Digital, which has delegación + periodo). */
    fun startCaptureSession(
        portal: ImssPortal,
        ooadCode: String,
        ooadLabel: String,
        periodCode: String,
        periodLabel: String,
    ): TarjetonCaptureSession? {
        if (activeSession != null) { Log.w(TAG, "CAPTURE_SESSION_BLOCKED activeSession exists"); return null }
        val session = TarjetonCaptureSession(
            id = java.util.UUID.randomUUID().toString(),
            portalId = portal.id,
            ooadCode = ooadCode,
            ooadLabel = ooadLabel,
            periodCode = periodCode,
            periodLabel = periodLabel,
        )
        activeSession = session
        Log.i(TAG, "CAPTURE_SESSION_STARTED sessionId=${session.id} ooad=${session.ooadCode} period=${session.periodCode}")
        return session
    }

    fun createDownloadListener(
        context: Context, portal: ImssPortal, scope: CoroutineScope, onSaved: (String) -> Unit = {},
    ): DownloadListener = DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
        val isPdf = mimeType?.contains("pdf", ignoreCase = true) == true ||
                contentDisposition?.contains(".pdf", ignoreCase = true) == true ||
                url?.contains(".pdf", ignoreCase = true) == true
        if (isPdf && url != null && !url.startsWith("blob:")) {
            captureHttpPdf(context, portal, url, userAgent, scope, onSaved)
        }
    }

    // ── HTTP ────────────────────────────────────────────────────────────────

    private fun captureHttpPdf(
        context: Context, portal: ImssPortal, url: String, userAgent: String?,
        scope: CoroutineScope, onSaved: (String) -> Unit,
    ) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val bytes = downloadAuthenticated(url, portal) ?: return@withContext
                    if (bytes.size < 5 || String(bytes, 0, 5) != "%PDF-") return@withContext
                    saveHttpPdf(context, portal, bytes, onSaved)
                }
            } catch (e: Exception) { Log.e(TAG, "PDF_HTTP_DOWNLOAD: $url", e) }
        }
    }

    /**
     * Captura el reporte PDF de Tarjetón Digital IMSS, que el portal entrega vía
     * `window.open('.../wfrReporteTarjeton.aspx')` después de fijar la sesión de
     * reporte con `clsSesionReporte`. Descarga con cookies de sesión, valida la
     * cabecera `%PDF-`, calcula SHA-256, evita duplicados y lo guarda con su
     * periodo en el histórico (source = TARJETON_DIGITAL).
     */
    fun captureTarjetonDigitalReport(
        context: Context,
        portal: ImssPortal,
        url: String,
        ooadCode: String,
        ooadLabel: String,
        periodCode: String,
        periodLabel: String,
        scope: CoroutineScope,
        onEvent: (PdfCaptureEvent) -> Unit,
    ) {
        val session = startCaptureSession(portal, ooadCode, ooadLabel, periodCode, periodLabel)
            ?: return
        Log.i(TAG, "REPORT_CAPTURE_START url=$url")
        scope.launch {
            try {
                val bytes = withContext(Dispatchers.IO) { downloadAuthenticated(url, portal) }
                if (bytes == null) {
                    withContext(Dispatchers.Main) { onEvent(PdfCaptureEvent.CaptureError("REPORT_DOWNLOAD_FAILED")) }
                    finishSession(); return@launch
                }
                if (bytes.size < 5 || String(bytes, 0, 5) != "%PDF-") {
                    Log.w(TAG, "REPORT_NOT_PDF url=$url")
                    withContext(Dispatchers.Main) { onEvent(PdfCaptureEvent.CaptureError("REPORT_NOT_PDF")) }
                    finishSession(); return@launch
                }
                val dir = sessionDir(context, portal.id, ooadCode, periodCode)
                val file = withContext(Dispatchers.IO) { atomicWrite(dir, "tarjeton", bytes) }
                if (file == null) {
                    withContext(Dispatchers.Main) { onEvent(PdfCaptureEvent.CaptureError("REPORT_WRITE_FAILED")) }
                    finishSession(); return@launch
                }
                val event = withContext(Dispatchers.IO) { savePdf(context, portal, session, file, bytes) }
                finishSession()
                withContext(Dispatchers.Main) { onEvent(event) }
            } catch (e: Exception) {
                Log.e(TAG, "REPORT_CAPTURE_FAILED", e)
                finishSession()
            }
        }
    }

    /** Descarga vía HTTP autenticado (cookies de sesión + Referer). Devuelve null ante error. */
    private fun downloadAuthenticated(url: String, portal: ImssPortal): ByteArray? {
        return try {
            val cookies = CookieManager.getInstance().getCookie(url)
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 15_000; conn.readTimeout = 60_000
            if (cookies != null) conn.setRequestProperty("Cookie", cookies)
            conn.setRequestProperty("User-Agent", "LaVeinteDigitalAndroid/1.0.0")
            conn.setRequestProperty("Referer", "https://${portal.host}/")
            if (conn.responseCode != 200) { conn.disconnect(); return null }
            val bytes = conn.inputStream.readBytes()
            conn.disconnect()
            bytes
        } catch (e: Exception) { null }
    }

    /** Saves an HTTP-downloaded PDF (no capture session) straight to Room with a real local path. */
    private suspend fun saveHttpPdf(
        context: Context, portal: ImssPortal, bytes: ByteArray, onSaved: (String) -> Unit,
    ) {
        val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val dir = File(context.filesDir, "$sessionDir/${portal.id}/http")
        dir.mkdirs()
        val file = atomicWrite(dir, "doc", bytes)
        if (file == null) { withContext(Dispatchers.Main) { onSaved("invalid") }; return }
        val db = PayslipDatabase.getInstance(context)
        if (db.payslipDao().findByHash(sha) != null) {
            Log.d(TAG, "PDF_HTTP_DUPLICATE sha=${sha.take(8)}")
            withContext(Dispatchers.Main) { onSaved("duplicate") }
            return
        }
        db.payslipDao().insert(PayslipDocument(
            source = if (portal == ImssPortal.TU_PERFIL) "TU_PERFIL" else "TARJETON_DIGITAL",
            displayName = file.name,
            localPath = file.absolutePath,
            fileSize = bytes.size.toLong(),
            sha256 = sha,
            mimeType = "application/pdf",
            sourceHost = portal.host,
        ))
        Log.i(TAG, "PDF_HTTP_SAVED path=${file.absolutePath}")
        withContext(Dispatchers.Main) { onSaved("saved") }
    }

    // ── Blob capture via FileReader + Base64 ────────────────────────────────

    /**
     * Extrae un Blob PDF pendiente del monitor JS y lo persiste como **checadas**
     * (source `TU_PERFIL_BIOMETRIC`), distinto de un tarjetón. El monitor debe
     * haberse inyectado antes con [injectPdfMonitor]. Devuelve la ruta local del
     * PDF guardado, o null si no hay blob / ya estaba guardado / error.
     *
     * Es SUSPEND y usa [suspendCoroutine] (resume en el hilo Main del WebView) en
     * lugar de un CountDownLatch — evitar bloquear el hilo Main y causar un
     * deadlock con el callback de `evaluateJavascript`.
     */
    suspend fun pollBiometricPdf(
        webView: WebView,
        context: Context,
        periodLabel: String? = null,
    ): String? {
        val appContext = context.applicationContext
        val raw = withContext(Dispatchers.Main.immediate) {
            suspendCoroutine<String?> { cont ->
                webView.evaluateJavascript("""
                (function(){
                    var keys = Object.keys(window.__LVD_PDFS__ || {});
                    if (keys.length === 0) return null;
                    var key = keys[0];
                    var data = window.__LVD_PDFS__[key];
                    delete window.__LVD_PDFS__[key];
                    return JSON.stringify({key: key, b64: data.b64, type: data.type, size: data.size});
                })();
                """.trimIndent()) { result -> cont.resume(result ?: "null") }
            }
        }
        if (raw == null || raw == "null") return null
        return try {
            val cleaned = raw.trim('"').replace("\\\"", "\"")
            val json = org.json.JSONObject(cleaned)
            val b64 = json.optString("b64")
            if (b64.length < 20) return null
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            if (bytes.size < 5 || String(bytes, 0, 5) != "%PDF-") {
                Log.w(TAG, "Blob biometric PDF invalid header"); return null
            }
            val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            withContext(Dispatchers.IO) {
                val db = PayslipDatabase.getInstance(appContext)
                val existing = db.payslipDao().findByHash(sha)
                if (existing != null) {
                    Log.d(TAG, "BIOMETRIC_PDF_DUPLICATE sha=${sha.take(8)} docId=${existing.id}")
                    existing.localPath.takeIf { it.isNotBlank() }
                } else {
                    val dir = File(appContext.filesDir, "$sessionDir/${ImssPortal.TU_PERFIL.id}/biometricos")
                    dir.mkdirs()
                    val file = atomicWrite(dir, "checadas", bytes)
                    if (file != null) {
                        val displayName = buildString {
                            append("Checadas")
                            if (!periodLabel.isNullOrBlank()) append(" — ").append(periodLabel)
                        }
                        db.payslipDao().insert(PayslipDocument(
                            source = "TU_PERFIL_BIOMETRIC",
                            displayName = displayName,
                            localPath = file.absolutePath,
                            fileSize = bytes.size.toLong(),
                            sha256 = sha,
                            mimeType = "application/pdf",
                            periodLabel = periodLabel,
                            sourceHost = ImssPortal.TU_PERFIL.host,
                        ))
                        Log.i(TAG, "BIOMETRIC_PDF_SAVED path=${file.absolutePath} sha=${sha.take(8)}")
                        file.absolutePath
                    } else null
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Blob decode error", e)
            null
        }
    }

    // ── (legacy) Blob capture via FileReader + Base64 ────────────────────────

    val PDF_MONITOR_SCRIPT = """
(function(){
    if (window.__LVD_PDF_MONITOR__) return;
    window.__LVD_PDF_MONITOR__ = true;
    window.__LVD_PDFS__ = {};

    var _orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function(obj) {
        var result = _orig(obj);
        try {
            if (obj instanceof Blob && obj.type && obj.type.indexOf('pdf') !== -1) {
                var id = 'pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
                var reader = new FileReader();
                reader.onload = function() {
                    window.__LVD_PDFS__[id] = {
                        b64: reader.result.split(',')[1],
                        type: obj.type, size: obj.size
                    };
                };
                reader.readAsDataURL(obj);
            }
        } catch(e) {}
        return result;
    };
})();
    """.trimIndent()

    fun injectPdfMonitor(webView: WebView) {
        webView.evaluateJavascript(PDF_MONITOR_SCRIPT, null)
    }

    /** Polls for ALL pending base64 PDFs from the JS map and processes them. */
    fun pollPdfCandidates(
        webView: WebView, context: Context, portal: ImssPortal,
        scope: CoroutineScope, onEvent: (PdfCaptureEvent) -> Unit,
    ) {
        webView.evaluateJavascript("""
        (function(){
            var keys = Object.keys(window.__LVD_PDFS__ || {});
            if (keys.length === 0) return null;
            var key = keys[0];
            var data = window.__LVD_PDFS__[key];
            delete window.__LVD_PDFS__[key];
            return JSON.stringify({key: key, b64: data.b64, type: data.type, size: data.size});
        })();
        """.trimIndent()) { result ->
            if (result == null || result == "null") return@evaluateJavascript
            try {
                val cleaned = result.trim('"').replace("\\\"", "\"")
                val json = org.json.JSONObject(cleaned)
                val b64 = json.optString("b64")
                if (b64.length < 20) return@evaluateJavascript
                val bytes = Base64.decode(b64, Base64.DEFAULT)
                if (bytes.size < 5 || String(bytes, 0, 5) != "%PDF-") {
                    Log.w(TAG, "Blob PDF invalid header"); return@evaluateJavascript
                }
                val session = activeSession
                if (session != null) {
                    session.pdfSequence++
                    val seq = session.pdfSequence
                    if (seq in session.processedSequences) {
                        Log.d(TAG, "PDF_SEQUENCE_ALREADY_PROCESSED sequence=$seq")
                        return@evaluateJavascript
                    }
                    session.processedSequences += seq
                    Log.d(TAG, "PDF_BLOB_DETECTED sequence=$seq size=${bytes.size}")
                    val dir = sessionDir(context, portal.id, session.ooadCode, session.periodCode)
                    if (seq == 1) {
                        scope.launch(Dispatchers.Main) { onEvent(PdfCaptureEvent.PdfDetected(seq, bytes.size)) }
                        val file = atomicWrite(dir, "tarjeton", bytes)
                        if (file != null) {
                            scope.launch(Dispatchers.IO) {
                                val event = savePdf(context, portal, session, file, bytes)
                                withContext(Dispatchers.Main) { onEvent(event) }
                            }
                            Log.i(TAG, "PDF_1_SAVED path=${file.absolutePath}")
                        }
                    } else if (seq == 2) {
                        val file = atomicWrite(dir, "conceptos", bytes)
                        if (file != null) {
                            scope.launch(Dispatchers.IO) {
                                associateConcepts(context, session, file.absolutePath)
                                finishSession()
                            }
                            scope.launch(Dispatchers.Main) { onEvent(PdfCaptureEvent.ConceptsSaved) }
                            Log.i(TAG, "PDF_2_SAVED path=${file.absolutePath}")
                        }
                    } else {
                        Log.d(TAG, "PDF_EXTRA_IGNORED sequence=$seq size=${bytes.size}")
                    }
                } else {
                    // No session — save generically (safety net, e.g. manual download)
                    scope.launch(Dispatchers.IO) {
                        val f = atomicWrite(File(context.filesDir, "$sessionDir/${portal.id}"), "blob", bytes)
                        if (f != null) {
                            val db = PayslipDatabase.getInstance(context)
                            val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
                            if (db.payslipDao().findByHash(sha) == null) {
                                db.payslipDao().insert(PayslipDocument(
                                    source = if (portal == ImssPortal.TU_PERFIL) "TU_PERFIL" else "TARJETON_DIGITAL",
                                    displayName = f.name,
                                    localPath = f.absolutePath,
                                    fileSize = bytes.size.toLong(),
                                    sha256 = sha,
                                    mimeType = "application/pdf",
                                    sourceHost = portal.host,
                                ))
                            }
                        }
                    }
                }
            } catch (e: Exception) { Log.w(TAG, "Blob decode error", e) }
        }
    }

    private val sessionDir: String get() = "Tarjetones"

    private fun sessionDir(context: Context, portalId: String, ooad: String, period: String): File {
        val dir = File(context.filesDir, "$sessionDir/$portalId/$ooad/$period")
        dir.mkdirs()
        return dir
    }

    /** Writes bytes to .tmp file, validates header, renames to final name. */
    private fun atomicWrite(dir: File, prefix: String, bytes: ByteArray): File? {
        val tmp = File(dir, "${prefix}.tmp")
        try {
            FileOutputStream(tmp).use { it.write(bytes) }
            if (tmp.length() < 5L || !isPdfHeader(tmp)) {
                tmp.delete(); return null
            }
            val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            val final = File(dir, "${prefix}_${sha.take(8)}.pdf")
            if (final.exists()) final.delete()
            tmp.renameTo(final)
            return if (final.exists()) final else tmp.also { tmp.renameTo(final) }
        } catch (e: Exception) {
            tmp.delete()
            return null
        }
    }

    private fun isPdfHeader(file: File): Boolean {
        return try {
            val b = ByteArray(5)
            java.io.FileInputStream(file).use { it.read(b) }
            String(b) == "%PDF-"
        } catch (e: Exception) { false }
    }

    private fun File.readBytes(offset: Int, len: Int): String {
        return java.io.FileInputStream(this).use { fis ->
            val b = ByteArray(len)
            fis.read(b)
            String(b)
        }
    }

    /**
     * Persists the tarjetón PDF in Room with its real local path and capture session
     * metadata. Returns a TarjetonSaved event (wasDuplicate=true when the same SHA exists).
     */
    private suspend fun savePdf(
        context: Context, portal: ImssPortal, session: TarjetonCaptureSession,
        file: File, bytes: ByteArray,
    ): PdfCaptureEvent {
        val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val db = PayslipDatabase.getInstance(context)
        val existing = db.payslipDao().findByHash(sha)
        if (existing != null) {
            session.tarjetonDocumentId = existing.id
            val path = if (existing.localPath.isBlank()) file.absolutePath else existing.localPath
            Log.d(TAG, "PDF_DUPLICATE sha=${sha.take(8)} docId=${existing.id}")
            return PdfCaptureEvent.TarjetonSaved(existing.id, path, wasDuplicate = true)
        }
        val displayName = buildString {
            append("Tarjetón")
            if (session.periodLabel.isNotBlank()) append(" — ").append(session.periodLabel)
        }
        val docId = db.payslipDao().insert(PayslipDocument(
            source = if (portal == ImssPortal.TU_PERFIL) "TU_PERFIL" else "TARJETON_DIGITAL",
            displayName = displayName,
            localPath = file.absolutePath,
            fileSize = bytes.size.toLong(),
            sha256 = sha,
            mimeType = "application/pdf",
            periodLabel = session.periodLabel.ifBlank { null },
            sourceHost = portal.host,
        ))
        session.tarjetonDocumentId = docId
        Log.i(TAG, "PDF_1_SAVED docId=$docId sha=${sha.take(8)}")
        return PdfCaptureEvent.TarjetonSaved(docId, file.absolutePath, wasDuplicate = false)
    }

    /** Associates the concepts PDF with the document captured in this session. */
    private suspend fun associateConcepts(context: Context, session: TarjetonCaptureSession, conceptsPath: String) {
        val db = PayslipDatabase.getInstance(context)
        val docId = session.tarjetonDocumentId
        if (docId != null) {
            db.payslipDao().updateConceptsPath(docId, conceptsPath)
            Log.i(TAG, "CONCEPTS_ASSOCIATED docId=$docId")
        } else {
            val latest = db.payslipDao().getAll().firstOrNull() ?: return
            db.payslipDao().updateConceptsPath(latest.id, conceptsPath)
            Log.i(TAG, "CONCEPTS_ASSOCIATED_FALLBACK docId=${latest.id}")
        }
    }

    /** Closes the active session after both PDFs received or timeout. */
    fun finishSession() {
        activeSession?.let { s ->
            Log.i(TAG, "CAPTURE_SESSION_FINISHED sessionId=${s.id} sequences=${s.pdfSequence} docId=${s.tarjetonDocumentId}")
        }
        activeSession = null
    }

    /** Cleans up orphaned .tmp files in the tarjeton directory. */
    fun cleanOrphans(context: Context) {
        val dir = File(context.filesDir, sessionDir)
        if (!dir.exists()) return
        dir.walkTopDown().filter { it.extension == "tmp" }.forEach {
            if (System.currentTimeMillis() - it.lastModified() > 300_000) it.delete()
        }
    }
}
