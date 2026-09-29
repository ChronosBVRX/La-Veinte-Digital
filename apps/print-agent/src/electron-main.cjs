/* eslint-disable @typescript-eslint/no-require-imports */
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  safeStorage,
  nativeImage,
  clipboard,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { execFile } = require("child_process");
const { promisify } = require("util");
const ptp = require("pdf-to-printer");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

const execFileAsync = promisify(execFile);
const printerLib = ptp.default || ptp;

// Compatibilidad con equipos Windows 7 / GPUs antiguas de oficina sin drivers DirectX modernos
app.disableHardwareAcceleration();

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
// Cliente HTTP/HTTPS nativo compatible con Windows 7/8/10/11
// ------------------------------------------------------------
function httpRequest(urlString, options = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error("Demasiadas redirecciones HTTP."));
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(urlString);
    } catch (err) {
      reject(err);
      return;
    }

    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;
    const method = options.method || "GET";
    const headers = { ...(options.headers || {}) };
    const bodyBuffer = options.body
      ? Buffer.isBuffer(options.body)
        ? options.body
        : Buffer.from(String(options.body), "utf8")
      : null;

    if (bodyBuffer && !headers["Content-Length"] && !headers["content-length"]) {
      headers["Content-Length"] = String(bodyBuffer.length);
    }

    const req = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method,
        headers,
        timeout: 25000,
      },
      (res) => {
        const status = res.statusCode || 0;
        const location = res.headers.location;

        if ([301, 302, 303, 307, 308].includes(status) && location) {
          res.resume();
          const nextUrl = new URL(location, parsedUrl).toString();
          const nextMethod = status === 303 ? "GET" : method;
          const nextBody = status === 303 ? undefined : options.body;
          httpRequest(
            nextUrl,
            { ...options, method: nextMethod, body: nextBody },
            redirectCount + 1
          ).then(resolve, reject);
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const responseHeaders = res.headers || {};
          resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
              get(name) {
                const key = String(name || "").toLowerCase();
                const val = responseHeaders[key];
                return Array.isArray(val) ? val[0] : val || null;
              },
            },
            async json() {
              return JSON.parse(buffer.toString("utf8"));
            },
            async text() {
              return buffer.toString("utf8");
            },
            async arrayBuffer() {
              return buffer;
            },
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Tiempo de espera agotado al conectar con el servidor."));
    });
    req.on("error", (err) => reject(err));

    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

// ------------------------------------------------------------
// Spooler de impresión compatible con Windows 7, 8, 10 y 11
// ------------------------------------------------------------
async function getInstalledPrinters() {
  try {
    const printers = await printerLib.getPrinters();
    const list = printers
      .map((p) => (typeof p === "string" ? p : p.name || p.deviceId))
      .filter(Boolean);
    if (list.length > 0) {
      return list;
    }
  } catch (err) {
    console.warn("Aviso al listar con pdf-to-printer:", err.message);
  }

  // Fallback 1: WMIC (presente en Windows 7, 8 y 10 de 32 y 64 bits)
  try {
    const { stdout } = await execFileAsync("wmic", ["printer", "get", "Name"], {
      windowsHide: true,
    });
    const list = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && line.toLowerCase() !== "name");
    if (list.length > 0) {
      return list;
    }
  } catch {
    // Continuar al siguiente fallback
  }

  // Fallback 2: PowerShell 2.0+ Get-WmiObject (compatible con Windows 7)
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-WmiObject Win32_Printer | Select-Object -ExpandProperty Name",
      ],
      { windowsHide: true }
    );
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function printPdfSilently(pdfBuffer, options = {}) {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(
    tempDir,
    `la20-job-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
  );

  fs.writeFileSync(tempFilePath, pdfBuffer);

  try {
    const printer =
      options.printerName && options.printerName.trim()
        ? options.printerName.trim()
        : undefined;
    const copies = options.copies && options.copies > 0 ? options.copies : 1;

    const printOptions = {
      printer,
      paperSize: "Letter",
      copies,
      silent: true,
      ...(options.duplex ? { side: "duplex" } : {}),
    };

    await printerLib.print(tempFilePath, printOptions);
    return { success: true };
  } catch (err) {
    throw new Error(
      `Fallo de impresión en Windows: ${err.message || "Error desconocido en el spooler"}`
    );
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {
      // Ignorar error al limpiar archivo temporal
    }
  }
}

async function generateTestPagePdf({
  stationName = "Oficina Sindical",
  printerName = "Impresora predeterminada",
  serverUrl = "https://la20.com.mx",
} = {}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const primaryBlue = rgb(37 / 255, 99 / 255, 235 / 255);
  const darkText = rgb(15 / 255, 23 / 255, 42 / 255);
  const mutedText = rgb(100 / 255, 116 / 255, 139 / 255);
  const greenText = rgb(22 / 255, 163 / 255, 74 / 255);
  const lightBg = rgb(248 / 255, 250 / 255, 252 / 255);
  const borderColor = rgb(226 / 255, 232 / 255, 240 / 255);

  page.drawRectangle({
    x: 40,
    y: 710,
    width: 532,
    height: 48,
    color: primaryBlue,
  });

  page.drawText("LA VEINTE DIGITAL · REPRESENTACIÓN SINDICAL", {
    x: 55,
    y: 728,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("PÁGINA DE PRUEBA DE IMPRESIÓN AUTOMÁTICA", {
    x: 40,
    y: 670,
    size: 16,
    font: fontBold,
    color: darkText,
  });

  page.drawText(
    "Esta página confirma que la estación de oficina está configurada y lista para operar.",
    {
      x: 40,
      y: 650,
      size: 10,
      font: fontRegular,
      color: mutedText,
    }
  );

  page.drawRectangle({
    x: 40,
    y: 460,
    width: 532,
    height: 165,
    color: lightBg,
    borderColor,
    borderWidth: 1,
  });

  page.drawText("DATOS DE CONFIGURACIÓN", {
    x: 55,
    y: 595,
    size: 11,
    font: fontBold,
    color: primaryBlue,
  });

  const now = new Date();
  const fechaStr = now.toISOString().replace("T", " ").slice(0, 19);

  const rows = [
    { label: "Estación de Oficina:", value: stationName },
    { label: "Impresora Windows:", value: printerName || "(Predeterminada de Windows)" },
    { label: "Servidor Conectado:", value: serverUrl },
    { label: "Fecha y hora de prueba:", value: fechaStr },
    { label: "Estado del Spooler:", value: "ACTIVO Y OPERATIVO" },
  ];

  let currentY = 570;
  for (const row of rows) {
    page.drawText(row.label, {
      x: 55,
      y: currentY,
      size: 9,
      font: fontBold,
      color: darkText,
    });
    page.drawText(row.value, {
      x: 200,
      y: currentY,
      size: 9,
      font: fontRegular,
      color: row.label.includes("Estado") ? greenText : darkText,
    });
    currentY -= 22;
  }

  page.drawRectangle({
    x: 40,
    y: 330,
    width: 532,
    height: 105,
    color: rgb(240 / 255, 253 / 255, 244 / 255),
    borderColor: rgb(187 / 255, 247 / 255, 208 / 255),
    borderWidth: 1,
  });

  page.drawText("✓ COMUNICACIÓN Y SPOOLER VERIFICADOS", {
    x: 55,
    y: 405,
    size: 11,
    font: fontBold,
    color: greenText,
  });

  const instructions = [
    "• Cuando un representante sindical pulse 'MANDAR A IMPRIMIR' desde el portal,",
    "  el paquete de licencias saldrá automáticamente por esta misma bandeja.",
    "• No es necesario tener ninguna ventana abierta en la PC.",
    "• La Veinte Print permanecerá activo silenciosamente junto al reloj de Windows.",
  ];

  let instY = 385;
  for (const line of instructions) {
    page.drawText(line, {
      x: 55,
      y: instY,
      size: 8.5,
      font: fontRegular,
      color: darkText,
    });
    instY -= 16;
  }

  page.drawLine({
    start: { x: 40, y: 70 },
    end: { x: 572, y: 70 },
    thickness: 0.5,
    color: borderColor,
  });

  page.drawText(
    "La Veinte Digital · Sistema Oficial de Representación Sindical · Sección XX IMSS",
    {
      x: 40,
      y: 55,
      size: 8,
      font: fontRegular,
      color: mutedText,
    }
  );

  page.drawText(
    `Impresión 100% silenciosa en Windows vía La Veinte Print Agent v${APP_VERSION}`,
    {
      x: 40,
      y: 42,
      size: 7.5,
      font: fontRegular,
      color: mutedText,
    }
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
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
  // Ignorar en entornos de desarrollo
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
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const rendererPath = path.join(__dirname, "renderer", "index.html");
  mainWindow.loadFile(rendererPath);

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

  return httpRequest(url, { ...options, headers });
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
      const claimRes = await apiRequest("/api/union/print-agent/claim", {
        method: "POST",
        body: JSON.stringify({ job_id: job.id }),
      });

      if (!claimRes.ok) continue;
      const claimData = await claimRes.json();
      if (!claimData.claimed) continue;

      notifyRendererJob({ id: job.id, folio: job.folio, status: "claimed" });

      const docRes = await apiRequest(`/api/union/print-agent/jobs/${job.id}/document`);
      if (!docRes.ok) {
        await reportJobStatus(job.id, "failed", "DOWNLOAD_ERROR", "Fallo al descargar el archivo PDF.");
        continue;
      }

      const docArrayBuffer = await docRes.arrayBuffer();
      const docBuffer = Buffer.isBuffer(docArrayBuffer)
        ? docArrayBuffer
        : Buffer.from(docArrayBuffer);
      const serverSha = docRes.headers.get("x-document-sha256");

      if (serverSha) {
        const computedSha = crypto.createHash("sha256").update(docBuffer).digest("hex");
        if (computedSha.toLowerCase() !== serverSha.toLowerCase()) {
          await reportJobStatus(job.id, "failed", "INTEGRITY_MISMATCH", "Checksum de seguridad no coincide.");
          continue;
        }
      }

      await reportJobStatus(job.id, "printing");
      notifyRendererJob({ id: job.id, folio: job.folio, status: "printing" });

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
  } catch {
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
    const res = await httpRequest(`${targetUrl}/api/union/print-agent/enroll`, {
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
  if (!activeCreds) {
    app.quit();
  }
});
