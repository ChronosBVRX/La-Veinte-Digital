package com.laveintedigital.app.internal.navigation

import android.util.Log
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import com.laveintedigital.app.BuildConfig

/**
 * Detector SPA inyectado en document-start.
 *
 * SOLO OBSERVA navegación: clicks reales en enlaces internos + cambios de
 * clave de navegación (`origin + pathname + search`) vía History API.
 * Nunca hace `preventDefault`, nunca navega manualmente, nunca inserta
 * estados, nunca llama `history.back()`.
 *
 * Abrir modales/menús/sheets NO cambia la clave de navegación, por lo que
 * jamás emite `intent` (el Back canónico del PR #66 los administra).
 *
 * En navegadores normales (sin el listener nativo) es un no-op silencioso:
 * la web queda intacta.
 */
internal object NavFeedbackDetector {

    /** Nombre del WebMessageListener, independiente del PDF bridge. */
    const val BRIDGE_NAME = "laVeinteNavFeedback"

    fun script(): String = """
(function() {
  if (window.__laveinteNavFeedbackInstalled) return;
  window.__laveinteNavFeedbackInstalled = true;

  var __seq = 0;
  function nextGen() { __seq += 1; return __seq; }
  function lastGen() { return __seq; }

  function post(msg) {
    try {
      var b = window.laVeinteNavFeedbackBridge;
      if (b && typeof b.postMessage === 'function') {
        b.postMessage(JSON.stringify(msg));
      }
    } catch (err) {}
  }

  function navKeyOf(loc) {
    try { return loc.origin + loc.pathname + loc.search; }
    catch (err) { return ''; }
  }

  // Click real en enlace interno: solo observar, jamás interferir.
  document.addEventListener('click', function (e) {
    try {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var t = e.target;
      var el = (t && t.closest) ? t.closest('a') : null;
      if (!el) return;
      if (el.hasAttribute('download')) return;
      var target = (el.getAttribute('target') || '').toLowerCase();
      if (target === '_blank') return;
      var href = el.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      var url;
      try { url = new URL(href, location.href); }
      catch (err) { return; }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
      if (url.origin !== location.origin) return;
      if (navKeyOf(url) === navKeyOf(location)) return;
      post({ event: 'intent', path: url.pathname + url.search, gen: nextGen() });
    } catch (err) {}
  }, true);

  // History API: señal complementaria de URL real cambiada. Se conserva
  // EXACTAMENTE args, this, resultado y excepciones de la API original.
  function wrapHistory(method) {
    return function () {
      var before = navKeyOf(location);
      var result = method.apply(this, arguments);
      var after = navKeyOf(location);
      if (after && before && after !== before) {
        try {
          post({ event: 'commit', path: location.pathname + location.search, gen: lastGen() });
        } catch (err) {}
      }
      return result;
    };
  }

  try {
    if (window.history && history.pushState) {
      history.pushState = wrapHistory(history.pushState);
    }
    if (window.history && history.replaceState) {
      history.replaceState = wrapHistory(history.replaceState);
    }
    window.addEventListener('popstate', function () {
      try {
        post({ event: 'commit', path: location.pathname + location.search, gen: lastGen() });
      } catch (err) {}
    });
  } catch (err) {}
})();
    """.trimIndent()

    /**
     * Misma allowlist conceptual del PDF bridge: solo orígenes internos y
     * localhost en DEBUG. Sin excepciones.
     */
    fun allowedOrigins(): Set<String> {
        val production = setOf(
            "https://la-veinte-digital.vercel.app",
            "https://laveinte-digital.vercel.app",
            "https://la-veinte-digital.pages.dev",
            "https://la20.com.mx",
            "https://www.la20.com.mx",
        )
        return if (BuildConfig.DEBUG) {
            production + setOf(
                "http://la-veinte-digital.localhost",
                "https://la-veinte-digital.localhost",
            )
        } else {
            production
        }
    }

    /**
     * Validación del listener: origen permitido + main frame.
     * Recibe el origen ya como String para mantenerse testeable en JVM pura.
     */
    fun isMessageAllowed(sourceOrigin: String?, isMainFrame: Boolean, allowed: Set<String>): Boolean {
        if (!isMainFrame) return false
        if (sourceOrigin.isNullOrEmpty()) return false
        return allowed.contains(sourceOrigin)
    }

    fun install(webView: WebView, allowedOrigins: Set<String>, onMessage: (String) -> Unit) {
        runCatching {
            WebViewCompat.addDocumentStartJavaScript(webView, script(), setOf("*"))
        }.onFailure { e ->
            Log.w("NavFeedback", "document_start_script_failed", e)
        }
        runCatching {
            WebViewCompat.addWebMessageListener(
                webView,
                BRIDGE_NAME,
                allowedOrigins,
            ) { _, message, sourceOrigin, isMainFrame, _ ->
                val originString = sourceOrigin?.toString()
                if (!isMessageAllowed(originString, isMainFrame, allowedOrigins)) {
                    Log.w("NavFeedback", "Rejected feedback message from origin=$originString main=$isMainFrame")
                    return@addWebMessageListener
                }
                val data = message.data ?: return@addWebMessageListener
                onMessage(data)
            }
        }.onFailure { e ->
            Log.w("NavFeedback", "addWebMessageListener not supported or failed", e)
        }
    }
}
