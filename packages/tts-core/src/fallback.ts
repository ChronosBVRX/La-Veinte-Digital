/**
 * TTSProvider: generación de voces para episodios.
 * 1) edge-tts (voces neurales es-MX, sin API key) — puede fallar por red/403.
 * 2) Fallback local: SAPI de Windows (voz es-MX Sabina) + ffmpeg para MP3.
 * El audio es un artefacto derivado del guion verificado; la evidencia vive en la ficha.
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface VoiceSpec {
  id: string;
  name: string;
  gender: "male" | "female";
}

export const DEFAULT_VOICES: Record<string, VoiceSpec> = {
  EDUARDO: { id: "es-MX-JorgeNeural", name: "Eduardo (Jorge)", gender: "male" },
  MARIANA: { id: "es-MX-MarinaNeural", name: "Mariana (Marina)", gender: "female" },
};

const SAPI_FALLBACK_VOICE = "Microsoft Sabina Desktop";

export interface TtsLine {
  text: string;
  voice?: string;
}

export interface AudioResult {
  mp3: Buffer;
  durationEstimateSec: number;
  segments: number;
  voices: string[];
  engine: "edge" | "sapi";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function cleanTtsText(t: string): string {
  return t
    .replace(/🎙|📚|🟢|🟡|🔴|⚠|🔒|🌐|📻/g, "")
    .replace(/[“”«»"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findFfmpeg(): Promise<string> {
  const candidates = [
    "ffmpeg",
    path.join(os.homedir(), "AppData", "Local", "ffmpeg", "ffmpeg-8.1.1-essentials_build", "bin", "ffmpeg.exe"),
  ];
  for (const c of candidates) {
    try {
      await execFileAsync(c, ["-version"], { timeout: 10000 });
      return c;
    } catch {
      /* probar siguiente */
    }
  }
  throw new Error("ffmpeg no disponible (necesario para el fallback local de voces)");
}

async function sapiLineToWav(text: string, rate: number, outFile: string): Promise<void> {
  const ps = [
    "Add-Type -AssemblyName System.Speech;",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
    `$s.SelectVoice('${SAPI_FALLBACK_VOICE}');`,
    `$s.Rate = ${rate};`,
    `$s.SetOutputToWaveFile('${outFile.replace(/'/g, "''")}');`,
    `$s.Speak('${text.replace(/'/g, "''")}');`,
    "$s.Dispose();",
  ].join(" ");
  await execFileAsync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { timeout: 120000 });
}

export async function synthesizeMp3(
  lines: TtsLine[],
  opts: { onProgress?: (done: number, total: number) => void } = {}
): Promise<AudioResult> {
  const wordsPerSec = 2.6;
  let totalWords = 0;
  for (const line of lines) {
    const t = cleanTtsText(line.text);
    if (t) totalWords += t.split(/\s+/).length;
  }

  try {
    const { tts } = await import("edge-tts");
    const buffers: Buffer[] = [];
    const voices = new Set<string>();
    let i = 0;
    for (const line of lines) {
      const text = cleanTtsText(line.text);
      if (!text) continue;
      const voice = line.voice ?? "es-MX-JorgeNeural";
      voices.add(voice);
      buffers.push(await tts(text, { voice, rate: "+0%", volume: "+0%" }));
      i++;
      opts.onProgress?.(i, lines.length);
      if (i < lines.length) await sleep(350);
    }
    return {
      mp3: Buffer.concat(buffers),
      durationEstimateSec: Math.round(totalWords / wordsPerSec) + lines.length * 0.8,
      segments: buffers.length,
      voices: [...voices],
      engine: "edge",
    };
  } catch (edgeErr) {
    console.warn(`[tts] edge-tts no disponible (${edgeErr instanceof Error ? edgeErr.message : edgeErr}) — usando voz local de Windows (SAPI)`);
  }

  const ffmpeg = await findFfmpeg();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "la-veinte-tts-"));
  const wavs: string[] = [];
  let i = 0;
  try {
    for (const line of lines) {
      const text = cleanTtsText(line.text);
      if (!text) continue;
      const wav = path.join(tmp, `line-${String(i).padStart(3, "0")}.wav`);
      const isFemale = (line.voice ?? "").toLowerCase().includes("marina") || (line.voice ?? "").toLowerCase().includes("dalia");
      await sapiLineToWav(text, isFemale ? 1 : -2, wav);
      wavs.push(wav);
      i++;
      opts.onProgress?.(i, lines.length);
    }

    const listFile = path.join(tmp, "concat.txt");
    fs.writeFileSync(listFile, wavs.map((w) => `file '${w.replace(/'/g, "'\\''")}'`).join("\n"));
    const outMp3 = path.join(tmp, "episodio.mp3");
    await execFileAsync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-codec:a", "libmp3lame", "-b:a", "96k", outMp3], { timeout: 300000 });
    const mp3 = fs.readFileSync(outMp3);

    return {
      mp3,
      durationEstimateSec: Math.round(totalWords / wordsPerSec) + lines.length * 0.8,
      segments: wavs.length,
      voices: [SAPI_FALLBACK_VOICE],
      engine: "sapi",
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
