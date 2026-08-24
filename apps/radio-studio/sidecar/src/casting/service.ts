/**
 * VoiceCastingService — generación, evaluación y promoción de candidatos de voz.
 * FASE A: Chatterbox builtin con seeds variados (candidatos inmediatos).
 * FASE B (futura): Qwen3-TTS VoiceDesign como generador de referencias sintéticas.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CASTING_DIR = path.join(process.cwd(), "data", "tts", "casting");

export interface CastingCandidate {
  candidateId: string;
  characterId: string;
  designPrompt: string;
  seed: number;
  model: string;
  generatedAt: string;
  wavPath: string;
  durationMs: number;
  sha256: string;
  asrTranscript?: string;
  contentMatchScore?: number;
  technicalQa?: Record<string, unknown>;
  castingScore?: Record<string, number>;
  status: "candidate" | "finalist" | "rejected" | "canonical";
}

export interface CastingManifest {
  characterId: string;
  candidates: CastingCandidate[];
  finalists: string[];
  recommendedWinner?: string;
  canonicalReference?: {
    voiceId: string;
    character: string;
    sourceWav: string;
    sha256: string;
    seed: number;
  };
}

// ── Textos de casting ──
export const CASTING_TEXT_COMMON =
  "Buenos días. Esto es La Veinte Radio. Hay algo que necesitamos aclarar: si hoy te cambian el horario por teléfono, ¿qué documento debería existir? Espera, porque ahí está el detalle. Una cosa es una indicación verbal y otra una modificación formal.";

export const CASTING_TEXT_JAVIER_CORRECTION =
  "Sí, ahí tienes razón. Me expliqué demasiado rápido. El punto importante no es solamente quién dio la indicación, sino qué procedimiento se siguió.";

export const CASTING_TEXT_JAVIER_NORMATIVE =
  "No necesariamente. Primero hay que distinguir una indicación verbal de una modificación formal del horario; son cosas diferentes.";

export const CASTING_TEXT_RODRIGO_FIELD =
  "Revisé el procedimiento y encontré dos documentos que aquí importan mucho: la solicitud y el oficio con el que notifican la decisión.";

export const CASTING_TEXT_RODRIGO_PRECISION =
  "Déjame agregar un dato. El procedimiento distingue entre una modificación temporal y una definitiva, y eso cambia cómo se documenta.";

// ── Perfiles de diseño ──
export const DESIGN_PROMPTS = {
  javier: `Native Mexican Spanish male, approximately 38 to 48 years old. Neutral central Mexican accent. Natural medium pitch, noticeably lighter than a traditional baritone narrator. Warm, calm, intelligent and approachable. Conversational delivery as if speaking with colleagues around the same table. Thoughtful and analytical without sounding academic. Natural melodic variation, small human hesitations and realistic phrasing. Serious when necessary but never ominous, solemn or authoritative. Should sound like the colleague who knows where the clause is and explains it clearly. Avoid: narrator, documentary narrator, announcer, news anchor, deep bass voice, trailer voice, authority voice, judge-like tone, solemn performance, dramatic gravitas, monotone, corporate training voice.`,
  rodrigo: `Native Mexican Spanish male, approximately 28 to 38 years old. Neutral Mexican accent. Medium to medium-high male pitch. Agile, energetic and conversational without sounding young or childish. Natural voice texture, clear but not overly polished articulation. Curious, observant and practical personality. Speaks like someone who has just checked a document, spoken with people and is bringing useful information back to the table. Naturally faster than the main host but still easy to understand. Avoid: news anchor, formal correspondent stereotype, sports announcer, commercial voice, deep baritone, trailer voice, exaggerated excitement, theatrical delivery.`,
};

export function ensureCastingDir(characterId: string): string {
  const dir = path.join(CASTING_DIR, characterId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function candidateDir(characterId: string, candidateId: string): string {
  const dir = path.join(ensureCastingDir(characterId), candidateId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveCandidate(dir: string, candidate: CastingCandidate): void {
  fs.writeFileSync(path.join(dir, "candidate.json"), JSON.stringify(candidate, null, 1));
}

export function loadManifest(characterId: string): CastingManifest | null {
  const p = path.join(CASTING_DIR, characterId, "manifest.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function saveManifest(m: CastingManifest): void {
  const p = path.join(CASTING_DIR, m.characterId, "manifest.json");
  fs.writeFileSync(p, JSON.stringify(m, null, 1));
}

export function sha256File(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
