/**
 * ConversationDirector — capa de dirección conversacional.
 *
 * Convierte la escaleta en intercambios con FUNCIÓN CONVERSACIONAL:
 * cada intervención existe porque alguien escuchó la anterior.
 * Reglas clave (no negociables):
 *  - Ninguna cita normativa queda sin reacción posterior.
 *  - Andrea cuestiona, objeta y reacciona; nunca es solo eco de Eduardo.
 *  - Javier solo fundamento; Eduardo dirige sin monopolizar;
 *    Rodrigo trae campo y mantiene conversación; Valeria SOLO comercial.
 *  - Longitudes variadas; pausas clasificadas; solapes con causa semántica.
 */

import type { DialogueTurn, SpeakerProfile, EvidenceClaim, CitationMode } from "./director";
import { fraseCitaPublic } from "./director";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type TurnIntent =
  | "statement"
  | "question"
  | "answer"
  | "reaction"
  | "backchannel"
  | "interrupt_question"
  | "interrupt_correction"
  | "agreement"
  | "disagreement"
  | "clarification"
  | "example"
  | "summary"
  | "handoff"
  | "normative_request"
  | "normative_answer"
  | "field_report"
  | "commercial";

export interface EpisodeMemory {
  episodeId: string;
  factsExplained: string[];
  questionsOpen: string[];
  claimsSupported: string[];
  claimsPending: string[];
  examplesUsed: string[];
  phrasesRecentlyUsed: string[];
  speakerLastTurn: Record<string, string>;
  speakerWords: Record<string, number>;
  commercialsPlayed: string[];
  callbacksAvailable: Array<{ id: string; resumen: string; turnoId: string }>;
}

export function nuevoMemory(episodeId: string): EpisodeMemory {
  return {
    episodeId,
    factsExplained: [],
    questionsOpen: [],
    claimsSupported: [],
    claimsPending: [],
    examplesUsed: [],
    phrasesRecentlyUsed: [],
    speakerLastTurn: {},
    speakerWords: {},
    commercialsPlayed: [],
    callbacksAvailable: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pausas por intención (clasificación, no números fijos por capricho)
// ─────────────────────────────────────────────────────────────────────────────

export const PAUSA = {
  micro: [80, 250] as const,
  cambioHablante: [260, 520] as const,
  deliberada: [600, 1100] as const,
};

function randSeeded(seed: number, min: number, max: number): number {
  // determinista por seed
  const x = Math.sin(seed) * 10000;
  const f = x - Math.floor(x);
  return Math.round(min + f * (max - min));
}

/** Pausa ANTES de una intervención según su intención y si cambia hablante. */
export function pausaAntesDe(t: { intent?: TurnIntent }, cambiaHablante: boolean, seed: number): number {
  switch (t.intent) {
    case "backchannel":
    case "interrupt_question":
    case "interrupt_correction":
      return randSeeded(seed, 0, 60); // entra encima / casi encima
    case "reaction":
      return randSeeded(seed, PAUSA.micro[0], PAUSA.micro[1]);
    case "normative_answer":
      return randSeeded(seed, PAUSA.cambioHablante[0], PAUSA.cambioHablante[1] + 120); // espacio mayor
    case "summary":
      return randSeeded(seed, PAUSA.deliberada[0], PAUSA.deliberada[1]);
    default:
      return cambiaHablante
        ? randSeeded(seed, PAUSA.cambioHablante[0], PAUSA.cambioHablante[1])
        : randSeeded(seed, PAUSA.micro[0], PAUSA.micro[1]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro-reacciones contextuales con anti-repetición
// ─────────────────────────────────────────────────────────────────────────────

export const MICRO_REACCIONES: Record<string, string[]> = {
  acuerdo: ["Exacto.", "Así es.", "Justo ahí.", "Eso mismo.", "Sí, tal cual."],
  duda: ["Ajá, cuéntame.", "Ya veo.", "Entiendo.", "¿Y eso por qué?", "Mmm, ya veo."],
  sorpresa: ["Ahí está.", "Eso cambia todo.", "Ojo con eso.", "No lo tenía claro.", "Vaya dato."],
  transicion: ["A ver, cuéntame.", "Espera un segundo.", "Pero entonces…", "Bueno, ahí hay algo.", "Justo en ese punto."],
  desacuerdo: ["Ahí no estoy tan segura.", "Yo ahí sí te diría que depende.", "Pero espera, no es tan directo.", "Hmm, ahí te contradices un poquito."],
};


/** Elige un texto de la lista que NO esté ya usado en memoria; si todos están
 *  usados, genera una variante con conector distinto para evitar clon exacto. */
function elegirUnico(candidatos: string[], memory: EpisodeMemory, seed: number): string {
  const usados = new Set(memory.phrasesRecentlyUsed.map((x) => normalizarTexto(x)));
  const libres = candidatos.filter((c) => !usados.has(normalizarTexto(c)));
  if (libres.length > 0) {
    const idx = randSeeded(seed, 0, libres.length - 1);
    return libres[Math.max(0, idx)];
  }
  const conectores = ["Fíjate que ", "Mira, ", "Te cuento algo útil: ", "Esto es clave: ", "Y toma nota: "];
  const base = candidatos[randSeeded(seed, 0, candidatos.length - 1)];
  const c = conectores[randSeeded(seed + 7, 0, conectores.length - 1)];
  return `${c}${base.charAt(0).toLowerCase()}${base.slice(1)}`;
}

export class ReactionPool {
  private usados = new Map<string, Set<string>>();
  constructor(private episodeSeed: number) {}

  /** Elige variante no usada recientemente para esta categoría. */
  pick(categoria: keyof typeof MICRO_REACCIONES, contador: number): string {
    const pool = MICRO_REACCIONES[categoria] ?? MICRO_REACCIONES.acuerdo;
    let usadosCat = this.usados.get(categoria);
    if (!usadosCat) {
      usadosCat = new Set();
      this.usados.set(categoria, usadosCat);
    }
    if (usadosCat.size >= pool.length) usadosCat.clear(); // ciclo solo tras agotar
    const libres = pool.filter((p) => !usadosCat!.has(p));
    const idx = randSeeded(this.episodeSeed + contador * 31, 0, libres.length - 1);
    const eleccion = libres[Math.max(0, idx)] ?? pool[0];
    usadosCat.add(eleccion);
    return eleccion;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firewall editorial de Valeria
// ─────────────────────────────────────────────────────────────────────────────

export interface FirewallViolation {
  turnId: string;
  regla: string;
  detalle: string;
}

const PATRONES_EDITORIALES = /\b(cláusula|clausula|artículo|articulo|LFT|LSS|CCT|derecho|plazo|jornada|incapacidad|prima|pensión|pension|trabajador\w*|IMSS)\b/i;

export function validateRoleFirewall(turns: DialogueTurn[]): FirewallViolation[] {
  const v: FirewallViolation[] = [];
  for (const t of turns) {
    const esValeria = t.speaker.toUpperCase().includes("VALERIA");
    if (!esValeria) continue;
    const comercialOk = t.adSlot === true || t.intent === "commercial" || t.kind === "ad";
    if (!comercialOk) {
      v.push({ turnId: t.id, regla: "VALERIA_SOLO_COMERCIAL", detalle: "intervención de Valeria fuera de bloque comercial" });
    }
    if (t.editorial === true) {
      v.push({ turnId: t.id, regla: "VALERIA_EDITORIAL", detalle: "flag editorial=true en voz comercial" });
    }
    if (!comercialOk && PATRONES_EDITORIALES.test(t.text)) {
      v.push({ turnId: t.id, regla: "VALERIA_CONTENIDO_JURIDICO", detalle: "texto con términos normativos en voz comercial" });
    }
  }
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analizador de distribución (detector de anomalías, NO cuotas rígidas)
// ─────────────────────────────────────────────────────────────────────────────

export interface DistributionReport {
  palabrasPorLocutor: Record<string, number>;
  porcentajePorLocutor: Record<string, number>;
  turnos: number;
  longitudMediaPalabras: number;
  longitudMaxima: number;
  preguntas: number;
  interrupciones: number;
  reacciones: number;
  advertencias: string[];
}

export function analyzeDistribution(turns: DialogueTurn[], _speakers: SpeakerProfile[] = []): DistributionReport {
  const palabras: Record<string, number> = {};
  let totalPalabras = 0;
  let preguntas = 0;
  let interrupciones = 0;
  let reacciones = 0;
  let maxLen = 0;
  const longitudes: number[] = [];
  const editoriales = turns.filter((t) => t.kind !== "ad" && !t.adSlot);

  for (const t of editoriales) {
    const w = t.text.trim().split(/\s+/).filter(Boolean).length;
    palabras[t.speaker] = (palabras[t.speaker] ?? 0) + w;
    totalPalabras += w;
    longitudes.push(w);
    if (w > maxLen) maxLen = w;
    if (t.intent === "question" || t.intent === "interrupt_question" || t.intent === "normative_request" || /\?\s*$/.test(t.text)) preguntas++;
    if (t.intent && /interrupt/.test(t.intent)) interrupciones++;
    if (t.intent === "reaction" || t.intent === "backchannel") reacciones++;
  }

  const pct: Record<string, number> = {};
  for (const [k, v] of Object.entries(palabras)) pct[k] = totalPalabras > 0 ? Math.round((v / totalPalabras) * 100) : 0;

  const adv: string[] = [];
  const eduardoPct = Object.entries(pct).find(([k]) => k.toUpperCase().includes("EDUARDO"))?.[1] ?? 0;
  if (eduardoPct > 48) adv.push(`Eduardo concentra ${eduardoPct}% del texto editorial (>45%).`);
  const andreaEntry = Object.entries(palabras).find(([k]) => /ANDREA|MARIANA/i.test(k));
  if (andreaEntry) {
    const andreaTurns = editoriales.filter((t) => /ANDREA|MARIANA/i.test(t.speaker));
    const cortas = andreaTurns.filter((t) => t.text.trim().split(/\s+/).filter(Boolean).length < 5).length;
    if (andreaTurns.length > 0 && cortas / andreaTurns.length > 0.4) adv.push("Andrea dice principalmente frases menores a 5 palabras (acompañante, no co-conductora).");
  } else {
    adv.push("Andrea no participa en el guion.");
  }
  const alonsoTurns = editoriales.filter((t) => /NARRADOR|ALONSO/i.test(t.speaker));
  if (alonsoTurns.length > 0 && alonsoTurns.every((t) => (t.citations?.length ?? 0) === 0)) {
    adv.push("Javier aparece sin ninguna cita verificada.");
  }
  const rodrigoTurns = editoriales.filter((t) => /RODRIGO/i.test(t.speaker));
  for (let i = 0; i < rodrigoTurns.length; i++) {
    const idx = editoriales.indexOf(rodrigoTurns[i]);
    const siguiente = editoriales[idx + 1];
    const alguienLeResponde = siguiente && !/RODRIGO/i.test(siguiente.speaker) && (siguiente.respondsTo === rodrigoTurns[i].id || siguiente.intent === "question");
    if (i === rodrigoTurns.length - 1 && !alguienLeResponde && rodrigoTurns.length > 0) {
      adv.push("Rodrigo participa pero nadie le responde ni le pregunta.");
      break;
    }
  }

  return {
    palabrasPorLocutor: palabras,
    porcentajePorLocutor: pct,
    turnos: editoriales.length,
    longitudMediaPalabras: longitudes.length ? Math.round(longitudes.reduce((a, b) => a + b, 0) / longitudes.length) : 0,
    longitudMaxima: maxLen,
    preguntas,
    interrupciones,
    reacciones,
    advertencias: adv,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QA conversacional (lista PASS/FAIL del contrato editorial)
// ─────────────────────────────────────────────────────────────────────────────

export interface QaLinea { check: string; pass: boolean; detalle: string }

export function auditConversation(turns: DialogueTurn[]): QaLinea[] {
  const edit = turns.filter((t) => t.kind !== "ad" && !t.adSlot);
  const lineas: QaLinea[] = [];

  // 1. Toda pregunta obtiene respuesta o queda deliberadamente abierta
  const sinRespuesta: string[] = [];
  edit.forEach((t, i) => {
    const esQ = t.intent === "question" || t.intent === "interrupt_question" || t.intent === "normative_request" || /\?\s*$/.test(t.text);
    if (!esQ) return;
    const respuestas = edit.slice(i + 1, i + 3);
    // responde quien (a) declara responder a esta pregunta o (b) usa intención de respuesta
    const respondida = respuestas.some((r) => r.speaker !== t.speaker && (r.respondsTo === t.id || r.intent === "answer" || r.intent === "normative_answer" || r.intent === "clarification" || r.intent === "field_report"));
    const abiertaDeliberada = i >= edit.length - 3; // cierre puede dejar abierta
    if (!respondida && !abiertaDeliberada) sinRespuesta.push(`${t.id} ("${t.text.slice(0, 32)}…")`);
  });
  lineas.push({ check: "cada pregunta obtiene respuesta o queda deliberadamente abierta", pass: sinRespuesta.length === 0, detalle: sinRespuesta.join("; ") || "ok" });

  // 2. Cita importante siempre con reacción posterior
  const citasFrias: string[] = [];
  edit.forEach((t, i) => {
    if (t.intent !== "normative_answer") return;
    // la reacción puede llegar después de una segunda parte del propio fundamento
    let posReaccion = i + 1;
    while (posReaccion < edit.length && edit[posReaccion].speaker === t.speaker && posReaccion <= i + 2) posReaccion++;
    const sig = edit[posReaccion];
    const reaccion = sig && sig.speaker !== t.speaker && ["reaction", "agreement", "disagreement", "question", "interrupt_question", "clarification", "summary", "handoff", "statement"].includes(sig.intent ?? "statement");
    if (!reaccion) citasFrias.push(t.id);
  });
  lineas.push({ check: "ninguna cita importante queda sin reacción posterior", pass: citasFrias.length === 0, detalle: citasFrias.join(", ") || "ok" });

  // 3. Escenas sin monólogos exclusivos (salvo apertura/cierre)
  const porEscena = new Map<string, DialogueTurn[]>();
  for (const t of edit) {
    const key = t.sceneId ?? "?";
    if (!porEscena.has(key)) porEscena.set(key, []);
    porEscena.get(key)!.push(t);
  }
  const monologos: string[] = [];
  for (const [escena, ts] of porEscena) {
    if (/apertura|cierre/i.test(escena)) continue;
    const vocesUnicas = new Set(ts.map((x) => x.speaker));
    if (ts.length >= 4 && vocesUnicas.size < 2) monologos.push(escena);
  }
  lineas.push({ check: "ninguna escena contiene únicamente monólogos salvo justificación", pass: monologos.length === 0, detalle: monologos.join(", ") || "ok" });

  // 4. Rodrigo conversa cuando participa
  const rodrigo = edit.filter((t) => /RODRIGO/i.test(t.speaker));
  const rodrigoSolo = rodrigo.length > 0 && !edit.some((t) => t.respondsTo && rodrigo.some((r) => r.id === t.respondsTo));
  lineas.push({ check: "Rodrigo mantiene conversación cuando participa", pass: rodrigo.length === 0 || !rodrigoSolo, detalle: rodrigoSolo ? "nadie responde a Rodrigo" : "ok" });

  // 5. Andrea aporta (no solo acompañante)
  const andrea = edit.filter((t) => /ANDREA|MARIANA/i.test(t.speaker));
  const andreaUtil = andrea.filter((t) => ["question", "disagreement", "interrupt_question", "example", "answer", "clarification", "normative_request"].includes(t.intent ?? "")).length;
  lineas.push({ check: "Andrea aporta información/preguntas y no es solamente acompañante", pass: andrea.length === 0 || andreaUtil >= Math.min(3, andrea.length), detalle: `${andreaUtil}/${andrea.length} intervenciones con función` });

  // 6. Eduardo dirige pero no monopoliza
  const palabras = analyzeDistribution(edit, []).porcentajePorLocutor;
  const edPct = Object.entries(palabras).find(([k]) => /EDUARDO/i.test(k))?.[1] ?? 0;
  lineas.push({ check: "Eduardo dirige pero no monopoliza", pass: edPct <= 48, detalle: `${edPct}% del texto` });

  // 7. Javier solo fundamento
  const alonsoFuera = edit.filter((t) => /NARRADOR|ALONSO/i.test(t.speaker) && t.intent && !["normative_answer", "statement", "handoff"].includes(t.intent));
  lineas.push({ check: "Javier solamente aporta fundamento/contexto institucional", pass: alonsoFuera.length === 0, detalle: alonsoFuera.map((t) => t.id).join(", ") || "ok" });

  // 8. Firewall Valeria
  const fw = validateRoleFirewall(turns);
  lineas.push({ check: "Valeria permanece fuera del editorial", pass: fw.length === 0, detalle: fw.map((f) => `${f.turnId}:${f.regla}`).join(", ") || "ok" });

  // 9-10. Transiciones y comerciales repetidos
  const transiciones = edit.map((t) => t.transition).filter(Boolean) as string[];
  const transRepetidas = transiciones.filter((x, i) => transiciones.indexOf(x) !== i && x !== null && x.length > 3);
  lineas.push({ check: "no existen transiciones repetitivas", pass: new Set(transiciones.filter((x) => x && x !== "cambio editorial")).size === transiciones.filter((x) => x && x !== "cambio editorial").length, detalle: [...new Set(transRepetidas)].slice(0, 3).join(", ") || "ok" });

  const textosNorm = edit.map((t) => normalizarTexto(t.text));
  const duplicados = textosNorm.filter((x, i) => textosNorm.indexOf(x) !== i && x.length > 25);
  lineas.push({ check: "no existen frases clonadas en distintas partes del episodio", pass: duplicados.length === 0, detalle: duplicados.length > 0 ? `${duplicados.length} duplicados` : "ok" });

  return lineas;
}

export function normalizarTexto(s: string): string {
  return s.toLowerCase().replace(/[^\wáéíóúñü\s]/gi, "").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// conversationQualityScore — control de naturalidad antes de TTS
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationScore {
  score: number; // 0-100
  componentes: Record<string, number>;
  issues: string[];
  aprobarGeneracion: boolean;
}

export function conversationQualityScore(turns: DialogueTurn[]): ConversationScore {
  const dist = analyzeDistribution(turns, []);
  const qa = auditConversation(turns);
  const edit = turns.filter((t) => t.kind !== "ad" && !t.adSlot);
  const issues: string[] = [];

  // Variedad de longitudes (desviación relativa)
  const lens = edit.map((t) => t.text.trim().split(/\s+/).filter(Boolean).length);
  const media = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const sd = lens.length > 1 ? Math.sqrt(lens.reduce((a, b) => a + (b - media) ** 2, 0) / lens.length) : 0;
  const variedadLen = media > 0 ? Math.min(15, Math.round((sd / media) * 30)) : 0;

  // Balance (penaliza monopolio)
  const maxPct = Math.max(0, ...Object.values(dist.porcentajePorLocutor));
  const balance = maxPct <= 45 ? 15 : maxPct <= 50 ? 9 : maxPct <= 58 ? 4 : 0;
  if (maxPct > 48) issues.push(`monopolio: locutor dominante ${maxPct}%`);

  // Preguntas auténticas
  const pregAuth = dist.preguntas >= 4 ? 12 : dist.preguntas >= 2 ? 7 : 2;
  if (dist.preguntas < 3) issues.push(`pocas preguntas reales (${dist.preguntas})`);

  // Respuestas conectadas (respondsTo)
  const conectadas = edit.filter((t) => t.respondsTo).length;
  const conexion = Math.min(15, Math.round((conectadas / Math.max(1, edit.length)) * 40));
  if (conectadas < edit.length * 0.2) issues.push("pocas intervenciones declaran a quién responden");

  // Reacciones e interrupciones justificadas
  const reacciones = dist.reacciones;
  const interr = dist.interrupciones;
  const dinamica = Math.min(13, reacciones + interr * 2);
  if (reacciones === 0 && interr === 0) issues.push("sin reacciones ni interrupciones: suena a bloques alternados");

  // Ausencia de repeticiones
  const norm = edit.map((t) => normalizarTexto(t.text));
  const dups = norm.filter((x, i) => norm.indexOf(x) !== i && x.length > 25).length;
  const sinDups = dups === 0 ? 10 : 0;
  if (dups > 0) issues.push(`${dups} frases clonadas`);

  // Diversidad de comienzos
  const comienzos = new Set(edit.map((t) => t.text.trim().split(/\s+/)[0]?.toLowerCase())).size;
  const divComienzos = Math.min(8, comienzos);

  // Callbacks
  const conCallbacks = turns.some((t) => /recuerdas|como te decía|mencionabas|lo que decía/i.test(t.text)) ? 5 : 0;

  // Final práctico
  const cierrePractico = turns.slice(-4).some((t) => /puedes hacer|qué hago|pasos|mañana|hoy mismo|documenta|guarda|acude/i.test(t.text)) ? 7 : 2;

  // Penalización por QA fallido
  const fallosQa = qa.filter((q) => !q.pass);
  if (fallosQa.length > 0) issues.push(...fallosQa.map((f) => `QA: ${f.check} — ${f.detalle}`));

  const score = Math.min(100, variedadLen + balance + pregAuth + conexion + dinamica + sinDups + divComienzos + conCallbacks + cierrePractico - fallosQa.length * 5);
  return {
    score: Math.max(0, score),
    componentes: { variedadLen, balance, pregAuth, conexion, dinamica, sinDups, divComienzos, callbacks: conCallbacks, cierrePractico },
    issues,
    aprobarGeneracion: score >= 55 && fallosQa.length === 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructor de intercambios — el corazón del director conversacional
// ─────────────────────────────────────────────────────────────────────────────

export interface ExchangeContext {
  conductor: SpeakerProfile;
  coConductora: SpeakerProfile;
  narrador?: SpeakerProfile;
  corresponsal?: SpeakerProfile;
  memory: EpisodeMemory;
  pool: ReactionPool;
  modoCita: CitationMode;
  seedBase: number;
}

type Draft = Omit<DialogueTurn, "id" | "pauseBeforeMs"> & {
  intent: TurnIntent;
  respondsTo?: string | null;
  pauseBeforeMs?: number;
};

/**
 * Construye UN intercambio conversacional alrededor de una afirmación
 * verificada. Devuelve los drafts en orden; el llamador les asigna ids.
 */
export function buildExchange(ctx: ExchangeContext, claim: EvidenceClaim, sceneTitulo: string, contadores: { n: number }): Draft[] {
  const { conductor: E, coConductora: A, narrador: N, corresponsal: R, pool } = ctx;
  const drafts: Draft[] = [];
  const s = ctx.seedBase + contadores.n * 97;
  let prevSpeaker = "";
  const ultimoId = ""; // se resuelve después con ids reales

  const push = (d: Draft) => {
    const cambia = prevSpeaker !== d.speaker;
    if (d.pauseBeforeMs === undefined || d.pauseBeforeMs == null) {
      d.pauseBeforeMs = pausaAntesDe(d, cambia, s + contadores.n * 13 + drafts.length * 7);
    }
    if (d.overlapPreviousMs != null && d.overlapPreviousMs > 0) {
      d.pauseBeforeMs = 0;
      d.canOverlap = true;
    }
    if (typeof d.pauseAfterMs !== "number") {
      d.pauseAfterMs = randSeeded(s + drafts.length * 11, PAUSA.micro[0], PAUSA.cambioHablante[1]);
    }
    prevSpeaker = d.speaker;
    drafts.push(d as unknown as Draft);
  };

  const esOjo = /ojo/i.test(sceneTitulo);
  const textoClaim = claim.texto.replace(/\s+/g, " ").trim();
  const recorte = textoClaim.length > 150 ? `${textoClaim.slice(0, 150)}…` : textoClaim;

  // 1. Eduardo plantea corto — introducción VARIADA por seed
  const introsPlanteamiento = [
    `A ver, vamos con esto: ${recorte}`,
    `Esto que sigue es de lo más preguntado: ${recorte}`,
    `Ponle atención a este punto, porque vale oro: ${recorte}`,
    `Y aquí viene algo que casi nadie se lee: ${recorte}`,
    `Vamos al grano con esto otro: ${recorte}`,
    `Mira qué dato tan útil: ${recorte}`,
  ];
  push({
    speaker: E.id,
    text: esOjo
      ? `Ahora, aquí viene una parte delicada: ${textoClaim.slice(0, 140)}${textoClaim.length > 140 ? "…" : ""}`
      : introsPlanteamiento[randSeeded(s + contadores.n * 11, 0, introsPlanteamiento.length - 1)],
    intent: "statement",
    energy: 3,
    pace: "normal",
    canOverlap: false,
    transition: null,
    citations: [claim.id],
    respondsTo: null,
    emotion: esOjo ? "serio" : "conducción",
    pauseAfterMs: randSeeded(s + 1, 180, 420),
  } as Draft);

  // 2. Andrea reacciona con doubt real o backchannel con solape
  const categoriaReaccion: keyof typeof MICRO_REACCIONES = esOjo ? "sorpresa" : contadores.n % 3 === 0 ? "duda" : "acuerdo";
  const reaccionCorta = pool.pick(categoriaReaccion, contadores.n);
  push({
    speaker: A.id,
    text: reaccionCorta,
    intent: "backchannel",
    overlapPreviousMs: randSeeded(s + 2, 120, 220),
    allowCutPrevious: false,
    energy: 3,
    pace: "rapido",
    canOverlap: true,
    transition: null,
    citations: [],
    respondsTo: ultimoId || undefined,
    emotion: categoriaReaccion,
    pauseAfterMs: 0,
  } as Draft);

  // 3. Andrea formula la pregunta/incógnita real (la duda natural del oyente)
  const dudas = [
    `Pero espera, ¿eso aplica aunque uno tenga antigüedad corta?`,
    `Ahí tengo una duda: ¿eso vale igual si te lo dicen verbalmente?`,
    `Y en la práctica, ¿quién tiene que demostrar eso?`,
    `Bueno, pero ¿cuánto tiempo tiene la persona para actuar?`,
    `¿Y qué pasa si ya firmó algo? Porque eso pasa mucho.`,
    `¿Y si el área no responde? Porque también pasa.`,
    `Ojo, ¿eso lo cubre el contrato o es puro acuerdo interno?`,
  ];
  push({
    speaker: A.id,
    text: elegirUnico(dudas, ctx.memory, s + 40),
    intent: "question",
    energy: 4,
    pace: "normal",
    canOverlap: false,
    transition: null,
    citations: [],
    emotion: "curiosa",
    pauseAfterMs: randSeeded(s + 3, 220, 480),
  } as Draft);

  // 4. Eduardo responde parcialmente y hace handoff a Javier (variado)
  const handoffs = [
    `Buena pregunta, y justo ahí está el detalle. Javier, ayúdanos con lo que dice la fuente sobre esto.`,
    `Eso es importante. Javier, ¿qué dice exactamente el documento?`,
    `Espérame tantito, porque aquí conviene ir a la fuente. Javier, danos el fundamento.`,
    `Justo ahí hay un matiz que vale la pena leer tal cual está escrito. Javier.`,
    `Y para no quedarnos en comentarios: Javier, ¿qué respaldo hay?`,
  ];
  push({
    speaker: E.id,
    text: elegirUnico(handoffs, ctx.memory, s + 30),
    intent: "normative_request",
    respondsTo: null, // se liga al id de la pregunta al asignar ids
    energy: 3,
    pace: "normal",
    canOverlap: false,
    transition: null,
    citations: [],
    emotion: "conducción",
    pauseAfterMs: randSeeded(s + 4, 300, 600),
  } as Draft);

  // 5. Javier fundamento exacto
  if (N) {
    push({
      speaker: N.id,
      text: fraseCitaPublic(claim, ctx.modoCita, ctx.seedBase + contadores.n * 29),
      intent: "normative_answer",
      energy: 2,
      pace: "lento",
      canOverlap: false,
      transition: null,
      citations: [claim.id],
      emotion: "institucional",
      pauseAfterMs: randSeeded(s + 5, 280, 550),
    } as Draft);
  }

  // 6. Andrea REACCIONA al dato (nunca cita fría) — consecuencia práctica, VARIADA
  const reaccionesCita = [
    `Entonces el plazo no empieza cuando a Recursos Humanos le convenga. Eso cambia todo.`,
    `O sea, una cosa es la costumbre del área y otra lo que está escrito. Ahí está la clave.`,
    `Eso me gusta más, porque le da certeza a la persona de qué revisar primero.`,
    `Perfecto, entonces sí hay respaldo escrito. No era puro rumor.`,
    `Ajá, y eso significa que la persona puede exigirlo por escrito, no solo pedirlo de buena suerte.`,
    `Entiendo. Entonces el trámite sí tiene un camino claro, nomás hay que seguirlo con papel en mano.`,
  ];
  push({
    speaker: A.id,
    text: elegirUnico(reaccionesCita, ctx.memory, s + 60),
    intent: "reaction",
    respondsTo: null,
    energy: 4,
    pace: "normal",
    canOverlap: false,
    transition: null,
    citations: [claim.id],
    emotion: "comprensión",
    pauseAfterMs: randSeeded(s + 6, 160, 380),
  } as Draft);

  // 7. Aterriza alternando Eduardo/Andrea (longitud variable)
  const aterrizaLargo = contadores.n % 2 === 0;
  const aterrizaEduardo = contadores.n % 2 === 0;
  const textoAterriza = elegirUnico(
    !aterrizaEduardo
      ? [
          "Y para llevarlo a tu caso: revisa tu contrato y tus recibos antes de asumir que te toca lo mismo que al compañero.",
          "En tu caso concreto: compara lo que dice tu nómina y tu contrato con esto que acabamos de ver.",
        ]
      : aterrizaLargo
        ? [
            "Exactamente. Y eso es lo importante: no quedarse con el comentario de pasillo, sino revisar el documento, guardar copia de lo que firmes o recibas y preguntar a tu representación sindical si algo no cuadra.",
            "Entonces, en resumen: fuente primero, copia firmada guardada, y duda grande se pregunta, no se improvisa.",
          ]
        : [
            "Eso. Documento primero, comentarios después.",
            "Esa es la clave: papel y fecha antes que rumores.",
          ],
    ctx.memory,
    s + 50
  );
  push({
    speaker: aterrizaEduardo ? E.id : A.id,
    text: textoAterriza,
    intent: "summary",
    energy: 3,
    pace: "normal",
    canOverlap: false,
    transition: null,
    citations: [],
    emotion: "aterrizaje",
    pauseAfterMs: randSeeded(s + 7, 240, 520),
  } as Draft);

  // 8. Rodrigo ocasionalmente trae campo Y alguien le responde
  if (R && contadores.n % 3 === 1) {
    const reportesRodrigo = [
      `Eduardo, precisamente revisando casos así encontré algo: la gente suele llegar tarde a documentar porque asume que con la palabra basta. Lo que más falta cuando surge el problema son fechas y copias.`,
      `Pues mira, en unidades se escucha mucho este tema. Y casi siempre el tropiezo es el mismo: nadie guarda la constancia de lo que pidió o de lo que le dijeron.`,
      `Yo traigo algo desde campo: los casos que salen adelante son los que tienen papel. Los que se quedan en "palabra de la jefatura", ahí sí sufre la persona.`,
      `Eduardo, esa duda está llegando al correo del programa justo esta semana. Y en los casos que he visto, el detalle está en quién tiene la copia firmada.`,
    ];
    push({
      speaker: R.id,
      text: elegirUnico(reportesRodrigo, ctx.memory, s + 80),
      intent: "field_report",
      energy: 3,
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: [],
      emotion: "reporte",
      pauseAfterMs: randSeeded(s + 8, 200, 450),
    } as Draft);
    push({
      speaker: A.id,
      text: elegirUnico([
        `Y eso conecta con lo que decíamos: si tienes la fecha y el papel, la conversación cambia completamente.`,
        `O sea, Rodrigo está confirmando en campo lo que dice el documento. Eso me convence.`,
        `Justo. Por eso insistimos tanto en el papelito que nadie quiere guardar.`,
      ], ctx.memory, s + 90),
      intent: "reaction",
      respondsTo: null,
      energy: 3,
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: [],
      emotion: "conexión",
      pauseAfterMs: randSeeded(s + 9, 180, 400),
    } as Draft);
    ctx.memory.callbacksAvailable.push({
      id: `cb-${contadores.n}`,
      resumen: "el reporte de Rodrigo sobre documentar tarde",
      turnoId: `rodrigo-${contadores.n}`,
    });
  }

  // registrar frases usadas para anti-repetición global
  for (const d of drafts) {
    ctx.memory.phrasesRecentlyUsed.push(d.text);
  }
  if (ctx.memory.phrasesRecentlyUsed.length > 120) {
    ctx.memory.phrasesRecentlyUsed = ctx.memory.phrasesRecentlyUsed.slice(-80);
  }

  contadores.n++;
  return drafts;
}
