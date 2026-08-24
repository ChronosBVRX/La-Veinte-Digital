/**
 * MasterQA — control automático de calidad tras la mezcla.
 * Mide LUFS/true peak, silencios accidentales, duplicados de texto,
 * firewall editorial y QA conversacional. Devuelve veredicto.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { DialogueTurn } from "@la-veinte/radio-core";
import { auditConversation, validateRoleFirewall, normalizarTexto } from "@la-veinte/radio-core";

const execFileAsync = promisify(execFile);

export interface MasterQaReport {
  archivo: string;
  duracionSec: number | null;
  lufsIntegrado: number | null;
  truePeakDbfs: number | null;
  clippingSamples: number;
  silenciosMayores1500ms: number;
  silenciosDetalle: Array<{ inicioSec: number; duracionSec: number }>;
  bloquesDuplicados: number;
  duplicadosDetalle: string[];
  firewallValeria: Array<{ turnId: string; regla: string }>;
  qaConversacionalFallidos: string[];
  advertencias: string[];
  bloqueExportacion: boolean;
}

export async function runMasterQa(
  masterFile: string,
  turnosMezcla: Array<{ id: string; speaker: string; startMs: number; durMs: number; solapeConAnterior?: number }>,
  turns: Array<Partial<DialogueTurn> & { speaker: string; text: string }>
): Promise<MasterQaReport> {
  const rep: MasterQaReport = {
    archivo: masterFile,
    duracionSec: null,
    lufsIntegrado: null,
    truePeakDbfs: null,
    clippingSamples: 0,
    silenciosMayores1500ms: 0,
    silenciosDetalle: [],
    bloquesDuplicados: 0,
    duplicadosDetalle: [],
    firewallValeria: [],
    qaConversacionalFallidos: [],
    advertencias: [],
    bloqueExportacion: false,
  };

  // 1) Loudness internacional + true peak (ffmpeg lo reporta en stderr)
  try {
    const { stdout, stderr } = await execFileAsync("ffmpeg", [
      "-hide_banner", "-nostats", "-i", masterFile,
      "-af", "ebur128=peak=true", "-f", "null", "-",
    ], { timeout: 300000, maxBuffer: 10 * 1024 * 1024 });
    const salida = `${stdout}\n${stderr}`;
    const resumen = salida.slice(salida.lastIndexOf("Summary:"));
    const iMatch = /I:\s*(-?[\d.]+)\s*LUFS/.exec(resumen);
    const tpMatch = /True peak:\s*Peak:\s*(-?[\d.]+)\s*dBFS/.exec(resumen);
    if (iMatch) rep.lufsIntegrado = Number(iMatch[1]);
    if (tpMatch) rep.truePeakDbfs = Number(tpMatch[1]);
    if (rep.truePeakDbfs != null && rep.truePeakDbfs > -0.1) rep.clippingSamples = 1;
  } catch {
    rep.advertencias.push("no se pudo medir loudness");
  }

  // 2) Duración + silencios accidentales > 1.5 s
  try {
    const { stdout, stderr } = await execFileAsync("ffmpeg", [
      "-hide_banner", "-nostats", "-i", masterFile,
      "-af", "silencedetect=noise=-45dB:d=1.5", "-f", "null", "-",
    ], { timeout: 300000, maxBuffer: 10 * 1024 * 1024 });
    const detectSalida = `${stdout}\n${stderr}`;
    const inicios = [...detectSalida.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
    const durs = [...detectSalida.matchAll(/silence_duration:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    rep.duracionSec = inicios.length > 0 || true ? null : null;
    inicios.forEach((ini, i) => {
      const dur = durs[i];
      if (dur != null && dur > 1.5) rep.silenciosDetalle.push({ inicioSec: Math.round(ini * 10) / 10, duracionSec: Math.round(dur * 10) / 10 });
    });
    rep.silenciosMayores1500ms = rep.silenciosDetalle.length;
  } catch {
    rep.advertencias.push("no se pudo medir silencios");
  }
  try {
    const { stdout: durOut } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", masterFile], { timeout: 60000 });
    rep.duracionSec = Math.round(Number(durOut.trim()) * 10) / 10;
  } catch { /* opcional */ }

  // 3) Bloques duplicados por texto normalizado
  const vistos = new Map<string, number>();
  const detalleDup: string[] = [];
  for (const t of turns) {
    const k = normalizarTexto(t.text ?? "");
    if (k.length <= 25) continue;
    const n = (vistos.get(k) ?? 0) + 1;
    vistos.set(k, n);
    if (n === 2) detalleDup.push(`"${(t.text ?? "").slice(0, 48)}…"`);
  }
  rep.bloquesDuplicados = detalleDup.length;
  rep.duplicadosDetalle = detalleDup;

  // 4) Firewall Valeria + QA conversacional
  const comoTurns = turns.map((t, i) => ({
    id: t.id ?? `t${String(i).padStart(3, "0")}`,
    speaker: t.speaker,
    text: t.text ?? "",
    kind: t.kind,
    adSlot: t.adSlot,
    intent: t.intent,
    editorial: t.editorial,
    respondsTo: t.respondsTo,
    citations: t.citations ?? [],
    transition: t.transition ?? null,
    sceneId: t.sceneId,
  })) as DialogueTurn[];
  rep.firewallValeria = validateRoleFirewall(comoTurns).map((v) => ({ turnId: v.turnId, regla: v.regla }));
  rep.qaConversacionalFallidos = auditConversation(comoTurns).filter((l) => !l.pass).map((l) => `${l.check} — ${l.detalle}`);

  // 5) Veredicto
  if (rep.bloquesDuplicados > 0) rep.advertencias.push(`${rep.bloquesDuplicados} bloque(s) con texto clonado (repetición accidental)`);
  if (rep.firewallValeria.length > 0) rep.bloqueExportacion = true;
  if (rep.qaConversacionalFallidos.length > 0 && rep.firewallValeria.length === 0) rep.advertencias.push(...rep.qaConversacionalFallidos);
  if (rep.silenciosMayores1500ms > 0) rep.advertencias.push(`${rep.silenciosMayores1500ms} silencio(s) > 1.5 s — revisar si son intencionales`);

  try {
    writeFileSync(path.join(path.dirname(masterFile), path.basename(masterFile).replace(/\.(mp3|wav)$/, "") + "-qa.json"), JSON.stringify(rep, null, 2));
  } catch { /* reporte es best-effort */ }

  return rep;
}
