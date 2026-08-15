package com.laveintedigital.app.imss.portal

import android.util.Log
import android.webkit.WebView

/**
 * JavaScript adapter for Tu Perfil IMSS Angular Material mat-select controls.
 * Handles OOAD selection, period selection, and search button click.
 * All interactions simulate real user clicks on mat-select → mat-option.
 */
object TuPerfilPortalAdapter {

    private const val TAG = "TuPerfilAdapter"

    /** Injects the adapter script. Call after card page is detected. */
    fun inject(webView: WebView) {
        webView.evaluateJavascript(SCRIPT, null)
        Log.d(TAG, "Adapter injected")
    }

    /** Gets all OOAD options from the portal. Returns JSON array of {code, label}. */
    fun getOoadOptions(webView: WebView, onResult: (List<Pair<String, String>>) -> Unit) {
        webView.evaluateJavascript("""
        (function(){
            try {
                var sel = document.querySelector('mat-select[role="combobox"]');
                if (!sel) sel = document.querySelectorAll('mat-select[role="combobox"]')[0];
                if (!sel) return '[]';
                // Open if closed
                if (sel.getAttribute('aria-expanded') !== 'true') {
                    var trigger = sel.querySelector('.mat-select-trigger');
                    if (trigger) trigger.click(); else sel.click();
                }
                return new Promise(function(resolve){
                    setTimeout(function(){
                        var opts = document.querySelectorAll('mat-option[role="option"]');
                        var result = [];
                        opts.forEach(function(o){
                            result.push({code: (o.innerText||'').trim().substring(0,2), label: (o.innerText||'').trim()});
                        });
                        resolve(JSON.stringify(result));
                    }, 800);
                });
            } catch(e) { return '[]'; }
        })();
        """.trimIndent()) { result ->
            try {
                val cleaned = result?.trim('"')?.replace("\\\"", "\"") ?: "[]"
                val arr = org.json.JSONArray(cleaned)
                val list = mutableListOf<Pair<String, String>>()
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    list.add(obj.optString("code") to obj.optString("label"))
                }
                onResult(list)
            } catch (e: Exception) {
                onResult(emptyList())
            }
        }
    }

    /** Selects OOAD by code (e.g. "17") and returns period options. */
    fun selectOoadAndGetPeriods(webView: WebView, ooadCode: String, onResult: (List<String>) -> Unit) {
        webView.evaluateJavascript("""
        (function(){
            try {
                var selector = document.querySelectorAll('mat-select[role="combobox"]')[0];
                if (!selector) return '[]';
                if (selector.getAttribute('aria-expanded') !== 'true') {
                    var t = selector.querySelector('.mat-select-trigger');
                    if (t) t.click(); else selector.click();
                }
                return new Promise(function(resolve){
                    setTimeout(function(){
                        var opts = document.querySelectorAll('mat-option[role="option"]');
                        var found = null;
                        opts.forEach(function(o){
                            if ((o.innerText||'').trim().startsWith('$ooadCode -')) found = o;
                        });
                        if (found) { found.click();
                            setTimeout(function(){
                                var psel = document.querySelectorAll('mat-select[role="combobox"]')[1];
                                if (!psel) { resolve('[]'); return; }
                                if (psel.getAttribute('aria-expanded') !== 'true') {
                                    var pt = psel.querySelector('.mat-select-trigger');
                                    if (pt) pt.click(); else psel.click();
                                }
                                setTimeout(function(){
                                    var popts = document.querySelectorAll('mat-option[role="option"]');
                                    var periods = [];
                                    popts.forEach(function(o){ periods.push((o.innerText||'').trim()); });
                                    resolve(JSON.stringify(periods));
                                }, 600);
                            }, 500);
                        } else { resolve('[]'); }
                    }, 800);
                });
            } catch(e) { return '[]'; }
        })();
        """.trimIndent()) { result ->
            try {
                val cleaned = result?.trim('"')?.replace("\\\"", "\"") ?: "[]"
                val arr = org.json.JSONArray(cleaned)
                val list = mutableListOf<String>()
                for (i in 0 until arr.length()) list.add(arr.getString(i))
                onResult(list)
            } catch (e: Exception) { onResult(emptyList()) }
        }
    }

    /** Selects a period by code (e.g. "2026015") and clicks the Search button. */
    fun selectPeriodAndSearch(webView: WebView, periodCode: String, onDone: (Boolean) -> Unit) {
        webView.evaluateJavascript("""
        (function(){
            try {
                var psel = document.querySelectorAll('mat-select[role="combobox"]')[1];
                if (!psel) return 'NO_SELECT';
                if (psel.getAttribute('aria-expanded') !== 'true') {
                    var pt = psel.querySelector('.mat-select-trigger');
                    if (pt) pt.click(); else psel.click();
                }
                setTimeout(function(){
                    var opts = document.querySelectorAll('mat-option[role="option"]');
                    var found = null;
                    opts.forEach(function(o){
                        if ((o.innerText||'').trim().startsWith('$periodCode')) found = o;
                    });
                    if (found) {
                        found.click();
                        setTimeout(function(){
                            var btns = document.querySelectorAll('button.primary');
                            var search = null;
                            btns.forEach(function(b){ if ((b.innerText||'').trim().toLowerCase() === 'buscar') search = b; });
                            if (!search) {
                                btns = document.querySelectorAll('button');
                                btns.forEach(function(b){ if ((b.innerText||'').trim().toLowerCase() === 'buscar') search = b; });
                            }
                            if (search) { search.click(); return 'OK'; }
                            return 'NO_BUTTON';
                        }, 400);
                    } else { return 'NO_OPTION'; }
                }, 600);
            } catch(e) { return 'ERROR'; }
        })();
        """.trimIndent()) { result -> onDone(result != null && result.contains("OK")) }
    }

    private val SCRIPT = """
(function(){})();
    """.trimIndent()
}
