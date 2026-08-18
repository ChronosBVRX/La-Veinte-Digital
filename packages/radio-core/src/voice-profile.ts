/**
 * VoiceProfile — identidad vocal por locutor.
 * La asignación conductor/co-conductora y las etiquetas de rol son MANUALES
 * (userAssignedVoiceRole); nunca se infiere género automáticamente.
 */

import { sha256Hex } from "./sha256";

export interface VoiceSettings {
  exaggeration?: number;
  temperature?: number;
  cfgWeight?: number;
}

export interface VoiceProfile {
  id: string;
  displayName: string;
  role: string;
  userAssignedVoiceRole?: string;
  referenceAudioPath: string;
  referenceAudioSha256: string;
  voiceSourceId: string;
  voiceSourceType: "synthetic" | "human" | "builtin" | "unknown";
  voiceSourceLabel: string;
  voiceProvenance?: string;
  provider: string;
  modelId: string;
  modelRevision: string;
  language: string;
  locale: string;
  generationSettings: VoiceSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CastingValidation {
  ok: boolean;
  blocked?: boolean;
  estado?: "CASTING_SOURCE_DUPLICATED" | "PASS";
  mensaje?: string;
  voces: Array<{ id: string; displayName: string; referenceAudioSha256: string; voiceSourceId: string; role: string }>;
}

/**
 * Regla 3: dos personajes DEFINIDOS COMO VOCES DISTINTAS no pueden provenir
 * de la MISMA voz de origen (voiceSourceId), aunque los SHA difieran.
 * Se exige entre los conductores principales (conductor + co-conductor);
 * el narrador y otros roles pueden compartir fuente si el usuario lo define.
 */
export function validateCasting(perfiles: Array<Pick<VoiceProfile, "id" | "displayName" | "role" | "referenceAudioSha256" | "voiceSourceId">>): CastingValidation {
  const voces = perfiles.map((p) => ({ id: p.id, displayName: p.displayName, referenceAudioSha256: p.referenceAudioSha256, voiceSourceId: p.voiceSourceId, role: p.role }));
  const hosts = voces.filter((v) => v.role === "conductor" || v.role === "co-conductor");
  const porFuente = new Map<string, string[]>();
  for (const v of hosts) {
    const list = porFuente.get(v.voiceSourceId) ?? [];
    list.push(v.displayName);
    porFuente.set(v.voiceSourceId, list);
  }
  const duplicadas = [...porFuente.entries()].filter(([, names]) => names.length >= 2);
  if (duplicadas.length > 0) {
    return {
      ok: false,
      blocked: true,
      estado: "CASTING_SOURCE_DUPLICATED",
      mensaje: `${duplicadas[0][1].join(" y ")} utilizan variantes de la misma voz de origen. Selecciona voces de origen distintas para conductor y co-conductora antes de producir el episodio.`,
      voces,
    };
  }
  return { ok: true, estado: "PASS", voces };
}

/**
 * Cache key de identidad (regla 5): texto + speakerId + referenceAudioSha256
 * + provider + modelId + modelRevision + generationSettings.
 */
export async function voiceIdentityCacheKey(params: {
  text: string;
  profile: Pick<VoiceProfile, "id" | "provider" | "modelId" | "modelRevision" | "referenceAudioSha256" | "generationSettings">;
  language?: string;
}): Promise<string> {
  const payload = JSON.stringify({
    t: params.text,
    s: params.profile.id,
    r: params.profile.referenceAudioSha256,
    p: params.profile.provider,
    m: params.profile.modelId,
    rev: params.profile.modelRevision,
    g: params.profile.generationSettings,
    l: params.language ?? "es",
  });
  return (await sha256Hex(payload)).slice(0, 24);
}
