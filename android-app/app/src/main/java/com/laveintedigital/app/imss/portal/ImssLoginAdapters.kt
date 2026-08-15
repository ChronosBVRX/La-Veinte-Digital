package com.laveintedigital.app.imss.portal

import android.webkit.WebView

/**
 * Injects login credentials into the IMSS portal page via evaluateJavascript.
 * Each adapter knows the exact selectors for its portal.
 */
object TuPerfilLoginAdapter {

    private val ALLOWED_HOST = "tuperfil.imss.gob.mx"

    fun canHandle(host: String?): Boolean = host == ALLOWED_HOST

    fun inject(webView: WebView, username: String, password: String, onResult: (Boolean) -> Unit) {
        val js = """
        (function(){
            try {
                var u = document.getElementById('usuario');
                if (!u) u = document.querySelector('input[name="usuario"]');
                if (!u) u = document.querySelector('input[type="text"]');
                var p = document.getElementById('password');
                if (!p) p = document.querySelector('input[name="password"]');
                if (!p) p = document.querySelector('input[type="password"]');
                if (!u || !p) return 'FIELDS_NOT_FOUND';
                u.value = '$username';
                u.dispatchEvent(new Event('input', {bubbles:true}));
                p.value = '$password';
                p.dispatchEvent(new Event('input', {bubbles:true}));
                var btn = document.querySelector('button[type="submit"]');
                if (!btn) btn = document.querySelector('input[type="submit"]');
                if (!btn) {
                    var buttons = document.querySelectorAll('button');
                    for (var i=0; i<buttons.length; i++) {
                        if (buttons[i].innerText.indexOf('Entrar')>-1 || buttons[i].innerText.indexOf('Acceder')>-1) {
                            btn = buttons[i]; break;
                        }
                    }
                }
                if (!btn) return 'BUTTON_NOT_FOUND';
                btn.click();
                return 'OK';
            } catch(e) { return 'ERROR'; }
        })();
        """.trimIndent()

        webView.evaluateJavascript(js) { result ->
            val success = result != null && result.contains("OK")
            onResult(success)
        }
    }
}

object TarjetonDigitalLoginAdapter {

    private val ALLOWED_HOST = "rh.imss.gob.mx"

    fun canHandle(host: String?): Boolean = host == ALLOWED_HOST

    fun inject(webView: WebView, username: String, password: String, onResult: (Boolean) -> Unit) {
        val js = """
        (function(){
            try {
                var u = document.querySelector('input[name="usuario"]');
                if (!u) u = document.querySelector('input[name="user"]');
                if (!u) u = document.querySelector('input[type="text"]');
                var p = document.querySelector('input[name="password"]');
                if (!p) p = document.querySelector('input[type="password"]');
                if (!u || !p) return 'FIELDS_NOT_FOUND';
                u.value = '$username';
                u.dispatchEvent(new Event('input', {bubbles:true}));
                p.value = '$password';
                p.dispatchEvent(new Event('input', {bubbles:true}));
                var btn = document.querySelector('button[type="submit"]');
                if (!btn) btn = document.querySelector('input[type="submit"]');
                if (!btn) {
                    var buttons = document.querySelectorAll('button');
                    for (var i=0; i<buttons.length; i++) {
                        if (buttons[i].innerText.indexOf('Entrar')>-1 || buttons[i].innerText.indexOf('Ingresar')>-1) {
                            btn = buttons[i]; break;
                        }
                    }
                }
                if (!btn) return 'BUTTON_NOT_FOUND';
                btn.click();
                return 'OK';
            } catch(e) { return 'ERROR'; }
        })();
        """.trimIndent()

        webView.evaluateJavascript(js) { result ->
            val success = result != null && result.contains("OK")
            onResult(success)
        }
    }
}
