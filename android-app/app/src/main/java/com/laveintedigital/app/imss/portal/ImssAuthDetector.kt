package com.laveintedigital.app.imss.portal

import android.util.Log
import android.webkit.WebView

/**
 * Injects a MutationObserver-based auth detection script into the IMSS portal WebView.
 * The script monitors DOM changes and sets window.__LVD_AUTH_DATA__ with auth state.
 *
 * Kotlin side polls this variable to detect login/logout transitions.
 */
object ImssAuthDetector {

    private const val TAG = "ImssAuthDetector"

    enum class AuthState { UNKNOWN, LOGIN_PAGE, AUTHENTICATED }

    val SCRIPT = """
(function(){
    if (window.__LVD_AUTH_MONITOR__) return;
    window.__LVD_AUTH_MONITOR__ = true;

    var lastAuthData = null;
    var timer = null;

    function isVisible(el) {
        if (!el) return false;
        var s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && el.getClientRects().length > 0;
    }

    function anyVisible(selectors) {
        for (var i = 0; i < selectors.length; i++) {
            var els = document.querySelectorAll(selectors[i]);
            for (var j = 0; j < els.length; j++) {
                if (isVisible(els[j])) return true;
            }
        }
        return false;
    }

    function detect() {
        var bodyText = (document.body && document.body.innerText || '').toLowerCase();

        var loginVisible = anyVisible(LOGIN_SELECTORS);
        var postLoginVisible = anyVisible(POST_LOGIN_SELECTORS);
        var postLoginText = false;
        for (var k = 0; k < POST_LOGIN_PATTERNS.length; k++) {
            if (bodyText.indexOf(POST_LOGIN_PATTERNS[k]) !== -1) { postLoginText = true; break; }
        }

        var state = 'UNKNOWN';
        if (postLoginVisible || postLoginText) state = 'AUTHENTICATED';
        else if (loginVisible) state = 'LOGIN_PAGE';

        var data = JSON.stringify({state: state, url: location.href, title: document.title, ts: Date.now()});
        if (data !== lastAuthData) {
            lastAuthData = data;
            window.__LVD_AUTH_DATA__ = data;
        }
    }

    function schedule() { clearTimeout(timer); timer = setTimeout(detect, 200); }

    new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true, attributes:true});
    window.addEventListener('popstate', schedule);
    var origPush = history.pushState; history.pushState = function(){ var r = origPush.apply(this,arguments); setTimeout(detect,0); return r; };
    var origReplace = history.replaceState; history.replaceState = function(){ var r = origReplace.apply(this,arguments); setTimeout(detect,0); return r; };

    setTimeout(detect, 100);
    setTimeout(detect, 800);
    setTimeout(detect, 2000);
    setTimeout(detect, 4000);
})();
    """.trimIndent()

    fun inject(webView: WebView, rules: PortalDetectionRules.RuleSet) {
        val loginSelectors = rules.loginSelectors.joinToString(",") { """"$it"""" }
        val postLoginSelectors = rules.postLoginSelectors.joinToString(",") { """"$it"""" }
        val postLoginPatterns = rules.postLoginTextPatterns.joinToString(",") { """"$it"""" }

        val fullScript = """
var LOGIN_SELECTORS = [$loginSelectors];
var POST_LOGIN_SELECTORS = [$postLoginSelectors];
var POST_LOGIN_PATTERNS = [$postLoginPatterns];
$SCRIPT
        """.trimIndent()

        webView.evaluateJavascript(fullScript, null)
        Log.d(TAG, "Auth detector injected")
    }

    fun poll(webView: WebView, onResult: (AuthState, String?) -> Unit) {
        webView.evaluateJavascript("window.__LVD_AUTH_DATA__", { result ->
            if (result == null || result == "null") {
                onResult(AuthState.UNKNOWN, null)
                return@evaluateJavascript
            }
            try {
                val cleaned = result.trim('"').replace("\\\"", "\"")
                val json = org.json.JSONObject(cleaned)
                val state = when (json.optString("state")) {
                    "AUTHENTICATED" -> AuthState.AUTHENTICATED
                    "LOGIN_PAGE" -> AuthState.LOGIN_PAGE
                    else -> AuthState.UNKNOWN
                }
                onResult(state, json.optString("url", null))
            } catch (e: Exception) {
                onResult(AuthState.UNKNOWN, null)
            }
        })
    }
}
