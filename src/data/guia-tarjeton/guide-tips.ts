// "¿Sabías que?" y micro-explicaciones de la Home de Guía de mi Tarjetón.
// El bloque rota de forma estable (por índice o fecha), nunca aleatoria.

export interface GuideTip {
  id: string
  text: string
  cta?: string
  target: string // ruta de destino
}

export const GUIDE_TIPS: GuideTip[] = [
  {
    id: "tip-observaciones",
    text: "La sección de Observaciones puede contener información adicional sobre conceptos, vencimientos, unidades, cargos y saldos.",
    cta: "Muéstrame dónde está",
    target: "/guia/tarjeton?region=observaciones",
  },
  {
    id: "tip-desfase",
    text: "Los estímulos de asistencia (032) y puntualidad (033) se pagan con una quincena de desfase respecto a la quincena de incidencia.",
    cta: "Entender el desfase",
    target: "/guia/aprender/incidencia",
  },
  {
    id: "tip-marca-continuidad",
    text: "La marca de continuidad de vacaciones (un solo dígito) define cómo será tu siguiente periodo: en fracciones o completo.",
    cta: "Ver el campo",
    target: "/guia/tarjeton?region=receptor&campo=49",
  },
  {
    id: "tip-011",
    text: "La ayuda de renta (011) se calcula sobre tu sueldo tabular y su porcentaje se actualiza en cada revisión contractual.",
    cta: "Ver concepto 011",
    target: "/guia/conceptos/011",
  },
  {
    id: "tip-capacidad-credito",
    text: "Si tu capacidad de crédito es cero o negativa, no puedes obtener un nuevo crédito: el descuento máximo por ley es del 30%.",
    cta: "Ver el campo",
    target: "/guia/tarjeton?region=receptor&campo=42",
  },
  {
    id: "tip-conservar",
    text: "Tu tarjetón es comprobante oficial: consérvalo para trámites, créditos y aclaraciones de nómina.",
    cta: "Saber más",
    target: "/guia/aprender/conservar",
  },
]

// Micro-explicaciones "Aprende algo en 1 minuto" (Home).
export interface GuideQuickLearn {
  id: string
  emoji: string
  title: string
  target: string
}

export const GUIDE_QUICK_LEARN: GuideQuickLearn[] = [
  { id: "ql-smi", emoji: "🧮", title: "¿Qué es el sueldo mensual integrado?", target: "/guia/tarjeton?region=receptor&campo=57" },
  { id: "ql-antiguedad", emoji: "⏳", title: "¿Qué significa antigüedad efectiva?", target: "/guia/tarjeton?region=receptor&campo=13" },
  { id: "ql-incidencia", emoji: "📅", title: "¿Qué es la quincena de incidencia?", target: "/guia/tarjeton?region=receptor&campo=30" },
  { id: "ql-desfase", emoji: "🔁", title: "¿Por qué un concepto aparece después?", target: "/guia/aprender/incidencia" },
  { id: "ql-observaciones", emoji: "🔍", title: "¿Qué son las observaciones?", target: "/guia/tarjeton?region=observaciones" },
  { id: "ql-liquido", emoji: "💵", title: "¿Qué diferencia hay entre percepciones y líquido?", target: "/guia/aprender/percepciones-deducciones" },
  { id: "ql-conservar", emoji: "🗂️", title: "¿Por qué debo guardar mis tarjetones?", target: "/guia/aprender/conservar" },
]