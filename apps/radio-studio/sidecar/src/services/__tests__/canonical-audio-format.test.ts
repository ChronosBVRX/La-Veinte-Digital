import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  generateSilenceWav,
  monoToStereoPcmWav,
  ensureCanonicalWavFormat,
  applyGainToPcmWav,
} from "../smart-mixer";

function generateSineTone(frequencyHz: number, durationSec: number, sampleRate: number): Buffer {
  const numSamples = Math.round(durationSec * sampleRate);
  const dataSize = numSamples * 2;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);

  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  const pcm = Buffer.alloc(dataSize);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = Math.round(Math.sin(2 * Math.PI * frequencyHz * t) * 16384);
    pcm.writeInt16LE(sampleVal, i * 2);
  }

  return Buffer.concat([header, pcm]);
}

function measureZeroCrossingFrequency(buf: Buffer): number {
  const dataOffset = buf.indexOf("data") + 8;
  const sampleRate = buf.readUInt32LE(24);
  const channels = buf.readUInt16LE(22);

  let zeroCrossings = 0;
  const totalFrames = Math.floor((buf.length - dataOffset) / (2 * channels));
  let prevVal = 0;

  for (let i = 0; i < totalFrames; i++) {
    const val = buf.readInt16LE(dataOffset + i * 2 * channels);
    if (i > 0 && ((prevVal < 0 && val >= 0) || (prevVal >= 0 && val < 0))) {
      zeroCrossings++;
    }
    prevVal = val;
  }

  const duration = totalFrames / sampleRate;
  return Math.round((zeroCrossings / 2) / duration);
}

describe("Regla Canónica de Formato de Audio y Resampling Real", () => {
  it("Regla 1: monoToStereoPcmWav duplica canales manteniendo invariante la duración y el pitch", () => {
    const mono = generateSineTone(1000, 1.0, 48000);
    const stereo = monoToStereoPcmWav(mono);

    expect(mono.readUInt16LE(22)).toBe(1);
    expect(stereo.readUInt16LE(22)).toBe(2);
    expect(stereo.readUInt32LE(24)).toBe(48000);

    const monoFrames = Math.floor((mono.length - 44) / 2);
    const stereoFrames = Math.floor((stereo.length - 44) / 4);
    expect(stereoFrames).toBe(monoFrames);

    const freq = measureZeroCrossingFrequency(stereo);
    expect(freq).toBeGreaterThanOrEqual(995);
    expect(freq).toBeLessThanOrEqual(1005);
  });

  it("Regla 2: generateSilenceWav genera buffer estéreo 48 kHz exacto", () => {
    const silence = generateSilenceWav(500, 48000, 2);
    expect(silence.readUInt16LE(22)).toBe(2);
    expect(silence.readUInt32LE(24)).toBe(48000);
    expect(silence.readUInt16LE(32)).toBe(4); // blockAlign = 4
    expect(silence.readUInt32LE(28)).toBe(192000); // byteRate

    const frames = Math.floor((silence.length - 44) / 4);
    const durSec = frames / 48000;
    expect(durSec).toBeCloseTo(0.5, 3);
  });

  it("Regla 3: speaker gain no altera duración, pitch ni número de muestras", () => {
    const tone = generateSineTone(1000, 0.75, 48000);
    const gained = applyGainToPcmWav(tone, 0.5);

    expect(gained.length).toBe(tone.length);
    expect(gained.readUInt32LE(24)).toBe(tone.readUInt32LE(24));
    expect(gained.readUInt16LE(22)).toBe(tone.readUInt16LE(22));

    const freq = measureZeroCrossingFrequency(gained);
    expect(freq).toBeGreaterThanOrEqual(995);
    expect(freq).toBeLessThanOrEqual(1005);
  });

  const testRates = [24000, 22050, 44100, 48000];
  for (const r of testRates) {
    it(`Regla 4: Resampling real de ${r} Hz a 48000 Hz estéreo conserva duración y pitch (1000 Hz)`, async () => {
      const tone = generateSineTone(1000, 1.0, r);
      const canonical = await ensureCanonicalWavFormat(tone, "ffmpeg", 48000, 2);

      const rate = canonical.readUInt32LE(24);
      const channels = canonical.readUInt16LE(22);
      expect(rate).toBe(48000);
      expect(channels).toBe(2);

      const frames = Math.floor((canonical.length - 44) / 4);
      const durSec = frames / 48000;
      expect(Math.abs(durSec - 1.0)).toBeLessThan(0.01); // Menos de 10 ms de tolerancia

      const freq = measureZeroCrossingFrequency(canonical);
      expect(Math.abs(freq - 1000)).toBeLessThan(25); // Frecuencia conservada sin subir a 2000 Hz
    });
  }
});
