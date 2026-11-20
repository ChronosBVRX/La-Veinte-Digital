import { BrowserWindow, WebContents } from 'electron';
import { SecurityVault, TuPerfilCredentials } from '../vault';
import { DocumentManager } from '../documents';

export interface BiometricRowRecord {
  fecha: string;
  tipo: string; // 'ENTRADA' | 'SALIDA' | 'OTRO'
  hora: string;
  checador?: string;
  estatus?: string;
  raw?: string;
}

export interface BiometricQueryResult {
  ok: boolean;
  records?: BiometricRowRecord[];
  summary?: {
    total: number;
    entradas: number;
    salidas: number;
    retardos: number;
    omisiones: number;
  };
  error?: string;
}

export class ImssTuPerfilController {
  private vault: SecurityVault;
  private docManager: DocumentManager;
  private workerWebContents: WebContents | null = null;
  private hiddenWindow: BrowserWindow | null = null;

  public static readonly LOGIN_URL = 'https://tuperfil.imss.gob.mx/guitpei-web/login';
  public static readonly BIOMETRIC_URL = 'https://tuperfil.imss.gob.mx/guitpei-web/#/app/administration/biometric/consult-period';

  constructor(vault: SecurityVault, docManager: DocumentManager) {
    this.vault = vault;
    this.docManager = docManager;
  }

  public attach(webContents: WebContents): void {
    this.workerWebContents = webContents;
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
   * Ejecuta la consulta de checadas en segundo plano
   */
  public async executeBackgroundConsultation(
    creds: TuPerfilCredentials,
    onProgress?: (step: string) => void
  ): Promise<BiometricQueryResult> {
    const wc = await this.getWebContents();

    try {
      if (onProgress) onProgress('Conectando a Tu Perfil IMSS (tuperfil.imss.gob.mx)...');

      // 1. Cargar login
      await wc.loadURL(ImssTuPerfilController.LOGIN_URL);
      await this.sleep(2500);

      if (onProgress) onProgress('Ingresando usuario y contraseña...');

      // 2. Inyectar credenciales
      const loginScript = `
        (function() {
          try {
            var userInputs = Array.from(document.querySelectorAll('input')).filter(function(i) {
              return i.type === 'text' || (i.getAttribute('formcontrolname') && i.getAttribute('formcontrolname').toLowerCase().indexOf('user') >= 0);
            });
            var passInputs = Array.from(document.querySelectorAll('input[type="password"]'));
            var submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(function(b) {
              return b.innerText && (b.innerText.toLowerCase().indexOf('iniciar') >= 0 || b.innerText.toLowerCase().indexOf('entrar') >= 0);
            });

            if (userInputs.length && passInputs.length) {
              function setVal(elem, val) {
                elem.value = val;
                elem.dispatchEvent(new Event('input', { bubbles: true }));
                elem.dispatchEvent(new Event('change', { bubbles: true }));
                elem.dispatchEvent(new Event('blur', { bubbles: true }));
              }
              setVal(userInputs[0], "${creds.matricula}");
              setVal(passInputs[0], "${creds.password}");

              if (submitBtn) {
                submitBtn.click();
                return { ok: true };
              }
            }
            return { ok: false, reason: 'inputs_not_found' };
          } catch(e) {
            return { ok: false, error: e.toString() };
          }
        })();
      `;

      await wc.executeJavaScript(loginScript);
      await this.sleep(3000);

      if (onProgress) onProgress('Accediendo a la sección de registros biométricos...');

      // 3. Navegar a checadas
      await wc.loadURL(ImssTuPerfilController.BIOMETRIC_URL);
      await this.sleep(3500);

      // Esperar que Angular renderice la vista o pulsar Consultar
      const triggerConsultScript = `
        (function() {
          try {
            var btn = Array.from(document.querySelectorAll('button')).find(function(b) {
              return b.innerText && b.innerText.toLowerCase().indexOf('consultar') >= 0;
            });
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          } catch(e) { return false; }
        })();
      `;

      await wc.executeJavaScript(triggerConsultScript);
      await this.sleep(2500);

      if (onProgress) onProgress('Extrayendo registros de entrada y salida...');

      const records = await this.extractBiometricRecords(wc);

      // Calcular resumen
      let entradas = 0;
      let salidas = 0;
      let retardos = 0;
      let omisiones = 0;

      records.forEach((r) => {
        if (r.tipo.includes('ENTRADA')) entradas++;
        if (r.tipo.includes('SALIDA')) salidas++;
        if ((r.estatus || '').toLowerCase().includes('retardo')) retardos++;
        if ((r.estatus || '').toLowerCase().includes('omision') || (r.estatus || '').toLowerCase().includes('omisión')) omisiones++;
      });

      return {
        ok: true,
        records,
        summary: {
          total: records.length,
          entradas,
          salidas,
          retardos,
          omisiones,
        },
      };
    } catch (err: any) {
      console.error('[TuPerfil Error]', err);
      return { ok: false, error: err.message || 'Error consultando registros biométricos.' };
    }
  }

  public async extractBiometricRecords(wc: WebContents): Promise<BiometricRowRecord[]> {
    const extractScript = `
      (function() {
        try {
          var rows = Array.from(document.querySelectorAll('mat-row, tr.mat-row, tr')).filter(function(r) {
            return r.querySelectorAll('td, mat-cell').length >= 2;
          });

          var records = [];
          rows.forEach(function(r) {
            var cells = Array.from(r.querySelectorAll('td, mat-cell')).map(function(c) {
              return c.innerText.trim();
            });

            if (cells.length >= 2) {
              var col1 = cells[0] || '';
              var col2 = cells[1] || '';
              var col3 = (cells[2] || '').toUpperCase();
              var col4 = cells[3] || '';
              var col5 = cells[4] || 'NORMAL';

              records.push({
                fecha: col1,
                hora: col2,
                tipo: col3.indexOf('SALIDA') >= 0 ? 'SALIDA' : 'ENTRADA',
                checador: col4,
                estatus: col5,
                raw: cells.join(' | ')
              });
            }
          });
          return records;
        } catch(e) {
          return [];
        }
      })();
    `;

    try {
      const results = (await wc.executeJavaScript(extractScript)) as BiometricRowRecord[];
      if (results && results.length > 0) {
        this.saveBiometricSnapshot(results);
      }
      return results || [];
    } catch (err) {
      return [];
    }
  }

  private saveBiometricSnapshot(records: BiometricRowRecord[]): void {
    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const filename = `Checadas_IMSS_${dateStr}_${Date.now().toString().slice(-4)}.json`;
      const jsonContent = JSON.stringify(
        {
          timestamp: Date.now(),
          fechaConsulta: new Date().toISOString(),
          totalRegistros: records.length,
          registros: records,
        },
        null,
        2
      );
      const base64Data = Buffer.from(jsonContent, 'utf8').toString('base64');
      this.docManager.save(base64Data, filename, 'BIOMETRICO', 'application/json');
    } catch (err) {}
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
