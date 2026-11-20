import { contextBridge, ipcRenderer } from 'electron';

/**
 * Puente JavaScript idéntico al inyectado en Android por LaVeinteBridgeInjector.kt.
 * Permite que la aplicación web de La 20 Digital reconozca que se está ejecutando
 * dentro del cliente nativo de escritorio y active todas las funciones de
 * Tarjetón oficial, Biométricos y Documentos guardados sin ningún cambio en el código web.
 */
const laVeinteAppBridge = {
  __isInjected: true,
  appPlatform: () => 'desktop',
  appVersion: () => '1.0.0',
  sdkVersion: () => 1,
  packageName: () => 'com.laveintedigital.desktop',
  isNativeApp: () => true,

  hasBiometrics: async () => false,
  isBiometricsEnabled: async () => false,
  promptBiometricEnrollment: () => {},
  disableBiometrics: () => {},

  // Navegación nativa entre módulos
  openOfficialPayslips: () => {
    ipcRenderer.send('app:switch-tab', 'tarjeton');
  },
  openBiometrics: (mode: string = 'hub') => {
    ipcRenderer.send('app:switch-tab', 'biometricos', mode);
  },
  openSavedDocuments: () => {
    ipcRenderer.send('app:switch-tab', 'documentos');
  },
  openExternal: (url: string) => {
    ipcRenderer.send('app:open-external-url', url);
  },

  // Gestión de Documentos y Tarjetones Guardados en la memoria USB
  listNativeDocuments: async () => {
    return await ipcRenderer.invoke('docs:list');
  },
  readNativeDocument: async (localPath: string) => {
    return await ipcRenderer.invoke('docs:read', localPath);
  },
  deleteNativeDocument: async (localPath: string) => {
    return await ipcRenderer.invoke('docs:delete', localPath);
  },
  deleteNativeDocumentById: async (documentId: string, expectedLocalPath?: string) => {
    return await ipcRenderer.invoke('docs:delete-by-id', documentId, expectedLocalPath);
  },
  saveBlobToDownloads: async (base64Data: string, filename: string, mimeType?: string) => {
    const res = await ipcRenderer.invoke('docs:save', base64Data, filename, mimeType);
    return Boolean(res);
  },

  // Consulta de Credenciales IMSS guardadas en la Bóveda con PIN
  hasImssCredentials: async (portalId: string) => {
    return await ipcRenderer.invoke('vault:has-credentials', portalId);
  },

  log: (msg: string) => {
    console.log('[LaVeinte Desktop] ' + msg);
  },
  checkForUpdate: () => {},
  getFcmToken: async () => ({ token: '' }),
  scanDocument: async () => ({ ok: false, reason: 'scanner_not_available_on_desktop' }),
  getPendingPrintDoc: async () => null,
  clearPendingPrintDoc: () => {},
  syncAgendaReminders: async () => ({ ok: true }),
  share: (title: string, text: string) => {
    ipcRenderer.send('app:share', { title, text });
  },
  shareNativeDocument: async (localPath: string) => {
    await ipcRenderer.invoke('docs:open', localPath);
  },
};

// Exponer en el contexto global de la ventana
try {
  contextBridge.exposeInMainWorld('LaVeinteApp', laVeinteAppBridge);
} catch (e) {
  (window as any).LaVeinteApp = laVeinteAppBridge;
}

// API de control para la interfaz del Shell (Pestañas, PIN, Barra de Navegación, Automatizaciones)
const desktopShellApi = {
  // Bóveda y PIN
  isVaultConfigured: () => ipcRenderer.invoke('vault:is-configured'),
  isVaultLocked: () => ipcRenderer.invoke('vault:is-locked'),
  setupPin: (pin: string) => ipcRenderer.invoke('vault:setup-pin', pin),
  unlock: (pin: string) => ipcRenderer.invoke('vault:unlock', pin),
  lock: () => ipcRenderer.invoke('vault:lock'),
  changePin: (oldPin: string, newPin: string) => ipcRenderer.invoke('vault:change-pin', oldPin, newPin),

  // Credenciales IMSS
  saveCredentials: (portal: string, creds: any) => ipcRenderer.invoke('vault:save-credentials', portal, creds),
  getCredentials: (portal: string) => ipcRenderer.invoke('vault:get-credentials', portal),
  removeCredentials: (portal: string) => ipcRenderer.invoke('vault:remove-credentials', portal),

  // Pestañas y Navegación
  switchTab: (tabId: string, url?: string) => ipcRenderer.send('app:switch-tab', tabId, url),
  navigateUrl: (url: string) => ipcRenderer.send('app:navigate-url', url),
  navigateBack: () => ipcRenderer.send('app:navigate-back'),
  navigateForward: () => ipcRenderer.send('app:navigate-forward'),
  reloadPage: () => ipcRenderer.send('app:reload-page'),

  // Documentos en USB
  listDocuments: (source?: string) => ipcRenderer.invoke('docs:list', source),
  openDocument: (localPath: string) => ipcRenderer.invoke('docs:open', localPath),
  deleteDocumentById: (id: string, path?: string) => ipcRenderer.invoke('docs:delete-by-id', id, path),

  // Automatizaciones de Fondo (Completamente invisibles para el usuario)
  executeTarjetonDownload: (creds?: any) => ipcRenderer.invoke('imss:tarjeton-execute-download', creds),
  executeTuPerfilConsult: (creds?: any) => ipcRenderer.invoke('imss:tuperfil-execute-consult', creds),

  onTarjetonProgress: (cb: (step: string) => void) => {
    ipcRenderer.on('imss:tarjeton-progress', (_e, step) => cb(step));
  },
  onTuPerfilProgress: (cb: (step: string) => void) => {
    ipcRenderer.on('imss:tuperfil-progress', (_e, step) => cb(step));
  },

  // Eventos emitidos desde el proceso principal
  onTabChanged: (cb: (tabId: string) => void) => {
    ipcRenderer.on('shell:tab-changed', (_e, tabId) => cb(tabId));
  },
  onUrlChanged: (cb: (url: string) => void) => {
    ipcRenderer.on('shell:url-changed', (_e, url) => cb(url));
  },
  onTarjetonCaptured: (cb: (doc: any) => void) => {
    ipcRenderer.on('tarjeton-captured', (_e, doc) => cb(doc));
  },
  onLockStateChanged: (cb: (locked: boolean) => void) => {
    ipcRenderer.on('shell:lock-state-changed', (_e, locked) => cb(locked));
  },
};

try {
  contextBridge.exposeInMainWorld('DesktopShell', desktopShellApi);
} catch (e) {
  (window as any).DesktopShell = desktopShellApi;
}
