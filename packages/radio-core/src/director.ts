/**
 * RadioDirector — convierte evidencia normativa en un guion conversacional
 * multi-voz con dirección de radio: pausas, energía, ritmo, solapamientos
 * y transiciones. Determinista (solo corpus) por defecto; el LLM solo pule.
 */

import type { VoiceSlot } from "./voice-slots";
import { nuevoMemory, ReactionPool, buildExchange, type TurnIntent } from "./conversation";

type Draft = Partial<Pick<DialogueTurn, "pauseBeforeMs" | "pauseAfterMs">> & Omit<DialogueTurn, "id" | "pauseBeforeMs" | "pauseAfterMs"> & {
  intent: TurnIntent;
  respondsTo?: string | null;
};

export type SpeakerRole =
  | "conductor"
  | "co-conductor"
  | "narrador"
  | "normative_analyst"
  | "invitado"
  | "reportero"
  | "corresponsal"
  | "experto"
  | "representante"
  | "trabajador"
  | "moderador"
  | "comercial";
export type InteractionLevel = "informativo" | "natural" | "dinamico";
export type Pace = "lento" | "normal" | "rapido";

export interface SpeakerProfile {
  id: string;
  nombre: string;
  rol: SpeakerRole;
  personalidad: string;
  voz: VoiceSlot;
  genero?: "masculino" | "femenino" | "no-binario" | "neutral" | "no-especificado";
  timbre?: string;
  rangoEdad?: "joven" | "adulto" | "maduro";
  acento?: string;
  energia?: number;
  ritmo?: Pace;
  autoridad?: "baja" | "media" | "alta";
  cercania?: "baja" | "media" | "alta";
  especialidad?: string;
  funcionEditorial?: string;
  frecuenciaPreguntas?: "baja" | "media" | "alta";
  longitud?: "breve" | "normal" | "larga";
  puedeInterrumpir?: boolean;
  puedeEjemplificar?: boolean;
  puedeCerrar?: boolean;
  participa?: boolean;
}

export interface DialogueTurn {
  id: string;
  speaker: string;
  text: string;
  kind?: "dialogue" | "ad";
  adSlot?: boolean;
  adDurationSec?: number;
  sponsorName?: string | null;
  pauseBeforeMs: number;
  pauseAfterMs: number;
  energy: 1 | 2 | 3 | 4 | 5;
  pace: Pace;
  canOverlap: boolean;
  transition: string | null;
  citations: string[];
  /** ── Dirección conversacional (opcional, compatible hacia atrás) ── */
  intent?: TurnIntent;
  respondsTo?: string | null;
  emotion?: string;
  overlapPreviousMs?: number;
  allowCutPrevious?: boolean;
  editorial?: boolean;
  sceneId?: string;
  seed?: number;
}

export interface Scene {
  id: string;
  titulo: string;
  turns: DialogueTurn[];
}

export interface EvidenceClaim {
  id: string;
  texto: string;
  documento: string;
  clausula: string | null;
  articulo: string | null;
  pagina: number | null;
}

export interface DirectorInput {
  tema: string;
  duracionMin: number;
  speakers: SpeakerProfile[];
  nivel: InteractionLevel;
  claims: EvidenceClaim[];
  cutoff: string;
  fuentes: Array<{ id: string; title: string; versionLabel: string; sha256: string }>;
  modoCita?: CitationMode;
}

export type CitationMode = "natural" | "documental" | "tecnico";

export interface EpisodeScript {
  tema: string;
  formato: string;
  nivel: InteractionLevel;
  modoCita: CitationMode;
  speakers: SpeakerProfile[];
  scenes: Scene[];
  turns: DialogueTurn[];
  cutoff: string;
  fuentes: Array<{ id: string; title: string; versionLabel: string; sha256: string }>;
  estimacionDurSec: number;
}

export const DEFAULT_SPEAKERS: SpeakerProfile[] = [
  {
    id: "EDUARDO",
    nombre: "Eduardo",
    rol: "conductor",
    personalidad: "Conductor principal: saluda, presenta temas, hace preguntas, lleva el hilo de la conversación con lenguaje cercano.",
    voz: "A",
  },
  {
    id: "ANDREA",
    nombre: "Andrea",
    rol: "co-conductor",
    personalidad: "Co-conductora: explica, cuestiona, pone ejemplos y corrige ideas comunes. Nunca repite lo que Eduardo acaba de decir.",
    voz: "B",
  },
  {
    id: "NARRADOR",
    nombre: "Javier Ríos",
    rol: "normative_analyst" as SpeakerRole,
    personalidad: "Javier Ríos, analista normativo: interviene solo para precisar o demostrar algo con la fuente. Habla como una persona más en la mesa, serio y conciso. JAMÁS dice 'narrador', 'analista', 'voz N' ni explica su rol al aire.",
    voz: "N",
  },
  {
    id: "RODRIGO",
    nombre: "Rodrigo Torres",
    rol: "corresponsal",
    personalidad: "Rodrigo Torres, corresponsal: trae reportes de campo, preguntas de unidades y contexto de piso sin convertir rumores en hechos.",
    voz: "C",
    genero: "masculino",
    timbre: "medio",
    rangoEdad: "adulto",
    acento: "latinoamericano neutro",
    energia: 3,
    ritmo: "normal",
    autoridad: "media",
    cercania: "alta",
    especialidad: "reportes de campo",
    funcionEditorial: "Entrar en segmentos concretos para contar qué duda o situación se está escuchando en hospitales, clínicas u oficinas.",
    frecuenciaPreguntas: "media",
    longitud: "breve",
    puedeInterrumpir: false,
    puedeEjemplificar: true,
    puedeCerrar: false,
    participa: true,
  },
  {
    id: "VALERIA",
    nombre: "Valeria Soto",
    rol: "comercial",
    personalidad: "Valeria Soto, voz comercial: lee patrocinios y avisos pagados con claridad, calidez y separación editorial explícita.",
    voz: "P",
    genero: "femenino",
    timbre: "brillante",
    rangoEdad: "adulto",
    acento: "latinoamericano neutro",
    energia: 4,
    ritmo: "normal",
    autoridad: "media",
    cercania: "media",
    especialidad: "mensajes comerciales",
    funcionEditorial: "Entrar solo en espacios comerciales editables; nunca presentar publicidad como contenido editorial.",
    frecuenciaPreguntas: "baja",
    longitud: "breve",
    puedeInterrumpir: false,
    puedeEjemplificar: false,
    puedeCerrar: false,
    participa: true,
  },
];

const LEVEL_PARAMS: Record<InteractionLevel, { pausa: [number, number]; reacciones: boolean; overlapMs: number; energia: 1 | 2 | 3 | 4 | 5; pace: Pace }> = {
  informativo: { pausa: [380, 620], reacciones: false, overlapMs: 0, energia: 2, pace: "normal" },
  natural: { pausa: [140, 320], reacciones: true, overlapMs: 90, energia: 3, pace: "normal" },
  dinamico: { pausa: [60, 200], reacciones: true, overlapMs: 140, energia: 4, pace: "rapido" },
};

export const REACCIONES = ["Exacto.", "Claro que sí.", "Mmm, ahí está el detalle.", "Eso mismo.", "Justo.", "Ajá, y eso es importante."];

const SEGMENTOS_PROGRAMA = [
  "Qué dice la normativa",
  "Ojo con esto",
  "Caso práctico",
  "Consultorio",
  "Cómo documentarlo",
];

const CASOS_ARRANQUE = [
  "Imagina que una persona sale de turno con una duda concreta: le dijeron una cosa en ventanilla, otra en su área y otra distinta entre compañeros.",
  "Pensemos en alguien que trae el recibo, el horario o el trámite en la mano, pero no sabe qué parte revisar primero.",
  "Vamos a ponerlo en tierra: no como pleito ni como rumor, sino como una situación común que puede pasar en una unidad u hospital.",
];

const CITAS_NATURALES_MARCO = ["De acuerdo con {f}.", "Conforme a {f}.", "Lo respalda {f}.", "Ahí es oficial: {f} lo establece.", "Y esto viene directo de {f}."];

function citaNatural(c: EvidenceClaim, seed = 0): string {
  const fuente = c.documento.startsWith("CCT") ? "el Contrato Colectivo vigente" : c.documento === "LFT" ? "la Ley Federal del Trabajo" : c.documento === "LSS" ? "la Ley del Seguro Social" : "la normativa aplicable";
  const plantilla = CITAS_NATURALES_MARCO[Math.abs(seed) % CITAS_NATURALES_MARCO.length];
  return plantilla.replace("{f}", fuente);
}

function citaDocumental(c: EvidenceClaim): string {
  if (c.clausula) return `Esto se encuentra en la ${c.clausula.toLowerCase().replace("cláusula", "Cláusula")} del Contrato Colectivo vigente.`;
  if (c.articulo) return `Esto se encuentra en el ${c.articulo} de ${c.documento === "LFT" ? "la Ley Federal del Trabajo" : c.documento}.`;
  return `Esto se encuentra en ${c.documento}.`;
}

function citaTecnica(c: EvidenceClaim): string {
  return `Fuente: ${c.documento}${c.clausula ? `, ${c.clausula}` : ""}${c.articulo ? `, ${c.articulo}` : ""}${c.pagina != null ? `, página ${c.pagina}` : ""}.`;
}

export function fraseCitaPublic(c: EvidenceClaim, modo: CitationMode, seed = 0): string {
  return fraseCita(c, modo, seed);
}

function fraseCita(c: EvidenceClaim, modo: CitationMode, seed = 0): string {
  switch (modo) {
    case "natural":
      return citaNatural(c, seed);
    case "documental":
      return citaDocumental(c);
    case "tecnico":
      return citaTecnica(c);
  }
}

function estimaDurSec(texto: string): number {
  const palabras = texto.trim().split(/\s+/).filter(Boolean).length;
  return palabras / 2.6;
}


export function directRadioEpisode(input: DirectorInput): EpisodeScript {
  const p = LEVEL_PARAMS[input.nivel] ?? LEVEL_PARAMS.natural;
  const conductor = input.speakers.find((s) => s.rol === "conductor") ?? input.speakers[0];
  const co = input.speakers.find((s) => s.rol === "co-conductor") ?? input.speakers[1] ?? input.speakers[0];
  const narrador = input.speakers.find((s) => s.rol === "narrador" || s.rol === "normative_analyst");
  const corresponsal = input.speakers.find((s) => s.rol === "corresponsal");
  const scenes: Scene[] = [];
  const allTurns: DialogueTurn[] = [];
  let turn = 0;
  const episodeSeed = 1000 + (input.tema.length * 37) % 900;



  // ── Escena 1: Apertura conversacional ─────────────────────────────────
  const memory = nuevoMemory(`ep-${episodeSeed}`);
  const pool = new ReactionPool(episodeSeed);
  const contadores = { n: 0 };

  const addDrafts = (scene: Scene, drafts: Draft[], sceneId: string): DialogueTurn[] => {
    const ids: DialogueTurn[] = [];
    for (const d of drafts) {
      const full: DialogueTurn = {
        id: `t${String(++turn).padStart(3, "0")}`,
        ...d,
        pauseBeforeMs: typeof d.pauseBeforeMs === "number" ? d.pauseBeforeMs : 300,
        pauseAfterMs: typeof d.pauseAfterMs === "number" ? d.pauseAfterMs : 300,
        sceneId,
        editorial: d.speaker.toUpperCase().includes("VALERIA") ? false : true,
      } as DialogueTurn;
      ids.push(full);
      scene.turns.push(full);
      allTurns.push(full);
    }
    // ligar respondsTo con ids reales: cada intervención reactiva a la anterior relevante
    for (let i = 1; i < ids.length; i++) {
      const t = ids[i];
      if (!t.respondsTo) {
        const prev = ids[i - 1];
        if (["reaction", "answer", "clarification", "agreement", "disagreement", "normative_answer"].includes(t.intent ?? "")) {
          t.respondsTo = prev.id;
        }
      }
    }
    for (const t of ids) {
      memory.speakerWords[t.speaker] = (memory.speakerWords[t.speaker] ?? 0) + t.text.trim().split(/\s+/).filter(Boolean).length;
      memory.speakerLastTurn[t.speaker] = t.id;
    }
    return ids;
  };

  const seedRand = (min: number, max: number) => {
    const s = episodeSeed + turn * 17;
    const x = Math.sin(s) * 10000;
    return Math.round(min + (x - Math.floor(x)) * (max - min));
  };

  // ── Apertura ──
  const apertura: Scene = { id: "s1", titulo: "Apertura", turns: [] };
  addDrafts(apertura, [
    {
      speaker: conductor.id,
      text: `Bienvenidas y bienvenidos a La Veinte Radio. Hoy vamos a hablar de un tema que genera muchísimas dudas entre las personas trabajadoras del IMSS: ${input.tema}.`,
      intent: "statement",
      pauseBeforeMs: 0,
      pauseAfterMs: seedRand(260, 480),
      energy: 3,
      pace: "normal",
      canOverlap: false,
      transition: "sintonía",
      citations: [],
      emotion: "bienvenida",
    },
    {
      speaker: co.id,
      text: `Y seguro más de una persona que nos escucha está pensando: "bueno, ¿y cómo funciona esto en mi caso?". Porque una cosa es la regla escrita y otra lo que te cuentan.`,
      intent: "question",
      pauseBeforeMs: seedRand(220, 420),
      pauseAfterMs: seedRand(200, 420),
      energy: p.energia,
      pace: p.pace,
      canOverlap: false,
      transition: null,
      citations: [],
      emotion: "cercanía",
    },
    {
      speaker: conductor.id,
      text: `Justo. Vamos a llevarlo como debe ser: primero un caso real de esos que llegan, luego qué dice el documento y al final qué puedes hacer mañana mismo.`,
      intent: "answer",
      pauseBeforeMs: seedRand(180, 380),
      pauseAfterMs: seedRand(300, 560),
      energy: p.energia,
      pace: p.pace,
      canOverlap: false,
      transition: "a desarrollo",
      citations: [],
      emotion: "conducción",
    },
  ], "apertura");
  scenes.push(apertura);

  // ── Caso de arranque: persona → problema → pregunta ──
  const caso: Scene = { id: "s2", titulo: "Caso de arranque", turns: [] };
  const casoDetalle = CASOS_ARRANQUE[input.tema.length % CASOS_ARRANQUE.length];
  addDrafts(caso, [
    {
      speaker: co.id,
      text: casoDetalle,
      intent: "statement",
      pauseBeforeMs: seedRand(300, 600),
      pauseAfterMs: seedRand(220, 460),
      energy: p.energia,
      pace: p.pace,
      canOverlap: false,
      transition: "cambio editorial",
      citations: [],
      emotion: "narración",
    },
    {
      speaker: conductor.id,
      text: `Y ahí es donde conviene ordenar la conversación: qué documento aplica, qué dato falta y qué puede hacer la persona antes de tomar una decisión.`,
      intent: "statement",
      pauseBeforeMs: seedRand(200, 420),
      pauseAfterMs: seedRand(200, 400),
      energy: p.energia,
      pace: p.pace,
      canOverlap: false,
      transition: null,
      citations: [],
      emotion: "conducción",
    },
    {
      speaker: co.id,
      text: `Espera, ¿y si en medio de eso la persona ya firmó algo? Porque eso pasa muchísimo.`,
      intent: "interrupt_question",
      overlapPreviousMs: seedRand(120, 220),
      allowCutPrevious: true,
      energy: 4,
      pace: "normal",
      canOverlap: true,
      transition: null,
      citations: [],
      emotion: "preocupada",
    },
    {
      speaker: conductor.id,
      text: `No, ojo: firmar no siempre significa aceptar todo. Depende de qué firmó y con qué información. Y justo para eso está Javier después.`,
      intent: "clarification",
      respondsTo: null,
      energy: 3,
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: [],
      emotion: "aclarando",
    },
  ], "caso-arranque");
  if (corresponsal) {
    addDrafts(caso, [
      {
        speaker: corresponsal.id,
        text: `Desde campo, esta duda aparece mucho cuando el personal escucha versiones distintas en su unidad. Lo importante es ubicar el documento y no decidir solo con comentarios.`,
        intent: "field_report",
        pauseBeforeMs: seedRand(240, 460),
        pauseAfterMs: seedRand(200, 420),
        energy: 3,
        pace: p.pace,
        canOverlap: false,
        transition: null,
        citations: [],
        emotion: "reporte",
      },
      {
        speaker: co.id,
        text: `Eso conecta con el caso: sin documento, todo se queda en "según me dijeron".`,
        intent: "reaction",
        energy: 3,
        pace: p.pace,
        canOverlap: false,
        transition: null,
        citations: [],
        emotion: "conexión",
      },
    ], "caso-arranque");
  }
  if (narrador && input.fuentes.length > 0) {
    addDrafts(caso, [
      {
        speaker: narrador.id,
        text: `Para este episodio se usa la biblioteca local con fecha de corte ${input.cutoff}.`,
        intent: "statement",
        pauseBeforeMs: seedRand(280, 520),
        pauseAfterMs: seedRand(260, 500),
        energy: 2,
        pace: "lento",
        canOverlap: false,
        transition: null,
        citations: [],
        emotion: "institucional",
      },
    ], "caso-arranque");
  }
  scenes.push(caso);
  memory.callbacksAvailable.push({ id: "cb-caso", resumen: "el caso inicial de la persona con versiones distintas", turnoId: allTurns[allTurns.length - 1]?.id ?? "" });

  // ── Desarrollo por intercambios (uno por afirmación verificada) ──
  const budgetSec = input.duracionMin * 60 * 0.85;
  let acumSec = allTurns.reduce((a, t) => a + estimaDurSec(t.text), 0);
  let sc = 3;
  let claimIdx = 0;
  for (const claim of input.claims) {
    if (acumSec >= budgetSec) break;
    const segmentTitle = SEGMENTOS_PROGRAMA[claimIdx % SEGMENTOS_PROGRAMA.length];
    const scene: Scene = { id: `s${sc++}`, titulo: segmentTitle, turns: [] };
    const drafts = buildExchange(
      { conductor, coConductora: co, narrador, corresponsal, memory, pool, modoCita: input.modoCita ?? "natural", seedBase: episodeSeed },
      claim,
      segmentTitle,
      contadores
    );
    const agregados = addDrafts(scene, drafts, scene.id);
    // transición puente hacia el siguiente tema (pertenecen a la conversación)
    if (claimIdx > 0) {
      const primera = agregados[0];
      if (primera) {
        primera.transition = PUENTES[(claimIdx - 1) % PUENTES.length];
      }
    }
    scenes.push(scene);
    acumSec += scene.turns.reduce((a, t) => a + estimaDurSec(t.text), 0);
    claimIdx++;
  }

  // ── Cierre práctico: acciones + callback ──
  const cierre: Scene = { id: `s${sc++}`, titulo: "Cierre práctico", turns: [] };
  const callback = memory.callbacksAvailable.find((c) => c.id === "cb-caso");
  addDrafts(cierre, [
    {
      speaker: conductor.id,
      text: callback ? `¿Recuerdas el caso con el que arrancamos? ${callback.resumen}. Pues precisamente por eso todo lo que hablamos importa: sin documento, esa persona queda desprotegida.` : `Cerramos ordenando las ideas del programa de hoy.`,
      intent: "statement",
      pauseBeforeMs: seedRand(320, 620),
      pauseAfterMs: seedRand(240, 480),
      energy: 3,
      pace: "normal",
      canOverlap: false,
      transition: "a cierre",
      citations: [],
      emotion: "recapitulación",
    },
    {
      speaker: co.id,
      text: `Y en acción, tres cosas concretas: revisa qué documento te aplica, guarda copia fechada de todo lo que firmes o recibas, y si algo no cuadra, acude a tu representación sindical antes de firmar o dejar pasar el plazo.`,
      intent: "summary",
      energy: 4,
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: [],
      emotion: "práctica",
    },
    {
      speaker: conductor.id,
      text: `Exacto. Y si tu caso tiene detalles distintos, no te quedes con la duda: pregúntalo, porque cada situación puede cambiar la lectura.`,
      intent: "statement",
      energy: 3,
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: [],
      emotion: "cierre cálido",
    },
  ], "cierre");
  if (narrador) {
    addDrafts(cierre, [
      {
        speaker: narrador.id,
        text: `Contenido informativo elaborado a partir de las fuentes indicadas. La aplicación conserva la versión documental utilizada y la fecha de corte. Los casos individuales pueden requerir revisión específica.`,
        intent: "statement",
        pauseBeforeMs: seedRand(300, 560),
        pauseAfterMs: seedRand(280, 520),
        energy: 2,
        pace: "lento",
        canOverlap: false,
        transition: null,
        citations: [],
        emotion: "institucional",
      },
    ], "cierre");
  }
  addDrafts(cierre, [
    {
      speaker: conductor.id,
      text: `Nos escuchamos en el próximo programa. Cuídate mucho y hasta la próxima.`,
      intent: "handoff",
      pauseBeforeMs: seedRand(240, 460),
      pauseAfterMs: 0,
      energy: 3,
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: [],
      emotion: "despedida",
    },
  ], "cierre");
  scenes.push(cierre);

  return {
    tema: input.tema,
    formato: "magazine informativo con caso, normativa, alerta, consultorio y cierre práctico",
    nivel: input.nivel,
    modoCita: input.modoCita ?? "natural",
    speakers: input.speakers,
    scenes,
    turns: allTurns,
    cutoff: input.cutoff,
    fuentes: input.fuentes,
    estimacionDurSec: Math.round(allTurns.reduce((a, t) => a + estimaDurSec(t.text), 0)),
  };
}

/** Prompts para el guionista LLM opcional (mismo contrato que el determinista). */
export function directorSystemPrompt(): string {
  return `Eres un DIRECTOR DE RADIO. Recibes evidencia normativa verificada y la conviertes en un diálogo natural entre locutores.

Personalidades:
${DEFAULT_SPEAKERS.map((s) => `- ${s.id} (${s.rol}): ${s.personalidad}`).join("\n")}

Reglas:
- No puedes cambiar el significado jurídico de la evidencia ni añadir derechos, cantidades, plazos o procedimientos que no estén sustentados.
- Diálogo natural: preguntas, reacciones cortas ("Exacto.", "Claro."), ejemplos hipotéticos claramente marcados ("por ejemplo, imagina…").
- El Narrador solo da citas breves de fuentes, fechas y avisos editoriales.
- Estructura permanente del programa: Apertura breve → Caso de arranque → Qué dice la normativa → Ojo con esto → Caso práctico o consultorio → Cómo documentarlo → Cierre práctico.
- No hagas una lista plana de preguntas. Cada bloque debe cambiar la dinámica y aportar algo nuevo.
- Los comerciales no se escriben como contenido editorial; se insertan después como bloques editables.
- Cada turno lleva: speaker, text, pauseBeforeMs, pauseAfterMs, energy (1-5), pace (lento|normal|rapido), canOverlap (solo reacciones cortas), transition (opcional), citations (ids de la evidencia).

Devuelve ÚNICAMENTE JSON: { "escenas": [ { "titulo": "...", "turns": [ { ...turno... } ] } ] }`;
}

const PUENTES = [
  "Y esto nos lleva justamente a lo que sigue.",
  "Ahora, aquí viene el problema.",
  "Pero falta una pieza.",
  "Rodrigo investigó precisamente eso, y conecta con esto otro.",
  "Javier, detengámonos aquí porque hay una parte que cambia el escenario.",
];
