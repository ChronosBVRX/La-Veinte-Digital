/**
 * Chatterbox Worker — proceso INDEPENDIENTE del sidecar HTTP.
 * Consume la cola persistente (job-actual.json), genera bloque por bloque,
 * confirma cada bloque a disco inmediatamente y hace checkpoints de sesión
 * por duración de voz acumulada (12-15 min) para evitar la degeneración.
 *
 * El sidecar NUNCA se bloquea: este worker puede estar ocupado horas.
 */
import path from "node:path";
import { ChatterboxEngine, pythonBin, sentenceAwareChunk, cleanTtsText } from "@la-veinte/tts-core";
import { leerJob, guardarJob } from "./job-store";

const REPO = path.resolve(__dirname, "../../../..");
const STATE = path.join(REPO, "data", "tts");
const SESSION_MAX_AUDIO_MS = Number(process.env.CHATTERBOX_SESSION_MAX_AUDIO_SEC ?? 780) * 1000;

function log(msg: string) {
  console.log(`[worker] ${msg}`);
}

async function main() {
  const job = leerJob();
  if (!job) {
    log("no hay trabajo en la cola");
    process.exit(0);
  }
  if (job.estado !== "QUEUED" && job.estado !== "RUNNING" && job.estado !== "INTERRUPTED") {
    log(`estado ${job.estado} — nada que hacer`);
    process.exit(0);
  }

  const engine = new ChatterboxEngine(
    pythonBin(STATE),
    path.join(REPO, "packages", "tts-core", "engine", "chatterbox_engine.py"),
    STATE
  );

  job.estado = "RUNNING";
  guardarJob(job);

  await engine.start();
  const warmup = await engine.warmup();
  if (!warmup.ok) {
    job.estado = "FAILED";
    job.notas.push(`warmup falló: ${warmup.error ?? "desconocido"}`);
    guardarJob(job);
    log(`warmup falló: ${warmup.error}`);
    process.exit(2);
  }

  const pendientes = job.bloques.filter((b) => b.estado === "pendiente");
  log(`arrancando: ${pendientes.length} bloques pendientes de ${job.bloques.length}`);

  for (let idx = 0; idx < job.bloques.length; idx++) {
    const fresh = leerJob();
    if (!fresh) break;
    if (fresh.cancelado) {
      fresh.estado = "PAUSED";
      guardarJob(fresh);
      log("cancelado por el usuario — PAUSED");
      process.exit(0);
    }

    const b = fresh.bloques[idx];
    if (b.estado !== "pendiente") continue;

    fresh.bloqueActual = idx;
    guardarJob(fresh);

    const locutorId = b.locutor.toUpperCase();
    const voz = fresh.voces[b.locutor]
      ?? (locutorId.includes("NARRADOR") || locutorId.includes("ALONSO") ? "N"
        : locutorId.includes("RODRIGO") || locutorId.includes("CORRESPONSAL") || locutorId.includes("REPORTERO") ? "C"
          : locutorId.includes("VALERIA") || locutorId.includes("COMERCIAL") || locutorId.includes("PATROCIN") ? "P"
            : locutorId.includes("MARIANA") || locutorId.includes("ANDREA") ? "B"
              : "A");
    const chunks = sentenceAwareChunk(cleanTtsText(b.texto), 120, 220);

    let ok = true;
    let durMs = 0;
    let genMs = 0;
    let cacheHit = false;
    const wavs: string[] = [];

    const inicio = Date.now();
    for (const c of chunks) {
      const r = await engine.generate(c, voz, {
        voiceProfileId: b.voiceProfileId,
        referenceAudioSha256: b.referenceAudioSha256,
        voiceSourceId: b.voiceSourceId,
        modelRevision: b.modelRevision,
      });
      if (!r.ok) {
        ok = false;
        b.error = r.error ?? "fallo";
        break;
      }
      if (r.fromCache) cacheHit = true;
      if (r.path) wavs.push(r.path);
      durMs += Math.round((r.dur_s ?? 0) * 1000);
    }
    genMs = Date.now() - inicio;

    if (ok && durMs > 0) {
      b.estado = "generado";
      b.audioDurMs = durMs;
      b.genMs = genMs;
      b.rtf = durMs > 0 ? Number((genMs / durMs).toFixed(3)) : null;
      b.cacheHit = cacheHit;
      b.engineRestart = false;
      b.wavPath = wavs[0] ?? null;
      if (!cacheHit) {
        fresh.vozAcumuladaMsDesdeReinicio += durMs;
      }
    } else {
      b.estado = "fallo";
    }

    // Confirmación inmediata por bloque (resumen ante caídas)
    guardarJob(fresh);

    // Checkpoint de sesión por voz acumulada: reiniciar worker-modelo.
    if (fresh.vozAcumuladaMsDesdeReinicio >= SESSION_MAX_AUDIO_MS && !cacheHit) {
      log(`checkpoint: ${Math.round(fresh.vozAcumuladaMsDesdeReinicio / 1000)}s de voz — reiniciando motor`);
      await engine.restart();
      fresh.reiniciosWorker += 1;
      fresh.vozAcumuladaMsDesdeReinicio = 0;
      guardarJob(fresh);
    }
  }

  const final = leerJob();
  if (final) {
    final.estado = final.cancelado ? "PAUSED" : "DONE";
    final.bloqueActual = final.bloques.length;
    final.notas.push(`terminado: ${final.bloques.filter((b) => b.estado === "generado").length}/${final.bloques.length} bloques generados, ${final.bloques.filter((b) => b.estado === "fallo").length} fallos`);
    guardarJob(final);
    log(final.notas[final.notas.length - 1] ?? "terminado");
  }
  await engine.shutdown();
  process.exit(0);
}

process.on("SIGTERM", () => {
  const job = leerJob();
  if (job && job.estado === "RUNNING") {
    job.estado = "INTERRUPTED";
    job.notas.push("interrumpido — RESUMABLE");
    guardarJob(job);
  }
  process.exit(0);
});
process.on("SIGINT", () => {
  const job = leerJob();
  if (job && job.estado === "RUNNING") {
    job.estado = "INTERRUPTED";
    job.notas.push("interrumpido — RESUMABLE");
    guardarJob(job);
  }
  process.exit(0);
});

main().catch((e) => {
  const job = leerJob();
  if (job) {
    job.estado = "FAILED";
    job.notas.push(String(e).slice(0, 200));
    guardarJob(job);
  }
  console.error("FATAL:", e);
  process.exit(1);
});
