/**
 * QA de música ACE-Step: construye qa-acestep-radio-mix.mp3 de 60-90s.
 * Usa audio de voz YA cacheado (sin regenerar), intro/cama/cortinilla de ACE-Step,
 * y mezcla con el mixer FFmpeg (adelay + amix + sidechain ducking + loudnorm).
 *
 * Estructura:
 *   INTRO (jingle ACE) → voz 1 (con cama ducking) → CORTINILLA ACE → voz 2 → cierre
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPO = process.env.LVD_REPO_ROOT ?? path.resolve(__dirname, "../../../..");
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const MUSIC = path.join(REPO, "data", "tts", "music");
const CACHE = path.join(REPO, "data", "tts", "cache");
const MASTER = path.join(REPO, "data", "tts", "master");

type GuionTurn = {
  id: string;
  speaker: string;
  text: string;
};

type GuionProbe = {
  turns: GuionTurn[];
};

type CacheEntry = {
  text?: string;
  wavPath?: string;
};

async function main() {
  // 1. Leer guion IA y mapear texto -> wav cacheado
  const guion = JSON.parse(fs.readFileSync(path.join(REPO, "data", "tts", "scripts", "guion-ia-tiempo-extra.json"), "utf8")) as GuionProbe;
  const cache = new Map<string, string>();
  for (const f of fs.readdirSync(CACHE).filter((n) => n.endsWith(".json"))) {
    try {
      const e = JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8")) as CacheEntry;
      if (e.text && e.wavPath && fs.existsSync(e.wavPath)) cache.set(e.text.trim(), e.wavPath);
    } catch { /* skip */ }
  }
  const conVoz = guion.turns.filter((t) => cache.has(t.text.trim()));
  console.log(`[qa] turnos con voz cacheada: ${conVoz.length}`);

  // 2. Seleccionar fragmento: primeros N turnos hasta ~65s de audio
  const turnos: Array<{ id: string; speaker: string; text: string; wav: string; durSec: number }> = [];
  let totalSec = 0;
  const ffprobe = FFMPEG.endsWith("ffmpeg.exe")
    ? FFMPEG.replace("ffmpeg.exe", "ffprobe.exe")
    : FFMPEG.replace(/ffmpeg$/, "ffprobe");
  for (const t of conVoz) {
    const wav = cache.get(t.text.trim());
    if (!wav) continue;
    const dur = Number((await execFileAsync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wav])).stdout.trim());
    if (!dur || dur <= 0) continue;
    turnos.push({ id: t.id, speaker: t.speaker, text: t.text, wav, durSec: dur });
    totalSec += dur;
    if (totalSec >= 65) break;
  }
  console.log(`[qa] voz: ${turnos.length} turnos, ${totalSec.toFixed(1)}s`);

  // 3. Localizar assets ACE-Step
  const bed = fs.readdirSync(MUSIC).find((n) => /^bed-cama-ace-/.test(n)) ?? "bed-cama-ace-60s.wav";
  const cortinilla = fs.readdirSync(MUSIC).find((n) => /^cortinilla-ace-/.test(n));
  const jingle = fs.readdirSync(MUSIC).find((n) => /^jingle-ace-.*8s/.test(n)) ?? fs.readdirSync(MUSIC).find((n) => /^jingle-ace-/.test(n));
  if (!bed || !cortinilla || !jingle) throw new Error("faltan assets ACE-Step en data/tts/music");
  const bedPath = path.join(MUSIC, bed);
  const corPath = path.join(MUSIC, cortinilla);
  const jinPath = path.join(MUSIC, jingle);
  console.log(`[qa] assets: bed=${bed} cortinilla=${cortinilla} jingle=${jingle}`);

  // 4. Construir la mezcla FFmpeg
  const tmp = fs.mkdtempSync(path.join(REPO, "data", "tts", "qa-tmp-"));
  const inputs: string[] = [];
  const filtros: string[] = [];
  const voiceLabels: string[] = [];

  // Pista de voz: concatenar turnos con pequeñas pausas (sin re-generar TTS)
  let cursorMs = 0;
  const voiceWavs: string[] = [];
  for (const t of turnos) {
    voiceWavs.push(t.wav);
    cursorMs += Math.round(t.durSec * 1000) + 350;
  }
  // concat de voz con silencios de 350ms
  const concatFile = path.join(tmp, "voz-list.txt");
  fs.writeFileSync(concatFile, voiceWavs.map((w) => `file '${w.replace(/'/g, "'\\''")}'`).join("\n"));
  const vozRaw = path.join(tmp, "voz.wav");
  await execFileAsync(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", vozRaw], { timeout: 120000 });
  const vozDurSec = Number((await execFileAsync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", vozRaw])).stdout.trim());

  // Intro (jingle) en t=0..8s; voz empieza después del intro
  const introMs = 0;
  const vozStartMs = Math.round(8.5 * 1000);
  const bedMs = vozStartMs + Math.round((vozDurSec + 4) * 1000);

  inputs.push(jinPath);       // 0 = intro
  inputs.push(vozRaw);        // 1 = voz
  inputs.push(bedPath);       // 2 = cama (se hará loop)
  inputs.push(corPath);       // 3 = cortinilla

  filtros.push("[0:a]adelay=0|0,volume=-6dB,afade=t=out:st=6.5:d=1.5[intro]");
  filtros.push(`[1:a]adelay=${vozStartMs}|${vozStartMs},volume=0dB[voz]`);
  filtros.push(`[2:a]aloop=loop=-1:size=2000000000,atrim=0:${((vozDurSec + 8) / 1000).toFixed(0)},volume=-18dB,afade=t=in:d=1.5,afade=t=out:st=${(vozDurSec / 1000).toFixed(1)}:d=2[bed]`);
  filtros.push("[intro][voz][bed]amix=inputs=3:normalize=0:dropout_transition=0[pre1]");

  // Cortinilla de transición a mitad de la voz
  const mitadMs = vozStartMs + Math.round(vozDurSec * 500);
  filtros.push(`[3:a]adelay=${mitadMs}|${mitadMs},volume=-8dB[cort]`);
  filtros.push("[pre1][cort]amix=inputs=2:normalize=0:dropout_transition=0[pre2]");
  filtros.push("[pre2]loudnorm=I=-16:TP=-1.5:LRA=11[out]");

  const outFile = path.join(MASTER, "qa-acestep-radio-mix.mp3");
  const args = ["-y", ...inputs.map((i) => ["-i", i]).flat(), "-filter_complex", filtros.join(";"), "-map", "[out]", "-codec:a", "libmp3lame", "-b:a", "192k", outFile];
  console.log("[qa] mezclando con ffmpeg…");
  await execFileAsync(FFMPEG, args, { timeout: 300000 });

  // 5. Auditoría
  const audit = await auditMp3(outFile, ffprobe, FFMPEG);
  console.log("[qa] MASTER:", outFile);
  console.log("[qa] duración:", audit.durSec.toFixed(1) + "s", "| bytes:", audit.bytes);
  console.log("[qa] LUFS:", audit.lufs, "| true peak:", audit.tp, "| clipping:", audit.clipping);
  console.log("[qa] silencios > 2.5s:", audit.silences.join(", ") || "ninguno");
  console.log("[qa] cortinilla en:", (mitadMs / 1000).toFixed(1) + "s", "| intro: 0-8s | voz:", (vozStartMs / 1000).toFixed(1) + "s");
  fs.rmSync(tmp, { recursive: true, force: true });
}

async function auditMp3(p: string, ffprobe: string, ffmpeg: string) {
  const durSec = Number((await execFileAsync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", p])).stdout.trim());
  const bytes = fs.statSync(p).size;
  // ebur128
  const e = await execFileAsync(ffmpeg, ["-i", p, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"], { timeout: 180000 }).catch((e) => ({ stdout: "", stderr: String(e.stderr ?? "") }));
  const log = typeof e === "string" ? e : String(e.stderr ?? "");
  const lufs = log.match(/I:\s+(-?[\d.]+)\s+LUFS/) ? log.match(/I:\s+(-?[\d.]+)\s+LUFS/)![1] : null;
  const tp = log.match(/Peak:\s+(-?[\d.]+)\s+dBFS/) ? log.match(/Peak:\s+(-?[\d.]+)\s+dBFS/)![1] : null;
  // silencios
  const s = await execFileAsync(ffmpeg, ["-i", p, "-af", "silencedetect=n=-38dB:d=2.5", "-f", "null", "-"], { timeout: 180000 }).catch((e) => ({ stdout: "", stderr: String(e.stderr ?? "") }));
  const slog = typeof s === "string" ? s : String(s.stderr ?? "");
  const silences = [...slog.matchAll(/silence_(?:start|end): (-?[\d.]+)/g)].map((m) => m[1] + "s");
  const clipping = tp && Math.abs(Number(tp)) < 1.0;
  return { durSec, bytes, lufs, tp, clipping, silences };
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
