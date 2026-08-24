/**
 * Preview de casting: genera una muestra por personaje oficial
 * con el MISMO texto para comparar identidad vocal (referencias actuales).
 */
import fs from "node:fs";
import path from "node:path";
import { ChatterboxEngine, pythonBin, sentenceAwareChunk, cleanTtsText, CHATTERBOX_MODEL_ID } from "@la-veinte/tts-core";
import { createHash } from "node:crypto";

const REPO = path.resolve(__dirname, "../../../..");
const STATE = path.join(REPO, "data", "tts");
const PYTHON = pythonBin(STATE);
const ENGINE = path.join(REPO, "packages", "tts-core", "engine", "chatterbox_engine.py");
const REF_DIR = path.join(STATE, "ref");
const OUT_DIR = path.join(STATE, "casting");

const TEST_TEXT_V2 =
  "Bienvenidos a La Veinte Radio. Hoy vamos a explicar de manera sencilla un tema que genera muchas dudas entre los trabajadores del IMSS.";

const BUILTIN_IDENTITY_SHA = createHash("sha256").update("chatterbox:builtin-multilingual").digest("hex");

const refs: Record<string, { file: string; profileId: string; sourceId: string; sourceLabel: string; sourceType: string }> = {
  A: {
    file: "(builtin)",
    profileId: "EDUARDO",
    sourceId: "chatterbox:builtin-multilingual",
    sourceLabel: "Chatterbox Multilingual — voz integrada",
    sourceType: "builtin",
  },
  B: {
    file: "mariana.wav",
    profileId: "ANDREA",
    sourceId: "piper:rhasspy/es_MX-claude-high",
    sourceLabel: "Piper es_MX Claude High",
    sourceType: "synthetic",
  },
  N: {
    file: "narrador.wav",
    profileId: "ALONSO",
    sourceId: "piper:rhasspy/es_MX-ald-medium:narrator-serious",
    sourceLabel: "Piper es_MX Ald Medium",
    sourceType: "synthetic",
  },
  C: {
    file: "rodrigo.wav",
    profileId: "RODRIGO",
    sourceId: "piper:rhasspy/es_ES-davefx-medium:correspondent",
    sourceLabel: "Piper es_ES DaveFX Medium",
    sourceType: "synthetic",
  },
  P: {
    file: "valeria.wav",
    profileId: "VALERIA",
    sourceId: "piper:rhasspy/es_AR-daniela-high:commercial",
    sourceLabel: "Piper es_AR Daniela High",
    sourceType: "synthetic",
  },
};

function sha(p: string): string {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const engine = new ChatterboxEngine(PYTHON, ENGINE, STATE);
  await engine.start();
  const warmup = await engine.warmup();
  console.log("warmup:", warmup.ok);
  if (!warmup.ok) process.exit(2);

  const report: Record<string, unknown> = {};
  for (const [slot, r] of Object.entries(refs)) {
    const refSha = r.file === "(builtin)" ? BUILTIN_IDENTITY_SHA : sha(path.join(REF_DIR, r.file));
    const outFile = path.join(OUT_DIR, `voice-test-${r.profileId.toLowerCase()}-v2.wav`);
    const r2 = await engine.generate(TEST_TEXT_V2, slot, {
      voiceProfileId: r.profileId,
      referenceAudioSha256: refSha,
      voiceSourceId: r.sourceId,
      modelRevision: "t3_es_mx_latam",
    });
    if (r2.ok && r2.path) {
      fs.copyFileSync(r2.path, outFile);
      report[r.profileId] = {
        slot,
        voiceSourceId: r.sourceId,
        voiceSourceType: r.sourceType,
        voiceSourceLabel: r.sourceLabel,
        referencePath: r.file === "(builtin)" ? "(builtin — voz integrada de Chatterbox)" : path.join(REF_DIR, r.file),
        referenceAudioSha256: refSha,
        voiceProfileId: r.profileId,
        wav: outFile,
        durSec: r2.dur_s,
        genSec: r2.gen_s,
        fromCache: r2.fromCache,
      };
      console.log(`${r.profileId}: ${outFile} (${r2.dur_s}s)`);
    } else {
      report[r.profileId] = { error: r2.error };
      console.log(`${r.profileId}: ERROR ${r2.error}`);
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, "casting-preview-v2-report.json"), JSON.stringify(report, null, 2));
  await engine.shutdown();
  console.log("reporte:", path.join(OUT_DIR, "casting-preview-v2-report.json"));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
