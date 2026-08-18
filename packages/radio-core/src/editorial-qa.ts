import type { DialogueTurn, EpisodeScript } from "./director";
import { analyzeDiversity, type DiversityReport } from "./diversity";

export interface EditorialIssue {
  tipo:
    | "cortinillas_internas"
    | "pausas_excesivas"
    | "cierre_prematuro"
    | "tema_desviado"
    | "monotonia";
  severidad: "baja" | "media" | "alta";
  detalle: string;
  ocurrencias: number;
}

export interface EditorialQaReport {
  score: number;
  issues: EditorialIssue[];
  diversity: DiversityReport;
  stats: {
    turnos: number;
    cortinillasInternas: number;
    pausasLargas: number;
    cierresPrematuros: number;
    temasDesviados: number;
  };
}

export interface EditorialSanitizeResult {
  script: EpisodeScript;
  cambios: number;
  qa: EditorialQaReport;
}

const MAX_PAUSE_BEFORE_MS = 180;
const MAX_PAUSE_AFTER_MS = 260;

const PREMATURE_CLOSE_RE = /\b(nos vemos|hasta la proxima|hasta pronto|antes de irnos|para cerrar|por hoy|despedida)\b/i;
const AIRCRAFT_OFFTOPIC_RE = /\b(pilotos?|tripulantes?|avion|avión|vuelo|descanso horizontal|musico|músico|obra de teatro|barco|buque|maritimo|marítimo|articulo 39|artículo 39)\b/i;
const LABOR_CONTRACT_OFFTOPIC_RE = /\b(contrato por tiempo determinado|tiempo indeterminado|temporada|funcion especifica|función específica|revisión del contrato colectivo|venza el contrato colectivo|sesenta días naturales)\b/i;
const WEAK_AUTHORITY_RE = /\b(no te se decir|no te sé decir|no estoy seguro|no lo tengo a la mano|mejor lo checamos despues|mejor lo checamos después)\b/i;

function isTransition(t: DialogueTurn): boolean {
  return /cortinilla|seccion|sección|cambio|transición|transicion/i.test(t.transition ?? "");
}

function isInternalAudioTransition(t: DialogueTurn, index: number, total: number): boolean {
  if (!/cortinilla/i.test(t.transition ?? "")) return false;
  return index > 1 && index < total - 2;
}

function hasPrematureClose(t: DialogueTurn): boolean {
  return PREMATURE_CLOSE_RE.test(t.text);
}

function isClearlyOffTopic(t: DialogueTurn, tema: string): boolean {
  const normalizedTopic = tema.toLowerCase();
  if (normalizedTopic.includes("tiempo extra") || normalizedTopic.includes("extraordinario")) {
    return AIRCRAFT_OFFTOPIC_RE.test(t.text) || LABOR_CONTRACT_OFFTOPIC_RE.test(t.text) || WEAK_AUTHORITY_RE.test(t.text);
  }
  return false;
}

function clampPause(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 120;
  return Math.min(Math.round(value), max);
}

function normalizeIds(turns: DialogueTurn[]): DialogueTurn[] {
  return turns.map((t, i) => ({ ...t, id: t.id || `qa${String(i + 1).padStart(3, "0")}` }));
}

function removeInternalAudioTransitions(turns: DialogueTurn[]): { turns: DialogueTurn[]; cambios: number } {
  let cambios = 0;
  const out = turns.map((t, i) => {
    const next = { ...t };
    if (isInternalAudioTransition(next, i, turns.length)) {
      next.transition = "cambio editorial";
      cambios += 1;
    }
    return next;
  });
  return { turns: out, cambios };
}

function rebuildScenes(turns: DialogueTurn[]): EpisodeScript["scenes"] {
  const scenes: EpisodeScript["scenes"] = [];
  let current = { id: "s1", titulo: "Apertura", turns: [] as DialogueTurn[] };
  for (const t of turns) {
    if (current.turns.length > 0 && isTransition(t)) {
      scenes.push(current);
      current = {
        id: `s${scenes.length + 1}`,
        titulo: /salida|cierre/i.test(t.transition ?? "") ? "Cierre" : "Sección",
        turns: [],
      };
    }
    current.turns.push(t);
  }
  if (current.turns.length > 0) scenes.push(current);
  if (scenes.length > 1) {
    scenes[scenes.length - 1] = { ...scenes[scenes.length - 1], titulo: "Cierre" };
  }
  return scenes;
}

function stripPrematureClose(text: string): string {
  return text
    .replace(/\s*Nos vemos en el proximo segmento\.?/gi, "")
    .replace(/\s*Nos vemos en el próximo segmento\.?/gi, "")
    .replace(/\s*Por hoy,?\s*/gi, "")
    .replace(/\s*antes de irnos,?\s*/gi, "")
    .replace(/\s*para cerrar este segmento,?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeEditorialScript(script: EpisodeScript): EditorialSanitizeResult {
  let cambios = 0;
  const lastCloseAllowedFrom = Math.max(0, script.turns.length - 5);
  const filtered: DialogueTurn[] = [];

  for (let i = 0; i < script.turns.length; i++) {
    const original = script.turns[i];
    if (isClearlyOffTopic(original, script.tema)) {
      cambios += 1;
      continue;
    }

    const t = { ...original };
    const pauseBefore = clampPause(t.pauseBeforeMs, MAX_PAUSE_BEFORE_MS);
    const pauseAfter = clampPause(t.pauseAfterMs, MAX_PAUSE_AFTER_MS);
    if (pauseBefore !== t.pauseBeforeMs || pauseAfter !== t.pauseAfterMs) cambios += 1;
    t.pauseBeforeMs = pauseBefore;
    t.pauseAfterMs = pauseAfter;

    if (i < lastCloseAllowedFrom && hasPrematureClose(t)) {
      const cleaned = stripPrematureClose(t.text);
      if (cleaned.length >= 18) {
        if (cleaned !== t.text) cambios += 1;
        t.text = cleaned;
      } else {
        cambios += 1;
        continue;
      }
    }

    filtered.push(t);
  }

  const inserted = removeInternalAudioTransitions(normalizeIds(filtered));
  cambios += inserted.cambios;

  const sanitized: EpisodeScript = {
    ...script,
    turns: inserted.turns,
    scenes: rebuildScenes(inserted.turns),
  };

  return {
    script: sanitized,
    cambios,
    qa: auditEditorialScript(sanitized),
  };
}

export function auditEditorialScript(script: EpisodeScript): EditorialQaReport {
  const diversity = analyzeDiversity(script);
  const cortinillasInternas = script.turns.filter((t, i) => isInternalAudioTransition(t, i, script.turns.length)).length;
  const pausasLargas = script.turns.filter((t) => t.pauseBeforeMs > 260 || t.pauseAfterMs > 360).length;
  const lastCloseAllowedFrom = Math.max(0, script.turns.length - 5);
  const cierresPrematuros = script.turns.slice(0, lastCloseAllowedFrom).filter(hasPrematureClose).length;
  const temasDesviados = script.turns.filter((t) => isClearlyOffTopic(t, script.tema)).length;
  const issues: EditorialIssue[] = [];

  if (cortinillasInternas > 0) {
    issues.push({
      tipo: "cortinillas_internas",
      severidad: "media",
      detalle: `${cortinillasInternas} cortinillas internas detectadas; por defecto solo se usa música breve de entrada y salida`,
      ocurrencias: cortinillasInternas,
    });
  }
  if (pausasLargas > 0) {
    issues.push({
      tipo: "pausas_excesivas",
      severidad: pausasLargas >= 8 ? "alta" : "media",
      detalle: `${pausasLargas} turnos tienen pausas largas que pueden sentirse como cortes`,
      ocurrencias: pausasLargas,
    });
  }
  if (cierresPrematuros > 0) {
    issues.push({
      tipo: "cierre_prematuro",
      severidad: "alta",
      detalle: `${cierresPrematuros} turnos cierran el programa antes del final`,
      ocurrencias: cierresPrematuros,
    });
  }
  if (temasDesviados > 0) {
    issues.push({
      tipo: "tema_desviado",
      severidad: "alta",
      detalle: `${temasDesviados} turnos parecen salir del tema principal`,
      ocurrencias: temasDesviados,
    });
  }
  if (diversity.score < 82) {
    issues.push({
      tipo: "monotonia",
      severidad: diversity.score < 70 ? "alta" : "media",
      detalle: `La diversidad conversacional quedó en ${diversity.score}/100`,
      ocurrencias: diversity.issues.length,
    });
  }

  const score = Math.max(0, Math.min(100, 100 - issues.reduce((a, i) => a + (i.severidad === "alta" ? 18 : i.severidad === "media" ? 9 : 4), 0)));
  return {
    score,
    issues,
    diversity,
    stats: {
      turnos: script.turns.length,
      cortinillasInternas,
      pausasLargas,
      cierresPrematuros,
      temasDesviados,
    },
  };
}

export function editorialSegmentGoal(index: number, total: number): string {
  if (index === 0) return "Apertura breve y caso de arranque: plantea la duda central, presenta una situación cotidiana y entra directo al primer punto.";
  if (index === total - 1) return "Cierre práctico: resume en tres pasos concretos y despide SOLO al final.";
  const goals = [
    "Qué dice la normativa: define la regla base sin leer el documento literal.",
    "Ojo con esto: desarma un error común o una confusión frecuente.",
    "Caso práctico: aterriza la regla en una situación común de hospital o unidad.",
    "Consultorio: responde una duda breve y vuelve al tema principal.",
    "Cómo documentarlo: explica qué revisar o conservar antes de reclamar, aclarar o preguntar.",
  ];
  return goals[(index - 1) % goals.length];
}

export function editorialPromptRules(): string {
  return `Arquitectura editorial obligatoria:
- El episodio NO es una lista plana de preguntas. Debe sentirse como programa con secciones.
- Escaleta permanente: Apertura breve → Caso de arranque → Qué dice la normativa → Ojo con esto → Caso práctico o consultorio → Cómo documentarlo → Cierre práctico.
- Cada sección debe tener una función distinta: duda real, regla, excepción, error común, ejemplo, pasos o resumen.
- Mantente en el tema principal; no abras temas satélite solo porque aparezcan en la evidencia.
- Prohibido cerrar, despedirse o decir "nos vemos" antes del último segmento.
- No uses cortinillas internas. La producción lleva solo música ambiental de entrada y de salida, ambas muy cortas.
- Si necesitas marcar un cambio de bloque, usa "transition": "cambio editorial"; eso NO dispara música.
- Pausas recomendadas: pauseBeforeMs 60-160, pauseAfterMs 80-220. No uses pausas largas para simular naturalidad.
- Cada 8-12 turnos debe haber un cambio de dinámica: caso práctico, mito/realidad, consultorio o resumen breve.
- Evita respuestas cansadas: no repitas "exacto", "buena pregunta", "claro" ni el mismo patrón pregunta-respuesta más de dos veces por segmento.`;
}
