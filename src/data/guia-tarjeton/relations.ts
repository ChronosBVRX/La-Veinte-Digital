/**
 * Relaciones navegables del índice provisional (pack).
 * La base textual es descriptiva y NO cita documentos no oficiales.
 * El respaldo normativo de cada relación se registra aparte (fuentes
 * oficiales + estado de verificación); hasta verificarse, permanece pendiente.
 */
export const guideRelations = [
  {
    "from": "field:57",
    "to": [
      "concept:029",
      "concept:030",
      "concept:037",
      "concept:048"
    ],
    "basis": "El sueldo mensual integrado es la base para el cálculo de varias percepciones.",
    "status": "pending_verification"
  },
  {
    "from": "field:13",
    "to": [
      "field:45",
      "field:46",
      "field:49",
      "field:50",
      "field:51",
      "field:53",
      "concept:022",
      "concept:048"
    ],
    "basis": "La antigüedad efectiva se relaciona con vacaciones, factores de ayuda de renta y días de ayuda cultural y recreativa.",
    "status": "pending_verification"
  },
  {
    "from": "field:30",
    "to": [
      "concept:032",
      "concept:033"
    ],
    "basis": "La quincena de incidencia se relaciona con el pago de estímulos de asistencia y puntualidad.",
    "status": "pending_verification"
  },
  {
    "from": "section:observaciones",
    "to": [
      "field:73",
      "field:74",
      "field:75",
      "field:76",
      "field:77"
    ],
    "basis": "La sección de observaciones contiene vencimiento, unidades, número de control, cargo inicial y mensajes de cada descuento.",
    "status": "pending_verification"
  }
] as const;