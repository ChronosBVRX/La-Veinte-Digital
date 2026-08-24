#!/usr/bin/env node
/**
 * Casting de Javier y Rodrigo — Chatterbox builtin con seeds variados.
 * Genera WAVs de referencia para evaluar como candidatos.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const REPO = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const CASTING_DIR = path.join(REPO, "data", "tts", "casting");
const VENV_PY = path.join(REPO, "data", "tts", "venv", "bin", "python");
const ENGINE = path.join(REPO, "packages", "tts-core", "engine", "chatterbox_engine.py");

const JAVIER_SEEDS = [1001, 2002, 3003, 4004];
const RODRIGO_SEEDS = [5001, 6002, 7003];

const TEXT_COMMON = "Buenos días. Esto es La Veinte Radio. Hay algo que necesitamos aclarar: si hoy te cambian el horario por teléfono, ¿qué documento debería existir? Espera, porque ahí está el detalle. Una cosa es una indicación verbal y otra una modificación formal.";
const TEXT_JAVIER_1 = "No necesariamente. Primero hay que distinguir una indicación verbal de una modificación formal del horario; son cosas diferentes.";
const TEXT_JAVIER_2 = "Sí, ahí tienes razón. Me expliqué demasiado rápido. El punto importante no es solamente quién dio la indicación, sino qué procedimiento se siguió.";
const TEXT_RODRIGO_1 = "Revisé el procedimiento y encontré dos documentos que aquí importan mucho: la solicitud y el oficio con el que notifican la decisión.";
const TEXT_RODRIGO_2 = "Déjame agregar un dato. El procedimiento distingue entre una modificación temporal y una definitiva, y eso cambia cómo se documenta.";

function generateClip(text, seed, outPath) {
  return new Promise((resolve) => {
    const proc = spawn(VENV_PY, [ENGINE], { timeout: 120000 });
    let buffer = "";
    let resultPath = null;

    proc.stdout.on("data", (c) => {
      buffer += c.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        try {
          const j = JSON.parse(line);
          if (j.op === "result" && j.ok && j.path) resultPath = j.path;
        } catch {}
      }
    });

    proc.stderr.on("data", () => {}); // silenciar warnings
    proc.on("close", () => {
      if (resultPath && fs.existsSync(resultPath)) {
        fs.copyFileSync(resultPath, outPath);
        resolve({ ok: true });
      } else {
        resolve({ ok: false });
      }
    });

    // enviar comandos JSONL
    const cmds = [
      JSON.stringify({ op: "warmup" }),
      JSON.stringify({ op: "generate", id: "cast", text, voice: "A", seed }),
      JSON.stringify({ op: "shutdown" }),
    ];
    // dar tiempo a que el engine arranque
    setTimeout(() => {
      for (const cmd of cmds) {
        try { proc.stdin.write(cmd + "\n"); } catch {}
      }
      proc.stdin.end();
    }, 3000);
  });
}

async function main() {
  console.log("═══ VOICE CASTING ═══\n");
  const t0 = Date.now();

  // ── JAVIER ──
  const javDir = path.join(CASTING_DIR, "javier");
  fs.mkdirSync(javDir, { recursive: true });
  console.log("── JAVIER (4 candidatos, voice A builtin + seed variado) ──");

  for (let i = 0; i < JAVIER_SEEDS.length; i++) {
    const seed = JAVIER_SEEDS[i];
    const cid = `candidate-0${i + 1}`;
    const cdir = path.join(javDir, cid);
    fs.mkdirSync(cdir, { recursive: true });

    process.stdout.write(`  ${cid} seed=${seed}: common `);
    await generateClip(TEXT_COMMON, seed, path.join(cdir, "common.wav"));
    process.stdout.write("✓ correction ");
    await generateClip(TEXT_JAVIER_1, seed + 1, path.join(cdir, "correction.wav"));
    process.stdout.write("✓ normative\n");
    await generateClip(TEXT_JAVIER_2, seed + 2, path.join(cdir, "normative.wav"));

    fs.writeFileSync(path.join(cdir, "meta.json"), JSON.stringify({
      candidateId: cid, characterId: "javier",
      designPrompt: "Medium pitch Mexican male 38-48 warm analytical conversational",
      seed, model: "chatterbox-builtin-seeded", generatedAt: new Date().toISOString(), status: "candidate"
    }, null, 1));
    console.log(`  ✓ ${cid} completo`);
  }

  // ── RODRIGO ──
  const rodDir = path.join(CASTING_DIR, "rodrigo");
  fs.mkdirSync(rodDir, { recursive: true });
  console.log("\n── RODRIGO (3 candidatos) ──");

  for (let i = 0; i < RODRIGO_SEEDS.length; i++) {
    const seed = RODRIGO_SEEDS[i];
    const cid = `candidate-0${i + 1}`;
    const cdir = path.join(rodDir, cid);
    fs.mkdirSync(cdir, { recursive: true });

    process.stdout.write(`  ${cid} seed=${seed}: common `);
    await generateClip(TEXT_COMMON, seed, path.join(cdir, "common.wav"));
    process.stdout.write("✓ field_report ");
    await generateClip(TEXT_RODRIGO_1, seed + 1, path.join(cdir, "field_report.wav"));
    process.stdout.write("✓ precision\n");
    await generateClip(TEXT_RODRIGO_2, seed + 2, path.join(cdir, "precision.wav"));

    fs.writeFileSync(path.join(cdir, "meta.json"), JSON.stringify({
      candidateId: cid, characterId: "rodrigo",
      designPrompt: "Medium-high pitch Mexican male 28-38 agile practical curious",
      seed, model: "chatterbox-builtin-seeded", generatedAt: new Date().toISOString(), status: "candidate"
    }, null, 1));
    console.log(`  ✓ ${cid} completo`);
  }

  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log(`\n✓ Casting generation complete (${elapsed}s)`);
  console.log(`Directorio: ${CASTING_DIR}`);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
