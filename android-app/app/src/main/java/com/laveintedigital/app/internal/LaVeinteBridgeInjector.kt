package com.laveintedigital.app.internal

import android.net.Uri
import android.webkit.WebView
import androidx.webkit.WebViewCompat

/**
 * JS object injected as `window.LaVeinteApp`. Native→web replies are delivered by calling
 * `window.__laveinteBridgeResult(reqId, jsonString)` from the native side via evaluateJavascript.
 *
 * A small request/response registry lets JS await a native round-trip (e.g. listing or reading
 * native saved documents) without blocking the UI thread.
 */
object LaVeinteBridgeInjector {

    private const val JS_OBJ = "window.LaVeinteApp"

    fun inject(webView: WebView) {
        val js = bridgeScript()
        webView.evaluateJavascript(js, null)
    }

    /**
     * Registers the bridge at DOCUMENT START so it exists before Next.js hydrates. This removes the
     * race in which PrintSendPanel's useEffect ran before `LaVeinteApp` was injected, and the native
     * shell was misdetected as a browser. Falls back to `inject()` (onPageFinished) for WebViews that
     * don't support document-start scripts.
     */
    fun installAtDocumentStart(webView: WebView) {
        val js = bridgeScript()
        runCatching {
            WebViewCompat.addDocumentStartJavaScript(webView, js, setOf("*"))
        }.onSuccess {
            android.util.Log.i("LaVeinteBridge", "document_start_script_installed")
        }.onFailure { e ->
            android.util.Log.w("LaVeinteBridge", "document_start_script_failed, will fallback to onPageFinished", e)
        }
    }

    private fun bridgeScript(): String {
        return """
(function() {
  if (window.LaVeinteApp && window.LaVeinteApp.__isInjected) return;
  var __seq = 0;
  var __pending = {};
  window.__laveinteBridgeResult = function(reqId, payload) {
    var cb = __pending[reqId];
    if (cb) { delete __pending[reqId]; cb(payload); }
  };
  window.LaVeinteApp = {
    __isInjected: true,
    appPlatform: function() { return 'android'; },
    appVersion: function() { return '1.0.1'; },
    sdkVersion: function() { return ${android.os.Build.VERSION.SDK_INT}; },
    packageName: function() { return 'com.laveintedigital.app'; },
    isNativeApp: function() { return true; },
    hasBiometrics: function() { return false; },
    isBiometricsEnabled: function() { return false; },
    openExternal: function(url) { window.location.href = 'laveinte://bridge/openExternal?url=' + encodeURIComponent(url); },
    openOfficialPayslips: function() { window.location.href = 'laveinte://bridge/openOfficialPayslips'; },
    openBiometrics: function() { window.location.href = 'laveinte://bridge/openBiometrics'; },
    checkForUpdate: function() { window.location.href = 'laveinte://bridge/checkForUpdate'; },
    hasImssCredentials: function(portalId) {
      window.location.href = 'laveinte://bridge/hasImssCredentials?portalId=' + portalId;
      return false;
    },
    onAuthenticated: function() { window.location.href = 'laveinte://bridge/onAuthenticated'; },
    onLoggedOut: function() { window.location.href = 'laveinte://bridge/onLoggedOut'; },
    log: function(msg) { console.log('[LaVeinte] ' + msg); },
    requestCameraPermission: function() {
      return new Promise(function(resolve) {
        var id = 'req' + (++__seq);
        __pending[id] = function(p) { try { resolve(JSON.parse(p || '{"granted":false}')); } catch(e) { resolve({granted:false}); } };
        window.location.href = 'laveinte://bridge/requestCameraPermission?req=' + id;
      });
    },
    requestNotificationsPermission: function() {
      window.location.href = 'laveinte://bridge/requestNotificationsPermission';
    },
    listNativeDocuments: function() {
      return new Promise(function(resolve) {
        var id = 'req' + (++__seq);
        __pending[id] = function(p) { try { resolve(JSON.parse(p || '[]')); } catch(e) { resolve([]); } };
        window.location.href = 'laveinte://bridge/listNativeDocuments?req=' + id;
      });
    },
    readNativeDocument: function(localPath) {
      return new Promise(function(resolve) {
        var id = 'req' + (++__seq);
        __pending[id] = function(p) { try { resolve(JSON.parse(p || 'null')); } catch(e) { resolve(null); } };
        window.location.href = 'laveinte://bridge/readNativeDocument?req=' + id + '&path=' + encodeURIComponent(localPath);
      });
    },
    deleteNativeDocument: function(localPath) {
      return new Promise(function(resolve) {
        var id = 'req' + (++__seq);
        __pending[id] = function(p) { try { resolve(JSON.parse(p || 'false')); } catch(e) { resolve(false); } };
        window.location.href = 'laveinte://bridge/deleteNativeDocument?req=' + id + '&path=' + encodeURIComponent(localPath);
      });
    },
    getFcmToken: function() {
      return new Promise(function(resolve) {
        var id = 'req' + (++__seq);
        __pending[id] = function(p) { try { resolve(JSON.parse(p || '{"token":""}')); } catch(e) { resolve({token:''}); } };
        window.location.href = 'laveinte://bridge/getFcmToken?req=' + id;
      });
    },
    getPendingPrintDoc: function() {
      return new Promise(function(resolve) {
        var id = 'req' + (++__seq);
        __pending[id] = function(p) { try { resolve(JSON.parse(p || 'null')); } catch(e) { resolve(null); } };
        window.location.href = 'laveinte://bridge/getPendingPrintDoc?req=' + id;
      });
    },
    clearPendingPrintDoc: function() {
      window.location.href = 'laveinte://bridge/clearPendingPrintDoc';
    },
    shareNativeDocument: function(localPath, title) {
      window.location.href = 'laveinte://bridge/shareNativeDocument?path=' + encodeURIComponent(localPath) + (title ? '&title=' + encodeURIComponent(title) : '');
    },
    openAppSettings: function() {
      window.location.href = 'laveinte://bridge/openAppSettings';
    }
  };
  window.dispatchEvent(new Event('laveinte:native-ready'));
})();
        """.trimIndent()
    }
}

/**
 * Called from LaVeinteInternalWebViewClient.shouldOverrideUrlLoading when a bridge URL is detected.
 * Returns true if the URL was handled. The [webView] is needed to push async native replies back
 * to the page via evaluateJavascript.
 */
fun handleBridgeUrl(url: String, webView: WebView?): Boolean {
    val uri = Uri.parse(url) ?: return false
    if (uri.scheme != "laveinte" || uri.host != "bridge") return false

    val path = uri.path ?: return false
    when (path) {
        "/openOfficialPayslips" -> BridgeHandler.onOpenOfficialPayslips?.invoke()
        "/openBiometrics" -> BridgeHandler.onOpenBiometrics?.invoke()
        "/checkForUpdate" -> BridgeHandler.onCheckForUpdate?.invoke()
        "/onAuthenticated" -> BridgeHandler.onAuthenticated?.invoke()
        "/onLoggedOut" -> BridgeHandler.onLoggedOut?.invoke()
        "/requestCameraPermission" -> {
            val req = uri.getQueryParameter("req") ?: return true
            BridgeHandler.onRequestCameraPermission?.invoke(webView, req)
        }
        "/requestNotificationsPermission" -> BridgeHandler.onRequestNotificationsPermission?.invoke()
        "/listNativeDocuments" -> {
            val req = uri.getQueryParameter("req") ?: return true
            BridgeHandler.onListNativeDocuments?.invoke(webView, req)
        }
        "/readNativeDocument" -> {
            val req = uri.getQueryParameter("req") ?: return true
            val p = uri.getQueryParameter("path") ?: return true
            BridgeHandler.onReadNativeDocument?.invoke(webView, req, p)
        }
        "/deleteNativeDocument" -> {
            val req = uri.getQueryParameter("req") ?: return true
            val p = uri.getQueryParameter("path") ?: return true
            BridgeHandler.onDeleteNativeDocument?.invoke(webView, req, p)
        }
        "/getFcmToken" -> {
            val req = uri.getQueryParameter("req") ?: return true
            BridgeHandler.onGetFcmToken?.invoke(webView, req)
        }
        "/getPendingPrintDoc" -> {
            val req = uri.getQueryParameter("req") ?: return true
            BridgeHandler.onGetPendingPrintDoc?.invoke(webView, req)
        }
        "/clearPendingPrintDoc" -> {
            com.laveintedigital.app.imss.payslips.NativeDocuments.PendingPrint.clear()
        }
        "/shareNativeDocument" -> {
            val p = uri.getQueryParameter("path") ?: return true
            val title = uri.getQueryParameter("title")
            BridgeHandler.onShareNativeDocument?.invoke(p, title)
        }
        "/openAppSettings" -> BridgeHandler.onOpenAppSettings?.invoke()
        "/hasImssCredentials" -> {
            val portalId = uri.getQueryParameter("portalId") ?: return true
            // Just consume, the JS side doesn't need the result
        }
        else -> return false
    }
    return true
}

/**
 * Global bridge handlers set by InternalWebScreen. Async responses are pushed back to the WebView
 * via `evaluateJavascript("window.__laveinteBridgeResult(reqId, json)")`.
 */
object BridgeHandler {
    var onOpenOfficialPayslips: (() -> Unit)? = null
    var onOpenBiometrics: (() -> Unit)? = null
    var onCheckForUpdate: (() -> Unit)? = null
    var onAuthenticated: (() -> Unit)? = null
    var onLoggedOut: (() -> Unit)? = null
    var onRequestCameraPermission: ((WebView?, String) -> Unit)? = null
    var onRequestNotificationsPermission: (() -> Unit)? = null
    var onListNativeDocuments: ((WebView?, String) -> Unit)? = null
    var onReadNativeDocument: ((WebView?, String, String) -> Unit)? = null
    var onDeleteNativeDocument: ((WebView?, String, String) -> Unit)? = null
    var onGetFcmToken: ((WebView?, String) -> Unit)? = null
    var onGetPendingPrintDoc: ((WebView?, String) -> Unit)? = null
    var onOpenAppSettings: (() -> Unit)? = null
    var onShareNativeDocument: ((String, String?) -> Unit)? = null
}
