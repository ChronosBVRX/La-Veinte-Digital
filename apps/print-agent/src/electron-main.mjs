import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  safeStorage,
  nativeImage,
  clipboard,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { printPdfSilently, getInstalledPrinters } from "./spooler.mjs";
import { generateTestPagePdf } from "./test-print.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_VERSION = "1.0.0";
const DEFAULT_SERVER_URL = "https://la20.com.mx";
const HEARTBEAT_INTERVAL_MS = 20000;
const POLL_INTERVAL_MS = 12000;

// Directorio de almacenamiento seguro en AppData
const APPDATA_DIR = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const DATA_DIR = path.join(APPDATA_DIR, "LaVeintePrintAgent");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const CREDENTIAL_FILE = path.join(DATA_DIR, "station.dat");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ------------------------------------------------------------
// 1. Cifrado Nativo Windows DPAPI vía Electron safeStorage
// ------------------------------------------------------------
function saveCredentialsLocally({ serverUrl, token, printerName, stationName, delegationId }) {
  ensureDataDir();

  let encryptedB64 = "";
  if (safeStorage.isEncryptionAvailable()) {
    encryptedB64 = safeStorage.encryptString(token).toString("base64");
  } else {
    encryptedB64 = Buffer.from(token, "utf8").toString("base64");
  }
  fs.writeFileSync(CREDENTIAL_FILE, encryptedB64, "utf8");

  const config = {
    serverUrl: (serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, ""),
    printerName: printerName || "",
    stationName: stationName || "Oficina Sindical Delegación XXI",
    delegationId: delegationId || "",
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

function loadCredentialsLocally() {
  if (!fs.existsSync(CONFIG_FILE) || !fs.existsSync(CREDENTIAL_FILE)) {
    return null;
  }

  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    const encryptedB64 = fs.readFileSync(CREDENTIAL_FILE, "utf8").trim();

    let token = "";
    if (safeStorage.isEncryptionAvailable()) {
      token = safeStorage.decryptString(Buffer.from(encryptedB64, "base64"));
    } else {
      token = Buffer.from(encryptedB64, "base64").toString("utf8");
    }

    return {
      serverUrl: cfg.serverUrl || DEFAULT_SERVER_URL,
      printerName: cfg.printerName || "",
      stationName: cfg.stationName || "Oficina Sindical",
      delegationId: cfg.delegationId || "",
      token,
    };
  } catch {
    return null;
  }
}

function wipeCredentialsLocally() {
  try {
    if (fs.existsSync(CREDENTIAL_FILE)) fs.unlinkSync(CREDENTIAL_FILE);
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
  } catch {
    // Ignorar errores de borrado
  }
}

// ------------------------------------------------------------
// 2. Control de Instancia Única y Variables Globales
// ------------------------------------------------------------
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow = null;
let tray = null;
let isQuitting = false;
let heartbeatTimer = null;
let pollTimer = null;
let isProcessingQueue = false;
let isOnline = false;
let lastHeartbeatTime = null;
let lastPrintError = null;
let activeCreds = null;

// Configurar inicio automático con Windows
try {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: ["--hidden"],
  });
} catch {
  // Ignorar en entornos de desarrollo donde execPath es el binario de electron
}

// ------------------------------------------------------------
// 3. Ventana Principal y Bandeja del Sistema (Tray)
// ------------------------------------------------------------
function getAssetPath(...relative) {
  return path.join(__dirname, "..", "assets", ...relative);
}

function getAppIcon() {
  const icoPath = getAssetPath("icon.ico");
  const pngPath = getAssetPath("icon.png");
  if (fs.existsSync(icoPath)) return nativeImage.createFromPath(icoPath);
  if (fs.existsSync(pngPath)) return nativeImage.createFromPath(pngPath);
  return null;
}

function createMainWindow(startHidden = false) {
  const icon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 600,
    height: 720,
    minWidth: 480,
    minHeight: 600,
    icon: icon || undefined,
    show: !startHidden,
    autoHideMenuBar: true,
    frame: true,
    title: "La Veinte Print · Oficina Sindical",
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const rendererPath = path.join(__dirname, "renderer", "index.html");
  mainWindow.loadFile(rendererPath);

  // Al cerrar la ventana, ocultarla a la bandeja si ya está configurado
  mainWindow.on("close", (e) => {
    if (!isQuitting && activeCreds) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const statusText = isOnline ? "● Conectado (En línea)" : "○ Desconectado";
  const printerText = activeCreds?.printerName
    ? `Impresora: ${activeCreds.printerName}`
    : "Impresora: (Predeterminada de Windows)";
  const stationTitle = activeCreds?.stationName || "Oficina Sindical";

  const contextMenu = Menu.buildFromTemplate([
    { label: `La Veinte Print v${APP_VERSION}`, enabled: false },
    { label: stationTitle, enabled: false },
    { type: "separator" },
    { label: statusText, enabled: false },
    { label: printerText, enabled: false },
    { type: "separator" },
    {
      label: "Abrir ventana principal...",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow(false);
        }
      },
    },
    {
      label: "Imprimir página de prueba",
      enabled: Boolean(activeCreds),
      click: async () => {
        await executeTestPrint();
      },
    },
    {
      label: "Copiar diagnóstico al portapapeles",
      click: () => {
        copyDiagnosticsToClipboard();
      },
    },
    { type: "separator" },
    {
      label: "Desvincular esta estación...",
      enabled: Boolean(activeCreds),
      click: () => {
        handleDisconnect();
      },
    },
    {
      label: "Salir de La Veinte Print",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip(`La Veinte Print — ${stationTitle} (${statusText})`);
  tray.setContextMenu(contextMenu);
}

function createTray() {
  const icon = getAppIcon();
  tray = new Tray(icon || nativeImage.createEmpty());

  tray.on("double-click", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow(false);
    }
  });

  updateTrayMenu();
}

// ------------------------------------------------------------
// 4. Motor de Comunicación con La Veinte Digital
// ------------------------------------------------------------
async function apiRequest(endpoint, options = {}) {
  if (!activeCreds || !activeCreds.token) {
    throw new Error("No hay credenciales activas.");
  }

  const url = `${activeCreds.serverUrl}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    "x-station-token": activeCreds.token,
    ...(options.headers || {}),
  };

  return fetch(url, { ...options, headers });
}

async function sendHeartbeat() {
  if (!activeCreds) return false;

  try {
    const res = await apiRequest("/api/union/print-agent/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        printer_name: activeCreds.printerName || "",
        agent_version: APP_VERSION,
      }),
    });

    if (res.ok) {
      isOnline = true;
      lastHeartbeatTime = new Date().toISOString();
      updateTrayMenu();
      notifyRendererStatus();
      return true;
    } else {
      isOnline = false;
      updateTrayMenu();
      notifyRendererStatus();
      return false;
    }
  } catch {
    isOnline = false;
    updateTrayMenu();
    notifyRendererStatus();
    return false;
  }
}

async function processQueue() {
  if (!activeCreds || !isOnline || isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const res = await apiRequest("/api/union/print-agent/pending-jobs");
    if (!res.ok) return;

    const data = await res.json();
    const jobs = data.jobs || [];
    if (jobs.length === 0) return;

    for (const job of jobs) {
      // 1. Reclamar atómicamente
      const claimRes = await apiRequest("/api/union/print-agent/claim", {
        method: "POST",
        body: JSON.stringify({ job_id: job.id }),
      });

      if (!claimRes.ok) continue;
      const claimData = await claimRes.json();
      if (!claimData.claimed) continue;

      notifyRendererJob({ id: job.id, folio: job.folio, status: "claimed" });

      // 2. Descargar documento
      const docRes = await apiRequest(`/api/union/print-agent/jobs/${job.id}/document`);
      if (!docRes.ok) {
        await reportJobStatus(job.id, "failed", "DOWNLOAD_ERROR", "Fallo al descargar el archivo PDF.");
        continue;
      }

      const docArrayBuffer = await docRes.arrayBuffer();
      const docBuffer = Buffer.from(docArrayBuffer);
      const serverSha = docRes.headers.get("x-document-sha256");

      // 3. Verificar integridad
      if (serverSha) {
        const computedSha = crypto.createHash("sha256").update(docBuffer).digest("hex");
        if (computedSha.toLowerCase() !== serverSha.toLowerCase()) {
          await reportJobStatus(job.id, "failed", "INTEGRITY_MISMATCH", "Checksum de seguridad no coincide.");
          continue;
        }
      }

      // 4. Marcar imprimiendo
      await reportJobStatus(job.id, "printing");
      notifyRendererJob({ id: job.id, folio: job.folio, status: "printing" });

      // 5. Imprimir silenciosamente
      try {
        await printPdfSilently(docBuffer, {
          printerName: activeCreds.printerName,
          copies: job.copies || 1,
          duplex: job.duplex || false,
        });

        await reportJobStatus(job.id, "printed");
        notifyRendererJob({ id: job.id, folio: job.folio, status: "printed" });
        lastPrintError = null;
      } catch (err) {
        lastPrintError = err.message;
        await reportJobStatus(job.id, "failed", "PRINT_FAILED", err.message);
        notifyRendererJob({ id: job.id, folio: job.folio, status: "failed", error: err.message });
      }
    }
  } catch (err) {
    // Error en el ciclo de cola
  } finally {
    isProcessingQueue = false;
  }
}

async function reportJobStatus(jobId, status, errorCode, errorMessage) {
  try {
    await apiRequest(`/api/union/print-agent/jobs/${jobId}/status`, {
      method: "POST",
      body: JSON.stringify({
        status,
        error_code: errorCode,
        error_message: errorMessage,
      }),
    });
  } catch {
    // Ignorar fallo al reportar estado
  }
}

function startBackgroundLoops() {
  stopBackgroundLoops();
  void sendHeartbeat();
  void processQueue();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  pollTimer = setInterval(processQueue, POLL_INTERVAL_MS);
}

function stopBackgroundLoops() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (pollTimer) clearInterval(pollTimer);
  heartbeatTimer = null;
  pollTimer = null;
  isOnline = false;
  updateTrayMenu();
}

function notifyRendererStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status-update", {
      isOnline,
      lastHeartbeatTime,
      stationName: activeCreds?.stationName || "",
      printerName: activeCreds?.printerName || "",
    });
  }
}

function notifyRendererJob(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("job-update", data);
  }
}

async function executeTestPrint() {
  try {
    const pdfBuf = await generateTestPagePdf({
      stationName: activeCreds?.stationName || "Oficina Sindical Delegación XXI",
      printerName: activeCreds?.printerName || "",
      serverUrl: activeCreds?.serverUrl || DEFAULT_SERVER_URL,
    });

    await printPdfSilently(pdfBuf, {
      printerName: activeCreds?.printerName,
      copies: 1,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function copyDiagnosticsToClipboard() {
  const diag = [
    `=== DIAGNÓSTICO LA VEINTE PRINT AGENT ===`,
    `Versión del agente: ${APP_VERSION}`,
    `Fecha y hora local: ${new Date().toISOString()}`,
    `Sistema Operativo: ${os.type()} ${os.release()} (${os.arch()})`,
    `Nombre del equipo: ${os.hostname()}`,
    `Estado de conexión: ${isOnline ? "CONECTADO" : "DESCONECTADO"}`,
    `Último latido: ${lastHeartbeatTime || "Ninguno"}`,
    `Servidor: ${activeCreds?.serverUrl || "No configurado"}`,
    `Estación: ${activeCreds?.stationName || "No vinculada"}`,
    `Impresora configurada: ${activeCreds?.printerName || "(Predeterminada de Windows)"}`,
    `Último error de impresión: ${lastPrintError || "Ninguno"}`,
    `DPAPI disponible: ${safeStorage.isEncryptionAvailable() ? "SÍ" : "NO"}`,
    `========================================`,
  ].join("\n");

  clipboard.writeText(diag);
}

function handleDisconnect() {
  stopBackgroundLoops();
  wipeCredentialsLocally();
  activeCreds = null;
  updateTrayMenu();

  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("status-update", {
      isOnline: false,
      stationName: "",
      printerName: "",
      isDisconnected: true,
    });
  } else {
    createMainWindow(false);
  }
}

// ------------------------------------------------------------
// 5. Manejadores de IPC (Renderer ↔ Main)
// ------------------------------------------------------------
ipcMain.handle("get-initial-state", async () => {
  const printers = await getInstalledPrinters();
  return {
    isPaired: Boolean(activeCreds),
    stationName: activeCreds?.stationName || "",
    printerName: activeCreds?.printerName || "",
    serverUrl: activeCreds?.serverUrl || DEFAULT_SERVER_URL,
    isOnline,
    installedPrinters: printers,
    version: APP_VERSION,
  };
});

ipcMain.handle("enroll-with-code", async (_event, { code, serverUrl }) => {
  const targetUrl = (serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, "");

  try {
    const res = await fetch(`${targetUrl}/api/union/print-agent/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        hostname: os.hostname(),
        agent_version: APP_VERSION,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || "No se pudo vincular con el código introducido.",
      };
    }

    // Guardar credenciales de forma cifrada con DPAPI
    saveCredentialsLocally({
      serverUrl: targetUrl,
      token: data.token,
      printerName: data.printer_name || "",
      stationName: data.station_name || "Oficina Sindical Delegación XXI",
      delegationId: data.delegation_id || "",
    });

    activeCreds = loadCredentialsLocally();
    startBackgroundLoops();
    updateTrayMenu();

    return {
      success: true,
      station_name: data.station_name,
      printer_name: data.printer_name,
    };
  } catch (err) {
    return {
      success: false,
      error: `Error de red al contactar al servidor: ${err.message}`,
    };
  }
});

ipcMain.handle("get-installed-printers", async () => {
  return getInstalledPrinters();
});

ipcMain.handle("save-preferred-printer", async (_event, { printerName }) => {
  if (!activeCreds) return { success: false, error: "Estación no vinculada" };

  activeCreds.printerName = (printerName || "").trim();
  saveCredentialsLocally({
    serverUrl: activeCreds.serverUrl,
    token: activeCreds.token,
    printerName: activeCreds.printerName,
    stationName: activeCreds.stationName,
    delegationId: activeCreds.delegationId,
  });

  updateTrayMenu();
  void sendHeartbeat();
  return { success: true };
});

ipcMain.handle("run-test-print", async () => {
  return executeTestPrint();
});

ipcMain.handle("minimize-to-tray", () => {
  if (mainWindow) {
    mainWindow.hide();
  }
  return true;
});

ipcMain.handle("disconnect-station", () => {
  handleDisconnect();
  return true;
});

ipcMain.handle("copy-diagnostics", () => {
  copyDiagnosticsToClipboard();
  return true;
});

// ------------------------------------------------------------
// 6. Ciclo de Vida de la Aplicación
// ------------------------------------------------------------
app.whenReady().then(() => {
  activeCreds = loadCredentialsLocally();

  const isHiddenLaunch = process.argv.includes("--hidden");
  const shouldStartHidden = isHiddenLaunch && Boolean(activeCreds);

  createTray();
  createMainWindow(shouldStartHidden);

  if (activeCreds) {
    startBackgroundLoops();
  }
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  stopBackgroundLoops();
});

app.on("window-all-closed", () => {
  // En Windows se mantiene vivo en segundo plano en la bandeja si está configurado
  if (!activeCreds) {
    app.quit();
  }
});
