package com.laveintedigital.app.imss.portal

import android.os.SystemClock
import android.view.MotionEvent
import android.webkit.WebView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Locates DOM elements via JavaScript and dispatches real Android touch events
 * to the WebView. Fallback when synthetic JS clicks don't work with Angular Material.
 */
object NativeDomTapper {

    data class TapTarget(val xRatio: Float, val yRatio: Float, val ok: Boolean)

    /**
     * Locates the center of a DOM element matched by [jsSelector] (returns a JS
     * object with {ok, xRatio, yRatio, width, height, ...}).
     * [jsSelector] must be a JS expression that returns a JSON string.
     */
    suspend fun locate(wv: WebView, jsSelector: String): TapTarget = withContext(Dispatchers.Main.immediate) {
        var result = TapTarget(0f, 0f, false)
        val latch = java.util.concurrent.CountDownLatch(1)
        wv.evaluateJavascript(jsSelector) { raw ->
            try {
                val cleaned = parseRaw(raw)
                val j = JSONObject(cleaned)
                result = TapTarget(
                    xRatio = j.optDouble("xRatio", 0.0).toFloat().coerceIn(0f, 1f),
                    yRatio = j.optDouble("yRatio", 0.0).toFloat().coerceIn(0f, 1f),
                    ok = j.optBoolean("ok") && j.optDouble("width", 0.0) > 0 && j.optDouble("height", 0.0) > 0,
                )
            } catch (_: Exception) {}
            latch.countDown()
        }
        latch.await(2, java.util.concurrent.TimeUnit.SECONDS)
        result
    }

    /**
     * Dispatches ACTION_DOWN + ACTION_UP to the WebView at normalized coordinates.
     */
    suspend fun tap(wv: WebView, target: TapTarget): Boolean = withContext(Dispatchers.Main.immediate) {
        if (!target.ok || wv.width <= 0 || wv.height <= 0) return@withContext false
        val x = target.xRatio * wv.width
        val y = target.yRatio * wv.height
        val downTime = SystemClock.uptimeMillis()
        val down = MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, x, y, 0)
        val handled = wv.dispatchTouchEvent(down)
        down.recycle()
        delay(50)
        val upTime = SystemClock.uptimeMillis()
        val up = MotionEvent.obtain(downTime, upTime, MotionEvent.ACTION_UP, x, y, 0)
        wv.dispatchTouchEvent(up)
        up.recycle()
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
}
