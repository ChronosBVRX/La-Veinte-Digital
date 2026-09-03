package com.laveintedigital.app.imss.portal

import android.content.Context
import android.util.Base64
import android.util.Log
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.WebView
import com.laveintedigital.app.imss.biometric.BiometricDiscovery
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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import org.json.JSONObject

object ImssPdfCaptureCoordinator {

    private const val TAG = "ImssPdfCapture"
    private val saveMutex = Mutex()
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
        if (activeSession != null) {
            Log.w(TAG, "CAPTURE_SESSION_RESET_PREVIOUS activeSession was still open: ${activeSession?.id}; finishing it before starting new session")
            finishSession()
        }
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

    /** Forcibly cancels/resets any active capture session cycle. */
    fun resetSession() {
        finishSession()
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

    /**
     * Descarga HTTP autenticada SIN depender de ".pdf" en la URL: usa las
     * cookies reales del CookieManager, conserva un User-Agent de WebView y el
     * Referer de la página biométrica. Devuelve los bytes, o null si no es PDF
     * válido (magic header %PDF-, min 5 bytes).
     */
    private fun downloadPdfAuthenticated(url: String, pageUrl: String, userAgent: String?): ByteArray? {
        return try {
            val cookies = CookieManager.getInstance().getCookie(url)
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 15_000; conn.readTimeout = 60_000
            conn.instanceFollowRedirects = true
            if (cookies != null) conn.setRequestProperty("Cookie", cookies)
            conn.setRequestProperty("User-Agent", userAgent ?: "LaVeinteDigitalAndroid/1.0.0")
            conn.setRequestProperty("Referer", pageUrl)
            if (conn.responseCode !in 200..399) { conn.disconnect(); return null }
            val bytes = conn.inputStream.readBytes()
            conn.disconnect()
            if (bytes.size < 5 || String(bytes, 0, 5) != "%PDF-") {
                Log.w(TAG, "BIO_PDF_INVALID_HEADER size=${bytes.size}")
                return null
            }
            bytes
        } catch (e: Exception) { null }
    }

    /** Guarda bytes ya validados (%PDF-) como checadas (TU_PERFIL_BIOMETRIC). */
    private suspend fun saveBiometricBytes(
        context: Context, bytes: ByteArray, periodLabel: String?,
    ): String? = saveMutex.withLock {
        val appContext = context.applicationContext
        if (bytes.size < 5 || String(bytes, 0, 5) != "%PDF-") return null
        val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val db = PayslipDatabase.getInstance(appContext)
        val existing = db.payslipDao().findByHash(sha)
        if (existing != null) {
            Log.d(TAG, "BIO_PDF_DUPLICATE sha=${sha.take(8)} docId=${existing.id}")
            return existing.localPath.takeIf { it.isNotBlank() }
        }
        val dir = File(appContext.filesDir, "$sessionDir/${ImssPortal.TU_PERFIL.id}/biometricos")
        dir.mkdirs()
        val file = atomicWrite(dir, "checadas", bytes)
        if (file == null) return null
        val displayName = buildString {
            append("Checadas")
            if (!periodLabel.isNullOrBlank()) append(" — ").append(periodLabel)
        }
        val docId = db.payslipDao().insert(PayslipDocument(
            source = "TU_PERFIL_BIOMETRIC",
            displayName = displayName,
            localPath = file.absolutePath,
            fileSize = bytes.size.toLong(),
            sha256 = sha,
            mimeType = "application/pdf",
            periodLabel = periodLabel,
            sourceHost = ImssPortal.TU_PERFIL.host,
        ))
        if (docId <= 0) {
            val rec = db.payslipDao().findByHash(sha)
            if (rec != null && rec.localPath != file.absolutePath && file.exists()) {
                runCatching { file.delete() }
            }
        }
        Log.i(TAG, "BIO_PDF_SAVED path=${file.absolutePath} sha=${sha.take(8)}")
        return file.absolutePath
    }

    /**
     * DownloadListener para Registros biométricos: descarga HTTP autenticada con
     * cookies/UA/Referer propios del WebView, valida %PDF- (sin depender de ".pdf")
     * y guarda como checadas. Nunca loguea cookies ni credenciales.
     */
    fun createBiometricDownloadListener(
        context: Context, scope: CoroutineScope,
        pageUrlProvider: () -> String?,
        periodLabelProvider: () -> String?,
        onSaved: (String?) -> Unit = {},
    ): DownloadListener = DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
        if (url == null || url.startsWith("blob:")) return@DownloadListener // blob: lo captura el monitor JS
        val isAllowed = url.startsWith("https://tuperfil.imss.gob.mx") || url.startsWith("https://tpei.imss.gob.mx")
        if (!isAllowed) { Log.w(TAG, "BIO_PDF_URL_BLOCKED host=${java.net.URI(url).host}"); return@DownloadListener }
        val isLikelyPdf = mimeType?.contains("pdf", true) == true ||
                contentDisposition?.contains("pdf", true) == true ||
                url.contains(".pdf", true) == true ||
                mimeType?.contains("octet-stream", true) == true
        if (!isLikelyPdf) return@DownloadListener
        val periodLabel = periodLabelProvider()
        Log.d(TAG, "BIO_PDF_DOWNLOAD_CALLBACK url=${url.take(80)} mime=$mimeType")
        scope.launch {
            try {
                val pageUrl = pageUrlProvider() ?: "https://tuperfil.imss.gob.mx/guitpei-web/app/administration/biometric/consult-period"
                val bytes = withContext(Dispatchers.IO) { downloadPdfAuthenticated(url, pageUrl, userAgent) } ?: run {
                    Log.w(TAG, "BIO_PDF_HTTP_DOWNLOAD_FAILED")
                    return@launch
                }
                val path = saveBiometricBytes(context, bytes, periodLabel)
                if (path != null) { Log.i(TAG, "BIO_PDF_HTTP_CAPTURED size=${bytes.size} path=${path}") }
                withContext(Dispatchers.Main) { onSaved(path) }
            } catch (e: Exception) { Log.w(TAG, "BIO_PDF_HTTP_ERR", e) }
        }
    }

    /** Saves an HTTP-downloaded PDF (no capture session) straight to Room with a real local path. */
    private suspend fun saveHttpPdf(
        context: Context, portal: ImssPortal, bytes: ByteArray, onSaved: (String) -> Unit,
    ) = saveMutex.withLock {
        val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val dir = File(context.filesDir, "$sessionDir/${portal.id}/http")
        dir.mkdirs()
        val file = atomicWrite(dir, "doc", bytes)
        if (file == null) { withContext(Dispatchers.Main) { onSaved("invalid") }; return@withLock }
        val db = PayslipDatabase.getInstance(context)
        val existing = db.payslipDao().findByHash(sha)
        if (existing != null) {
            if (file.absolutePath != existing.localPath && file.exists()) {
                runCatching { file.delete() }
            }
            Log.d(TAG, "PDF_HTTP_DUPLICATE sha=${sha.take(8)}")
            withContext(Dispatchers.Main) { onSaved("duplicate") }
            return@withLock
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
        // Fuente 1: buffer del monitor de blobs (URL.createObjectURL).
        val mono = withContext(Dispatchers.Main.immediate) {
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
        if (mono != null && mono != "null") {
            val b64 = extractB64(mono) ?: return null
            val bytes = try { Base64.decode(b64, Base64.DEFAULT) } catch (e: Exception) { return null }
            return saveBiometricBytes(appContext, bytes, periodLabel)
        }
        // Fuente 3: buffer del DownloadListener (fetch del blob URL).
        val dl = withContext(Dispatchers.Main.immediate) {
            suspendCoroutine<String?> { cont ->
                webView.evaluateJavascript(BiometricDiscovery.readBiometricPdfResultJs()) { result ->
                    cont.resume(result ?: "null")
                }
            }
        }
        if (dl == null || dl == "null") return null
        return try {
            val j = JSONObject(dl.trim('"').replace("\\\"", "\""))
            if (j.optBoolean("ok")) {
                val b64 = j.optString("b64")
                if (b64.length < 20) return null
                val bytes = try { Base64.decode(b64, Base64.DEFAULT) } catch (e: Exception) { return null }
                saveBiometricBytes(appContext, bytes, periodLabel)
            } else null
        } catch (e: Exception) { null }
    }

    private fun extractB64(raw: String): String? {
        val cleaned = raw.trim('"').replace("\\\"", "\"")
        val json = try { JSONObject(cleaned) } catch (e: Exception) { return null }
        val b64 = json.optString("b64")
        return b64.takeIf { it.length >= 20 }
    }

    /** Conecta un DownloadListener que, ante un blob PDF, lo lee vía JS y lo guarda. */
    fun attachBiometricDownloadListener(webView: WebView, context: Context) {
        webView.setDownloadListener { url, _, _, mimeType, _ ->
            val isPdf = mimeType?.contains("pdf", ignoreCase = true) == true ||
                    url?.contains(".pdf", ignoreCase = true) == true
            if (isPdf && url != null && url.startsWith("blob:")) {
                Log.i(TAG, "BIOMETRIC_DL_BLOB url=${url.take(40)}")
                webView.evaluateJavascript(BiometricDiscovery.fetchBlobJs(url), null)
            }
        }
    }

    /**
     * Guarda un PDF de checadas a partir de su base64 (obtenido del endpoint
     * `POST /biometricos/recuperar` → `data.archivoB64`). Valida la cabecera
     * `%PDF-`, deduplica por SHA-256 y devuelve la ruta local, o null.
     */
    fun saveBiometricBase64(context: Context, base64: String, periodLabel: String?): String? {
        val appContext = context.applicationContext
        if (base64.length < 20) return null
        return try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            if (bytes.size < 5 || String(bytes, 0, 5) != "%PDF-") {
                Log.w(TAG, "Biometric base64 invalid header"); return null
            }
            val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            val db = PayslipDatabase.getInstance(appContext)
            val existing = kotlinx.coroutines.runBlocking(Dispatchers.IO) { db.payslipDao().findByHash(sha) }
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
                    kotlinx.coroutines.runBlocking(Dispatchers.IO) { db.payslipDao().insert(PayslipDocument(
                        source = "TU_PERFIL_BIOMETRIC",
                        displayName = displayName,
                        localPath = file.absolutePath,
                        fileSize = bytes.size.toLong(),
                        sha256 = sha,
                        mimeType = "application/pdf",
                        periodLabel = periodLabel,
                        sourceHost = ImssPortal.TU_PERFIL.host,
                    )) }
                    Log.i(TAG, "BIOMETRIC_PDF_SAVED path=${file.absolutePath} sha=${sha.take(8)}")
                    file.absolutePath
                } else null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Biometric save error", e)
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

    /**
     * Monitor ampliado de PDFs para Regístros biométricos. Cubre TODAS las vías
     * de entrega del reporte que usa Tu Perfil IMSS: `window.open(blob:)`,
     * `URL.createObjectURL(Blob PDF)`, `<a href=blob: download>` y respuestas
     * fetch/XHR con `Content-Type: application/pdf`. Todo se normaliza a base64
     * en `window.__LVD_PDFS__` (mismo canal que [pollPdfCandidates]).
     * Nunca loguea cookies, tokens, matrícula ni contenido del PDF.
     */
    val BIOMETRIC_PDF_MONITOR_SCRIPT = """
(function(){
    if (window.__LVD_BIO_PDF_MONITOR__) return;
    window.__LVD_BIO_PDF_MONITOR__ = true;
    window.__LVD_PDFS__ = window.__LVD_PDFS__ || {};

    function store(b64, type, size) {
        if (!b64 || b64.length < 20) return;
        var id = 'pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
        window.__LVD_PDFS__[id] = { b64: b64, type: type || 'application/pdf', size: size || 0 };
    }
    function blobToB64(blob, done) {
        var reader = new FileReader();
        reader.onload = function() { done(reader.result.split(',')[1], blob.type, blob.size); };
        reader.readAsDataURL(blob);
    }
    function isPdfBlob(blob) { return blob && blob.type && blob.type.indexOf('pdf') !== -1; }

    // 1) window.open — se intercepta y, si trae PDF, se lee el blob.
    var ow = window.open;
    window.open = function(url, name, features) {
        try { if (String(url||'').indexOf('blob:') === 0) { /* el blob se captura vía createObjectURL */ } } catch(e) {}
        return ow.apply(this, arguments);
    };

    // 2) URL.createObjectURL(Blob PDF) — vía más común de Angular.
    if (window.URL && URL.createObjectURL) {
        var oc = URL.createObjectURL;
        URL.createObjectURL = function(obj) {
            var result = oc.apply(this, arguments);
            try {
                if (isPdfBlob(obj)) blobToB64(obj, function(b64,type,size){ store(b64,type,size); });
            } catch(e) {}
            return result;
        };
    }

    // 3) Clicks de <a href=blob: download> — lectura del blob resuelto.
    if (HTMLAnchorElement && HTMLAnchorElement.prototype) {
        var ac = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function() {
            var self = this;
            try {
                if (self.download || String(self.href||'').indexOf('blob:') === 0) {
                    fetch(self.href).then(function(r){ return r.blob(); }).then(function(b){
                        if (isPdfBlob(b)) blobToB64(b, function(b64,type,size){ store(b64,type,size); });
                    }).catch(function(){});
                }
            } catch(e) {}
            return ac.apply(this, arguments);
        };
    }

    // 4) fetch — respuestas con Content-Type application/pdf se leen como blob.
    var ofet = window.fetch;
    window.fetch = function(input, init) {
        var p = ofet.apply(this, arguments);
        try {
            p.then(function(resp){
                if (!resp) return;
                var ct = (resp.headers && resp.headers.get && resp.headers.get('content-type')) || '';
                if (ct.indexOf('pdf') !== -1) {
                    resp.clone().blob().then(function(b){ if (isPdfBlob(b)) blobToB64(b, function(b64,type,size){ store(b64,type,size); }); }).catch(function(){});
                }
            }).catch(function(){});
        } catch(e) {}
        return p;
    };

    // 5) XHR — respuestas con Content-Type application/pdf.
    var oxo = XMLHttpRequest.prototype.open;
    var oxs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(m,u){ this.__url=u; return oxo.apply(this,arguments); };
    XMLHttpRequest.prototype.send = function(){
        var self = this;
        this.addEventListener('load', function(){
            try {
                var ct = ('xhrResponseType' in self && self.responseType==='blob') ? (self.response && self.response.type) : (self.getResponseHeader && self.getResponseHeader('Content-Type') || '');
                if (ct && ct.indexOf('pdf') !== -1) {
                    var blob = self.response && self.responseType==='blob' ? self.response : null;
                    if (blob) blobToB64(blob, function(b64,type,size){ store(b64,type,size); });
                }
            } catch(e) {}
        });
        return oxs.apply(this, arguments);
    };
})();
    """.trimIndent()

    fun injectPdfMonitor(webView: WebView) {
        webView.evaluateJavascript(PDF_MONITOR_SCRIPT, null)
        webView.evaluateJavascript(BIOMETRIC_PDF_MONITOR_SCRIPT, null)
    }

    /** Inyecta solamente el monitor ampliado de biométricos. */
    fun injectBiometricPdfMonitor(webView: WebView) {
        webView.evaluateJavascript(BIOMETRIC_PDF_MONITOR_SCRIPT, null)
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
                val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
                val session = activeSession
                if (session != null) {
                    if (sha in session.processedHashes) {
                        Log.d(TAG, "PDF_SHA_ALREADY_PROCESSED sha=${sha.take(8)}")
                        return@evaluateJavascript
                    }
                    session.processedHashes += sha
                    session.pdfSequence++
                    val seq = session.pdfSequence
                    Log.d(TAG, "PDF_BLOB_DETECTED sequence=$seq size=${bytes.size} sha=${sha.take(8)}")
                    val dir = sessionDir(context, portal.id, session.ooadCode, session.periodCode)
                    if (session.tarjetonDocumentId == null) {
                        scope.launch(Dispatchers.Main) { onEvent(PdfCaptureEvent.PdfDetected(seq, bytes.size)) }
                        val file = atomicWrite(dir, "tarjeton", bytes)
                        if (file != null) {
                            scope.launch(Dispatchers.IO) {
                                val event = savePdf(context, portal, session, file, bytes)
                                withContext(Dispatchers.Main) { onEvent(event) }
                            }
                            Log.i(TAG, "PDF_1_SAVED path=${file.absolutePath}")
                        }
                    } else {
                        // El segundo PDF es el de conceptos auxiliares
                        val file = atomicWrite(dir, "conceptos", bytes)
                        if (file != null) {
                            scope.launch(Dispatchers.IO) {
                                associateConcepts(context, session, file.absolutePath)
                                finishSession()
                            }
                            scope.launch(Dispatchers.Main) { onEvent(PdfCaptureEvent.ConceptsSaved) }
                            Log.i(TAG, "PDF_2_CONCEPTS_SAVED path=${file.absolutePath}")
                        }
                    }
                } else {
                    // Sin sesión activa: NO guardar blob genérico en disco ni en Room
                    Log.d(TAG, "PDF_CANDIDATE_IGNORED_NO_SESSION size=${bytes.size} sha=${sha.take(8)}")
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
    ): PdfCaptureEvent = saveMutex.withLock {
        val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val db = PayslipDatabase.getInstance(context)
        val existing = db.payslipDao().findByHash(sha)
        if (existing != null) {
            session.tarjetonDocumentId = existing.id
            val path = if (existing.localPath.isBlank()) file.absolutePath else existing.localPath
            if (file.absolutePath != existing.localPath && file.exists()) {
                runCatching { file.delete() }
            }
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
        val finalId = if (docId > 0) docId else (db.payslipDao().findByHash(sha)?.id ?: 0L)
        session.tarjetonDocumentId = finalId
        Log.i(TAG, "PDF_1_SAVED docId=$finalId sha=${sha.take(8)}")
        return PdfCaptureEvent.TarjetonSaved(finalId, file.absolutePath, wasDuplicate = false)
    }

    /** Associates the concepts PDF with the document captured in this session. */
    private suspend fun associateConcepts(context: Context, session: TarjetonCaptureSession, conceptsPath: String) {
        val db = PayslipDatabase.getInstance(context)
        val docId = session.tarjetonDocumentId
        if (docId != null && docId > 0L) {
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
