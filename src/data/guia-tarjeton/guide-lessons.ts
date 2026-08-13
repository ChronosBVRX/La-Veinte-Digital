// Lecciones curadas de "Aprende desde cero" (Guía de mi Tarjetón).
// NOTA: estas lecciones son contenido educativo (índice provisional), no
// autoridad normativa; sin cláusulas/artículos de fuentes oficiales no se
// presentan como fundamento. Los importes de ejemplo son ficticios y están
// marcados como tales.

export type LessonBlock =
  | { type: "text"; text: string }
  | { type: "heading"; text: string }
  | { type: "example"; title?: string; rows: { label: string; value: string; highlight?: boolean }[]; note?: string }
  | { type: "tip"; text: string }

export interface GuideLesson {
  id: string
  title: string
  emoji: string
  durationSeconds: number
  goal: string
  blocks: LessonBlock[]
}

export const GUIDE_LESSONS: GuideLesson[] = [
  {
    id: "que-es-tarjeton",
    title: "¿Qué es un tarjetón?",
    emoji: "🧾",
    durationSeconds: 45,
    goal: "Entender que es el comprobante quincenal donde se reflejan percepciones y descuentos.",
    blocks: [
      { type: "text", text: "El tarjetón de pago es el documento que te entrega el IMSS cada quincena con el detalle de tu nómina: lo que recibes (percepciones), lo que te descuentan (deducciones) y la quincena a la que corresponde." },
      { type: "tip", text: "No es solo un papel: es tu comprobante de ingresos y descuentos. Consérvalo para trámites y aclaraciones." },
      { type: "heading", text: "Lo que siempre encontrarás" },
      {
        type: "example",
        rows: [
          { label: "Emisor", value: "Quién emite el comprobante (el IMSS)" },
          { label: "Receptor", value: "Tus datos y tu situación laboral" },
          { label: "Percepciones", value: "Todo lo que te pagaron" },
          { label: "Deducciones", value: "Todo lo que te descontaron" },
          { label: "Líquido", value: "Lo que de verdad recibiste", highlight: true },
        ],
      },
    ],
  },
  {
    id: "percepciones-deducciones",
    title: "Percepciones vs. deducciones",
    emoji: "💰",
    durationSeconds: 60,
    goal: "Distinguir ingresos, descuentos y líquido.",
    blocks: [
      { type: "text", text: "Las percepciones son todo lo que te pagan: sueldo, ayudas, estímulos y prestaciones. Las deducciones son todo lo que te descuentan: impuestos, fondos y créditos." },
      {
        type: "example",
        title: "Un ejemplo (importes ficticios)",
        rows: [
          { label: "Percepciones", value: "$8,450.00" },
          { label: "Deducciones", value: "$1,270.00" },
          { label: "Líquido", value: "$7,180.00", highlight: true },
        ],
        note: "Líquido = percepciones − deducciones.",
      },
      { type: "tip", text: "Un descuento no siempre es un error: muchos son aportaciones tuyas (fondo de jubilación) o pagos de créditos." },
    ],
  },
  {
    id: "codigos",
    title: "¿Qué significan 002, 011, 032…?",
    emoji: "🔢",
    durationSeconds: 60,
    goal: "Entender que las claves identifican conceptos de percepción y deducción.",
    blocks: [
      { type: "text", text: "Cada concepto tiene una clave de 3 dígitos. Las percepciones van del 001 al 084; las deducciones del 104 al 199." },
      {
        type: "example",
        rows: [
          { label: "002", value: "Sueldo base", highlight: true },
          { label: "011", value: "Ayuda de renta" },
          { label: "032", value: "Estímulo por asistencia" },
          { label: "033", value: "Estímulo por puntualidad" },
          { label: "151", value: "ISR (impuesto sobre la renta)" },
          { label: "154", value: "Descuento de crédito INFONAVIT" },
        ],
      },
      { type: "tip", text: "En la Guía puedes buscar cualquier clave: escribe “033” o “puntualidad” y te explicamos qué significa." },
    ],
  },
  {
    id: "incidencia",
    title: "¿Qué es una quincena de incidencia?",
    emoji: "📅",
    durationSeconds: 50,
    goal: "Comprender que la quincena que genera un concepto puede no coincidir con la quincena en que se refleja.",
    blocks: [
      { type: "text", text: "La quincena de incidencia es la quincena en la que ocurrió el hecho (tu asistencia, una falta, un permiso). El pago puede aparecer en la quincena siguiente." },
      { type: "text", text: "Por ejemplo, los estímulos de asistencia (032) y puntualidad (033) se pagan en la quincena siguiente a la que se generaron: hay un desfase de una quincena." },
      { type: "tip", text: "Si un estímulo “no aparece”, revisa primero la quincena de incidencia: puede ser simplemente el desfase." },
    ],
  },
  {
    id: "vacaciones",
    title: "Entiende tus vacaciones",
    emoji: "🏖️",
    durationSeconds: 60,
    goal: "Ubicar periodo, continuidad, días y pagos relacionados con vacaciones.",
    blocks: [
      { type: "text", text: "En la sección de datos del trabajador verás tus periodos vacacionales, la marca de continuidad, los días disfrutados y las fechas programadas." },
      { type: "text", text: "La marca de continuidad indica cómo disfrutaste tu último periodo y cómo será el siguiente: en una o dos fracciones, con o sin pago de la ayuda cultural (48)." },
      { type: "tip", text: "Cuando tomes vacaciones, en la quincena correspondiente verás la prima vacacional (029). Puedes simularla en el módulo de Vacaciones." },
    ],
  },
  {
    id: "revisar-cada-quincena",
    title: "Qué debes revisar cada quincena",
    emoji: "✅",
    durationSeconds: 60,
    goal: "Revisar lo esencial del tarjetón: sueldo, estímulos, descuentos y observaciones.",
    blocks: [
      { type: "text", text: "No necesitas revisar los 77 campos del tarjetón. Con 4 revisiones rápidas es suficiente:" },
      {
        type: "example",
        rows: [
          { label: "1", value: "Tu sueldo base (002) y ayudas recurrentes: que estén y no cambien sin motivo" },
          { label: "2", value: "Tus estímulos (032 y 033): recuerda el desfase de quincena" },
          { label: "3", value: "Tus descuentos fijos (ISR, fondos): que no aparezca uno nuevo sin explicación" },
          { label: "4", value: "Observaciones: vencimientos y saldos de créditos" },
        ],
      },
      { type: "tip", text: "En “Mi quincena explicada” hacemos estas revisiones por ti y te marcamos qué revisar." },
    ],
  },
  {
    id: "observaciones",
    title: "Aprende a leer Observaciones",
    emoji: "🔍",
    durationSeconds: 60,
    goal: "Interpretar vencimiento, unidades, control, cargo inicial y saldos/mensajes.",
    blocks: [
      { type: "text", text: "La sección de Observaciones detalla conceptos que continúan de quincenas anteriores: importes, vencimientos, unidades, número de control, cargo inicial y saldos." },
      { type: "text", text: "Es donde los créditos muestran su avance: el concepto 154 (INFONAVIT), 104 (FOVI) o 170 (FONACOT) pueden incluir vencimiento y saldo." },
      { type: "tip", text: "Cuando un descuento de crédito no te cuadre, escribe la clave en el buscador y revisa Observaciones." },
    ],
  },
  {
    id: "conservar",
    title: "¿Por qué conservar tus tarjetones?",
    emoji: "🗂️",
    durationSeconds: 40,
    goal: "Conocer los usos del tarjetón para trámites y comprobación.",
    blocks: [
      { type: "text", text: "Tu tarjetón es un comprobante oficial: sirve para comprobar ingresos, tramitar créditos, resolver aclaraciones de nómina y tener el historial de tus pagos y descuentos." },
      { type: "tip", text: "En La Veinte puedes guardar tu historial de tarjetones: cada quincena sube el tuyo y lo comparamos contigo." },
    ],
  },
]

export const GUIDE_LESSONS_BY_ID: ReadonlyMap<string, GuideLesson> = new Map(GUIDE_LESSONS.map((l) => [l.id, l]))

// Ruta educativa "Primeros pasos".
export const GUIDE_ROUTE_PRIMEROS_PASOS = {
  id: "primeros-pasos",
  title: "Primeros pasos",
  description: "Domina lo esencial en pocos minutos.",
  lessonIds: ["que-es-tarjeton", "percepciones-deducciones", "codigos", "incidencia", "vacaciones", "revisar-cada-quincena"],
}