/**
 * generate-sound-identity.ts
 *
 * Generador procedural de identidad sonora para La Veinte Radio:
 * 1. Apertura (4.0s): Motivo armónico cálido de radio pública (F9 -> Bbmaj7).
 * 2. Clic de micrófono (0.35s): Impulso mecánico realista de diafragma y conmutador.
 * 3. Identidad intermedia (3.0s): Melodía distintiva de 3 notas con cola resonante.
 * 4. Salida / Outro (6.5s): Resolución armónica con fade-out exponencial suave.
 *
 * Licencia: CC0 1.0 Universal / Dominio Público (Síntesis matemática original).
 */

import fs from "node:fs";
import path from "node:path";

const SAMPLE_RATE = 48000;
const NUM_CHANNELS = 2; // Estéreo

function createWavHeader(dataBytes: number, sampleRate: number = SAMPLE_RATE, channels: number = NUM_CHANNELS): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 para PCM)
  header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28); // ByteRate
  header.writeUInt16LE(channels * 2, 32); // BlockAlign
  header.writeUInt16LE(16, 34); // BitsPerSample
  header.write("data", 36);
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

// Síntesis de tono con armónicos y envolvente ADSR suave
function synthNote(
  freq: number,
  durationSec: number,
  volume: number,
  decayRate: number = 2.5
): Float32Array {
  const totalSamples = Math.round(SAMPLE_RATE * durationSec);
  const out = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.015);
    const envelope = attack * Math.exp(-decayRate * t);
    const s1 = Math.sin(2 * Math.PI * freq * t);
    const s2 = 0.35 * Math.sin(2 * Math.PI * (freq * 2) * t);
    const s3 = 0.15 * Math.sin(2 * Math.PI * (freq * 3) * t);
    const s4 = 0.05 * Math.sin(2 * Math.PI * (freq * 4) * t);
    out[i] = (s1 + s2 + s3 + s4) * volume * envelope;
  }
  return out;
}

function toPcm16Buffer(left: Float32Array, right: Float32Array): Buffer {
  const totalSamples = Math.min(left.length, right.length);
  const buf = Buffer.alloc(totalSamples * 4);
  for (let i = 0; i < totalSamples; i++) {
    const clL = Math.max(-1, Math.min(1, left[i]));
    const clR = Math.max(-1, Math.min(1, right[i]));
    const valL = Math.round(clL < 0 ? clL * 32768 : clL * 32767);
    const valR = Math.round(clR < 0 ? clR * 32768 : clR * 32767);
    buf.writeInt16LE(valL, i * 4);
    buf.writeInt16LE(valR, i * 4 + 2);
  }
  const header = createWavHeader(buf.length, SAMPLE_RATE, 2);
  return Buffer.concat([header, buf]);
}

// 1. Clic suave de micrófono (0.35 s)
export function generateMicClickWav(): Buffer {
  const durSec = 0.35;
  const totalSamples = Math.round(SAMPLE_RATE * durSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const switchClick = Math.exp(-t * 350) * Math.sin(2 * Math.PI * 2800 * t) * 0.45;
    const diaphragmPop = Math.exp(-t * 90) * Math.sin(2 * Math.PI * 110 * t) * 0.35;
    const roomAir = Math.exp(-t * 25) * (Math.random() * 2 - 1) * 0.04;

    const sample = switchClick + diaphragmPop + roomAir;
    left[i] = sample;
    right[i] = sample * 0.95 + (i > 10 ? left[i - 10] * 0.05 : 0);
  }

  return toPcm16Buffer(left, right);
}

// 2. Apertura Institucional (4.0 s)
export function generateAperturaWav(): Buffer {
  const durSec = 4.0;
  const totalSamples = Math.round(SAMPLE_RATE * durSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const notesChord1 = [
    { f: 174.61, delay: 0.00, vol: 0.22, decay: 1.2 },
    { f: 220.00, delay: 0.05, vol: 0.20, decay: 1.3 },
    { f: 261.63, delay: 0.10, vol: 0.18, decay: 1.4 },
    { f: 329.63, delay: 0.18, vol: 0.16, decay: 1.5 },
    { f: 392.00, delay: 0.25, vol: 0.14, decay: 1.6 },
  ];

  const notesChord2 = [
    { f: 233.08, delay: 1.20, vol: 0.24, decay: 0.9 },
    { f: 293.66, delay: 1.28, vol: 0.20, decay: 1.0 },
    { f: 349.23, delay: 1.35, vol: 0.18, decay: 1.1 },
    { f: 440.00, delay: 1.45, vol: 0.16, decay: 1.2 },
    { f: 523.25, delay: 1.60, vol: 0.12, decay: 1.3 },
  ];

  const allNotes = [...notesChord1, ...notesChord2];

  for (const n of allNotes) {
    const startIdx = Math.round(SAMPLE_RATE * n.delay);
    const noteWave = synthNote(n.f, durSec - n.delay, n.vol, n.decay);

    for (let i = 0; i < noteWave.length; i++) {
      if (startIdx + i < totalSamples) {
        left[startIdx + i] += noteWave[i];
        right[startIdx + i] += noteWave[i];
      }
    }
  }

  const fadeStart = Math.round(SAMPLE_RATE * 3.2);
  for (let i = fadeStart; i < totalSamples; i++) {
    const fadeRatio = 1 - (i - fadeStart) / (totalSamples - fadeStart);
    left[i] *= Math.max(0, fadeRatio);
    right[i] *= Math.max(0, fadeRatio);
  }

  return toPcm16Buffer(left, right);
}

// 3. Identidad corta intermedia (3.0 s)
export function generateIdentWav(): Buffer {
  const durSec = 3.0;
  const totalSamples = Math.round(SAMPLE_RATE * durSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const notes = [
    { f: 261.63, delay: 0.05, vol: 0.28, decay: 1.8 },
    { f: 329.63, delay: 0.38, vol: 0.26, decay: 1.9 },
    { f: 440.00, delay: 0.72, vol: 0.28, decay: 1.1 },
    { f: 523.25, delay: 0.75, vol: 0.15, decay: 1.2 },
  ];

  for (const n of notes) {
    const startIdx = Math.round(SAMPLE_RATE * n.delay);
    const noteWave = synthNote(n.f, durSec - n.delay, n.vol, n.decay);
    for (let i = 0; i < noteWave.length; i++) {
      if (startIdx + i < totalSamples) {
        left[startIdx + i] += noteWave[i];
        right[startIdx + i] += noteWave[i];
      }
    }
  }

  const fadeStart = Math.round(SAMPLE_RATE * 2.3);
  for (let i = fadeStart; i < totalSamples; i++) {
    const fadeRatio = 1 - (i - fadeStart) / (totalSamples - fadeStart);
    left[i] *= Math.max(0, fadeRatio);
    right[i] *= Math.max(0, fadeRatio);
  }

  return toPcm16Buffer(left, right);
}

// 4. Salida / Outro con Fade-out (6.5 s)
export function generateSalidaWav(): Buffer {
  const durSec = 6.5;
  const totalSamples = Math.round(SAMPLE_RATE * durSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const notes = [
    { f: 233.08, delay: 0.00, vol: 0.22, decay: 1.0 },
    { f: 293.66, delay: 0.10, vol: 0.20, decay: 1.1 },
    { f: 349.23, delay: 0.20, vol: 0.18, decay: 1.2 },
    { f: 440.00, delay: 0.30, vol: 0.16, decay: 1.3 },
    { f: 174.61, delay: 1.50, vol: 0.25, decay: 0.6 },
    { f: 261.63, delay: 1.55, vol: 0.22, decay: 0.7 },
    { f: 349.23, delay: 1.60, vol: 0.20, decay: 0.8 },
    { f: 440.00, delay: 1.65, vol: 0.18, decay: 0.9 },
  ];

  for (const n of notes) {
    const startIdx = Math.round(SAMPLE_RATE * n.delay);
    const noteWave = synthNote(n.f, durSec - n.delay, n.vol, n.decay);
    for (let i = 0; i < noteWave.length; i++) {
      if (startIdx + i < totalSamples) {
        left[startIdx + i] += noteWave[i];
        right[startIdx + i] += noteWave[i];
      }
    }
  }

  const fadeStart = Math.round(SAMPLE_RATE * 3.8);
  for (let i = fadeStart; i < totalSamples; i++) {
    const fadeRatio = 1 - (i - fadeStart) / (totalSamples - fadeStart);
    left[i] *= Math.max(0, fadeRatio * fadeRatio);
    right[i] *= Math.max(0, fadeRatio * fadeRatio);
  }

  return toPcm16Buffer(left, right);
}

export function buildAllSoundIdentityAssets(repoRoot: string) {
  const musicDir = path.join(repoRoot, "data", "tts", "music");
  const sfxDir = path.join(repoRoot, "data", "tts", "sfx");
  fs.mkdirSync(musicDir, { recursive: true });
  fs.mkdirSync(sfxDir, { recursive: true });

  const micClick = generateMicClickWav();
  const apertura = generateAperturaWav();
  const ident = generateIdentWav();
  const salida = generateSalidaWav();

  fs.writeFileSync(path.join(sfxDir, "clic-microfono.wav"), micClick);
  fs.writeFileSync(path.join(musicDir, "apertura-la-veinte.wav"), apertura);
  fs.writeFileSync(path.join(musicDir, "ident-la-veinte.wav"), ident);
  fs.writeFileSync(path.join(musicDir, "salida-la-veinte.wav"), salida);
  fs.writeFileSync(path.join(musicDir, "jingle-uniforme-vivo.wav"), apertura);

  const licenseText = `# Licencia de Activos de Identidad Sonora — La Veinte Radio

Todos los activos sonoros contenidos en esta carpeta (\`data/tts/music/\` y \`data/tts/sfx/\`):
- \`apertura-la-veinte.wav\` (Apertura institucional 4.0s)
- \`clic-microfono.wav\` (SFX interruptor/clic suave de micrófono 0.35s)
- \`ident-la-veinte.wav\` (Identidad sonora corta 3.0s)
- \`salida-la-veinte.wav\` (Cierre con fade out 6.5s)
- \`jingle-uniforme-vivo.wav\` (Referencia unificada 4.0s)

Fueron creados y sintetizados proceduralmente mediante algoritmos matemáticos en \`scratch/generate-sound-identity.ts\`.

**Licencia:** CC0 1.0 Universal (Dominio Público).
Se permite su uso, copia, modificación y distribución sin ninguna restricción de copyright.
`;

  fs.writeFileSync(path.join(musicDir, "LICENSE.md"), licenseText, "utf8");
  console.log("Activos de identidad sonora generados y licenciados exitosamente.");
}

const repoRoot = path.resolve(process.cwd());
buildAllSoundIdentityAssets(repoRoot);
