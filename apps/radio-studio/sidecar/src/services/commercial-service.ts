/**
 * CommercialService — biblioteca de comerciales + selección + firewall + bridges.
 *
 * REGLAS NO NEGOCIABLES:
 *  - Valeria (comercial) SIEMPRE comercia: nunca interpreta normativa, nunca
 *    afirma derechos ni introduce plazos/requisitos.
 *  - El bridge de entrada/salida lo decide el Director, pero si el texto
 *    generado cruza el firewall, el bridge determinista lo sustituye.
 *  - Un comercial se coloca en una transición natural, no cada N minutos.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  CommercialSchema,
  CommercialTypeSchema,
  type Commercial,
  type CommercialSelection,
  type CommercialPlacement,
  type FirewallViolation,
  type BridgeGeneratorResult,
} from "@la-veinte/studio-contract";

const LIBRARY_FILE = "commercials.json";

const COMMERCIAL_FIREWALL_RE =
  /\b(cláusula|clausula|artículo|articulo|LFT|LSS|Ley del Seguro|CCT|contrato colectivo|plazo|días naturales|INVIMA|IMSS|trabajador\w*|cotizaci[oó]n|semana|quincena|salario|sueldo|pensi[oó]n|jornada|derecho adquirido|requisito)\b/i;

function atomicWrite(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  let lastErr: unknown = null;
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      lastErr = e;
      if (i < 4) {
        const t = Date.now() + 50 + i * 150;
        while (Date.now() < t) { /* espera activa breve */ }
      }
    }
  }
  try {
    fs.copyFileSync(tmp, file);
    fs.rmSync(tmp, { force: true });
  } catch (e2) {
    throw lastErr ?? e2;
  }
}

function readJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export class CommercialLibraryService {
  constructor(private baseDir: string) {}

  private file(): string {
    return path.join(this.baseDir, LIBRARY_FILE);
  }

  private readAll(): Commercial[] {
    return readJson<Commercial[]>(this.file()) ?? [];
  }

  private writeAll(list: Commercial[]): void {
    atomicWrite(this.file(), list);
  }

  private sanitize(c: Commercial): Commercial {
    const parsed = CommercialSchema.safeParse(c);
    return parsed.success ? parsed.data : c;
  }

  list(opts: { onlyActive?: boolean; includeArchived?: boolean } = {}): Commercial[] {
    let list = this.readAll().map((c) => this.sanitize(c));
    if (opts.onlyActive) list = list.filter((c) => c.active && c.state === "active");
    if (!opts.includeArchived) list = list.filter((c) => c.state !== "archived");
    return list;
  }

  get(id: string): Commercial | null {
    return this.readAll().find((c) => c.id === id) ?? null;
  }

  create(input: Omit<Commercial, "id" | "createdAt" | "updatedAt" | "state" | "active">): Commercial {
    const now = new Date().toISOString();
    const item: Commercial = this.sanitize({
      ...input,
      id: crypto.randomUUID().slice(0, 8),
      active: true,
      state: "active",
      createdAt: now,
      updatedAt: now,
    });
    const list = this.readAll();
    list.push(item);
    this.writeAll(list);
    return item;
  }

  update(id: string, patch: Partial<Commercial>): Commercial | null {
    const list = this.readAll();
    const idx = list.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    const next = this.sanitize({ ...list[idx], ...patch, id, updatedAt: new Date().toISOString() });
    list[idx] = next;
    this.writeAll(list);
    return next;
  }

  setActive(id: string, active: boolean): Commercial | null {
    return this.update(id, { active });
  }

  archive(id: string): Commercial | null {
    return this.update(id, { state: "archived", active: false });
  }

  /** Seed con comerciales de ejemplo si la biblioteca está vacía (útil en dev). */
  seedDefaults(): { added: number; items: Commercial[] } {
    const existing = this.readAll();
    if (existing.length > 0) return { added: 0, items: existing };
    const now = new Date().toISOString();
    const defaults: Commercial[] = [
      {
        id: "com-colabora",
        name: "Colabora con La Veinte",
        type: "INSTITUTIONAL" as const,
        description: "Institucional para el final del episodio.",
        tags: ["institucional", "cierre"],
        targetDuration: 20,
        presenter: "VALERIA",
        baseText: "Si tú o alguien de tu unidad quiere acercarnos una duda o un caso, la comunidad de La Veinte está aquí para eso. Comparte, pregunta y sigue al frente.",
        active: true,
        state: "active",
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "com-protege",
        name: "Protege tu información",
        type: "INSTITUTIONAL" as const,
        description: "Recuerda guardar copia de tus documentos.",
        tags: ["institucional", "documentación"],
        targetDuration: 15,
        presenter: "VALERIA",
        baseText: "Aprovechando que aquí hablamos de documentos, un recordatorio: guarda siempre copia de lo que firmes y de lo que recibas. Cuando más lo necesitas, ahí está.",
        active: true,
        state: "active",
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ];
    this.writeAll(defaults);
    return { added: defaults.length, items: defaults };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firewall comercial
// ─────────────────────────────────────────────────────────────────────────────

const COMMERCIAL_PRESENTERS = [
  "VALERIA",
  "COMERCIAL",
  "PATROCINIO",
  "INSTITUCIONAL",
];

function isCommercialPresenter(speaker: string): boolean {
  const s = speaker.toUpperCase();
  return COMMERCIAL_PRESENTERS.some((p) => s.includes(p));
}

/**
 * Verifica que ninguna intervención de voz comercial cruce el firewall.
 * @param rows Turnos tal como quedaron después de generar los bridges.
 */
export function commercialFirewall(rows: Array<{ id: string; speaker: string; text: string; adSlot?: boolean; intent?: string | null; kind?: string | null }>): FirewallViolation[] {
  const violations: FirewallViolation[] = [];
  for (const r of rows) {
    if (!isCommercialPresenter(r.speaker)) continue;
    const esComercial = r.adSlot === true || r.intent === "commercial" || r.kind === "ad";
    // Regla A: fuera de bloque comercial es violación
    if (!esComercial) {
      violations.push({ turnId: r.id, regla: "VALERIA_SOLO_COMERCIAL", detalle: "intervención de voz comercial fuera de bloque comercial" });
    }
    // Regla B: nunca contenido jurídico/normativo
    if (COMMERCIAL_FIREWALL_RE.test(r.text)) {
      violations.push({ turnId: r.id, regla: "VALERIA_CONTENIDO_JURIDICO", detalle: "texto con términos normativos en voz comercial" });
    }
  }
  return violations;
}

export function validateCommercialFirewallPass(rows: Parameters<typeof commercialFirewall>[0]): boolean {
  return commercialFirewall(rows).length === 0;
}

/** Texto determinista de puente si el LLM cruza el firewall. */
const DETERMINISTIC_BRIDGE_IN = [
  "Antes de seguir, hagamos una breve pausa.",
  "Un momento, que aquí hacemos una pausa rápida.",
];
const DETERMINISTIC_BRIDGE_OUT = [
  "Ahora sí, seguimos con el tema.",
  "Listo, regresamos con lo nuestro.",
  "Y continuamos justo donde estábamos.",
];

/** Crea un bridge seguro (determinista) garantizando el firewall. */
export function safeBridge(placement: CommercialPlacement, commercial: Commercial): BridgeGeneratorResult {
  const seed = Math.abs(placement.commercialId.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  const pick = (arr: string[], s: number) => arr[Math.abs(s) % arr.length];
  return {
    bridgeIn: `${pick(DETERMINISTIC_BRIDGE_IN, seed)} Enseguida te comparto algo.`,
    bridgeOut: pick(DETERMINISTIC_BRIDGE_OUT, seed + 1),
    commercialText: commercial.baseText,
    placement,
    firewallPassed: true,
  };
}

/** Filtra el texto generado por el LLM: si cruza el firewall, se descarta. */
export function acceptBridgeText(placement: CommercialPlacement, candidate: { bridgeIn?: string; bridgeOut?: string; commercialText?: string | null; firewallPassed?: boolean } | null): BridgeGeneratorResult {
  const fence = (t: string | undefined | null): boolean => !!t && !COMMERCIAL_FIREWALL_RE.test(t);
  const commercial = candidate?.commercialText ?? "";
  const okCommercial = !commercial || !COMMERCIAL_FIREWALL_RE.test(commercial);
  if (candidate && fence(candidate.bridgeIn) && fence(candidate.bridgeOut) && okCommercial) {
    return {
      bridgeIn: candidate.bridgeIn ?? "",
      bridgeOut: candidate.bridgeOut ?? "",
      commercialText: commercial,
      placement,
      firewallPassed: true,
    };
  }
  // caer al determinista seguro
  const safe = safeBridge(placement, { baseText: commercial } as Commercial);
  return safe;
}

/** Decide colocaciones de comerciales dentro de un guion por transiciones naturales. */
export function planCommercialPlacements(
  turns: Array<{ id: string; speaker: string; text: string; adSlot?: boolean; transition?: string | null }>,
  selection: CommercialSelection,
  library: Commercial[]
): CommercialPlacement[] {
  if (!selection.enabled || selection.ids.length === 0) return [];

  const count = (() => {
    if (selection.count === "1") return 1;
    if (selection.count === "2") return 2;
    if (selection.count === "3") return 3;
    // auto: 1 si el guion es corto, 2 si largo
    return turns.length >= 30 ? 2 : 1;
  })();

  // Buscar puntos de transición ("cambio editorial") para no cortar a media idea
  const breakes = turns
    .map((t, i) => ({ t, i }))
    .filter((x) => /cambio editorial|transici[oó]n|secci[oó]n|espacio/i.test(x.t.transition ?? "") || x.t.adSlot === true)
    .map((x) => x.i);

  const result: CommercialPlacement[] = [];
  for (let k = 0; k < count; k++) {
    const frac = (k + 1) / (count + 1);
    const fromBreak = breakes.find((b) => b / turns.length >= frac);
    const at = fromBreak ?? Math.min(Math.max(4, Math.floor(turns.length * frac)), turns.length - 5);
    const before = turns[at - 1];
    const after = turns[at];
    const commercialId = selection.ids[k % selection.ids.length];
    if (!before || !after) continue;
    result.push({
      commercialId,
      topicBefore: before.text.slice(0, 80),
      topicAfter: after.text.slice(0, 80),
      speakerBefore: before.speaker,
      speakerAfter: after.speaker,
      interactionMode: selection.interaccion,
      placementReason: `pausa natural en el turno ${at}`,
      atIndex: at,
    });
  }
  return result;
}
