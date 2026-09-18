import crypto from "node:crypto";
import { loadStationCredentials } from "./security.mjs";
import { printPdfSilently, getInstalledPrinters } from "./spooler.mjs";

const AGENT_VERSION = "1.0.0";
const HEARTBEAT_INTERVAL_MS = 20000;
const POLL_INTERVAL_MS = 12000;

console.log("=================================================");
console.log("       LA VEINTE PRINT AGENT — WINDOWS           ");
console.log("  Oficina Sindical · Delegación XXI · SNTSS XX   ");
console.log(`  Versión: ${AGENT_VERSION}                              `);
console.log("=================================================");

const creds = loadStationCredentials();
if (!creds) {
  console.error("\n[ERROR] No se encontraron credenciales guardadas en Windows DPAPI.");
  console.error("Por favor ejecuta primero la configuración inicial:");
  console.error("  npm run setup\n");
  process.exit(1);
}

const { serverUrl, token, printerName } = creds;
console.log(`[CONFIG] Servidor: ${serverUrl}`);
console.log(`[CONFIG] Impresora configurada: ${printerName || "(Predeterminada de Windows)"}`);

let isProcessing = false;
let stationDetails = null;

/**
 * Realiza una petición HTTP autenticada con el Station Token.
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${serverUrl}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    "x-station-token": token,
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return res;
}

/**
 * Envía el latido periódico (heartbeat) para mantener el estado "En línea".
 */
async function sendHeartbeat() {
  try {
    const res = await apiRequest("/api/union/print-agent/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        printer_name: printerName,
        agent_version: AGENT_VERSION,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[HEARTBEAT] ⚠ Fallo al reportar latido (${res.status}): ${err.error || "Rechazado"}`);
      return false;
    }

    const data = await res.json();
    if (!stationDetails) {
      stationDetails = data;
      console.log(`[ESTACIÓN] Conectado exitosamente como: "${data.station_name}"`);
    }
    return true;
  } catch (err) {
    console.warn(`[HEARTBEAT] ⚠ Sin conexión con el servidor (${err.message})`);
    return false;
  }
}

/**
 * Consulta y procesa los trabajos de impresión en cola (FIFO).
 */
async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const res = await apiRequest("/api/union/print-agent/pending-jobs");
    if (!res.ok) {
      isProcessing = false;
      return;
    }

    const data = await res.json();
    const jobs = data.jobs || [];

    if (jobs.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`[COLA] Se encontraron ${jobs.length} trabajo(s) en espera.`);

    // Procesar en orden FIFO estricto
    for (const job of jobs) {
      console.log(`[PROCESANDO] Evaluando trabajo ${job.id} (Folio: ${job.folio || "N/A"}, Rev. ${job.document_revision})...`);

      // 1. Reclamar atómicamente el trabajo
      const claimRes = await apiRequest("/api/union/print-agent/claim", {
        method: "POST",
        body: JSON.stringify({ job_id: job.id }),
      });

      if (!claimRes.ok) {
        console.warn(`[CLAIM] No se pudo reclamar trabajo ${job.id}`);
        continue;
      }

      const claimData = await claimRes.json();
      if (!claimData.claimed) {
        console.log(`[CLAIM] El trabajo ${job.id} ya no está disponible.`);
        continue;
      }

      console.log(`[CLAIM] ✓ Trabajo ${job.id} reclamado exitosamente.`);

      // 2. Descargar el documento PDF conjunto inmutable
      console.log(`[DESCARGA] Descargando documento PDF del trabajo ${job.id}...`);
      const docRes = await apiRequest(`/api/union/print-agent/jobs/${job.id}/document`);
      if (!docRes.ok) {
        const errJson = await docRes.json().catch(() => ({}));
        await reportStatus(job.id, "failed", "DOWNLOAD_ERROR", errJson.error || "Fallo al descargar documento.");
        continue;
      }

      const docArrayBuffer = await docRes.arrayBuffer();
      const docBuffer = Buffer.from(docArrayBuffer);
      const serverSha = docRes.headers.get("x-document-sha256");

      // 3. Validar integridad criptográfica (SHA-256)
      if (serverSha) {
        const computedSha = crypto.createHash("sha256").update(docBuffer).digest("hex");
        if (computedSha.toLowerCase() !== serverSha.toLowerCase()) {
          console.error(`[INTEGRIDAD] ✕ SHA-256 no coincide para trabajo ${job.id}`);
          await reportStatus(job.id, "failed", "INTEGRITY_MISMATCH", "Checksum SHA-256 corrupto.");
          continue;
        }
      }

      // 4. Marcar estado "printing"
      await reportStatus(job.id, "printing");

      // 5. Imprimir silenciosamente a la impresora de Windows
      try {
        await printPdfSilently(docBuffer, {
          printerName,
          copies: job.copies || 1,
          duplex: job.duplex || false,
        });

        // 6. Marcar estado "printed"
        await reportStatus(job.id, "printed");
        console.log(`[ÉXITO] ✓ Expediente ${job.folio || job.id} impreso correctamente.`);
      } catch (printErr) {
        console.error(`[ERROR] ✕ Fallo en la impresora para trabajo ${job.id}:`, printErr.message);
        await reportStatus(job.id, "failed", "PRINT_FAILED", printErr.message);
      }
    }
  } catch (err) {
    console.error(`[COLA] Error en el ciclo de procesamiento:`, err.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Reporta el estado de un trabajo al servidor.
 */
async function reportStatus(jobId, status, errorCode, errorMessage) {
  try {
    await apiRequest(`/api/union/print-agent/jobs/${jobId}/status`, {
      method: "POST",
      body: JSON.stringify({
        status,
        error_code: errorCode,
        error_message: errorMessage,
      }),
    });
  } catch (err) {
    console.warn(`[ESTADO] No se pudo actualizar estado de ${jobId}:`, err.message);
  }
}

// Iniciar ciclo de vida del agente
async function bootstrap() {
  console.log("\n[INICIO] Conectando con La Veinte Digital...");
  const connected = await sendHeartbeat();
  if (connected) {
    console.log("[INICIO] ✓ Estación activa. Escuchando cola de impresión...");
    void processQueue();
  } else {
    console.log("[INICIO] Reintentando conexión en el siguiente ciclo...");
  }

  // Intervalos
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  setInterval(processQueue, POLL_INTERVAL_MS);
}

bootstrap();

// Manejo seguro de señales de terminación
process.on("SIGINT", () => {
  console.log("\n[APAGADO] Deteniendo La Veinte Print Agent...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("\n[APAGADO] Deteniendo La Veinte Print Agent...");
  process.exit(0);
});
