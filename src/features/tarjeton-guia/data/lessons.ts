/**
 * Rutas educativas de la Guía de mi Tarjetón.
 *
 * Contenido original redactado para micro-lecciones de 30–90 segundos.
 * Las cantidades usadas en ejemplos son ficticias y están marcadas como tales.
 * Nota: contenido educativo (índice provisional), no autoridad normativa.
 */

export interface GuideLessonBlock {
  kind: "text" | "example" | "highlight"
  text: string
}

export interface GuideLesson {
  id: string
  title: string
  emoji: string
  blocks: GuideLessonBlock[]
}

export interface GuideLessonPath {
  id: string
  title: string
  description: string
  emoji: string
  lessons: GuideLesson[]
}

export const guideLessonPaths: GuideLessonPath[] = [
  {
    id: "primeros-pasos",
    title: "Primeros pasos",
    description: "Aprende a leer tu tarjetón desde lo esencial, en menos de 10 minutos.",
    emoji: "🚀",
    lessons: [
      {
        id: "que-es-tarjeton",
        title: "¿Qué es un tarjetón?",
        emoji: "🧾",
        blocks: [
          {
            kind: "text",
            text: "Tu tarjetón es el comprobante quincenal de tu pago: ahí aparecen todas tus percepciones (lo que recibes) y tus deducciones (lo que se te descuenta).",
          },
          {
            kind: "text",
            text: "No es solo un recibo: también contiene tus datos laborales, tu asistencia, tus vacaciones, tus créditos y los mensajes que el IMSS te comunica.",
          },
          {
            kind: "highlight",
            text: "Cada quincena genera un tarjetón. Conservarlo te sirve para comprobar pagos y aclarar diferencias.",
          },
        ],
      },
      {
        id: "estructura",
        title: "Las 5 partes de tu tarjetón",
        emoji: "🧩",
        blocks: [
          {
            kind: "text",
            text: "Tu tarjetón se divide en cinco secciones: Emisor (quién paga), Receptor (tus datos laborales), Percepciones y Deducciones (los importes), Mensajes (avisos) y Observaciones (detalle de conceptos).",
          },
          {
            kind: "example",
            text: "Ejemplo: si quieres saber por qué te descontaron un crédito, busca primero en Deducciones el código y después en Observaciones su saldo y vencimiento.",
          },
        ],
      },
      {
        id: "percepciones-deducciones",
        title: "Percepciones vs. deducciones",
        emoji: "⚖️",
        blocks: [
          {
            kind: "text",
            text: "Percepciones son todos tus ingresos: sueldo, ayudas, estímulos, primas. Deducciones son todos los descuentos: impuestos, créditos, fondos y recuperaciones.",
          },
          {
            kind: "text",
            text: "La fórmula es simple: total de percepciones − total de deducciones = líquido (lo que de verdad recibes).",
          },
          {
            kind: "example",
            text: "Ejemplo ficticio: $8,500 (percepciones) − $2,100 (deducciones) = $6,400 (líquido).",
          },
        ],
      },
      {
        id: "codigos",
        title: "¿Qué significan 002, 011, 032…?",
        emoji: "🔢",
        blocks: [
          {
            kind: "text",
            text: "Cada código de tres dígitos identifica un concepto: 002 es el sueldo base, 011 la ayuda de renta, 032 el estímulo por asistencia, 033 el de puntualidad, 151 el ISR.",
          },
          {
            kind: "text",
            text: "Los códigos de percepción y de deducción conviven: un mismo número siempre significa lo mismo en todos los tarjetones.",
          },
          {
            kind: "highlight",
            text: "En la guía puedes buscar cualquier código (por ejemplo 033 o «puntualidad») y ver su explicación.",
          },
        ],
      },
      {
        id: "incidencia",
        title: "Quincena de incidencia",
        emoji: "📅",
        blocks: [
          {
            kind: "text",
            text: "La quincena de incidencia es la quincena donde ocurrió un evento (una falta, un retardo, una vacación). El pago puede reflejarse en la siguiente quincena.",
          },
          {
            kind: "example",
            text: "Ejemplo: tus retardos de la quincena 1 pueden afectar el estímulo por puntualidad que se paga en la quincena 2.",
          },
          {
            kind: "highlight",
            text: "Por eso un concepto puede aparecer o desaparecer una quincena sin que sea un error: revisa primero la incidencia.",
          },
        ],
      },
      {
        id: "vacaciones",
        title: "Entiende tus vacaciones",
        emoji: "🏖️",
        blocks: [
          {
            kind: "text",
            text: "En tu tarjetón aparecen tus días de vacaciones: disfrutadas, por vencer, periodo por disfrutar y sus fechas de inicio.",
          },
          {
            kind: "text",
            text: "Cuando disfrutas vacaciones, además se paga la prima vacacional y, si no las tomas, pueden liquidarse en efectivo.",
          },
          {
            kind: "example",
            text: "Ejemplo: si tienes 10 años de antigüedad, tus días de vacaciones aumentan por disposición legal y del CCT.",
          },
        ],
      },
      {
        id: "observaciones",
        title: "Aprende a leer Observaciones",
        emoji: "🔍",
        blocks: [
          {
            kind: "text",
            text: "Observaciones es la sección que detalla conceptos: importe, vencimiento, unidades, número de control y cargo inicial.",
          },
          {
            kind: "text",
            text: "Aquí aparecen los saldos de tus créditos, los pagos diferidos y los mensajes sobre cada concepto.",
          },
          {
            kind: "highlight",
            text: "Si un descuento te sorprende, revisa primero Observaciones: ahí suele estar la explicación.",
          },
        ],
      },
      {
        id: "conservar",
        title: "¿Por qué guardar tus tarjetones?",
        emoji: "🗂️",
        blocks: [
          {
            kind: "text",
            text: "Tu tarjetón sirve como comprobante de pago y de tu relación laboral: te apoya en trámites, aclaraciones y comprobaciones ante el Instituto.",
          },
          {
            kind: "text",
            text: "En La Veinte puedes guardar tus tarjetones y consultar su histórico cada quincena.",
          },
        ],
      },
    ],
  },
]

export const guideQuickLessons = [
  { id: "sueldo-mensual-integrado", title: "¿Qué es el sueldo mensual integrado?", emoji: "💵", ref: "field:57" },
  { id: "antiguedad-efectiva", title: "¿Qué significa antigüedad efectiva?", emoji: "⏳", ref: "field:13" },
  { id: "quincena-incidencia", title: "¿Qué es la quincena de incidencia?", emoji: "📅", ref: "field:30" },
  { id: "concepto-aparece-despues", title: "¿Por qué un concepto aparece después?", emoji: "🔁", ref: "lesson:incidencia" },
  { id: "observaciones", title: "¿Qué son las observaciones?", emoji: "🔍", ref: "field:77" },
  { id: "percepciones-vs-liquido", title: "¿Diferencia entre percepciones y líquido?", emoji: "⚖️", ref: "field:70" },
  { id: "guardar-tarjetones", title: "¿Por qué guardar tus tarjetones?", emoji: "🗂️", ref: "lesson:conservar" },
] as const
