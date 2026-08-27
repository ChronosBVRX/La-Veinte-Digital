/**
 * HumanConversationGate — validador pre-TTS.
 * Rechaza texto que delata generación: meta-lenguaje de rol, auto-dirección,
 * residuos de metadatos, repeticiones semánticas y monólogos normativos largos.
 * Todo fallo aquí detiene la producción antes de gastar TTS.
 */
import type { DialogueTurn } from "./director";
import { normalizarTexto } from "./conversation";

export interface GateViolation {
  turnId: string;
  regla: string;
  detalle: string;
  severidad: "fatal" | "warning";
}

const META_PATTERNS: Array<[RegExp, string]> = [
  [/\bnarrador aqu[ií]\b/i, "meta: 'narrador aquí'"],
  [/\bgracias,? narrador\b/i, "meta: 'gracias narrador'"],
  [/\bespera,? narrador\b/i, "meta: 'espera narrador'"],
  [/\bcomo conductor\b/i, "meta: 'como conductor'"],
  [/\bcomo corresponsal\b/i, "meta: 'como corresponsal'"],
  [/\bcomo analista\b/i, "meta: 'como analista'"],
  [/\bvoz\s+[ABNCP]\b/i, "meta: 'voz X'"],
  [/\bsecci[oó]n n[uú]mero\b/i, "meta: 'sección número'"],
  [/\bahora toca\b/i, "meta: 'ahora toca'"],
  [/\ben esta secci[oó]n\b/i, "meta: 'en esta sección'"],
  [/\bpersonaje\b/i, "meta: 'personaje'"],
  [/\bspeaker\b/i, "meta: 'speaker'"],
  [/\bturn_?\d+\b/i, "residuo: id de turno hablado"],
  [/\bsrc_?\d{3}\b/i, "residuo: sourceId hablado"],
  [/\bcita\s+(?:de\s+)?(?:src|t)\d+/i, "residuo: cita con id interno"],
];

/** IDs/códigos que jamás deben pronunciarse textualmente. */
const METADATA_RESIDUE = /\b(?:C\d{1,2}|T\d{1,3}|src_\w+)\b(?![a-záéíóúñ])/;

const NOMBRES = ["Eduardo", "Andrea", "Javier", "Rodrigo", "Valeria"] as const;

function selfAddress(texto: string, speaker: string): RegExpMatchArray | null {
  const propio = NOMBRES.find((n) => speaker.toUpperCase().includes(n.toUpperCase()));
  if (!propio) return null;
  // apelación al INICIO del turno dirigida a uno mismo ("Eduardo, ..." dicho por Eduardo)
  const re = new RegExp(`^${propio}\\s*[,:]`, "i");
  return re.exec(texto.trim());
}

/** Similitud por bigramas de palabras normalizadas (0-1). */
function bigramSim(a: string, b: string): number {
  const wa = a.split(/\s+/).filter((x) => x.length > 2);
  const wb = b.split(/\s+/).filter((x) => x.length > 2);
  if (wa.length < 4 || wb.length < 4) return 0;
  const bagB = new Set(wb);
  let hits = 0;
  for (let i = 0; i < wa.length - 1; i++) {
    const bi = `${wa[i]} ${wa[i + 1]}`;
    if (bagB.has(bi)) hits++;
  }
  return hits / Math.max(1, Math.min(wa.length - 1, wb.length - 1));
}

export function humanConversationGate(turns: DialogueTurn[]): GateViolation[] {
  const v: GateViolation[] = [];
  const palabrasPorSpeaker: Record<string, number[]> = {};
  let normativoAcumuladoMs = 0;
  let normativoSpeakerPrev: string | null = null;

  turns.forEach((t, i) => {
    const texto = t.text ?? "";

    // ── Meta-lenguaje de rol / residuos (FATAL) ──
    for (const [re, etiqueta] of META_PATTERNS) {
      if (re.test(texto)) {
        v.push({ turnId: t.id, regla: "META_LANGUAGE", detalle: etiqueta, severidad: "fatal" });
        break;
      }
    }
    const mm: RegExpExecArray | null = METADATA_RESIDUE.exec(texto);
    const ctxAntes = texto.slice(Math.max(0, (mm?.index ?? 0) - 20), mm?.index ?? 0);
    if (mm && !/artículo|cláusula/i.test(ctxAntes)) {
      v.push({ turnId: t.id, regla: "METADATA_SPOKEN", detalle: `posible id interno hablado: "${mm[0]}"`, severidad: "fatal" });
    }

    // ── Auto-dirección (FATAL) ──
    const selfM = selfAddress(texto, t.speaker);
    // salvo cita explícita: 'me dijo Eduardo que...' — el patrón exige inicio exacto
    if (selfM) {
      v.push({ turnId: t.id, regla: "SELF_ADDRESS", detalle: `"${selfM[0]}" dicho por ${t.speaker}`, severidad: "fatal" });
    }

    // ── NARRADOR/Javier nunca dice su nombre ni 'narrador' ──
    if (/NARRADOR|JAVIER/i.test(t.speaker) && /\b(narrador|analista)\b/i.test(texto)) {
      v.push({ turnId: t.id, regla: "ROLE_SPOKEN", detalle: "Javier verbaliza su rol", severidad: "fatal" });
    }

    // ── Monólogo normativo largo: Javier no debe pasar de ~18 s sin reacción ──
    const esNormativo = /NARRADOR|JAVIER/i.test(t.speaker) && t.intent === "normative_answer";
    const durEstimadaS = texto.trim().split(/\s+/).length / 2.6;
    if (esNormativo) {
      normativoAcumuladoMs += durEstimadaS * 1000;
      if (normativoSpeakerPrev && normativoSpeakerPrev !== t.speaker) normativoAcumuladoMs = durEstimadaS * 1000;
      normativoSpeakerPrev = t.speaker;
      if (normativoAcumuladoMs > 18_000) {
        v.push({ turnId: t.id, regla: "NORM_MONOLOGUE", detalle: `explicación normativa acumulada ${Math.round(normativoAcumuladoMs / 1000)} s (>18 s) sin devolver la palabra`, severidad: "fatal" });
        normativoAcumuladoMs = 0; // reportar una vez por ráfaga
      }
    } else {
      normativoAcumuladoMs = 0;
      normativoSpeakerPrev = null;
    }

    // ── Pausas demasiado largas para charla ágil (WARNING) ──
    if ((t.pauseBeforeMs ?? 0) >= 900 && !/dramátic|pausa deliberada/i.test(t.transition ?? "")) {
      v.push({ turnId: t.id, regla: "LONG_PAUSE", detalle: `pauseBeforeMs=${t.pauseBeforeMs} (>900 ms sin intención marcada)`, severidad: "warning" });
    }

    // ── Interrupción sin solape real (WARNING) ──
    if (/interrupt/.test(t.intent ?? "") && !(t.overlapPreviousMs && t.overlapPreviousMs > 0)) {
      v.push({ turnId: t.id, regla: "INTERRUPT_WITHOUT_OVERLAP", detalle: "interrupción declarada pero entra limpio tras silencio", severidad: "warning" });
    }

    // ── TEMPORAL_CONTINUITY: nadie reacciona a algo que el turno anterior no dijo ──
    if (/reaction|clarification/.test(t.intent ?? "") && i > 0 && t.respondsTo) {
      const prevTurn = turns.find((x) => x.id === t.respondsTo);
      if (prevTurn && prevTurn.speaker === t.speaker) {
        v.push({ turnId: t.id, regla: "TEMPORAL_CONTINUITY", detalle: `reacciona a ${t.respondsTo} pero es del mismo hablante`, severidad: "fatal" });
      }
    }
    // reacción que menciona un concepto ausente en los últimos 2 turnos
    const prevTextos = [turns[i-1]?.text ?? "", turns[i-2]?.text ?? ""].join(" ").toLowerCase();
    if (/reaction|clarification|disagreement/.test(t.intent ?? "") && i > 0) {
      // detectar referencia a tema no introducido aún
      const conceptosNuevos = /\b(comedor|veladas|permuta|lactancia|maternidad|bolsa de trabajo|escalaf[oó]n)\b/i;
      const mencionaNuevo = conceptosNuevos.exec(texto);
      if (mencionaNuevo && !conceptosNuevos.test(prevTextos)) {
        v.push({ turnId: t.id, regla: "SCOPE_ENTAILMENT", detalle: `introduce "${mencionaNuevo[0]}" sin que nadie lo haya mencionado antes`, severidad: "warning" });
      }
    }

    // ── FIRST_PERSON_EVIDENCE: Rodrigo no fabrica casos personales ──
    if (/RODRIGO/i.test(t.speaker)) {
      const primeraPersonaCasos = /\b(una vez|yo vi|yo estuve|me pas[oó]|cuando yo trabajaba|en mi experiencia personal)\b/i;
      if (primeraPersonaCasos.exec(texto)) {
        v.push({ turnId: t.id, regla: "FIRST_PERSON_EVIDENCE", detalle: `"${primeraPersonaCasos.exec(texto)![0]}" — Rodrigo no puede fabricar experiencias propias sin evidencia`, severidad: "fatal" });
      }
    }

    // ── SCOPE_ENTAILMENT: descanso/comedor no justifica horario de entrada/salida ──
    if (/NARRADOR|JAVIER/i.test(t.speaker) && t.intent === "normative_answer") {
      const hablaDescansoComedor = /\b(descanso|comedor|colaci[oó]n|alimentos)\b/i;
      const afirmaHorarioEntradaSalida = /\b(horario de (entrada|salida)|modificar? (el |mi |tu )?horario|cambiar? (el |mi |tu )?horario)\b/i;
      if (hablaDescansoComedor.test(texto) && afirmaHorarioEntradaSalida.test(texto)) {
        v.push({ turnId: t.id, regla: "SCOPE_ENTAILMENT", detalle: "mezcla descanso/comedor con modificación de horario de entrada/salida — verificar pertinencia", severidad: "warning" });
      }
    }

    // ── Repetición semántica contra ventana reciente (WARNING/FATAL si >0.55) ──
    const norm = normalizarTexto(texto);
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      const prev = normalizarTexto(turns[i - back].text);
      if (prev.length < 30 || norm.length < 30) continue;
      const sim = bigramSim(norm, prev);
      if (sim > 0.55) {
        v.push({ turnId: t.id, regla: "SEMANTIC_DUPLICATE", detalle: `bigrama ${Math.round(sim * 100)}% vs ${turns[i - back].id}`, severidad: sim > 0.7 ? "fatal" : "warning" });
        break;
      }
    }

    // ── "patrón" repetido en exceso dentro del mismo episodio IMSS (WARNING) ──
    const usosPatron = (texto.match(/\bpatrón(es)?\b/gi) ?? []).length;
    if (usosPatron >= 2) {
      v.push({ turnId: t.id, regla: "PATRON_ABUSE", detalle: `'patrón' ×${usosPatron} en un solo turno — contexto es IMSS: usar Instituto/jefatura/responsable`, severidad: "warning" });
    }

    // ── "los CCTs" o siglas forzadas (WARNING) ──
    if (/\bCCTs\b/.test(texto)) {
      v.push({ turnId: t.id, regla: "SIGLA_FORZADA", detalle: "'CCTs' al aire → primera vez 'Contrato Colectivo de Trabajo', después 'el Contrato'", severidad: "warning" });
    }

    void palabrasPorSpeaker;
    void i;
  });

  return v;
}

/** Resumen binario para quality gate: algún FATAL = bloquear TTS. */
export function gateBloqueado(violaciones: GateViolation[]): { bloquear: boolean; fatales: number; resumen: string[] } {
  const fatales = violaciones.filter((v) => v.severidad === "fatal");
  return {
    bloquear: fatales.length > 0,
    fatales: fatales.length,
    resumen: violaciones.map((v) => `[${v.severidad}] ${v.turnId} ${v.regla}: ${v.detalle}`),
  };
}
