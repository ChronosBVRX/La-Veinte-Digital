import fs from "node:fs";
import path from "node:path";
import { QwenEngine } from "@la-veinte/tts-core";
import { detectHardware, readGpuSnapshot } from "@la-veinte/tts-core";

const REPO = process.cwd();
const STATE = path.join(REPO, "data", "tts");

const TARGETS_DEFAULT = [
  { label: "30s", durSec: 30 },
  { label: "90s", durSec: 90 },
];

function buildTargets(): Array<{ label: string; durSec: number }> {
  const arg = Number(process.argv[2]);
  if (Number.isFinite(arg) && arg > 0) {
    return [{ label: `${arg}s`, durSec: arg }];
  }
  return TARGETS_DEFAULT;
}

const TARGETS = buildTargets();

const SENTENCES = [
  "El tiempo extraordinario se considera cuando el trabajo excede los límites de la jornada diaria.",
  "La autorización del tiempo extra debe registrarse conforme al procedimiento institucional.",
  "El pago de las horas extra se cubre con un cien por ciento más del salario correspondiente.",
  "Las guardias y los turnos especiales tienen reglas distintas que conviene conocer.",
  "El descanso semanal es un derecho que debe respetarse en cualquier jornada.",
  "El biométrico registra la asistencia y la puntualidad de cada trabajador.",
  "Los retardos injustificados pueden generar descuentos, pero siempre con fundamento.",
  "El Contrato Colectivo de Trabajo protege nuestros derechos laborales desde el primer día.",
  "La Comisión Mixta revisa las plantillas y las categorías en cada unidad.",
  "El escalafón ordena las promociones conforme a la antigüedad y la capacidad.",
];

interface BlockMetric {
  i: number;
  text: string;
  voice: string;
  gen_s: number | null;
  dur_s: number | null;
  rtf: number | null;
  vramUsedMb: number | null;
  tempC: number | null;
  ok: boolean;
  error?: string;
}

async function main() {
  fs.mkdirSync(path.join(STATE, "benchmark"), { recursive: true });
  const hw = await detectHardware(true);
  console.log(JSON.stringify({ hw }, null, 2));

  const engine = new QwenEngine(REPO, "", STATE);

  const t0 = Date.now();
  await engine.start();
  const warmup = await engine.warmup();
  console.log(JSON.stringify({ warmup, elapsedStartupMs: Date.now() - t0 }));

  if (!warmup.ok) {
    console.error("warmup falló:", warmup.error);
    await engine.shutdown();
    process.exit(2);
  }

  const blocks: BlockMetric[] = [];
  let totalDur = 0;
  let totalGen = 0;
  let peakVram = 0;
  let peakTemp = 0;
  let errors = 0;
  let targetIdx = 0;
  const targetResults: Array<Record<string, unknown>> = [];
  const MAX_BLOCKS = TARGETS[TARGETS.length - 1].durSec >= 600 ? 1200 : 600;
  const RUN_TOKEN = `[r${Date.now().toString(36).slice(-5)}]`;

  let i = 0;
  while (totalDur < TARGETS[TARGETS.length - 1].durSec && i < MAX_BLOCKS) {
    const sentence = SENTENCES[i % SENTENCES.length];
    const text = `${sentence} ${RUN_TOKEN}`;
    const voice = i % 2 === 0 ? "A" : "B";
    const g = await readGpuSnapshot();
    peakVram = Math.max(peakVram, g.vramUsedMb ?? 0);
    peakTemp = Math.max(peakTemp, g.tempC ?? 0);

    const tGen = Date.now();
    const r = await engine.generate(text, voice, { seed: i });
    const genMs = Date.now() - tGen;

    const metric: BlockMetric = {
      i, text: sentence, voice,
      gen_s: r.ok ? genMs / 1000 : null,
      dur_s: r.dur_s ?? null,
      rtf: r.ok && r.dur_s ? (genMs / 1000) / r.dur_s : null,
      vramUsedMb: g.vramUsedMb, tempC: g.tempC, ok: r.ok, error: r.error,
    };
    blocks.push(metric);
    if (r.ok && r.dur_s) {
      totalDur += r.dur_s;
      totalGen += genMs / 1000;
    } else {
      errors++;
    }

    while (targetIdx < TARGETS.length && totalDur >= TARGETS[targetIdx].durSec) {
      const measuredAudioDur = Math.round(totalDur);
      const rtfMeasured = measuredAudioDur > 0 ? totalGen / measuredAudioDur : null;
      const perBlockMeanRtf = blocks.filter((b) => b.rtf != null && b.ok).reduce((a, b) => a + (b.rtf ?? 0), 0) /
        Math.max(1, blocks.filter((b) => b.rtf != null && b.ok).length);
      targetResults.push({
        target: TARGETS[targetIdx].label,
        blocks: blocks.length,
        measuredAudioDurSec: measuredAudioDur,
        targetAudioDurSec: TARGETS[targetIdx].durSec,
        genTimeSec: Math.round(totalGen),
        rtf: rtfMeasured != null ? Number(rtfMeasured.toFixed(3)) : null,
        perBlockMeanRtf: Number(perBlockMeanRtf.toFixed(3)),
        peakVramMb: peakVram,
        peakTempC: peakTemp,
        errors,
        elapsedMin: Number(((Date.now() - t0) / 60000).toFixed(1)),
      });
      console.log(JSON.stringify(targetResults[targetResults.length - 1]));
      targetIdx++;
    }
    i++;
    if (i % 10 === 0) {
      console.log(`bloque ${i}: dur acum ${Math.round(totalDur)}s, RTF acumulado ${(totalGen / Math.max(totalDur, 0.1)).toFixed(2)}`);
    }
  }

  const okBlocks = blocks.filter((b) => b.ok);
  const first5 = okBlocks.slice(0, 5);
  const last5 = okBlocks.slice(-5);
  const rtfOf = (arr: BlockMetric[]) => arr.reduce((a, b) => a + (b.rtf ?? 0), 0) / Math.max(1, arr.length);
  const cumulativeRtf = totalDur > 0 ? totalGen / totalDur : 0;
  const perBlockMeanRtf = rtfOf(okBlocks.filter((b) => b.rtf != null));
  const conservativeRtf = Math.max(perBlockMeanRtf, cumulativeRtf);

  const report = {
    provider: "qwen-base-clone",
    model: "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    device: "cuda",
    hardware: hw,
    warmup,
    targets: targetResults,
    totalBlocks: blocks.length,
    errors,
    cumulativeRtf: Number(cumulativeRtf.toFixed(3)),
    perBlockMeanRtf: Number(perBlockMeanRtf.toFixed(3)),
    peakVramMb: peakVram,
    peakTempC: peakTemp,
    rtfFirst5: Number(rtfOf(first5).toFixed(3)),
    rtfLast5: Number(rtfOf(last5).toFixed(3)),
    throttlingSuspect: rtfOf(last5) > rtfOf(first5) * 1.25,
    estimates: {
      "10min": Math.round(10 * conservativeRtf),
      "30min": Math.round(30 * conservativeRtf),
      "45min": Math.round(45 * conservativeRtf),
      "60min": Math.round(60 * conservativeRtf),
    },
    estimatesBasis: `RTF conservador ${conservativeRtf.toFixed(2)} = máx(media por bloque ${perBlockMeanRtf.toFixed(2)}, acumulado ${cumulativeRtf.toFixed(2)}); duraciones de audio MEDIDAS de los WAV`,
    conservativeRtf: Number(conservativeRtf.toFixed(3)),
  };

  const out = path.join(STATE, "benchmark", "benchmark-report.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(STATE, "benchmark", "blocks.jsonl"),
    blocks.map((b) => JSON.stringify(b)).join("\n")
  );
  console.log("report:", out);
  console.log(JSON.stringify({ summary: report.targets[report.targets.length - 1], cumulativeRtf: report.cumulativeRtf, perBlockMeanRtf: report.perBlockMeanRtf, throttlingSuspect: report.throttlingSuspect }));

  await engine.shutdown();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
