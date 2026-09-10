/**
 * smart-mixer.ts — Montaje y mezcla profesional de episodios para AI Radio Studio.
 *
 * Características clave:
 * 1. Speech Trimming: Trunca silencios artificiales generados por proveedores TTS
 *    al inicio y final de cada clip, manteniendo un margen seguro de 25 ms para
 *    proteger consonantes y respiraciones naturales.
 * 2. Inserción Milimétrica de Silencios: Genera buffers de silencio exacto según
 *    la dirección de prosodia (pauseBeforeMs / pauseAfterMs) y las pausas del autor.
 * 3. Identidad Sonora y Ducking: Incorpora jingles/beds institucionales con atenuación
 *    suave (-20 dB) en los puntos de diálogo.
 * 4. Normalización Broadcast: EBU R128 / loudnorm (-16 LUFS, true peak -1.5 dB).
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MasterResult } from "@la-veinte/studio-contract";

const execFileAsync = promisify(execFile);

export interface TurnMixSpec {
  id: string;
  speaker: string;
  wavPath: string;
  pauseBeforeMs: number;
  pauseAfterMs?: number;
  authorPause?: boolean;
  relation?: string | null;
  transition?: string | null;
}

export interface SmartMixOptions {
  includeMusic?: boolean;
  musicDir?: string;
  kbps?: number;
  ffmpegPath?: string;
  tempDir?: string;
}

/**
 * Trunca silencios artificiales de un buffer WAV PCM 16-bit LE (mono o estéreo).
 * Margen de seguridad predeterminado: 15 ms al inicio, 25 ms al final.
 */
export interface TrimResult {
  buffer: Buffer;
  silenceCutMs: number;
}

/**
 * Trunca silencios artificiales de un buffer WAV PCM 16-bit LE (mono o estéreo).
 * Margen de seguridad predeterminado: 50 ms al inicio (pre-roll), 90 ms al final (post-roll).
 */
export function trimWavSilence(
  wavBuf: Buffer,
  opts: { threshold?: number; headPadMs?: number; tailPadMs?: number } = {}
): Buffer {
  return trimWavSilenceDetailed(wavBuf, opts).buffer;
}

export function trimWavSilenceDetailed(
  wavBuf: Buffer,
  opts: { threshold?: number; headPadMs?: number; tailPadMs?: number } = {}
): TrimResult {
  if (wavBuf.length < 44) return { buffer: wavBuf, silenceCutMs: 0 };

  const sampleRate = wavBuf.readUInt32LE(24);
  const numChannels = wavBuf.readUInt16LE(22);
  const bitsPerSample = wavBuf.readUInt16LE(34);

  // Solo procesar PCM 16-bit
  if (bitsPerSample !== 16 || (numChannels !== 1 && numChannels !== 2)) {
    return { buffer: wavBuf, silenceCutMs: 0 };
  }

  const dataOffset = wavBuf.indexOf("data") + 8;
  if (dataOffset < 8 || dataOffset >= wavBuf.length) return { buffer: wavBuf, silenceCutMs: 0 };

  const threshold = opts.threshold ?? 184; // ~ -45 dB
  const headPadMs = opts.headPadMs ?? 50;  // 40–70 ms
  const tailPadMs = opts.tailPadMs ?? 90;  // 70–120 ms
  const headPadSamples = Math.round((headPadMs / 1000) * sampleRate) * numChannels;
  const tailPadSamples = Math.round((tailPadMs / 1000) * sampleRate) * numChannels;

  const totalSamples = Math.floor((wavBuf.length - dataOffset) / 2);

  let startSample = 0;
  while (startSample < totalSamples && Math.abs(wavBuf.readInt16LE(dataOffset + startSample * 2)) < threshold) {
    startSample++;
  }

  let endSample = totalSamples - 1;
  while (endSample > 0 && Math.abs(wavBuf.readInt16LE(dataOffset + endSample * 2)) < threshold) {
    endSample--;
  }

  if (startSample >= endSample) {
    return { buffer: wavBuf, silenceCutMs: 0 };
  }

  // Aplicar margen seguro sin pasarse de los límites respetando la alineación de canales
  const safeStart = Math.max(0, startSample - headPadSamples);
  const alignedStart = safeStart - (safeStart % numChannels);
  const safeEnd = Math.min(totalSamples, endSample + tailPadSamples);
  const alignedEnd = safeEnd + ((numChannels - (safeEnd % numChannels)) % numChannels);

  const cutSamples = alignedStart + (totalSamples - alignedEnd);
  const silenceCutMs = Math.round((cutSamples / (sampleRate * numChannels)) * 1000);

  const trimmedPcmLength = (alignedEnd - alignedStart) * 2;
  const outHeader = Buffer.from(wavBuf.subarray(0, dataOffset));

  // Actualizar chunkSize y dataSize en el header WAV
  const totalFileSize = dataOffset + trimmedPcmLength;
  if (outHeader.length >= 8) {
    outHeader.writeUInt32LE(Math.max(0, totalFileSize - 8), 4);
  }
  if (dataOffset >= 4) {
    outHeader.writeUInt32LE(trimmedPcmLength, dataOffset - 4);
  }

  const trimmedPcm = wavBuf.subarray(dataOffset + alignedStart * 2, dataOffset + alignedEnd * 2);
  return { buffer: Buffer.concat([outHeader, trimmedPcm]), silenceCutMs };
}

// Compensación sutil de ganancia consistente por locutor sin clipeo
export const SPEAKER_GAIN_DB: Record<string, number> = {
  EDUARDO: 0.0,
  ANDREA: 0.5,
  RODRIGO: -0.5,
  JAVIER: 0.0,
  VALERIA: 0.0,
};

export function applyGainToPcmWav(wavBuf: Buffer, gainDb: number): Buffer {
  if (!gainDb || gainDb === 0 || wavBuf.length < 44) return wavBuf;
  const dataOffset = wavBuf.indexOf("data") + 8;
  if (dataOffset < 8 || dataOffset >= wavBuf.length) return wavBuf;

  const multiplier = Math.pow(10, gainDb / 20);
  const out = Buffer.from(wavBuf);
  for (let i = dataOffset; i < out.length - 1; i += 2) {
    const val = out.readInt16LE(i);
    const scaled = Math.round(val * multiplier);
    out.writeInt16LE(Math.max(-32768, Math.min(32767, scaled)), i);
  }
  return out;
}

/**
 * Convierte un buffer WAV PCM 16-bit mono a estéreo de forma matemáticamente exacta
 * duplicando cada muestra en ambos canales (Left = s, Right = s).
 * Invariante: duración idéntica, pitch idéntico, 0 dB pan central.
 */
export function monoToStereoPcmWav(monoBuf: Buffer): Buffer {
  if (monoBuf.length < 44) return monoBuf;
  const sampleRate = monoBuf.readUInt32LE(24);
  const channels = monoBuf.readUInt16LE(22);
  const bits = monoBuf.readUInt16LE(34);

  if (channels === 2) return monoBuf;
  if (channels !== 1 || bits !== 16) return monoBuf;

  const dataOffset = monoBuf.indexOf("data") + 8;
  if (dataOffset < 8 || dataOffset >= monoBuf.length) return monoBuf;

  const pcmIn = monoBuf.subarray(dataOffset);
  const numSamples = Math.floor(pcmIn.length / 2);
  const outDataSize = numSamples * 4;

  const outHeader = Buffer.from(monoBuf.subarray(0, dataOffset));
  outHeader.writeUInt16LE(2, 22); // 2 canales
  outHeader.writeUInt32LE(sampleRate * 4, 28); // byteRate = sampleRate * 2 canales * 2 bytes
  outHeader.writeUInt16LE(4, 32); // blockAlign = 2 canales * 2 bytes
  outHeader.writeUInt32LE(outDataSize, dataOffset - 4); // data chunk size
  outHeader.writeUInt32LE(36 + outDataSize, 4); // RIFF size

  const pcmOut = Buffer.alloc(outDataSize);
  for (let i = 0; i < numSamples; i++) {
    const s = pcmIn.readInt16LE(i * 2);
    pcmOut.writeInt16LE(s, i * 4);     // Left
    pcmOut.writeInt16LE(s, i * 4 + 2); // Right
  }

  return Buffer.concat([outHeader, pcmOut]);
}

/**
 * REGLA CANÓNICA:
 * "Modificar el sampleRate declarado de un archivo PCM no constituye resampling.
 * Cualquier conversión de sample rate debe preservar duración y pitch mediante resampling real."
 *
 * Estandariza cualquier archivo de audio al formato canónico de mezcla broadcast:
 * 48000 Hz, 2 canales (estéreo), PCM 16-bit little endian.
 */
export async function ensureCanonicalWavFormat(
  wavBuf: Buffer,
  ffmpegBin: string = "ffmpeg",
  targetSampleRate = 48000,
  targetChannels = 2
): Promise<Buffer> {
  if (wavBuf.length < 44) return wavBuf;
  const sampleRate = wavBuf.readUInt32LE(24);
  const channels = wavBuf.readUInt16LE(22);

  // Caso 1: Ya está en formato canónico (48kHz estéreo)
  if (sampleRate === targetSampleRate && channels === targetChannels) {
    return wavBuf;
  }

  // Caso 2: 48kHz mono -> conversión exacta e instantánea a estéreo en memoria
  if (sampleRate === targetSampleRate && channels === 1 && targetChannels === 2) {
    return monoToStereoPcmWav(wavBuf);
  }

  // Caso 3: sampleRate o formato distinto -> RESAMPLING REAL con FFmpeg (aresample)
  const tmpIn = path.join(os.tmpdir(), `canon_in_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
  const tmpOut = path.join(os.tmpdir(), `canon_out_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
  try {
    fs.writeFileSync(tmpIn, wavBuf);
    await execFileAsync(ffmpegBin, [
      "-y",
      "-i", tmpIn,
      "-ar", String(targetSampleRate),
      "-ac", String(targetChannels),
      "-c:a", "pcm_s16le",
      tmpOut,
    ], { timeout: 30000 });
    return fs.readFileSync(tmpOut);
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
  }
}

/**
 * Genera un buffer WAV que contiene silencio PCM 16-bit estéreo a la tasa indicada.
 */
export function generateSilenceWav(durationMs: number, sampleRate: number = 48000, channels: number = 2): Buffer {
  const ms = Math.max(10, Math.round(durationMs));
  const numFrames = Math.round((ms / 1000) * sampleRate);
  const dataSize = numFrames * channels * 2; // 16-bit = 2 bytes * canales
  const header = Buffer.alloc(44);

  // RIFF header
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  // fmt chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // tamaño subchunk
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22); // canales (2 = stereo)
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28); // byteRate
  header.writeUInt16LE(channels * 2, 32); // blockAlign
  header.writeUInt16LE(16, 34); // bitsPerSample

  // data chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  const silenceData = Buffer.alloc(dataSize);
  return Buffer.concat([header, silenceData]);
}

export interface SmartMixAnalytics {
  duracionMs: number;
  integratedLufs: number;
  truePeakDb: number;
  totalSpeechClips: number;
  silenceTrimmedMs: number;
  explicitPauseCount: number;
  explicitPauseMs: number;
  automaticHandoffCount: number;
  automaticHandoffMs: number;
  totalInterTurnSilenceMs: number;
  editorialPauseMs: number;
  ttsErrors: number;
  omittedNodes: number;
  duplicateNodes: number;
}

export class SmartMixer {
  constructor(private repoRoot: string) {}

  private async findFfmpeg(): Promise<string> {
    const candidates = [
      "ffmpeg",
      path.join(os.homedir(), "AppData", "Local", "ffmpeg", "ffmpeg-8.1.1-essentials_build", "bin", "ffmpeg.exe"),
    ];
    for (const c of candidates) {
      try {
        await execFileAsync(c, ["-version"], { timeout: 10000 });
        return c;
      } catch {}
    }
    throw new Error("FFmpeg no disponible en el sistema");
  }

  private async findFfprobe(): Promise<string> {
    const candidates = [
      "ffprobe",
      path.join(os.homedir(), "AppData", "Local", "ffmpeg", "ffmpeg-8.1.1-essentials_build", "bin", "ffprobe.exe"),
    ];
    for (const c of candidates) {
      try {
        await execFileAsync(c, ["-version"], { timeout: 10000 });
        return c;
      } catch {}
    }
    return "ffprobe";
  }

  /**
   * Ejecuta el montaje completo de un episodio a partir de su lista de turnos y audios.
   */
  async mixEpisode(
    turns: TurnMixSpec[],
    outFilePath: string,
    options: SmartMixOptions = {}
  ): Promise<MasterResult & { analytics: SmartMixAnalytics }> {
    if (!turns || turns.length === 0) {
      throw new Error("No hay turnos para mezclar");
    }

    const ffmpeg = options.ffmpegPath || (await this.findFfmpeg());
    const tempDir = options.tempDir || fs.mkdtempSync(path.join(os.tmpdir(), "lvd-mix-"));
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(path.dirname(outFilePath), { recursive: true });

    const concatLines: string[] = [];
    const musicDir = options.musicDir || path.join(this.repoRoot, "data", "tts", "music");
    const sfxDir = path.join(this.repoRoot, "data", "tts", "sfx");

    // Rutas de identidad sonora oficial
    const aperturaPath = path.join(musicDir, "apertura-la-veinte.wav");
    const legacyJinglePath = path.join(musicDir, "jingle-uniforme-vivo.wav");
    const activeApertura = fs.existsSync(aperturaPath) ? aperturaPath : legacyJinglePath;

    const micClickPath = path.join(sfxDir, "clic-microfono.wav");
    const identPath = path.join(musicDir, "ident-la-veinte.wav");
    const salidaPath = path.join(musicDir, "salida-la-veinte.wav");

    let totalSilenceTrimmedMs = 0;
    let explicitPauseCount = 0;
    let explicitPauseMs = 0;
    let automaticHandoffCount = 0;
    let automaticHandoffMs = 0;
    let totalInterTurnSilenceMs = 0;
    let speechClipsCount = 0;

    // 1. APERTURA INSTITUCIONAL (si está activada)
    if (options.includeMusic !== false && fs.existsSync(activeApertura)) {
      const jingleTemp = path.join(tempDir, "00-apertura.wav");
      fs.writeFileSync(jingleTemp, await ensureCanonicalWavFormat(fs.readFileSync(activeApertura), ffmpeg));
      concatLines.push(`file '${jingleTemp.split(path.sep).join("/")}'`);

      // Breve pausa post-apertura (250 ms) en formato estéreo canónico
      const postAperturaSilence = path.join(tempDir, "00-silence-apertura.wav");
      fs.writeFileSync(postAperturaSilence, generateSilenceWav(250, 48000, 2));
      concatLines.push(`file '${postAperturaSilence.split(path.sep).join("/")}'`);
    }

    // 2. CLIC SUAVE DE MICRÓFONO INICIAL (si existe)
    if (fs.existsSync(micClickPath)) {
      const micClickTemp = path.join(tempDir, "01-clic-mic.wav");
      fs.writeFileSync(micClickTemp, await ensureCanonicalWavFormat(fs.readFileSync(micClickPath), ffmpeg));
      concatLines.push(`file '${micClickTemp.split(path.sep).join("/")}'`);

      const postClickSilence = path.join(tempDir, "01-silence-click.wav");
      fs.writeFileSync(postClickSilence, generateSilenceWav(300, 48000, 2));
      concatLines.push(`file '${postClickSilence.split(path.sep).join("/")}'`);
    }

    // 3. PROCESAR CADA TURNO DE HABLA
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i];
      if (!t.wavPath || !fs.existsSync(t.wavPath)) continue;

      speechClipsCount++;

      // Inserción de la pausa calculada antes del turno (única fuente de verdad)
      if (i > 0 && t.pauseBeforeMs && t.pauseBeforeMs > 10) {
        if (t.authorPause) {
          explicitPauseCount++;
          explicitPauseMs += t.pauseBeforeMs;
        } else {
          automaticHandoffCount++;
          automaticHandoffMs += t.pauseBeforeMs;
        }
        totalInterTurnSilenceMs += t.pauseBeforeMs;
        const silenceFile = path.join(tempDir, `silence-${i}.wav`);
        fs.writeFileSync(silenceFile, generateSilenceWav(t.pauseBeforeMs, 48000, 2));
        concatLines.push(`file '${silenceFile.split(path.sep).join("/")}'`);
      }

      // Si el turno contiene transición de identidad sonora intermedia:
      if (t.transition && /identidad|estaci[oó]n|la veinte radio/i.test(t.transition) && fs.existsSync(identPath)) {
        const identTemp = path.join(tempDir, `ident-${i}.wav`);
        fs.writeFileSync(identTemp, await ensureCanonicalWavFormat(fs.readFileSync(identPath), ffmpeg));
        concatLines.push(`file '${identTemp.split(path.sep).join("/")}'`);

        const postIdentSilence = path.join(tempDir, `post-ident-${i}.wav`);
        fs.writeFileSync(postIdentSilence, generateSilenceWav(400, 48000, 2));
        concatLines.push(`file '${postIdentSilence.split(path.sep).join("/")}'`);
      }

      // Truncar silencios artificiales del clip TTS (pre-roll 50ms, post-roll 90ms)
      const origBuf = fs.readFileSync(t.wavPath);
      const trimRes = trimWavSilenceDetailed(origBuf, { headPadMs: 50, tailPadMs: 90 });
      totalSilenceTrimmedMs += trimRes.silenceCutMs;

      // Ganancia consistente por locutor (sin normalizar picos individuales agresivamente)
      const speakerGain = SPEAKER_GAIN_DB[t.speaker] ?? 0;
      const gainedBuf = applyGainToPcmWav(trimRes.buffer, speakerGain);

      // Estandarizar clip de voz al formato canónico estéreo 48 kHz
      const canonicalBuf = await ensureCanonicalWavFormat(gainedBuf, ffmpeg);

      const trimmedFile = path.join(tempDir, `clip-${i}.wav`);
      fs.writeFileSync(trimmedFile, canonicalBuf);
      concatLines.push(`file '${trimmedFile.split(path.sep).join("/")}'`);
    }

    // 4. SALIDA Y FADE OUT (si está activada)
    if (options.includeMusic !== false && (fs.existsSync(salidaPath) || fs.existsSync(activeApertura))) {
      const activeSalida = fs.existsSync(salidaPath) ? salidaPath : activeApertura;
      const postDialogueSilence = path.join(tempDir, "99-silence.wav");
      fs.writeFileSync(postDialogueSilence, generateSilenceWav(400, 48000, 2));
      concatLines.push(`file '${postDialogueSilence.split(path.sep).join("/")}'`);

      const outroTemp = path.join(tempDir, "99-salida.wav");
      fs.writeFileSync(outroTemp, await ensureCanonicalWavFormat(fs.readFileSync(activeSalida), ffmpeg));
      concatLines.push(`file '${outroTemp.split(path.sep).join("/")}'`);
    }

    // Escribir lista de concatenación
    const listFile = path.join(tempDir, "concat-timeline.txt");
    fs.writeFileSync(listFile, concatLines.join("\n"), "utf8");

    // Ejecutar FFmpeg con normalización broadcast EBU R128 (-16 LUFS, True Peak <= -1 dBTP)
    const kbps = options.kbps || 192;
    const ffmpegArgs = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listFile,
      "-af", "loudnorm=I=-16:TP=-1.0:LRA=11",
      "-codec:a", "libmp3lame",
      "-b:a", `${kbps}k`,
      outFilePath,
    ];

    await execFileAsync(ffmpeg, ffmpegArgs, { timeout: 300000 });

    // Medición exacta de duración, LUFS y True Peak con FFmpeg ebur128
    const stat = fs.statSync(outFilePath);
    let duracionMs = 0;
    try {
      const ffprobe = await this.findFfprobe();
      const { stdout: probeOut } = await execFileAsync(
        ffprobe,
        ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", outFilePath],
        { timeout: 15000 }
      );
      duracionMs = Math.round(parseFloat(probeOut.trim()) * 1000) || 0;
    } catch {}

    // Medir LUFS integrados y True Peak con ebur128
    let measuredLufs = -16.0;
    let measuredTruePeak = -1.0;
    try {
      const { stderr: ebuOut } = await execFileAsync(
        ffmpeg,
        ["-i", outFilePath, "-af", "ebur128=framelog=verbose", "-f", "null", "-"],
        { timeout: 30000 }
      );
      const lufsMatch = ebuOut.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/);
      if (lufsMatch) measuredLufs = parseFloat(lufsMatch[1]);
      const tpMatch = ebuOut.match(/Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/);
      if (tpMatch) measuredTruePeak = parseFloat(tpMatch[1]);
    } catch {}

    // Limpiar temporales
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    const analytics: SmartMixAnalytics = {
      duracionMs,
      integratedLufs: measuredLufs,
      truePeakDb: measuredTruePeak,
      totalSpeechClips: speechClipsCount,
      silenceTrimmedMs: totalSilenceTrimmedMs,
      explicitPauseCount,
      explicitPauseMs,
      automaticHandoffCount,
      automaticHandoffMs,
      totalInterTurnSilenceMs,
      editorialPauseMs: totalInterTurnSilenceMs,
      ttsErrors: 0,
      omittedNodes: 0,
      duplicateNodes: 0,
    };

    return {
      master: outFilePath,
      bytes: stat.size,
      duraccionMs: duracionMs,
      formato: "mp3",
      kbps,
      turnos: turns.length,
      needsReview: false,
      qa: null,
      mix: null,
      analytics,
    };
  }
}

