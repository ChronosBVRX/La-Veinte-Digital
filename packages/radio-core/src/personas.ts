/**
 * Personas vocales oficiales de AI Radio Studio.
 * Especificaciones del usuario (casting manual — no inferencia automática).
 * La REGLA DE PRONUNCIACIÓN es obligatoria y global: español mexicano neutro
 * con /s/ claramente articulada.
 */

import type { VoiceSlot } from "./voice-slots";

export interface VoicePersona {
  id: string;
  displayName: string;
  role: string;
  userAssignedVoiceRole: string;
  voz: VoiceSlot;
  descripcion: string;
  acento: string;
  diccion: string;
  estilo: string;
  entonacion: string;
  objetivo: string;
}

export const GLOBAL_PRONUNCIATION_RULE =
  "REGLA DE PRONUNCIACIÓN OBLIGATORIA: Todos los personajes deben hablar exclusivamente con español mexicano neutro. Conservar siempre una articulación clara de la consonante /s/. Está prohibido aspirar, suavizar, transformar o eliminar la 's'. No usar rasgos fonéticos costeños o caribeños. Nunca convertir expresiones como 'está', 'estamos', 'los', 'desde' o 'mismo' en pronunciaciones similares a 'ehtá', 'ejtá', 'ehtamo', 'loh', 'dehde' o 'mihmo'. Eduardo y Andrea deben pertenecer claramente a la misma variante de español mexicano neutro, aunque sus timbres, personalidades y estilos vocales sean diferentes.";

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "EDUARDO",
    displayName: "Eduardo",
    role: "conductor",
    userAssignedVoiceRole: "male-host",
    voz: "A",
    descripcion: "Voz: hombre mexicano adulto, natural, cálido y seguro.",
    acento: "español mexicano neutro",
    diccion:
      "clara, fluida y profesional. Pronunciar todas las consonantes de forma completa, especialmente la letra 's'. Nunca aspirar la 's', ni sustituirla por sonidos parecidos a 'h' o 'j', ni eliminarla al final de las palabras. Evitar 'ejtá', 'ehtá', 'cojteño', 'loh amigo', 'nojotro'. Evitar acento costeño/caribeño. No arrastrar ni comerse consonantes.",
    estilo: "conductor de radio mexicano contemporáneo. Cercano, relajado, agradable y con personalidad, pero con buena articulación.",
    entonacion:
      "natural y conversacional. Puede ser expresivo y dinámico, pero sin exagerar. Evitar sonar como doblaje, anuncio comercial, narrador solemne o voz robótica.",
    objetivo:
      "sonar como un conductor mexicano real hablando espontáneamente en una estación de radio moderna, con pronunciación limpia y una 's' claramente audible.",
  },
  {
    id: "ANDREA",
    displayName: "Andrea",
    role: "co-conductor",
    userAssignedVoiceRole: "female-cohost",
    voz: "B",
    descripcion: "Voz: mujer mexicana adulta, natural, cálida, despierta, agradable y expresiva.",
    acento: "español mexicano neutro",
    diccion:
      "clara, fluida y bien articulada. Pronunciar todas las consonantes de forma completa, especialmente la letra 's'. Nunca aspirar la 's', ni sustituirla por 'h'/'j', ni eliminarla al final de las palabras. Evitar 'ejtá', 'ehtá', 'cojteño', 'loh amigo', 'nojotro'. Evitar cantadito regional. No arrastrar palabras ni comerse consonantes.",
    estilo: "co-conductora de radio mexicana contemporánea. Cercana, espontánea, simpática, atenta y con personalidad propia; debe aportar ritmo sin sonar publicitaria.",
    entonacion:
      "dinámica y conversacional, con emociones naturales, curiosidad audible y pausas realistas. Evitar exagerar la entonación o sonar como locución publicitaria, doblaje, asistente virtual o lectura robótica.",
    objetivo:
      "sonar como una mujer mexicana real conversando en un programa de radio moderno, con voz natural y pronunciación limpia, especialmente con todas las 's' claramente audibles.",
  },
  {
    id: "NARRADOR",
    displayName: "Alonso",
    role: "narrador",
    userAssignedVoiceRole: "narrator",
    voz: "N",
    descripcion: "Voz: hombre adulto, seria, grave, sobria e institucional.",
    acento: "español latinoamericano neutro, preferentemente mexicano neutro",
    diccion:
      "muy clara y firme. Pronunciar todas las consonantes de forma completa, especialmente la letra 's'. Evitar tono juvenil, agudo, caricaturizado, publicitario o de asistente virtual.",
    estilo:
      "narrador institucional de radio pública. Entra solo para citas breves, fechas, fuentes y avisos editoriales; no conversa como conductor ni ocupa el centro del programa.",
    entonacion:
      "serena, contenida y confiable. Frases cortas, pausas medidas y autoridad tranquila, sin dramatizar ni sonar solemne en exceso.",
    objetivo:
      "proyectar seriedad y confianza documental, diferenciándose con claridad de Eduardo y Andrea.",
  },
  {
    id: "RODRIGO",
    displayName: "Rodrigo Torres",
    role: "corresponsal",
    userAssignedVoiceRole: "field-correspondent",
    voz: "C",
    descripcion: "Voz: hombre adulto, clara, periodistica, cercana y con energia de reporte.",
    acento: "español latinoamericano neutro",
    diccion:
      "clara y directa. Evitar exagerar acentos regionales; debe sonar como reporte de campo profesional, no como lectura burocratica.",
    estilo:
      "corresponsal de campo. Entra para traer contexto de unidades, hospitales u oficinas, formular dudas reales y separar hechos de rumores.",
    entonacion:
      "natural, atenta y con movimiento. Puede sonar un poco mas urgente que el narrador, pero sin perder seriedad.",
    objetivo:
      "hacer que el programa se sienta vivo, con presencia fuera del estudio y casos concretos bien delimitados.",
  },
  {
    id: "VALERIA",
    displayName: "Valeria Soto",
    role: "comercial",
    userAssignedVoiceRole: "commercial-voice",
    voz: "P",
    descripcion: "Voz: mujer adulta, premium, clara, amable y profesional para espacios comerciales.",
    acento: "español latinoamericano neutro",
    diccion:
      "muy clara, fluida y limpia. Debe diferenciar el patrocinio del contenido editorial sin sonar robotica ni invasiva.",
    estilo:
      "voz comercial breve. Solo participa en anuncios, patrocinios, menciones o avisos pagados editables.",
    entonacion:
      "positiva, pulida y confiable, con energia amable. Evitar tono de venta agresiva o exagerada.",
    objetivo:
      "permitir comerciales organicos y profesionales sin contaminar la conversacion editorial.",
  },
];

export function personaDe(id: string): VoicePersona | undefined {
  return VOICE_PERSONAS.find((p) => p.id === id);
}

/** Criterios para elegir una referencia vocal que cumpla la especificación. */
export const REFERENCE_QUALITY_CRITERIA = [
  "una sola persona hablando",
  "15–30 segundos de voz continua",
  "sin música ni ruido de fondo",
  "sin reverberación importante",
  "ritmo natural y conversacional",
  "español mexicano neutro, con /s/ claramente articulada",
  "sin acento costeño/caribeño ni cantadito regional",
];
