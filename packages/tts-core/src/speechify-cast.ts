/**
 * Speechify Casting — selección determinista de 5 voces únicas (3M+2F) para simba-3.0 es-MX
 */
import fs from "node:fs";
import path from "node:path";

export interface SpeechifyVoice {
  id: string;
  name?: string;
  display_name?: string;
  gender?: string;
  locale?: string;
  language?: string;
  model?: string;
  models?: string[];
  // compat fields variadas
  [k: string]: unknown;
}

export interface SpeechifyCast {
  version: number;
  generatedAt: string;
  provider: string;
  model: string;
  language: string;
  voices: {
    EDUARDO: string;
    ANDREA: string;
    JAVIER: string;
    RODRIGO: string;
    VALERIA: string;
  };
  details: Record<string, SpeechifyVoice>;
}

const CAST_FILE = "speechify-cast.json";

const ENV_OVERRIDES: Record<string, keyof SpeechifyCast["voices"]> = {
  SPEECHIFY_VOICE_MALE_1: "EDUARDO",
  SPEECHIFY_VOICE_FEMALE_1: "ANDREA",
  SPEECHIFY_VOICE_MALE_2: "JAVIER",
  SPEECHIFY_VOICE_MALE_3: "RODRIGO",
  SPEECHIFY_VOICE_FEMALE_2: "VALERIA",
};

export function getEnvOverrides(): Partial<Record<keyof SpeechifyCast["voices"], string>> {
  const out: Partial<Record<keyof SpeechifyCast["voices"], string>> = {};
  for (const [env, role] of Object.entries(ENV_OVERRIDES)) {
    const v = process.env[env]?.trim();
    if (v) out[role] = v;
  }
  return out;
}

export function castingPath(stateDir: string): string {
  return path.join(stateDir, CAST_FILE);
}

export function loadCasting(stateDir: string): SpeechifyCast | null {
  const p = castingPath(stateDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as SpeechifyCast;
  } catch {
    return null;
  }
}

export function saveCasting(stateDir: string, cast: SpeechifyCast): void {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(castingPath(stateDir), JSON.stringify(cast, null, 2));
}

function normalizeGender(v: SpeechifyVoice): "male" | "female" | "unknown" {
  const g = String(v.gender ?? (v as unknown as { sex?: string }).sex ?? "").toLowerCase();
  if (g === "male" || g === "m" || g.includes("mascul")) return "male";
  if (g === "female" || g === "f" || g.includes("femin")) return "female";
  return "unknown";
}

function normalizeLocale(v: SpeechifyVoice): string {
  return String(v.locale ?? v.language ?? "").toLowerCase();
}

function isCompatible(v: SpeechifyVoice): boolean {
  // debe ser compatible con simba-3.0 y español
  const models = (v.models ?? (v.model ? [v.model] : [])) as string[];
  if (models.length > 0 && !models.some((m) => String(m).toLowerCase().includes("simba"))) {
    // si declara modelos y ninguno es simba, no es compatible
    // pero algunos catálogos no declaran modelo → asumir compatible si locale es es-*
    const locale = normalizeLocale(v);
    if (!locale.startsWith("es")) return false;
    // si declara modelos no-simba y locale es es, excluir
    return false;
  }
  const locale = normalizeLocale(v);
  return locale.startsWith("es");
}

function scoreVoice(v: SpeechifyVoice): number {
  const locale = normalizeLocale(v);
  if (locale === "es-mx") return 100;
  if (locale.startsWith("es-mx")) return 90;
  if (locale.startsWith("es-")) return 50;
  if (locale === "es") return 40;
  return 0;
}

export async function fetchVoices(apiKey: string): Promise<SpeechifyVoice[]> {
  const r = await fetch("https://api.speechify.ai/v1/voices", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`voices HTTP ${r.status}`);
  const j = await r.json() as { voices?: SpeechifyVoice[]; data?: SpeechifyVoice[] } | SpeechifyVoice[];
  if (Array.isArray(j)) return j;
  return (j.voices ?? j.data ?? []) as SpeechifyVoice[];
}

export async function selectCasting(apiKey: string, stateDir?: string): Promise<SpeechifyCast> {
  const overrides = getEnvOverrides();
  // si hay overrides completos, validar unicidad y construir directo sin fetch?
  // aún necesitamos validar que los IDs existen; intentará fetch si no está en caché
  let voices: SpeechifyVoice[] = [];
  try {
    voices = await fetchVoices(apiKey);
  } catch (e) {
    // si hay overrides y fetch falla, aún podemos construir si overrides cubren 5?
    const overrideIds = Object.values(overrides).filter(Boolean) as string[];
    if (overrideIds.length === 5 && new Set(overrideIds).size === 5) {
      const cast: SpeechifyCast = {
        version: 1,
        generatedAt: new Date().toISOString(),
        provider: "speechify",
        model: "simba-3.0",
        language: "es-MX",
        voices: {
          EDUARDO: overrides.EDUARDO!,
          ANDREA: overrides.ANDREA!,
          JAVIER: overrides.JAVIER!,
          RODRIGO: overrides.RODRIGO!,
          VALERIA: overrides.VALERIA!,
        },
        details: Object.fromEntries(overrideIds.map((id) => [id, { id } as SpeechifyVoice])),
      };
      if (stateDir) saveCasting(stateDir, cast);
      return cast;
    }
    throw e;
  }

  const compatible = voices.filter(isCompatible);
  // separar por género
  const males = compatible.filter((v) => normalizeGender(v) === "male").sort((a, b) => scoreVoice(b) - scoreVoice(a) || String(a.id).localeCompare(String(b.id)));
  const females = compatible.filter((v) => normalizeGender(v) === "female").sort((a, b) => scoreVoice(b) - scoreVoice(a) || String(a.id).localeCompare(String(b.id)));

  // si no hay género distinguible, intentar inferir por locale fallback: tratar todos como unisex y fallar claramente
  if (males.length < 3 || females.length < 2) {
    const allSorted = compatible.sort((a, b) => scoreVoice(b) - scoreVoice(a) || String(a.id).localeCompare(String(b.id)));
    if (compatible.length < 5) {
      throw new Error(`Catálogo insuficiente: se requieren 3 voces masculinas y 2 femeninas compatibles con simba-3.0 es-MX; encontradas ${males.length}M/${females.length}F de ${compatible.length} compatibles totales`);
    }
    // si género no distinguible pero hay 5 compatibles, distribuir por fallback (no recomendado)
    throw new Error(`Catálogo insuficiente: se requieren 3 voces masculinas y 2 femeninas; encontradas ${males.length}M/${females.length}F (total compatibles ${compatible.length}). No se puede asignar sin duplicar.`);
  }

  // selección determinista: tomar top por score, asegurando unicidad
  const pick = (arr: SpeechifyVoice[], used: Set<string>, n: number): SpeechifyVoice[] => {
    const out: SpeechifyVoice[] = [];
    for (const v of arr) {
      if (used.has(v.id)) continue;
      out.push(v);
      used.add(v.id);
      if (out.length === n) break;
    }
    return out;
  };
  const used = new Set<string>();
  // reservar overrides primero
  const selected: Record<string, SpeechifyVoice> = {};
  const roleOrder: Array<{ role: keyof SpeechifyCast["voices"]; gender: "male" | "female"; pool: SpeechifyVoice[] }> = [
    { role: "EDUARDO", gender: "male", pool: males },
    { role: "ANDREA", gender: "female", pool: females },
    { role: "JAVIER", gender: "male", pool: males },
    { role: "RODRIGO", gender: "male", pool: males },
    { role: "VALERIA", gender: "female", pool: females },
  ];
  for (const { role, gender, pool } of roleOrder) {
    const overrideId = overrides[role];
    if (overrideId) {
      const found = voices.find((v) => v.id === overrideId);
      if (!found) throw new Error(`Override ${role} (${overrideId}) no existe en catálogo`);
      if (used.has(found.id)) throw new Error(`Override duplicado: ${found.id} ya asignado a otro personaje`);
      // validar género aproximado si posible
      const g = normalizeGender(found);
      if (g !== "unknown" && g !== gender) throw new Error(`Override ${role} (${found.id}) género ${g} no coincide con ${gender} requerido`);
      selected[role] = found;
      used.add(found.id);
    }
  }
  // completar faltantes
  for (const { role, pool } of roleOrder) {
    if (selected[role]) continue;
    const avail = pool.filter((v) => !used.has(v.id));
    if (avail.length === 0) throw new Error(`Sin voces disponibles para ${role}`);
    const chosen = avail[0];
    selected[role] = chosen;
    used.add(chosen.id);
  }

  const cast: SpeechifyCast = {
    version: 1,
    generatedAt: new Date().toISOString(),
    provider: "speechify",
    model: "simba-3.0",
    language: "es-MX",
    voices: {
      EDUARDO: selected.EDUARDO.id,
      ANDREA: selected.ANDREA.id,
      JAVIER: selected.JAVIER.id,
      RODRIGO: selected.RODRIGO.id,
      VALERIA: selected.VALERIA.id,
    },
    details: Object.fromEntries(Object.entries(selected).map(([k, v]) => [k, v])),
  };
  // validar unicidad final
  const ids = Object.values(cast.voices);
  if (new Set(ids).size !== 5) throw new Error("Casting duplicado: IDs no únicos");
  const maleIds = [cast.voices.EDUARDO, cast.voices.JAVIER, cast.voices.RODRIGO];
  const femaleIds = [cast.voices.ANDREA, cast.voices.VALERIA];
  if (new Set(maleIds).size !== 3 || new Set(femaleIds).size !== 2) throw new Error("Casting género incorrecto");
  if (stateDir) saveCasting(stateDir, cast);
  return cast;
}

export async function getOrCreateCasting(stateDir: string, forceRefresh = false): Promise<SpeechifyCast> {
  if (!forceRefresh) {
    const existing = loadCasting(stateDir);
    if (existing) {
      const overrides = getEnvOverrides();
      let needsUpdate = false;
      for (const [role, id] of Object.entries(overrides) as Array<[keyof SpeechifyCast["voices"], string]>) {
        if (existing.voices[role] !== id) needsUpdate = true;
      }
      if (!needsUpdate) return existing;
    }
  }
  const key = process.env.SPEECHIFY_API_KEY?.trim();
  if (!key) throw new Error("SPEECHIFY_API_KEY no configurada");
  return selectCasting(key, stateDir);
}
