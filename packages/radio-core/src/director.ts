/**
 * RadioDirector — convierte evidencia normativa en un guion conversacional
 * multi-voz con dirección de radio: pausas, energía, ritmo, solapamientos
 * y transiciones. Determinista (solo corpus) por defecto; el LLM solo pule.
 */

import type { VoiceSlot } from "./voice-slots";

export type SpeakerRole =
  | "conductor"
  | "co-conductor"
  | "narrador"
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
    nombre: "Alonso",
    rol: "narrador",
    personalidad: "Alonso, narrador institucional: intervenciones breves con fechas, fundamentos y avisos editoriales.",
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

const INTROS_CONDUCTOR = [
  "Vamos con un punto concreto: {x}",
  "Aquí hay un dato clave: {x}",
  "Y esto que viene es importante: {x}",
  "Pon atención a esto: {x}",
];

const INTROS_COHOST = [
  "Y aquí conviene separar dos cosas: lo que dicen los documentos y lo que mucha gente asume sin verificarlo.",
  "Aquí hay un matiz que casi nadie conoce.",
  "Y esto responde una duda muy frecuente.",
  "Justo aquí es donde la gente suele confundirse.",
];

const EJEMPLOS = [
  "Por ejemplo, imagina que tienes una situación concreta con esto. Lo primero sería revisar tu tipo de contratación, tu categoría y tu jornada, porque la regla no se aplica igual en todos los casos.",
  "Pongamos un caso: alguien con jornada distinta a la tuya podría tener condiciones diferentes. Por eso siempre hay que revisar lo que aplica a cada situación.",
  "Para aterrizarlo: si tu caso es distinto al del ejemplo, lo importante es verificar los documentos que te corresponden según tu categoría y antigüedad.",
];

const RESUMENES = [
  "En resumen: para este tema lo importante es conocer la regla, revisar tu situación específica y, si algo no te cuadra, acercarte a tu representación sindical.",
  "Para cerrar: conoce la regla, revisa tu caso y pregunta a tu sección sindical si algo no te cuadra.",
  "Resumiendo: regla clara, revisión de tu caso y acompañamiento sindical si lo necesitas.",
];

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

const OJO_CON_ESTO = [
  "Ojo con esto: una cosa es lo que se acostumbra en el área y otra lo que se puede sostener con documento.",
  "Aquí está la trampa común: quedarse solo con el comentario de pasillo y no revisar la fuente que aplica.",
  "Este punto conviene tratarlo con cuidado, porque un detalle administrativo puede cambiar la lectura del caso.",
];

function citaNatural(c: EvidenceClaim): string {
  const fuente = c.documento.startsWith("CCT") ? "el Contrato Colectivo vigente" : c.documento === "LFT" ? "la Ley Federal del Trabajo" : c.documento === "LSS" ? "la Ley del Seguro Social" : "la normativa aplicable";
  return `De acuerdo con ${fuente}.`;
}

function citaDocumental(c: EvidenceClaim): string {
  if (c.clausula) return `Esto se encuentra en la ${c.clausula.toLowerCase().replace("cláusula", "Cláusula")} del Contrato Colectivo vigente.`;
  if (c.articulo) return `Esto se encuentra en el ${c.articulo} de ${c.documento === "LFT" ? "la Ley Federal del Trabajo" : c.documento}.`;
  return `Esto se encuentra en ${c.documento}.`;
}

function citaTecnica(c: EvidenceClaim): string {
  return `Fuente: ${c.documento}${c.clausula ? `, ${c.clausula}` : ""}${c.articulo ? `, ${c.articulo}` : ""}${c.pagina != null ? `, página ${c.pagina}` : ""}.`;
}

function fraseCita(c: EvidenceClaim, modo: CitationMode): string {
  switch (modo) {
    case "natural":
      return citaNatural(c);
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

function cleanEvidence(texto: string): string {
  return texto
    .replace(/\s+/g, " ")
    .replace(/^CONTRATO COLECTIVO DE TRABAJO\s*/i, "")
    .trim();
}

export function directRadioEpisode(input: DirectorInput): EpisodeScript {
  const p = LEVEL_PARAMS[input.nivel] ?? LEVEL_PARAMS.natural;
  const conductor = input.speakers.find((s) => s.rol === "conductor") ?? input.speakers[0];
  const co = input.speakers.find((s) => s.rol === "co-conductor") ?? input.speakers[1] ?? input.speakers[0];
  const narrador = input.speakers.find((s) => s.rol === "narrador");
  const corresponsal = input.speakers.find((s) => s.rol === "corresponsal");
  const scenes: Scene[] = [];
  const allTurns: DialogueTurn[] = [];
  let turn = 0;

  const add = (scene: Scene, t: Omit<DialogueTurn, "id">) => {
    const full: DialogueTurn = {
      id: `t${String(++turn).padStart(3, "0")}`,
      ...t,
    };
    scene.turns.push(full);
    allTurns.push(full);
    return full;
  };

  const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

  // ── Escena 1: Apertura ────────────────────────────────────────────────
  const apertura: Scene = { id: "s1", titulo: "Apertura", turns: [] };
  add(apertura, {
    speaker: conductor.id,
    text: `Bienvenidas y bienvenidos a La Veinte Radio. Hoy vamos a hablar de un tema que genera muchísimas dudas entre las personas trabajadoras del IMSS: ${input.tema}.`,
    pauseBeforeMs: 0,
    pauseAfterMs: rand(...p.pausa),
    energy: 3,
    pace: "normal",
    canOverlap: false,
    transition: "sintonía",
    citations: [],
  });
  add(apertura, {
    speaker: co.id,
    text: `Y seguro más de una persona que nos escucha está pensando: "bueno, ¿y cómo funciona esto en mi caso?".`,
    pauseBeforeMs: rand(...p.pausa),
    pauseAfterMs: rand(...p.pausa),
    energy: p.energia,
    pace: p.pace,
    canOverlap: false,
    transition: null,
    citations: [],
  });
  add(apertura, {
    speaker: conductor.id,
    text: `Exacto. Vamos a llevarlo como programa completo: primero el caso, luego la regla, después los errores comunes y al final los pasos prácticos.`,
    pauseBeforeMs: rand(...p.pausa),
    pauseAfterMs: rand(...p.pausa),
    energy: p.energia,
    pace: p.pace,
    canOverlap: false,
    transition: "a desarrollo",
    citations: [],
  });
  scenes.push(apertura);

  // ── Escena 2: Caso de arranque ───────────────────────────────────────
  const caso: Scene = { id: "s2", titulo: "Caso de arranque", turns: [] };
  add(caso, {
    speaker: co.id,
    text: CASOS_ARRANQUE[input.tema.length % CASOS_ARRANQUE.length],
    pauseBeforeMs: rand(...p.pausa),
    pauseAfterMs: rand(...p.pausa),
    energy: p.energia,
    pace: p.pace,
    canOverlap: false,
    transition: "cambio editorial",
    citations: [],
  });
  add(caso, {
    speaker: conductor.id,
    text: `Y ahí es donde conviene ordenar la conversación: qué documento aplica, qué dato falta y qué puede hacer la persona antes de tomar una decisión.`,
    pauseBeforeMs: rand(...p.pausa),
    pauseAfterMs: rand(...p.pausa),
    energy: p.energia,
    pace: p.pace,
    canOverlap: false,
    transition: null,
    citations: [],
  });
  if (corresponsal) {
    add(caso, {
      speaker: corresponsal.id,
      text: `Desde campo, esta duda aparece mucho cuando el personal escucha versiones distintas en su unidad. Lo importante es ubicar el documento y no decidir solo con comentarios.`,
      pauseBeforeMs: rand(...p.pausa),
      pauseAfterMs: rand(...p.pausa),
      energy: 3,
      pace: p.pace,
      canOverlap: false,
      transition: null,
      citations: [],
    });
  }
  if (narrador && input.fuentes.length > 0) {
    add(caso, {
      speaker: narrador.id,
      text: `Para este episodio se usa la biblioteca local con fecha de corte ${input.cutoff}.`,
      pauseBeforeMs: rand(...p.pausa),
      pauseAfterMs: rand(...p.pausa),
      energy: 2,
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: [],
    });
  }
  scenes.push(caso);

  // ── Desarrollo por segmentos editoriales ──────────────────────────────
  const budgetSec = input.duracionMin * 60 * 0.85;
  let acumSec = allTurns.reduce((a, t) => a + estimaDurSec(t.text), 0);
  let sc = 3;
  let claimIdx = 0;
  for (const claim of input.claims) {
    if (acumSec >= budgetSec) break;
    const segmentTitle = SEGMENTOS_PROGRAMA[claimIdx % SEGMENTOS_PROGRAMA.length];
    const scene: Scene = { id: `s${sc++}`, titulo: segmentTitle, turns: [] };
    const texto = cleanEvidence(claim.texto).slice(0, 320);

    add(scene, {
      speaker: conductor.id,
      text: segmentTitle === "Ojo con esto"
        ? OJO_CON_ESTO[claimIdx % OJO_CON_ESTO.length]
        : INTROS_CONDUCTOR[claimIdx % INTROS_CONDUCTOR.length].replace("{x}", texto),
      pauseBeforeMs: rand(...p.pausa),
      pauseAfterMs: rand(...p.pausa),
      energy: p.energia,
      pace: p.pace,
      canOverlap: false,
      transition: claimIdx === 0 ? null : "cambio editorial",
      citations: [claim.id],
    });

    add(scene, {
      speaker: co.id,
      text: segmentTitle === "Consultorio"
        ? `La pregunta natural aquí sería: ¿qué reviso primero si esto me está pasando a mí?`
        : INTROS_COHOST[claimIdx % INTROS_COHOST.length],
      pauseBeforeMs: rand(...p.pausa),
      pauseAfterMs: rand(...p.pausa),
      energy: p.energia,
      pace: p.pace,
      canOverlap: false,
      transition: null,
      citations: [],
    });

    if (p.reacciones && claimIdx % 2 === 0) {
      add(scene, {
        speaker: conductor.id,
        text: REACCIONES[claimIdx % REACCIONES.length],
        pauseBeforeMs: rand(40, 120),
        pauseAfterMs: rand(...p.pausa),
        energy: 4,
        pace: p.pace,
        canOverlap: p.overlapMs > 0,
        transition: "solape suave",
        citations: [],
      });
    }

    if (corresponsal && claimIdx % 3 === 1) {
      add(scene, {
        speaker: corresponsal.id,
        text: `En las áreas, la duda práctica suele ser cómo comprobar esto sin entrar en conflicto. Ahí sirven fechas, recibos, solicitudes y respuestas por escrito.`,
        pauseBeforeMs: rand(...p.pausa),
        pauseAfterMs: rand(...p.pausa),
        energy: 3,
        pace: p.pace,
        canOverlap: false,
        transition: "reporte de campo",
        citations: [],
      });
    }

    add(scene, {
      speaker: co.id,
      text: segmentTitle === "Cómo documentarlo"
        ? `Para no quedarse solo con la palabra de alguien, conviene guardar recibos, solicitudes, respuestas por escrito y cualquier dato que ubique fecha, área y trámite.`
        : EJEMPLOS[claimIdx % EJEMPLOS.length],
      pauseBeforeMs: rand(...p.pausa),
      pauseAfterMs: rand(...p.pausa),
      energy: p.energia,
      pace: p.pace,
      canOverlap: false,
      transition: null,
      citations: [],
    });

    if (narrador) {
      add(scene, {
        speaker: narrador.id,
        text: fraseCita(claim, input.modoCita ?? "natural"),
        pauseBeforeMs: rand(...p.pausa),
        pauseAfterMs: rand(...p.pausa),
        energy: 2,
        pace: "normal",
        canOverlap: false,
        transition: null,
        citations: [claim.id],
      });
    }

    scenes.push(scene);
    acumSec += scene.turns.reduce((a, t) => a + estimaDurSec(t.text), 0);
    claimIdx++;
  }

  // ── Escena final: resumen + aviso + despedida ─────────────────────────
  const cierre: Scene = { id: `s${sc++}`, titulo: "Cierre práctico", turns: [] };
  add(cierre, {
    speaker: co.id,
    text: RESUMENES[claimIdx % RESUMENES.length],
    pauseBeforeMs: rand(...p.pausa),
    pauseAfterMs: rand(...p.pausa),
    energy: p.energia,
    pace: p.pace,
    canOverlap: false,
    transition: null,
    citations: [],
  });
  if (narrador) {
    add(cierre, {
      speaker: narrador.id,
      text: `Contenido informativo elaborado a partir de las fuentes indicadas. La aplicación conserva la versión documental utilizada y la fecha de corte. Los casos individuales pueden requerir revisión específica.`,
      pauseBeforeMs: rand(...p.pausa),
      pauseAfterMs: rand(...p.pausa),
      energy: 2,
      pace: "normal",
      canOverlap: false,
      transition: null,
      citations: [],
    });
  }
  add(cierre, {
    speaker: conductor.id,
    text: `Nos escuchamos en el próximo programa. Cuídate mucho y hasta la próxima.`,
    pauseBeforeMs: rand(...p.pausa),
    pauseAfterMs: 0,
    energy: 3,
    pace: "normal",
    canOverlap: false,
    transition: null,
    citations: [],
  });
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
