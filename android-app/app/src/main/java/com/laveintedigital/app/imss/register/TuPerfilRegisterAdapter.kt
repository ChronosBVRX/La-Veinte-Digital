package com.laveintedigital.app.imss.register

import org.json.JSONObject

/**
 * Generador de scripts JavaScript para interactuar de forma precisa con el formulario
 * Angular y los modales de Angular Material en `tuperfil.imss.gob.mx/guitpei-web/register`.
 */
object TuPerfilRegisterAdapter {

    const val REGISTER_URL = "https://tuperfil.imss.gob.mx/guitpei-web/register"

    /**
     * Comprueba si la ruta `/register` está lista y los primeros controles existen en el DOM.
     */
    val CHECK_PAGE_READY_JS = """
        (function() {
            var path = location.pathname || '';
            if (path.indexOf('/register') < 0) return JSON.stringify({ ready: false, reason: 'WRONG_PATH', path: path });
            var matInput = document.querySelector('input[formcontrolname="numMatricula"]') ||
                           document.querySelector('input[placeholder*="Matrícula" i]');
            var ooadSel = document.querySelector('app-custom-select') ||
                          document.querySelector('mat-select[formcontrolname="claveOoad"]');
            return JSON.stringify({
                ready: !!(matInput && ooadSel),
                hasMatricula: !!matInput,
                hasOoad: !!ooadSel
            });
        })()
    """.trimIndent()

    /**
     * Inyecta el OOAD y la Matrícula, y dispara los eventos necesarios para que Angular
     * ejecute `getEmployeeInfo()` y consulte a SIAP.
     */
    fun selectOoadAndMatriculaJs(ooadCode: String, matricula: String): String {
        val qOoad = JSONObject.quote(ooadCode)
        val qMat = JSONObject.quote(matricula)
        return """
        (function() {
            try {
                // 1. Matrícula
                var m = document.querySelector('input[formcontrolname="numMatricula"]') ||
                        document.querySelector('input[placeholder*="Matrícula" i]');
                if (!m) return JSON.stringify({ ok: false, reason: 'MATRICULA_NOT_FOUND' });

                var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
                if (d && d.set) {
                    m.focus();
                    d.set.call(m, $qMat);
                    m.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: $qMat }));
                    m.dispatchEvent(new Event('change', { bubbles: true }));
                    m.dispatchEvent(new Event('blur', { bubbles: true }));
                    m.blur();
                } else {
                    m.value = $qMat;
                    m.dispatchEvent(new Event('input', { bubbles: true }));
                    m.dispatchEvent(new Event('blur', { bubbles: true }));
                }

                // 2. OOAD Selector
                var sel = document.querySelector('mat-select[formcontrolname="claveOoad"]') ||
                          document.querySelector('app-custom-select mat-select') ||
                          document.querySelector('mat-select');
                if (!sel) return JSON.stringify({ ok: false, reason: 'OOAD_SELECT_NOT_FOUND' });

                if (sel.getAttribute('aria-expanded') !== 'true') {
                    var trig = sel.querySelector('.mat-select-trigger');
                    if (trig) trig.click(); else sel.click();
                }

                setTimeout(function() {
                    var opts = document.querySelectorAll('mat-option[role="option"]');
                    var target = null;
                    var targetCode = $qOoad;
                    opts.forEach(function(o) {
                        var txt = (o.innerText || '').trim();
                        if (txt.indexOf(targetCode + ' -') === 0 || txt.indexOf(targetCode + ' ') === 0 || txt === targetCode) {
                            target = o;
                        }
                    });
                    if (target) {
                        target.click();
                        // Disparar blur en matrícula de nuevo por si requiere el orden OOAD -> Matrícula
                        setTimeout(function() {
                            if (m) {
                                m.focus();
                                m.dispatchEvent(new Event('blur', { bubbles: true }));
                                m.blur();
                            }
                        }, 250);
                    }
                }, 400);

                return JSON.stringify({ ok: true });
            } catch(e) {
                return JSON.stringify({ ok: false, reason: String(e && e.message || e) });
            }
        })()
        """.trimIndent()
    }

    /**
     * Inspecciona si SIAP detectó que la cuenta ya existe (modal de "Cuenta duplicada")
     * o si cargó correctamente los validadores del empleado.
     */
    val CHECK_SIAP_RESULT_JS = """
        (function() {
            // Verificar si apareció modal de cuenta duplicada
            var dialogs = document.querySelectorAll('.mat-dialog-container, [role="dialog"], mat-dialog-container');
            for (var i = 0; i < dialogs.length; i++) {
                var d = dialogs[i];
                var t = (d.innerText || '').toLowerCase();
                if (t.indexOf('ya fue registrada') >= 0 || t.indexOf('cuenta duplicada') >= 0) {
                    return JSON.stringify({ status: 'ALREADY_REGISTERED', message: (d.innerText || '').trim() });
                }
            }

            // Verificar si hay errores en el campo de matrícula
            var matError = document.querySelector('mat-error');
            if (matError) {
                var txt = (matError.innerText || '').trim();
                if (txt && (txt.indexOf('no coincide') >= 0 || txt.indexOf('inválida') >= 0 || txt.indexOf('invalida') >= 0)) {
                    return JSON.stringify({ status: 'MATRICULA_ERROR', message: txt });
                }
            }

            // Verificar si el formulario desbloqueó el resto de los campos
            var curpInput = document.querySelector('input[formcontrolname="cveCurp"]');
            var rfcInput = document.querySelector('input[formcontrolname="cveRfc"]');
            if (curpInput && rfcInput && !curpInput.disabled) {
                return JSON.stringify({ status: 'READY_TO_FILL' });
            }

            return JSON.stringify({ status: 'WAITING_SIAP' });
        })()
    """.trimIndent()

    /**
     * Rellena todos los campos restantes en el formulario Angular y los valida.
     */
    fun fillAllRemainingFieldsJs(input: TuPerfilRegisterInput): String {
        val qCurp = JSONObject.quote(input.curp.uppercase())
        val qRfc = JSONObject.quote(input.rfc.uppercase())
        val qNss = JSONObject.quote(input.nss)
        val qDate = JSONObject.quote(input.fechaIngreso) // YYYY-MM-DD
        val qPhone = JSONObject.quote(input.telefono)
        val qMail = JSONObject.quote(input.correoPersonal.trim())
        val qCorpMail = JSONObject.quote(input.correoInstitucional.trim())
        val qPass = JSONObject.quote(input.password)
        val qPassR = JSONObject.quote(input.confirmPassword)

        return """
        (function() {
            try {
                function setField(name, val) {
                    var el = document.querySelector('input[formcontrolname="' + name + '"]');
                    if (!el) return false;
                    var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
                    if (d && d.set) {
                        el.focus();
                        d.set.call(el, val);
                        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                        el.blur();
                    } else {
                        el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                    }
                    return true;
                }

                var rCurp = setField('cveCurp', $qCurp);
                var rRfc = setField('cveRfc', $qRfc);
                var rNss = setField('numNss', $qNss);
                var rTel = setField('numeroContacto', $qPhone);
                var rMail = setField('refCorreoElectronicoPersona', $qMail);
                var rCorp = true;
                if ($qCorpMail) {
                    setField('refCorreoElectronicoImss', $qCorpMail);
                }

                // Fecha de ingreso: tanto fecIngresoImssAux como fecIngresoImss
                var dateAux = document.querySelector('input[formcontrolname="fecIngresoImssAux"]') ||
                              document.querySelector('input[placeholder*="dd/mm/aaaa" i]');
                if (dateAux) {
                    var parts = ($qDate).split('-'); // YYYY-MM-DD -> DD/MM/YYYY para Aux
                    var auxVal = parts.length === 3 ? (parts[2] + '/' + parts[1] + '/' + parts[0]) : $qDate;
                    setField('fecIngresoImssAux', auxVal);
                }
                setField('fecIngresoImss', $qDate);

                // Contraseñas
                var rP1 = setField('cveContrasena', $qPass);
                var rP2 = setField('cveContrasenaRepit', $qPassR);

                return JSON.stringify({
                    ok: rCurp && rRfc && rNss && rTel && rMail && rP1 && rP2,
                    curp: rCurp,
                    rfc: rRfc,
                    nss: rNss,
                    tel: rTel,
                    mail: rMail,
                    pass: rP1 && rP2
                });
            } catch(e) {
                return JSON.stringify({ ok: false, error: String(e && e.message || e) });
            }
        })()
        """.trimIndent()
    }

    /**
     * Localiza y hace clic en el botón de envío del formulario de registro.
     */
    val CLICK_SUBMIT_JS = """
        (function() {
            function n(s) { return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); }
            var btns = Array.from(document.querySelectorAll('button.primary, button[type="submit"], button'));
            var btn = btns.find(function(b) {
                var t = n(b.textContent);
                return t === 'continuar' || t === 'registrar' || t === 'enviar';
            });
            if (!btn) return JSON.stringify({ ok: false, reason: 'BUTTON_NOT_FOUND' });
            if (btn.disabled) return JSON.stringify({ ok: false, reason: 'BUTTON_DISABLED' });
            btn.click();
            return JSON.stringify({ ok: true });
        })()
    """.trimIndent()

    /**
     * Comprueba si apareció el diálogo del código de verificación (o modal "Confirma tu cuenta").
     */
    val CHECK_CODE_DIALOG_READY_JS = """
        (function() {
            // Caso A: Modal de confirmación informativa ("Confirma tu cuenta" -> requiere click en "Confirmar cuenta")
            var confirmBtn = Array.from(document.querySelectorAll('button')).find(function(b) {
                var t = (b.innerText || '').toLowerCase();
                return t.indexOf('confirmar cuenta') >= 0;
            });
            if (confirmBtn) {
                confirmBtn.click();
            }

            // Caso B: El diálogo de entrada del código (app-verification-code) ya está visible
            var codeComp = document.querySelector('app-verification-code');
            var codeInput = document.querySelector('app-verification-code input') ||
                            document.querySelector('input[placeholder*="código" i]') ||
                            document.querySelector('input[placeholder*="codigo" i]');
            if (codeComp || codeInput) {
                return JSON.stringify({ ready: true });
            }

            // Caso C: Error en pantalla
            var errors = document.querySelectorAll('mat-error, .alert-danger, [role="alert"]');
            for (var i = 0; i < errors.length; i++) {
                var err = errors[i];
                var et = (err.innerText || '').trim();
                if (et && et.length > 3) {
                    return JSON.stringify({ ready: false, error: et });
                }
            }

            return JSON.stringify({ ready: false });
        })()
    """.trimIndent()

    /**
     * Inyecta el código de 5 dígitos en el diálogo y pulsa Confirmar.
     */
    fun submitVerificationCodeJs(code: String): String {
        val qCode = JSONObject.quote(code.trim())
        return """
        (function() {
            try {
                var el = document.querySelector('app-verification-code input') ||
                         document.querySelector('input[placeholder*="código" i]') ||
                         document.querySelector('input[placeholder*="codigo" i]');
                if (!el) return JSON.stringify({ ok: false, reason: 'INPUT_CODE_NOT_FOUND' });

                var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
                if (d && d.set) {
                    el.focus();
                    d.set.call(el, $qCode);
                    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: $qCode }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.blur();
                } else {
                    el.value = $qCode;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }

                // Buscar botón confirmar en el modal
                setTimeout(function() {
                    var btns = Array.from(document.querySelectorAll('app-verification-code button, mat-dialog-actions button, button.primary'));
                    var confirmBtn = btns.find(function(b) {
                        var t = (b.innerText || '').trim().toLowerCase();
                        return t === 'confirmar' || t === 'validar' || t === 'continuar';
                    });
                    if (confirmBtn) {
                        confirmBtn.click();
                    }
                }, 300);

                return JSON.stringify({ ok: true });
            } catch(e) {
                return JSON.stringify({ ok: false, error: String(e && e.message || e) });
            }
        })()
        """.trimIndent()
    }

    /**
     * Comprueba si el código fue validado con éxito ("Cuenta registrada" / status 200)
     * o si el portal reportó error de código incorrecto (299).
     */
    val CHECK_CODE_VERIFICATION_RESULT_JS = """
        (function() {
            var dialogs = document.querySelectorAll('.mat-dialog-container, [role="dialog"], mat-dialog-container');
            for (var i = 0; i < dialogs.length; i++) {
                var txt = (dialogs[i].innerText || '').toLowerCase();
                if (txt.indexOf('cuenta registrada') >= 0 || txt.indexOf('registró con éxito') >= 0 || txt.indexOf('registro con exito') >= 0) {
                    return JSON.stringify({ status: 'SUCCESS' });
                }
            }

            // Buscar error de no coincide
            var codeError = document.querySelector('app-verification-code mat-error') ||
                            document.querySelector('mat-error');
            if (codeError) {
                var et = (codeError.innerText || '').trim();
                if (et.indexOf('no coincide') >= 0 || et.indexOf('incorrecto') >= 0) {
                    return JSON.stringify({ status: 'INVALID_CODE', message: et });
                }
            }

            return JSON.stringify({ status: 'PENDING' });
        })()
    """.trimIndent()

    /**
     * Hace clic en el botón de reenviar código dentro del modal de verificación.
     */
    val CLICK_RESEND_CODE_JS = """
        (function() {
            var links = Array.from(document.querySelectorAll('app-verification-code a, app-verification-code button'));
            var resend = links.find(function(el) {
                var t = (el.innerText || '').toLowerCase();
                return t.indexOf('reenviar') >= 0;
            });
            if (resend) {
                resend.click();
                return JSON.stringify({ ok: true });
            }
            return JSON.stringify({ ok: false, reason: 'RESEND_LINK_NOT_FOUND' });
        })()
    """.trimIndent()
}
