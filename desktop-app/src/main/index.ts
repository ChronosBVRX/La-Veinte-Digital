import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path from 'path';
import { initializePortablePaths, PortablePaths } from './paths';
import { SecurityVault } from './vault';
import { DocumentManager } from './documents';
import { ImssTarjetonController } from './automation/imss-tarjeton';
import { ImssTuPerfilController } from './automation/imss-tuperfil';

let mainWindow: BrowserWindow | null = null;
let paths: PortablePaths;
let vault: SecurityVault;
let docManager: DocumentManager;
let tarjetonController: ImssTarjetonController;
let tuPerfilController: ImssTuPerfilController;

// URL de producción oficial de La 20 Digital
const DEFAULT_LVD_URL = process.env.LVD_URL || 'https://la20.com.mx';

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  const rendererHtmlPath = path.join(__dirname, '../renderer/index.html');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'La 20 Digital — Edición Portable',
    backgroundColor: '#161F32',
    webPreferences: {
      preload: preloadPath,
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(rendererHtmlPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupNetworkSecurityRules() {
  // Eliminar cabeceras que bloquean iframes en pestañas libres
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    for (const key of Object.keys(responseHeaders)) {
      if (key.toLowerCase() === 'x-frame-options') {
        delete responseHeaders[key];
      }
      if (key.toLowerCase() === 'content-security-policy') {
        const val = responseHeaders[key];
        if (Array.isArray(val)) {
          responseHeaders[key] = val.map((h) =>
            h.replace(/frame-ancestors\s+[^;]+;?/gi, '')
          );
        }
      }
    }
    callback({ responseHeaders });
  });

  // Interceptar la creación de webviews para conectar controladores de automatización
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      const url = contents.getURL();

      if (url.includes('rh.imss.gob.mx')) {
        tarjetonController.attach(contents);
      } else if (url.includes('tuperfil.imss.gob.mx')) {
        tuPerfilController.attach(contents);
      }

      contents.on('did-navigate', (_e, newUrl) => {
        if (newUrl.includes('rh.imss.gob.mx')) {
          tarjetonController.attach(contents);
        } else if (newUrl.includes('tuperfil.imss.gob.mx')) {
          tuPerfilController.attach(contents);
        }
        if (mainWindow) {
          mainWindow.webContents.send('shell:url-changed', newUrl);
        }
      });
    }
  });
}

function registerIpcHandlers() {
  // === BÓVEDA Y SEGURIDAD (PIN) ===
  ipcMain.handle('vault:is-configured', () => vault.isConfigured());
  ipcMain.handle('vault:is-locked', () => vault.isLocked());

  ipcMain.handle('vault:setup-pin', (_e, pin: string) => {
    try {
      const ok = vault.setupPin(pin);
      if (mainWindow) mainWindow.webContents.send('shell:lock-state-changed', false);
      return { ok };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Error al configurar PIN' };
    }
  });

  ipcMain.handle('vault:unlock', (_e, pin: string) => {
    const ok = vault.unlock(pin);
    if (ok && mainWindow) {
      mainWindow.webContents.send('shell:lock-state-changed', false);
    }
    return ok;
  });

  ipcMain.handle('vault:lock', () => {
    vault.lock();
    if (mainWindow) {
      mainWindow.webContents.send('shell:lock-state-changed', true);
    }
    return true;
  });

  ipcMain.handle('vault:change-pin', (_e, oldPin: string, newPin: string) => {
    try {
      const ok = vault.changePin(oldPin, newPin);
      return { ok };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  });

  ipcMain.handle('vault:has-credentials', (_e, portalId: string) => {
    const portal = portalId === 'tu_perfil' ? 'tuperfil' : 'tarjeton';
    return vault.hasCredentials(portal);
  });

  ipcMain.handle('vault:get-credentials', (_e, portal: 'tarjeton' | 'tuperfil') => {
    return vault.getCredentials(portal);
  });

  ipcMain.handle('vault:save-credentials', (_e, portal: 'tarjeton' | 'tuperfil', creds: any) => {
    try {
      vault.saveCredentials(portal, creds);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  });

  ipcMain.handle('vault:remove-credentials', (_e, portal: 'tarjeton' | 'tuperfil') => {
    try {
      vault.removeCredentials(portal);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  });

  // === DOCUMENTOS EN MEMORIA USB ===
  ipcMain.handle('docs:list', (_e, source?: string) => {
    return docManager.list(source);
  });

  ipcMain.handle('docs:read', (_e, localPath: string) => {
    return docManager.read(localPath);
  });

  ipcMain.handle('docs:save', (_e, base64: string, filename: string, mime?: string) => {
    return docManager.save(base64, filename, 'ESCRITO', mime || 'application/pdf');
  });

  ipcMain.handle('docs:delete', (_e, localPath: string) => {
    return docManager.delete(localPath);
  });

  ipcMain.handle('docs:delete-by-id', (_e, id: string, expectedPath?: string) => {
    return docManager.deleteById(id, expectedPath);
  });

  ipcMain.handle('docs:open', async (_e, localPath: string) => {
    return await docManager.open(localPath);
  });

  // === CONTROL DE NAVEGACIÓN Y PESTAÑAS ===
  ipcMain.on('app:switch-tab', (_e, tabId: string, url?: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('shell:tab-changed', tabId, url);
    }
  });

  ipcMain.on('app:open-external-url', (_e, url: string) => {
    shell.openExternal(url);
  });

  // === AUTOMATIZACIONES DE FONDO ===
  ipcMain.handle('imss:tarjeton-execute-download', async (_e, credsOverride?: any) => {
    const creds = credsOverride || vault.getCredentials('tarjeton');
    if (!creds || !creds.matricula || !creds.password) {
      return { ok: false, error: 'Por favor ingresa tu matrícula y contraseña de Tarjetón.' };
    }
    return await tarjetonController.executeBackgroundDownload(creds, (step) => {
      if (mainWindow) mainWindow.webContents.send('imss:tarjeton-progress', step);
    });
  });

  ipcMain.handle('imss:tuperfil-execute-consult', async (_e, credsOverride?: any) => {
    const creds = credsOverride || vault.getCredentials('tuperfil');
    if (!creds || !creds.matricula || !creds.password) {
      return { ok: false, error: 'Por favor ingresa tu matrícula y contraseña de Tu Perfil.' };
    }
    return await tuPerfilController.executeBackgroundConsultation(creds, (step) => {
      if (mainWindow) mainWindow.webContents.send('imss:tuperfil-progress', step);
    });
  });
}

// Inicialización de la aplicación
app.whenReady().then(() => {
  paths = initializePortablePaths();
  vault = new SecurityVault(paths.securityDir);
  docManager = new DocumentManager(paths);
  tarjetonController = new ImssTarjetonController(vault, docManager);
  tuPerfilController = new ImssTuPerfilController(vault, docManager);

  setupNetworkSecurityRules();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
