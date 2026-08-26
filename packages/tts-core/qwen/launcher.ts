#!/usr/bin/env node
/**
 * launcher.ts — ÚNICA puerta de entrada a producción Qwen.
 * UN TURNO = UN PROCESO CONTENIDO POR EL WATCHDOG EXTERNO.
 *
 * render.py es desechable; si Qwen se cuelga, el launcher mata el process group.
 * renderTurn(turn) es la única API de producción.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execSync } from "node:child_process";
import crypto from "node:crypto";

const REPO = path.resolve(import.meta.dirname, "..", "..", "..");
const RENDER_PY = path.join(REPO, "packages", "tts-core", "qwen", "render.py");
const QWEN_PYTHON = process.env.QWEN_PYTHON || path.join(REPO, ".venv-qwen-voice-design", "bin", "python");
const VOICES_ROOT = path.join(REPO, "data", "tts", "voices");

const QWEN_FULL_TIMEOUT_MS = 180_000; // 180s por intento completo
const QWEN_CLAUSE_TIMEOUT_MS = 120_000; // 120s por cláusula
const GPU_LOCK = path.join(REPO, "data", "tts", "gpu.lock");

const [guionPath, outDir] = process.argv.slice(2);
if (!guionPath || !outDir) {
  console.error("uso: node qwen-launcher.ts <guion.json> <out_dir>");
  process.exit(1);
}
const guion = JSON.parse(fs.readFileSync(guionPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const VOICES = (() => {
  const map = {};
  for (const spk of ["EDUARDO", "ANDREA", "JAVIER", "RODRIGO"]) {
    const d = path.join(VOICES_ROOT, spk.toLowerCase(), "v1");
    const ref = path.join(d, "reference.wav");
    const txt = path.join(d, "reference.txt");
    if (fs.existsSync(ref) && fs.existsSync(txt)) {
      const meta = fs.existsSync(path.join(d, "metadata.json"))
        ? JSON.parse(fs.readFileSync(path.join(d, "metadata.json"), "utf8")) as Record<string, string>
        : {};
      map[spk] = {
        speaker: spk,
        version: meta.version || `${spk.toLowerCase()}-v1`,
        ref_audio: ref,
        ref_text: fs.readFileSync(txt, "utf8").trim(),
        sha256: meta.sha256 || "",
      };
    }
  }
  return map;
})();

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

function mapSpeaker(speaker) {
  return speaker === "NARRADOR" ? "JAVIER" : speaker;
}

function cacheKey(turn, voice) {
  return crypto
    .createHash("sha256")
    .update([
      "qwen-base",
      voice.version,
      voice.sha256 || "",
      crypto.createHash("sha256").update(turn.text).digest("hex"),
      JSON.stringify({ language: "Spanish", non_streaming_mode: true }),
    ].join("|"))
    .digest("hex")
    .slice(0, 16);
}

function turnIsPass(turnId) {
  const wav = path.join(outDir, `${turnId}.wav`);
  const meta = path.join(outDir, `${turnId}.json`);
  if (!fs.existsSync(wav) || !fs.existsSync(meta)) return false;
  if (fs.statSync(wav).size < 5000) return false;
  try {
    const m = JSON.parse(fs.readFileSync(meta, "utf8"));
    if (m.status === "PASS") return true;
    if (m.qa === "PASS") return true; // legacy qwen JSON
    return false;
  } catch {
    return false;
  }
}

// ── GPU lock (adquirir/liberar en finally) ──
function acquireLock() {
  fs.mkdirSync(path.dirname(GPU_LOCK), { recursive: true });
  fs.writeFileSync(GPU_LOCK, String(process.pid));
}
function releaseLock() {
  try {
    if (fs.existsSync(GPU_LOCK) && fs.readFileSync(GPU_LOCK, "utf8").trim() === String(process.pid)) {
      fs.unlinkSync(GPU_LOCK);
    }
  } catch {}
}

/**
 * Ejecuta render.py en process group propio con timeout externo.
 * Retorna { status: 'PASS'|'QA_FAIL'|'TIMEOUT'|'CRASH', pid, elapsedMs, meta? }.
 */
function runQwen(speaker, text, seed, outBase, timeoutMs) {
  return new Promise((resolve) => {
    // limpiar tmp viejos
    const tmpWav = outBase + ".tmp.wav";
    const tmpMeta = outBase + ".tmp.wav.meta.json";
    for (const p of [tmpWav, tmpMeta]) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    const child = spawn(QWEN_PYTHON, [
      RENDER_PY,
      "--speaker", speaker,
      "--text", text,
      "--seed", String(seed),
      "--output", tmpWav,
    ], {
      detached: true, // process group propio -> kill(-pid) mata TODO
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTORCH_CUDA_ALLOC_CONF: "expandable_segments:True" },
    });
    const pid = child.pid;
    child.unref();

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    const t0 = Date.now();

    const killGroup = (sig) => {
      try { process.kill(-pid, sig); } catch {}
    };

    const timer = setTimeout(() => {
      log(`${speaker} QWEN_HARD_TIMEOUT pid=${pid} elapsed=${Date.now() - t0}ms`);
      killGroup("SIGTERM");
      setTimeout(() => {
        try {
          // reap
          execSync(`ps -p ${pid} >/dev/null 2>&1 && kill -KILL -${pid} 2>/dev/null || true`);
        } catch {}
        resolve({ status: "TIMEOUT", pid, elapsedMs: Date.now() - t0 });
      }, 2000);
    }, timeoutMs);

    child.on("exit", (code) => {
      clearTimeout(timer);
      const elapsed = Date.now() - t0;
      log(`${speaker} exit=${code} elapsed=${elapsed}ms`);
      if (code === 0 && fs.existsSync(tmpWav)) {
        let meta = {};
        if (fs.existsSync(tmpMeta)) {
          try { meta = JSON.parse(fs.readFileSync(tmpMeta, "utf8")); } catch {}
        }
        if (meta.qa && meta.qa.pass !== false) {
          // rename atómico
          const finalWav = outBase + ".wav";
          fs.renameSync(tmpWav, finalWav);
          resolve({ status: "PASS", pid, elapsedMs: elapsed, meta });
        } else {
          resolve({ status: "QA_FAIL", pid, elapsedMs: elapsed, reason: meta.qa?.reason || "qa" });
        }
      } else if (code === 1) {
        resolve({ status: "QA_FAIL", pid, elapsedMs: elapsed, reason: stderr.slice(0, 120) });
      } else {
        resolve({ status: "CRASH", pid, elapsedMs: elapsed, reason: stderr.slice(0, 200), code });
      }
    });
  });
}

function splitClauses(text) {
  const parts = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if (";:.".includes(ch) && cur.trim().length > 30) {
      parts.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.length > 1 ? parts : [text];
}

function joinClauses(pieces, outBase) {
  // leer cada pieza .tmp, unir con pausas, escribir final
  const sr = 24000;
  const joined = [];
  for (let i = 0; i < pieces.length; i++) {
    if (i > 0) {
      const gapMs = (pieces[i - 1].endsWith(".") || pieces[i - 1].endsWith(" ")) ? 150 : 100;
      joined.push(Buffer.alloc(Math.floor(sr * gapMs / 1000) * 2)); // mono16 silencio
    }
    const p = pieces[i];
    const a = fs.readFileSync(p);
    joined.push(a);
  }
  const buf = Buffer.concat(joined);
  // escribir como WAV PCM16 24k mono via python tmp (re-usar soundfile) — simplificar: renombrar última
  return buf;
}

async function renderTurn(turn) {
  const speaker = mapSpeaker(turn.speaker);
  const tid = turn.id;
  if (turnIsPass(tid)) {
    log(`${tid} CACHE_REUSE`);
    return "PASS";
  }
  const voice = VOICES[speaker];
  if (!voice) {
    log(`${tid} VOICE_REFERENCE_INVALID:${speaker}`);
    writeManifest(tid, speaker, "HUMAN_REVIEW_REQUIRED", "VOICE_REFERENCE_INVALID");
    return "HUMAN_REVIEW_REQUIRED";
  }

  const outBase = path.join(outDir, tid);
  const seed1 = Math.abs(1 + tid.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 0)) % 100000;

  // ATTEMPT 1 full
  log(`${tid} ATTEMPT_1 START`);
  const a1 = await runQwen(speaker, turn.text, seed1, outBase, QWEN_FULL_TIMEOUT_MS);
  log(`${tid} ATTEMPT_1 ${a1.status} ${a1.elapsedMs}ms`);
  if (a1.status === "PASS") {
    writeManifest(tid, speaker, "PASS", a1.meta, { attempt: 1, mode: "full", seed: seed1 });
    log(`${tid} ACCEPT (full)`);
    return "PASS";
  }

  // ATTEMPT 2 full (seed distinto), nuevo proceso
  log(`${tid} ATTEMPT_2 START`);
  const a2 = await runQwen(speaker, turn.text, seed1 + 1000, outBase, QWEN_FULL_TIMEOUT_MS);
  log(`${tid} ATTEMPT_2 ${a2.status} ${a2.elapsedMs}ms`);
  if (a2.status === "PASS") {
    writeManifest(tid, speaker, "PASS", a2.meta, { attempt: 2, mode: "full", seed: seed1 + 1000 });
    log(`${tid} ACCEPT (full)`);
    return "PASS";
  }

  // CLAUSE MODE — cada cláusula en su propio proceso desechable
  const clauses = splitClauses(turn.text);
  log(`${tid} CLAUSE_MODE (${clauses.length} cláusulas)`);
  const parts = [];
  let failReason = "";
  for (let i = 0; i < clauses.length; i++) {
    const cl = clauses[i];
    const clBase = path.join(outDir, `${tid}.cl${i}`);
    const r = await runQwen(speaker, cl, seed1 + 2000 + i, clBase, QWEN_CLAUSE_TIMEOUT_MS);
    log(`${tid} CLAUSE_${i} ${r.status} ${r.elapsedMs}ms`);
    if (r.status !== "PASS") {
      failReason = `${r.status}:${r.reason || ""}`;
      break;
    }
    parts.push(clBase + ".wav");
  }

  if (parts.length === clauses.length) {
    // unir cláusulas -> final .wav
    try {
      joinAndWrite(parts, outBase + ".wav", turn.text);
      writeManifest(tid, speaker, "PASS", { mode: "clauses", segments: clauses.length }, { attempt: "clause" });
      log(`${tid} ACCEPT (clause)`);
      return "PASS";
    } catch (e) {
      failReason = "join:" + e.message;
    }
  }

  log(`${tid} HUMAN_REVIEW_REQUIRED (${failReason})`);
  writeManifest(tid, speaker, "HUMAN_REVIEW_REQUIRED", failReason);
  return "HUMAN_REVIEW_REQUIRED";
}

function joinAndWrite(clauseWavs, finalWav, text) {
  // Unir con pausas usando ffmpeg concat + silence entre segmentos
  const args = ["-y"];
  for (const w of clauseWavs) args.push("-i", w);
  const n = clauseWavs.length;
  let fc = "";
  let prev = "[0:a]";
  for (let i = 1; i < n; i++) {
    const gap = 0.12;
    fc += `[${prev}][${i}:a]concat=n=2:v=0:a=1[cf${i}]`;
    prev = `[cf${i}]`;
    if (i < n - 1) fc += ";";
  }
  if (n === 1) fc = "[0:a]acopy[out]";
  else fc += `;[${prev}]loudnorm=I=-16:TP=-1.5[out]`;
  args.push("-filter_complex", fc, "-map", "[out]", finalWav);
  execSync("ffmpeg " + args.map((a) => `"${a}"`).join(" "), { stdio: "pipe" });
}

function writeManifest(tid, speaker, status, extra = {}, info = {}) {
  const meta = {
    turnId: tid,
    speaker,
    voiceVersion: VOICES[speaker]?.version,
    engine: "qwen-base-clone",
    status,
    ...extra,
    ...info,
  };
  fs.writeFileSync(path.join(outDir, `${tid}.json`), JSON.stringify(meta, null, 2));
}

async function main() {
  log(`═══ QWEN PRODUCTION (watchdog externo 180s) ═══`);
  const required = [...new Set(guion.turns.map((t) => mapSpeaker(t.speaker)))];
  const bad = required.filter((s) => !VOICES[s]);
  if (bad.length) {
    log(`VOICE_REFERENCE_INVALID: ${bad.join(", ")}`);
    process.exit(1);
  }

  // limpiar .tmp.wav juntos
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith(".tmp.wav")) fs.unlinkSync(path.join(outDir, f));
  }

  const needsReview: string[] = [];
  for (const turn of guion.turns) {
    acquireLock();
    try {
      const r = await renderTurn(turn);
      if (r === "HUMAN_REVIEW_REQUIRED") needsReview.push(turn.id);
    } finally {
      releaseLock();
    }
  }

  const numPass = guion.turns.filter((t) => turnIsPass(t.id)).length;
  log(`\n═══ RESUMEN ═══`);
  log(`PASS: ${numPass}/${guion.turns.length}`);
  if (needsReview.length) log(`HUMAN_REVIEW_REQUIRED: ${needsReview.join(", ")}`);
  log("ALL_DONE");
}

main().catch((e) => {
  log("FATAL:" + e.message);
  process.exit(1);
});
