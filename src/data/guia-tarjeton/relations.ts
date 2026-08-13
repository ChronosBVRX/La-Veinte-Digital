export const guideRelations = [
  {
    "from": "field:57",
    "to": [
      "concept:029",
      "concept:030",
      "concept:037",
      "concept:048"
    ],
    "basis": "El manual indica que el sueldo mensual integrado es base para prima vacacional, prima dominical, guardias, tiempo extraordinario y ayuda para actividades culturales y recreativas.",
    "sourcePage": 19,
    "status": "manual-2023-reference"
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
    "basis": "El manual relaciona antigüedad efectiva con vacaciones, factores de ayuda de renta y días de ayuda cultural/recreativa.",
    "sourcePages": [
      11,
      18,
      19,
      23,
      27
    ],
    "status": "manual-2023-reference"
  },
  {
    "from": "field:30",
    "to": [
      "concept:032",
      "concept:033"
    ],
    "basis": "La quincena de incidencia identifica la quincena correspondiente al pago de estímulos de asistencia; el manual menciona desfase de registros.",
    "sourcePage": 15,
    "status": "manual-2023-reference"
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
    "basis": "La sección Observaciones contiene vencimiento, unidades, número de control, cargo inicial y mensajes/detalles.",
    "sourcePages": [
      32,
      33
    ],
    "status": "manual-2023-reference"
  }
] as const;
