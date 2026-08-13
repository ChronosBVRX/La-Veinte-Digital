export const guideSections = [
  {
    "id": "emisor",
    "name": "Emisor",
    "simple": "Datos del patrón que emite el comprobante.",
    "sourcePages": [
      7,
      9
    ]
  },
  {
    "id": "receptor",
    "name": "Receptor",
    "simple": "Datos personales y laborales del trabajador: adscripción, categoría, plaza, incidencias, periodo, vacaciones, créditos y otros.",
    "sourcePages": [
      7,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19
    ]
  },
  {
    "id": "percepciones-deducciones",
    "name": "Percepciones y Deducciones",
    "simple": "Ingresos y descuentos quincenales vinculados a la relación laboral, puesto/categoría, jornada y prestaciones.",
    "sourcePages": [
      7,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31
    ]
  },
  {
    "id": "mensajes",
    "name": "Mensajes",
    "simple": "Avisos e información que el patrón comunica al trabajador.",
    "sourcePages": [
      7,
      32
    ]
  },
  {
    "id": "observaciones",
    "name": "Observaciones",
    "simple": "Continuidad y detalle de conceptos, con importes, vencimientos, unidades, control, cargo inicial y observaciones.",
    "sourcePages": [
      7,
      32,
      33
    ]
  }
] as const;
