import { BrowserWindow, WebContents } from 'electron';
import fs from 'fs';
import path from 'path';
import { SecurityVault, TarjetonCredentials } from '../vault';
import { DocumentManager, SavedDocumentRecord } from '../documents';

export interface TarjetonAutomationResult {
  ok: boolean;
  document?: SavedDocumentRecord;
  error?: string;
  step?: string;
}

export class ImssTarjetonController {
  private vault: SecurityVault;
  private docManager: DocumentManager;
  private workerWebContents: WebContents | null = null;
  private hiddenWindow: BrowserWindow | null = null;
  private interceptedPdfUrl: string | null = null;
  private resolvePdfCapture: ((url: string) => void) | null = null;

  public static readonly LOGIN_URL = 'https://rh.imss.gob.mx/Personal/TarjetonDigital/';

  constructor(vault: SecurityVault, docManager: DocumentManager) {
    this.vault = vault;
    this.docManager = docManager;
  }

  public attach(webContents: WebContents): void {
    this.workerWebContents = webContents;

    // Interceptar ventanas emergentes (wfrReporteTarjeton)
    webContents.setWindowOpenHandler((details) => {
      if (
        details.url.includes('wfrReporteTarjeton') ||
        details.url.toLowerCase().includes('reporte') ||
        details.url.toLowerCase().endsWith('.pdf')
      ) {
        console.log('[Tarjeton] Interceptada URL de reporte:', details.url);
        this.interceptedPdfUrl = details.url;
        if (this.resolvePdfCapture) {
          this.resolvePdfCapture(details.url);
          this.resolvePdfCapture = null;
        }
        return { action: 'deny' }; // Bloquear ventana emergente, procesar de fondo
      }
      return { action: 'allow' };
    });

    webContents.on('did-finish-load', () => {
      this.injectHookScript(webContents);
    });
  }

  public async getWebContents(): Promise<WebContents> {
    if (this.workerWebContents && !this.workerWebContents.isDestroyed()) {
      return this.workerWebContents;
    }
    if (!this.hiddenWindow || this.hiddenWindow.isDestroyed()) {
      this.hiddenWindow = new BrowserWindow({
        show: false,
        width: 1024,
        height: 768,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
        },
      });
      this.attach(this.hiddenWindow.webContents);
    }
    return this.hiddenWindow.webContents;
  }

  /**
   * Ejecuta el flujo completo de descarga automática de fondo
   */
  public async executeBackgroundDownload(
    creds: TarjetonCredentials,
    onProgress?: (step: string) => void
  ): Promise<TarjetonAutomationResult> {
    const wc = await this.getWebContents();
    this.interceptedPdfUrl = null;

    try {
      if (onProgress) onProgress('Conectando con el portal oficial rh.imss.gob.mx...');

      // 1. Cargar portal
      await wc.loadURL(ImssTarjetonController.LOGIN_URL);
      await this.sleep(2000);

      if (onProgress) onProgress('Ingresando matrícula y validando credenciales...');

      // 2. Inyectar credenciales en el iframe
      const loginScript = `
        (function() {
          try {
            var iframe = document.getElementById('ifrPaginaSecundaria');
            var doc = iframe ? (iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document)) : document;
            if (!doc) return { ok: false, reason: 'no_doc' };

            var txtMat = doc.getElementById('txtMatricula') || doc.querySelector('input[name*="Matricula"]');
            var txtPass = doc.getElementById('txtPassword') || doc.querySelector('input[type="password"]');
            var ddlDel = doc.getElementById('ddlDelegacion') || doc.querySelector('select[name*="Delegacion"]');
            var btn = doc.getElementById('btnIngresar') || doc.querySelector('input[type="submit"][value*="Ingresar"]');

            if (!txtMat || !txtPass || !btn) {
              return { ok: false, reason: 'inputs_not_found' };
            }

            txtMat.value = "${creds.matricula}";
            txtPass.value = "${creds.password}";
            if (ddlDel && "${creds.delegacion || ''}") {
              ddlDel.value = "${creds.delegacion}";
            }

            txtMat.dispatchEvent(new Event('input', { bubbles: true }));
            txtPass.dispatchEvent(new Event('input', { bubbles: true }));
            txtMat.dispatchEvent(new Event('change', { bubbles: true }));
            txtPass.dispatchEvent(new Event('change', { bubbles: true }));

            btn.click();
            return { ok: true };
          } catch(e) {
            return { ok: false, error: e.toString() };
          }
        })();
      `;

      const loginRes = await wc.executeJavaScript(loginScript);
      console.log('[Tarjeton] Resultado envío login:', loginRes);

      // Esperar navegación o postback
      await this.sleep(3000);

      if (onProgress) onProgress('Generando comprobante oficial de pago...');

      // Preparar promesa de intercepción de PDF con timeout de 20s
      const pdfPromise = new Promise<string>((resolve, reject) => {
        this.resolvePdfCapture = resolve;
        setTimeout(() => {
          if (this.interceptedPdfUrl) {
            resolve(this.interceptedPdfUrl);
          } else {
            reject(new Error('Tiempo de espera agotado al generar reporte PDF.'));
          }
        }, 20000);
      });

      // 3. Generar reporte en la página secundaria
      const generateScript = `
        (function() {
          try {
            var iframe = document.getElementById('ifrPaginaSecundaria');
            var doc = iframe ? (iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document)) : document;
            if (!doc) return false;

            // Seleccionar formato PDF
            var rdbPdf = doc.getElementById('rdbFormatoPDF') || doc.querySelector('input[value*="PDF"]');
            if (rdbPdf) {
              rdbPdf.checked = true;
              rdbPdf.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Pulsar Generar
            var btnGen = doc.getElementById('btnGenerar') || doc.querySelector('input[value*="Generar"]');
            if (btnGen) {
              btnGen.click();
              return true;
            }
            return false;
          } catch(e) {
            return false;
          }
        })();
      `;

      await wc.executeJavaScript(generateScript);

      const capturedUrl = await pdfPromise;
      if (!capturedUrl) {
        return { ok: false, error: 'No se pudo obtener el enlace del reporte.' };
      }

      if (onProgress) onProgress('Descargando archivo PDF y respaldando en USB...');

      const savedPath = await this.downloadReportPdf(capturedUrl, wc);
      if (!savedPath) {
        return { ok: false, error: 'Error al descargar el archivo PDF del servidor.' };
      }

      return {
        ok: true,
        document: savedPath,
      };
    } catch (err: any) {
      console.error('[Tarjeton Automation Error]', err);
      return { ok: false, error: err.message || 'Error durante la automatización del tarjetón.' };
    }
  }

  private async injectHookScript(webContents: WebContents): Promise<void> {
    const hook = `
      (function() {
        try {
          var iframe = document.getElementById('ifrPaginaSecundaria');
          function hookW(w) {
            if (!w || w.__LVD_OPEN_HOOKED__) return;
            w.__LVD_OPEN_HOOKED__ = true;
            var orig = w.open;
            w.open = function(url) {
              if (typeof url === 'string') {
                window.postMessage({ type: '__LVD_REPORT__', url: url }, '*');
              }
              return orig ? orig.apply(this, arguments) : null;
            };
          }
          hookW(window);
          if (iframe && iframe.contentWindow) hookW(iframe.contentWindow);
        } catch(e) {}
      })();
    `;
    try {
      await webContents.executeJavaScript(hook);
    } catch (e) {}
  }

  public async downloadReportPdf(reportUrl: string, webContents: WebContents): Promise<SavedDocumentRecord | null> {
    try {
      const currentSession = webContents.session;
      const cookies = await currentSession.cookies.get({ url: reportUrl });
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      const response = await fetch(reportUrl, {
        headers: {
          Cookie: cookieHeader,
          'User-Agent': webContents.getUserAgent(),
          Referer: webContents.getURL(),
        },
      });

      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const filename = `Tarjeton_IMSS_${dateStr}_${Date.now().toString().slice(-4)}.pdf`;

      const saved = this.docManager.save(base64Data, filename, 'TARJETON', 'application/pdf');
      return saved;
    } catch (e) {
      console.error('Error downloading PDF:', e);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
