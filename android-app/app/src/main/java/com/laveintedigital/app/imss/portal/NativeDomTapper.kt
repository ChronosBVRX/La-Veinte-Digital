package com.laveintedigital.app.imss.portal

import android.os.SystemClock
import android.view.MotionEvent
import android.webkit.WebView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * Locates DOM elements via JavaScript and dispatches real Android touch events
 * to the WebView. Fallback when synthetic JS clicks don't work with Angular Material.
 */
object NativeDomTapper {

    data class TapTarget(val xRatio: Float, val yRatio: Float, val ok: Boolean, val width: Float = 0f, val height: Float = 0f)

    /**
     * Locates the center of a DOM element matched by [jsSelector] (returns a JS
     * object with {ok, xRatio, yRatio, width, height, ...}).
     * [jsSelector] must be a JS expression that returns a JSON string.
     *
     * Es SUSPEND y usa [suspendCoroutine] (resume en el hilo Main del WebView) en
     * lugar de un CountDownLatch — evitar bloquear el hilo Main y causar un
     * deadlock con el callback de `evaluateJavascript`.
     */
    suspend fun locate(wv: WebView, jsSelector: String): TapTarget = withContext(Dispatchers.Main.immediate) {
        val raw = suspendCoroutine<String?> { cont ->
            wv.evaluateJavascript(jsSelector) { value -> cont.resume(value ?: "null") }
        }
        if (raw == null || raw == "null" || raw == "null" || raw == "{}") return@withContext TapTarget(0f, 0f, false)
        try {
            val cleaned = parseRaw(raw)
            val j = JSONObject(cleaned)
            TapTarget(
                xRatio = j.optDouble("xRatio", 0.0).toFloat().coerceIn(0f, 1f),
                yRatio = j.optDouble("yRatio", 0.0).toFloat().coerceIn(0f, 1f),
                ok = j.optBoolean("ok") && j.optDouble("width", 0.0) > 0 && j.optDouble("height", 0.0) > 0,
                width = j.optDouble("width", 0.0).toFloat(),
                height = j.optDouble("height", 0.0).toFloat(),
            )
        } catch (_: Exception) { TapTarget(0f, 0f, false) }
    }

    /**
     * Dispatches a real tap (DOWN → MOVE → UP) to the WebView at the element's
     * center. angular/Material necesita que el WebView sintetice un `click`, lo
     * que requiere una secuencia de toque con leve movimiento y pausas reales.
     */
    suspend fun tap(wv: WebView, target: TapTarget): Boolean = withContext(Dispatchers.Main.immediate) {
        if (!target.ok || wv.width <= 0 || wv.height <= 0) return@withContext false
        val x = target.xRatio * wv.width
        val y = target.yRatio * wv.height
        val downTime = SystemClock.uptimeMillis()
        val down = MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, x, y, 0)
        wv.dispatchTouchEvent(down)
        down.recycle()
        delay(90)
        val move = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_MOVE, x, y, 0)
        wv.dispatchTouchEvent(move)
        move.recycle()
        delay(60)
        val upTime = SystemClock.uptimeMillis()
        val up = MotionEvent.obtain(downTime, upTime, MotionEvent.ACTION_UP, x, y, 0)
        val handled = wv.dispatchTouchEvent(up)
        up.recycle()
        delay(40)
        handled
    }

    private fun parseRaw(raw: String?): String {
        if (raw == null || raw == "null") return "{}"
        var cleaned = raw.trim()
        if (cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
            cleaned = cleaned.substring(1, cleaned.length - 1)
            cleaned = cleaned.replace("\\\"", "\"").replace("\\\\", "\\")
        }
        return cleaned
    }

    // ── Pre-built selectors ────────────────────────────────────────────────

    /** Locates the OOAD mat-select trigger. Scrolls into view first. */
    val OOAD_TRIGGER_SELECTOR = """
(function(){function n(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}var s=Array.from(document.querySelectorAll('mat-select[role="combobox"]')).find(function(x){return n(x.textContent).includes('ooad')})||document.querySelectorAll('mat-select[role="combobox"]')[0];if(!s)return JSON.stringify({ok:false});if(s.getAttribute('aria-disabled')==='true')return JSON.stringify({ok:false});s.scrollIntoView({behavior:'auto',block:'center',inline:'center'});var t=s.querySelector('.mat-select-trigger')||s;setTimeout(function(){},0);var r=t.getBoundingClientRect();return JSON.stringify({ok:true,xRatio:(r.left+r.width/2)/window.innerWidth,yRatio:(r.top+r.height/2)/window.innerHeight,width:r.width,height:r.height})})()
    """.trimIndent()

    /** Locates the "17 - MICHOACAN" option in the CDK overlay. */
    val OOAD_OPTION_17_SELECTOR = """
(function(){var o=Array.from(document.querySelectorAll('.cdk-overlay-container mat-option[role="option"]')).find(function(x){return /^17\s*-\s*/.test(String(x.textContent||'').replace(/\s+/g,' ').trim())});if(!o)return JSON.stringify({ok:false});o.scrollIntoView({behavior:'auto',block:'center'});setTimeout(function(){},0);var r=o.getBoundingClientRect();return JSON.stringify({ok:true,xRatio:(r.left+r.width/2)/window.innerWidth,yRatio:(r.top+r.height/2)/window.innerHeight,width:r.width,height:r.height})})()
    """.trimIndent()

    /** Locates the Period mat-select trigger. */
    val PERIOD_TRIGGER_SELECTOR = """
(function(){function n(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}var s=Array.from(document.querySelectorAll('mat-select[role="combobox"]')).find(function(x){return n(x.textContent).includes('periodo')})||document.querySelectorAll('mat-select[role="combobox"]')[1];if(!s)return JSON.stringify({ok:false});if(s.getAttribute('aria-disabled')==='true')return JSON.stringify({ok:false});s.scrollIntoView({behavior:'auto',block:'center',inline:'center'});var t=s.querySelector('.mat-select-trigger')||s;setTimeout(function(){},0);var r=t.getBoundingClientRect();return JSON.stringify({ok:true,xRatio:(r.left+r.width/2)/window.innerWidth,yRatio:(r.top+r.height/2)/window.innerHeight,width:r.width,height:r.height})})()
    """.trimIndent()

    /** Locates a period option by code prefix in the CDK overlay. */
    fun periodOptionSelector(code: String) = """
(function(){var o=Array.from(document.querySelectorAll('.cdk-overlay-container mat-option[role="option"]')).find(function(x){return String(x.textContent||'').replace(/\s+/g,' ').trim().startsWith('$code')});if(!o)return JSON.stringify({ok:false});o.scrollIntoView({behavior:'auto',block:'center'});setTimeout(function(){},0);var r=o.getBoundingClientRect();return JSON.stringify({ok:true,xRatio:(r.left+r.width/2)/window.innerWidth,yRatio:(r.top+r.height/2)/window.innerHeight,width:r.width,height:r.height})})()
    """.trimIndent()

    /**
     * Locates el control "Descargar" del reporte biométrico. El handler de
     * Angular está en el `<a>` (sin href) dentro de `div.download`. Devuelve la
     * posición a tocar. Se reinyecta window.__LVD_BIO_LIB__ antes de usarla.
     */
    val DOWNLOAD_TAP_SELECTOR = """
(function(){function n(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}function vis(e){if(!e)return false;return e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0}var a=document.querySelector('div.download a')||document.querySelector('.download a');if(!a||!vis(a))return JSON.stringify({ok:false});a.scrollIntoView({behavior:'auto',block:'center',inline:'center'});setTimeout(function(){},0);var r=a.getBoundingClientRect();return JSON.stringify({ok:true,xRatio:(r.left+r.width/2)/window.innerWidth,yRatio:(r.top+r.height/2)/window.innerHeight,width:r.width,height:r.height})})()
    """.trimIndent()
}
