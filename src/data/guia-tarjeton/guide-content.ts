// Capa editorial de "Guía de mi Tarjetón".
// Contenido educativo curado para la UI, basado en el índice provisional
// (concepts.ts) y en la normativa vigente ya validada por La Veinte Digital.
//
// IMPORTANTE:
// - Este archivo es NOTA EDITORIAL/ÍNDICE, no autoridad normativa: ninguna
//   cantidad o porcentaje citado aquí se muestra como vigente sin respaldo
//   en fuentes oficiales (CCT IMSS-SNTSS vigente, normas y procedimientos
//   del IMSS) o en los motores validados del repositorio.
// - Las fórmulas y cantidades vigentes viven en los motores de
//   `features/calculators`, `features/nomina` y `features/vacations`.
// - `calculator` solo enlaza motores vigentes validados del repositorio.
// - Para agregar o actualizar un concepto: edita SOLO este archivo y,
//   si aplica, las fuentes en `sources.ts` y las relaciones en `relations.ts`.

export type GuideContentSourceType = "provisional" | "CCT" | "RIT" | "ley" | "convenio" | "app"

export interface GuideContentSource {
  type: GuideContentSourceType
  title: string
  reference?: string
  year?: number
  note?: string
}

export interface GuideCondition {
  what: string
  effect: string // "con_pago" | "sin_pago" | "reduce" | "suspende" | "informacion" | "variable"
}

export interface GuideCalculation {
  kind: "current" | "reference-only" | "none"
  engine?: string // nombre del motor vigente de La Veinte, cuando existe
  note?: string
  formula?: string // copia textual clara para mostrar en "Detallado" (solo reference-only)
}

export interface GuideConceptContent {
  code: string
  // Fácil — lenguaje humano, corto.
  easy: {
    short: string
    whyMatters?: string
    whenAppears?: string
    conditions?: GuideCondition[]
  }
  // Detallado — información laboral más completa.
  detailed?: {
    howItWorks?: string
    whenItAppears?: string
    affects?: string[]
    review?: string
    calculation?: GuideCalculation
  }
  // Relaciones navegables: "029" (concepto), "field:13" (campo), "section:observaciones".
  related?: string[]
  // Motor de cálculo vigente ya existente en la app (una sola fuente de verdad).
  calculator?: { route: string; label: string }
  sources?: GuideContentSource[]
  validity?: { notes: string }
  searchAliases?: string[]
}

export const GUIDE_CONCEPT_CONTENT: GuideConceptContent[] = [
  // ---------------------------------------------------------------------
  // PERCEPCIONES
  // ---------------------------------------------------------------------
  {
    code: "002",
    easy: {
      short: "Es el pago base de tu quincena, de acuerdo con la categoría que tienes en el Tabulador de Sueldos del IMSS.",
      whyMatters: "Es el punto de partida de casi todos tus pagos: muchas ayudas y estímulos se calculan sobre este importe.",
      whenAppears: "Debe aparecer en todas tus quincenas, mientras tu nombramiento esté vigente.",
      conditions: [
        { what: "Faltas, licencias sin sueldo y otras incidencias", effect: "reduce" },
        { what: "Cambio de categoría o jornada", effect: "variable" },
      ],
    },
    detailed: {
      howItWorks: "El IMSS tiene un tabulador con categorías de personal de base. Tu sueldo base quincenal corresponde a tu categoría y a la vigencia del tabulador (una fuente provisional menciona que se actualiza a partir del 16 de octubre de cada año).",
      whenItAppears: "Quincenalmente, mientras tu nombramiento esté vigente y existan días pagados en la quincena.",
      affects: [
        "Es la base de la ayuda de renta (011) y de muchos estímulos (032, 033).",
        "Se usa para el sueldo mensual integrado en el tarjetón.",
        "Es la referencia del simulador de nómina y de las calculadoras de la app.",
      ],
      review: "Compara que el importe corresponda a tu categoría. Si cambió sin que cambie tu categoría o jornada, conviene revisarlo.",
      calculation: {
        kind: "current",
        engine: "Simulador de nómina / Tabulador de sueldos",
        note: "La app ya tiene el tabulador vigente; no se usa la fórmula duna fuente provisional.",
      },
    },
    related: ["011", "022", "032", "033", "037", "field:57", "field:11"],
    calculator: { route: "/simulador-nomina", label: "Simular mi nómina" },
    searchAliases: ["sueldo base", "salario base", "tabular"],
  },
  {
    code: "011",
    easy: {
      short: "Es la ayuda que reciben muchos trabajadores para el pago de renta de su casa-habitación.",
      whyMatters: "Junto con el 002, es la base de gran parte de tus otros pagos y deducciones.",
      whenAppears: "Quincenalmente cuando la cláusula de ayuda de renta te sea aplicable: se paga en proporción a tu sueldo tabular.",
      conditions: [
        { what: "Faltas, licencias sin sueldo y otras incidencias", effect: "reduce" },
        { what: "Revisión contractual del porcentaje", effect: "variable" },
      ],
    },
    detailed: {
      howItWorks: "una fuente provisional indica que la ayuda de renta equivale a un porcentaje del sueldo tabular (72.15% en esa fuente) y que el porcentaje se actualiza en cada revisión contractual. Usa sueldos e historial reales: la cifra que ves en tu tarjetón es la que tu nómina realmente calculó.",
      whenItAppears: "Mientras la cláusula aplique a tu situación; es una percepción recurrente.",
      affects: ["Renta de tu casa-habitación", "Cálculo de estímulos y otros conceptos que toman el 011 como base"],
      review: "Si en la misma categoría ves un importe distinto al de semanas anteriores, revisa si hubo alguna actualización del porcentaje o una incidencia.",
      calculation: {
        kind: "reference-only",
        formula: "Sueldo tabular (002) × 72.15% (fuente provisional; el porcentaje se actualiza en cada revisión contractual)",
        note: "La app usa el tabulador vigente; este porcentaje es referencia histórica y requiere validación.",
      },
    },
    related: ["002", "022", "020", "field:57"],
    searchAliases: ["ayuda de renta", "renta", "cláusula 63 bis", "casa-habitación"],
  },
  {
    code: "012",
    easy: {
      short: "Es un complemento de pago que recibes cuando laburas con jornada discontinua.",
      whyMatters: "Recompensa un horario partido: una fuente provisional habla de un 15% adicional sobre tu sueldo normal.",
      whenAppears: "Solo en las quincenas donde se paga jornada discontinua.",
      conditions: [{ what: "Jornada continua normal", effect: "variable" }],
    },
    detailed: {
      howItWorks: "La cláusula 28 del CCT permite horarios discontinuos por necesidad del servicio con aceptación previa del sindicato, y el trabajador percibe un porcentaje adicional de sueldo (una fuente provisional registra 15%).",
      whenItAppears: "En las quincenas en las que tu jornada discontinua esté vigente.",
      affects: ["Se toma en cuenta en diversas bases de cálculo (por ejemplo, primas y estímulos)"],
      review: "Es un concepto variable: puede aparecer o desaparecer según tu horario asignado.",
      calculation: {
        kind: "reference-only",
        formula: "Sueldo tabular (002) + 011 × 15% (fuente provisional; validar vigencia y precedencia)",
        note: "Pendiente de validación contra normativa vigente.",
      },
    },
    related: ["002", "011", "field:11"],
    searchAliases: ["jornada discontinua", "horario partido"],
  },
  {
    code: "013",
    easy: {
      short: "Sobresueldo que reciben los médicos en ciertas condiciones.",
      whyMatters: "Es un complemento del sueldo base que forma parte de varias bases de cálculo.",
      whenAppears: "Quincenalmente cuando tu categoría y condiciones lo contemplan.",
    },
    detailed: {
      howItWorks: "Complementos salariales al personal médico pueden integrarse en las bases de cálculo de otras percepciones.",
      whenItAppears: "Mientras tu nombramiento lo contemple.",
      review: "Aparece en el tarjetón como una percepción más; su presencia depende de tu categoría.",
    },
    related: ["002", "011", "022"],
    searchAliases: ["sobresueldo médicos", "médicos"],
  },
  {
    code: "020",
    easy: {
      short: "Ayuda quincenal fija para el pago de renta (cláusula 63 Bis inciso A).",
      whyMatters: "Es un apoyo fijo: una fuente provisional registra $250.00 quincenales.",
      whenAppears: "Quincenalmente para quien tiene derecho a esta prestación.",
      conditions: [{ what: "Incidencias o pérdida del derecho", effect: "suspende" }],
    },
    detailed: {
      howItWorks: "Importe fijo mensual ($500.00 en la fuente 2023) pagado por quincena ($250.00). La app lo reconoce como concepto recurrente con importe fijo vigente ($250.00 quincenales en `fixed-concept-amounts`).",
      whenItAppears: "Es un concepto recurrente; puede dejar de aparecer si se modifica tu derecho a la prestación.",
      review: "Si es tu caso, deberías verlo cada quincena.",
    },
    related: ["011", "022", "002"],
    searchAliases: ["ayuda de renta", "renta 250", "renta inciso a"],
  },
  {
    code: "022",
    easy: {
      short: "Es la ayuda de renta ligada a tu antigüedad: a más años de servicio, mayor el factor.",
      whyMatters: "Crece con tu antigüedad, así que es un buen dato para revisar que tu antigüedad esté bien registrada.",
      whenAppears: "Quincenalmente cuando tienes derecho a la ayuda de renta por antigüedad.",
      conditions: [{ what: "Antigüedad efectiva insuficiente", effect: "variable" }],
    },
    detailed: {
      howItWorks: "El factor de pago se calcula dividiendo los días de estímulo entre 360, y la antigüedad se determina conforme a la cláusula 30 del CCT (referencia del fuente provisional).",
      whenItAppears: "Se genera periódicamente según tus periodos de antigüedad.",
      affects: ["Depende directamente de tu antigüedad efectiva registrada"],
      review: "Si cambió sin que cambie tu antigüedad, conviene revisar el registro.",
      calculation: {
        kind: "reference-only",
        formula: "002 + 011 (o 013 + 057 + 058 + 061, según el caso) × factor según años de servicio (fuente provisional)",
        note: "Requiere la tabla/factor vigente; la app lo cubre en el simulador de nómina.",
      },
    },
    related: ["field:13", "011", "002", "048", "field:45", "field:53"],
    calculator: { route: "/simulador-nomina", label: "Simular mi nómina con mi antigüedad" },
    searchAliases: ["ayuda de renta antigüedad", "renta por antigüedad", "inciso c"],
  },
  {
    code: "023",
    easy: {
      short: "Complemento que aparece como base en varios cálculos del IMSS.",
      whyMatters: "No es el pago directo más visible, pero forma parte de las bases de muchos conceptos.",
      whenAppears: "Según tu categoría y condiciones laborales.",
    },
    detailed: {
      howItWorks: "Concepto recurrente que se integra en bases de cálculo de estímulos, primas y deducciones.",
      whenItAppears: "Es recurrente en el tarjetón (la app lo clasifica como concepto recurrente).",
      review: "Déjalo que te sirva de referencia: si lo tenías y dejó de aparecer sin explicación, revísalo.",
    },
    related: ["002", "011", "022"],
  },
  {
    code: "025",
    easy: {
      short: "Pago que cubre el servicio de guardería cuando no hay cupo en alguna.",
      whyMatters: "Sustituye al servicio de guardería con un monto mensual (el fuente provisional registra $1,000.00 mensuales, $500.00 quincenales).",
      whenAppears: "Solo para trabajadores con derecho a guardería sin cupo disponible y con comprobación de su derecho.",
      conditions: [{ what: "Cupo disponible en guardería", effect: "suspende" }],
    },
    detailed: {
      howItWorks: "Cuando no hay espacio en una guardería, el IMSS paga una cantidad mensual por cada hijo con derecho al servicio, previa comprobación del derecho (cláusula 76 CCT).",
      whenItAppears: "En las quincenas mientras aplique la situación de falta de cupo.",
      review: "Si usas guardería con cupo, no deberías verlo.",
      calculation: {
        kind: "reference-only",
        formula: "$1,000.00 mensuales / $500.00 quincenales (fuente provisional)",
        note: "Cantidad de referencia; validar vigencia.",
      },
    },
    related: ["039", "113"],
    searchAliases: ["guardería", "supletorio"],
  },
  {
    code: "026",
    easy: {
      short: "Compensación mensual de pasajes para quienes desempeñan tareas fuera de los centros de trabajo.",
      whyMatters: "una fuente provisional registra $600.00 mensuales ($300.00 quincenales) y no se suspende en vacaciones ni en licencias por enfermedad.",
      whenAppears: "Quincenalmente para el personal que labora fuera de los centros de trabajo.",
      conditions: [{ what: "Tareas fuera del centro de trabajo", effect: "informacion" }],
    },
    detailed: {
      howItWorks: "Compensación para transporte de quienes deben trabajar fuera de los centros de trabajo (cláusula 103 CCT en la referencia 2023).",
      whenItAppears: "Mientras exista la condición de trabajo fuera de tu centro.",
      review: "Es recurrente para quienes les aplica.",
      calculation: {
        kind: "reference-only",
        formula: "$600.00 mensuales / $300.00 quincenales (fuente provisional)",
        note: "Cantidad de referencia; validar vigencia.",
      },
    },
    related: ["027"],
    searchAliases: ["pasajes fijos", "transporte"],
  },
  {
    code: "027",
    easy: {
      short: "Compensación de pasajes para quienes viven en un municipio distinto al del trabajo.",
      whyMatters: "Aplica solo si tu residencia es en un municipio colindante con el de tu centro de trabajo.",
      whenAppears: "Cuando la Comisión de Pasajes determina tu derecho y el importe.",
    },
    detailed: {
      howItWorks: "El importe lo determinan la Comisión Nacional o las subcomisiones mixtas de Pasajes (fuente provisional).",
      whenItAppears: "Mientras prestes servicios en un municipio distinto al de tu residencia, si es colindante.",
      review: "Es un concepto condicionado a tu situación de residencia.",
    },
    related: ["026"],
    searchAliases: ["pasajes", "compensación de pasajes", "municipio colindante"],
  },
  {
    code: "029",
    easy: {
      short: "Es la prima que recibes cuando tomas vacaciones: un 25% sobre el pago de tus días de vacaciones.",
      whyMatters: "Se genera con cada periodo vacacional y su importe depende de tu sueldo mensual integrado.",
      whenAppears: "En la quincena donde se paga tu periodo de vacaciones (disfrutado).",
      conditions: [{ what: "No disfrutar el periodo", effect: "suspende" }],
    },
    detailed: {
      howItWorks: "Por cada año de servicios tienes un periodo mínimo de vacaciones (el fuente provisional señala 16 días hábiles con aumento de un día por año, sin exceder 20). Durante ese periodo te corresponde una prima del 25% sobre los salarios correspondientes (cláusula 47 CCT).",
      whenItAppears: "En la quincena en la que coincide el pago de tus vacaciones.",
      affects: ["Depende de tu sueldo mensual integrado", "Se relaciona con tus periodos de vacaciones"],
      review: "Si tomaste vacaciones y el importe no te cuadra, revisa los días pagados.",
      calculation: {
        kind: "current",
        engine: "Simulador de vacaciones / motor del módulo Vacaciones",
        note: "La app ya cuenta con un módulo de vacaciones.",
      },
    },
    related: ["field:57", "field:45", "field:49", "037", "048", "030"],
    calculator: { route: "/vacaciones", label: "Simular mis vacaciones" },
    searchAliases: ["prima vacacional", "vacaciones", "prima de vacaciones"],
  },
  {
    code: "030",
    easy: {
      short: "Es el 25% adicional que recibes por cada domingo trabajado.",
      whyMatters: "Solo aparece si laboras en domingo; es un complemento a tu pago ordinario.",
      whenAppears: "En las quincenas donde hayas trabajado domingos.",
    },
    detailed: {
      howItWorks: "Los trabajadores que laboran domingos disfrutan una prima dominical del 25% sobre el salario de un día ordinario (cláusula 46 fracción II CCT, referencia 2023).",
      whenItAppears: "Quincenas con domingos laborados.",
      review: "Revisa que el número de domingos coincida con los que trabajaste.",
      calculation: {
        kind: "reference-only",
        formula: "Base quincenal ÷ 15 ÷ jornada × 0.25 (fuente provisional; validar vigencia)",
        note: "El motor vigente si existe en la app se usará en lugar de esta referencia.",
      },
    },
    related: ["002", "011", "022"],
    searchAliases: ["dominical", "prima dominical", "domingo"],
  },
  {
    code: "031",
    easy: {
      short: "Pago que recibes cuando te movilizan laboralmente de un lugar a otro.",
      whyMatters: "Se genera solo por movilizaciones de lugar (necesidades del servicio).",
      whenAppears: "Únicamente cuando ocurre un cambio de lugar autorizado.",
    },
    detailed: {
      howItWorks: "Cuando por necesidades del servicio te muevan de lugar, una fuente provisional indica que se cubren pasajes, transporte de menaje y un importe equivalente a 60 días de sueldo (cláusula 99 CCT).",
      whenItAppears: "En la quincena del cambio de lugar.",
      review: "Es extraordinario: no debería aparecer en quincenas normales.",
      calculation: {
        kind: "reference-only",
        formula: "002 + 011 × 4 quincenas (60 días de sueldo) (fuente provisional; validar vigencia)",
      },
    },
    related: ["002", "011"],
    searchAliases: ["cambio de lugar", "cláusula 99", "movilización"],
  },
  {
    code: "032",
    easy: {
      short: "Es el estímulo que recibes por asistir todos los días hábiles de la quincena: equivale a 3 días de aguinaldo.",
      whyMatters: "Es un pago recurrente que se genera con tu asistencia perfecta y puede perderse por ciertas incidencias.",
      whenAppears: "Aparece en la quincena siguiente a la que completaste tu asistencia (hay un desfase de una quincena).",
      conditions: [
        { what: "Faltas injustificadas, licencia sin sueldo, incapacidad por enfermedad general", effect: "sin_pago" },
        { what: "Incapacidad por maternidad o por riesgo de trabajo, vacaciones, comisión", effect: "con_pago" },
        { what: "Pases de salida de más de 8 horas", effect: "sin_pago" },
      ],
    },
    detailed: {
      howItWorks: "El estímulo por asistencia se otorga por asistir todos los días hábiles de la quincena (3 días de aguinaldo) y se paga en la nómina de la quincena siguiente a aquella en la que ocurrió (artículo 91 del RIT, referencia 2023).",
      whenItAppears: "En la quincena siguiente a la de la asistencia perfecta; por eso a veces no coincide con tu quincena de incidencia.",
      affects: ["Registros de asistencia de la quincena anterior", "Se paga con un mes de desfase según una fuente provisional"],
      review: "Si no aparece, revisa tu quincena de incidencia y las incidencias registradas (faltas, licencias, incapacidades).",
      calculation: {
        kind: "current",
        engine: "Simulador de nómina",
        note: "El simulador de nómina de la app calcula estímulos con la lógica vigente.",
      },
    },
    related: ["033", "field:30", "022", "002", "011"],
    calculator: { route: "/simulador-nomina", label: "Simular mis estímulos" },
    searchAliases: ["estímulo por asistencia", "asistencia", "estímulo 032"],
  },
  {
    code: "033",
    easy: {
      short: "Es el estímulo que recibes por llegar puntual: por cada 10 asistencias dentro del minuto 5, te corresponden 2 días de aguinaldo.",
      whyMatters: "Es un pago que se genera con tu puntualidad y se refleja con una quincena de desfase.",
      whenAppears: "Aparece cuando acumulas 10 marcas de asistencia puntual; se paga en la quincena siguiente.",
      conditions: [
        { what: "Faltas injustificadas, licencia sin sueldo", effect: "sin_pago" },
        { what: "Incapacidad por enfermedad general", effect: "sin_pago" },
        { what: "Vacaciones, comisión, incapacidad por maternidad o por riesgo de trabajo", effect: "con_pago" },
        { what: "Licencias con sueldo por fallecimiento de padres, hijos o cónyuge", effect: "sin_pago" },
      ],
    },
    detailed: {
      howItWorks: "Registrar la asistencia hasta el minuto 5 de entrada cuenta como asistencia puntual; cada 10 marcas generan el pago de 2 días de aguinaldo (cláusula 38 y artículo 93 RIT, referencia 2023).",
      whenItAppears: "Con una quincena de desfase respecto a la incidencia; también considera días de vacaciones, pases de entrada oficiales e incapacidades por riesgo de trabajo (no en trayecto).",
      affects: ["Marcas de \"sin retardo\" del tarjetón", "Quincena de incidencia"],
      review: "El que no aparezca una quincena no significa un error: revisa las marcas de asistencia y el desfase de pago.",
      calculation: {
        kind: "current",
        engine: "Simulador de nómina",
        note: "El simulador de nómina de la app calcula estímulos con la lógica vigente.",
      },
    },
    related: ["032", "field:23", "field:39", "field:30", "002", "011"],
    calculator: { route: "/simulador-nomina", label: "Simular mis estímulos" },
    searchAliases: ["estímulo por puntualidad", "puntualidad", "estímulo 033", "sin retardo"],
  },
  {
    code: "037",
    easy: {
      short: "Es el pago por las horas que trabajas más allá de tu jornada contratada, incluyendo tiempos en días de descanso.",
      whyMatters: "Su importe depende de tu sueldo y de las horas reportadas; la app tiene una calculadora para estimarlo.",
      whenAppears: "Solo en quincenas donde se reportaron horas extraordinarias.",
      conditions: [{ what: "Horas extraordinarias autorizadas y reportadas", effect: "informacion" }],
    },
    detailed: {
      howItWorks: "Se considera tiempo extraordinario el que excede los límites de tu jornada diaria contratada y todo el tiempo laborado en días de descanso semanal y días no laborales (cláusulas 32 y 33 CCT, referencia 2023).",
      whenItAppears: "En las quincenas donde tengas horas extraordinarias autorizadas.",
      review: "Compara que el número de horas cuadre con las autorizadas.",
      calculation: {
        kind: "current",
        engine: "Calculadora de tiempo extra",
        note: "La app ya tiene la calculadora de tiempo extra vigente.",
      },
    },
    related: ["002", "011", "020", "050", "field:57"],
    calculator: { route: "/calculadoras/tiempo-extra", label: "Calcular mi tiempo extra" },
    searchAliases: ["tiempo extra", "tiempo extraordinario", "horas extra", "037"],
  },
  {
    code: "038",
    easy: {
      short: "Es el pago en efectivo de vacaciones (personal comisionado del SNTSS).",
      whyMatters: "Solo aplica para personal sindical comisionado en ciertas condiciones.",
      whenAppears: "Únicamente en los casos que contempla la cláusula correspondiente.",
    },
    detailed: {
      howItWorks: "Se paga únicamente al personal comisionado del SNTSS por periodo anual, el tiempo que dure la comisión sindical (cláusula 42 CCT, referencia 2023).",
      whenItAppears: "Por periodo anual mientras dure la comisión.",
      review: "Si no eres personal comisionado, no debería aparecer.",
    },
    related: ["029", "048"],
    searchAliases: ["vacaciones en efectivo", "comisionado"],
  },
  {
    code: "039",
    easy: {
      short: "Es una bonificación quincenal ligada al seguro de guarderías.",
      whyMatters: "una fuente provisional registra un importe de $5.21 quincenal.",
      whenAppears: "Quincenalmente para el personal con esa bonificación.",
      conditions: [{ what: "Derecho a guarderías", effect: "informacion" }],
    },
    detailed: {
      howItWorks: "Bonificación por seguro de responsabilidad civil de la rama de guarderías (fuente provisional).",
      whenItAppears: "Es un concepto fijo para quien tiene derecho.",
      calculation: {
        kind: "reference-only",
        formula: "$5.21 quincenal (fuente provisional)",
        note: "Cantidad de referencia; validar vigencia.",
      },
    },
    related: ["025", "113"],
  },
  {
    code: "040",
    easy: {
      short: "Bonificación quincenal al personal médico como protección a la práctica médica.",
      whyMatters: "Aplica principalmente a personal con práctica médica (el fuente provisional registra $20.20 quincenales).",
      whenAppears: "Quincenalmente para el personal que la tiene asignada.",
    },
    detailed: {
      howItWorks: "Bonificación por seguro médico como protección a la práctica médica (fuente provisional).",
      whenItAppears: "Para personal médico con derecho a esta bonificación.",
    },
    related: ["120"],
    searchAliases: ["bonificación seguro médico", "práctica médica"],
  },
  {
    code: "042",
    easy: {
      short: "Es el anticipo de sueldo de la cláusula 97: hasta 3 meses de sueldo, una sola vez al año y sin intereses.",
      whyMatters: "Si lo solicitaste, verás el pago del anticipo y después su recuperación como descuento.",
      whenAppears: "En la quincena en la que se te deposita el anticipo.",
      conditions: [{ what: "Antigüedad mínima (23 quincenas según el fuente provisional)", effect: "informacion" }, { what: "Solicitud del trabajador", effect: "informacion" }],
    },
    detailed: {
      howItWorks: "Es facultativo del trabajador de base usar en una sola ocasión o fraccionado, hasta por tres meses de sueldo, una sola vez al año y sin devengar intereses (cláusula 97 CCT, referencia 2023).",
      whenItAppears: "En la quincena que lo solicitas; su recuperación se descuenta después (concepto 160).",
      affects: ["Se recupera mediante el descuento 160"],
      review: "Si pediste un anticipo, ambas partes deben reflejarse: el pago y después la recuperación.",
      calculation: {
        kind: "current",
        engine: "Calculadora cláusula 97",
        note: "La app ya tiene la calculadora de la cláusula 97.",
      },
    },
    related: ["160", "002", "011"],
    calculator: { route: "/calculadoras/clausula-97", label: "Calcular anticipo cláusula 97" },
    searchAliases: ["anticipo de sueldo", "cláusula 97", "préstamo personal"],
  },
  {
    code: "043",
    easy: {
      short: "Es el vale a cuenta de aguinaldo que se paga en la primera quincena de agosto, a solicitud del trabajador.",
      whyMatters: "Es la parte intermedia de tu aguinaldo anual de 3 meses.",
      whenAppears: "En la primera quincena de agosto, si lo solicitaste en la programación anual.",
      conditions: [{ what: "Solicitud del trabajador", effect: "informacion" }],
    },
    detailed: {
      howItWorks: "El aguinaldo anual es de 3 meses de sueldo nominal: medio mes en enero (047), un mes en la primera quincena de agosto a solicitud (043) y el resto en la primera quincena de diciembre (049). Se paga libre de impuestos (cláusula 107 CCT, referencia 2023).",
      whenItAppears: "Primera quincena de agosto de cada año, si lo solicitaste.",
      review: "Si no lo solicitaste, no debería aparecer.",
      calculation: {
        kind: "current",
        engine: "Calculadora de aguinaldo",
        note: "La app ya tiene la calculadora de aguinaldo.",
      },
    },
    related: ["047", "049", "197", "199"],
    calculator: { route: "/calculadoras/aguinaldo", label: "Calcular mi aguinaldo" },
    searchAliases: ["vale a cuenta de aguinaldo", "aguinaldo agosto", "vale aguinaldo"],
  },
  {
    code: "044",
    easy: {
      short: "Ayuda quincenal para refrigerio (personal de guarderías que no recibe alimentos en especie).",
      whyMatters: "una fuente provisional registra $30.00 quincenales.",
      whenAppears: "Quincenalmente para quien tiene derecho; se afecta por varias incidencias.",
      conditions: [
        { what: "Incidencias (incapacidades, comisiones, licencias, faltas, becas, vacaciones)", effect: "reduce" },
      ],
    },
    detailed: {
      howItWorks: "Ayuda para alimentación al personal de guarderías que no percibe alimentos en especie; se afecta con incidencias (fuente provisional).",
      whenItAppears: "Quincenas de nómina activa para el personal con derecho.",
      calculation: {
        kind: "reference-only",
        formula: "$30.00 quincenales (fuente provisional)",
        note: "Cantidad de referencia; validar vigencia.",
      },
    },
    related: ["025", "039"],
    searchAliases: ["refrigerio", "alimentos"],
  },
  {
    code: "047",
    easy: {
      short: "Es el anticipo de aguinaldo de enero: medio mes de sueldo, se paga de forma automática.",
      whyMatters: "Es la primera parte del aguinaldo de 3 meses.",
      whenAppears: "Primera quincena de enero de cada año, automáticamente.",
    },
    detailed: {
      howItWorks: "Pago automático de medio mes de aguinaldo en la primera quincena de enero (cláusula 107 CCT, referencia 2023).",
      whenItAppears: "Primera quincena de enero.",
      review: "Si trabajaste el año completo, debe aparecer cada enero.",
      calculation: {
        kind: "current",
        engine: "Calculadora de aguinaldo",
      },
    },
    related: ["043", "049", "197"],
    calculator: { route: "/calculadoras/aguinaldo", label: "Calcular mi aguinaldo" },
    searchAliases: ["anticipo aguinaldo enero", "aguinaldo enero"],
  },
  {
    code: "048",
    easy: {
      short: "Es la ayuda para actividades culturales y recreativas: días de salario según tu antigüedad.",
      whyMatters: "Su importe crece con tu antigüedad (de 23 a 31 días), así que refleja tu tiempo de servicio.",
      whenAppears: "En el periodo anual en que se paga esta prestación.",
      conditions: [{ what: "Antigüedad efectiva", effect: "variable" }],
    },
    detailed: {
      howItWorks: "Los trabajadores perciben días de salario por ayuda cultural y recreativa según su antigüedad efectiva (tabla del fuente provisional: 1 año = 23 días … 5 y más = 31 días).",
      whenItAppears: "En la quincena del pago anual de esta ayuda.",
      affects: ["Su cálculo depende del sueldo mensual integrado"],
      calculation: {
        kind: "reference-only",
        formula: "SMI ÷ 30 × días de ayuda según antigüedad (fuente provisional; validar tabla vigente)",
      },
    },
    related: ["field:13", "field:57", "029"],
    searchAliases: ["actividades culturales", "recreativas", "culturales"],
  },
  {
    code: "049",
    easy: {
      short: "Es el aguinaldo: el pago que cierra tu aguinaldo anual de 3 meses de sueldo.",
      whyMatters: "Se paga en la primera quincena de diciembre y es uno de los pagos más importantes del año.",
      whenAppears: "Primera quincena de diciembre.",
    },
    detailed: {
      howItWorks: "El aguinaldo anual es de 3 meses de sueldo nominal y proporcional a los sueldos percibidos: medio mes en enero (047), un mes en agosto a solicitud (043) y el resto en la primera quincena de diciembre (049). Se paga libre de impuestos (cláusula 107 CCT, referencia 2023).",
      whenItAppears: "Primera quincena de diciembre de cada año.",
      review: "Si iniciaste a mitad de año, el importe es proporcional a lo trabajado.",
      calculation: {
        kind: "current",
        engine: "Calculadora de aguinaldo",
        note: "La app ya tiene la calculadora de aguinaldo.",
      },
    },
    related: ["043", "047", "002", "011"],
    calculator: { route: "/calculadoras/aguinaldo", label: "Calcular mi aguinaldo" },
    searchAliases: ["aguinaldo", "diciembre"],
  },
  {
    code: "050",
    easy: {
      short: "Es una ayuda quincenal fija para despensa.",
      whyMatters: "Es un apoyo fijo (una fuente provisional registra $400.00 mensuales; la app usa $200.00 quincenales como fijo vigente).",
      whenAppears: "Quincenalmente para quien tiene derecho.",
      conditions: [{ what: "Pérdida del derecho por categoría o incidencias", effect: "suspende" }],
    },
    detailed: {
      howItWorks: "Ayuda para despensa (cláusula 142 Bis CCT en la referencia 2023). La app lo reconoce como concepto recurrente con importe fijo vigente en `fixed-concept-amounts`.",
      whenItAppears: "Es un concepto recurrente.",
      review: "Si lo tenías y dejó de aparecer, conviene revisarlo.",
    },
    related: ["002", "011"],
    searchAliases: ["despensa", "ayuda para despensa"],
  },
  {
    code: "051",
    easy: {
      short: "Concepto de pago adicional que puede aparecer según tu categoría.",
      whyMatters: "Forma parte de las combinaciones salariales que usa la aplicación en el simulador.",
      whenAppears: "Según tu categoría y condiciones laborales.",
    },
    detailed: {
      howItWorks: "Concepto registrado en el catálogo de percepciones; su presencia depende de tu nombramiento.",
      whenItAppears: "Cuando tu situación lo contempla.",
      review: "La app lo reconoce en el simulador de nómina.",
    },
    related: ["002", "011"],
  },
  {
    code: "052",
    easy: {
      short: "Pago por notas de mérito: cada nota equivale a un día adicional de aguinaldo.",
      whyMatters: "Las notas de mérito se pagan en la primera quincena de diciembre junto con otros conceptos.",
      whenAppears: "Primera quincena de diciembre, por notas de mérito otorgadas en el año.",
    },
    detailed: {
      howItWorks: "Por cada nota de mérito dentro de un año calendario, se aumenta un día adicional de aguinaldo (cláusula 126 CCT y artículo 97 RIT, referencia 2023).",
      whenItAppears: "Se paga en la primera quincena de diciembre.",
      review: "Si recibiste nota(s) de mérito, revisa que el número de días cuadre.",
    },
    related: ["049", "field:28"],
    searchAliases: ["notas de mérito", "notas"],
  },
  {
    code: "053",
    easy: {
      short: "Es la liquidación que se paga desde el fondo de retiro del trabajador.",
      whyMatters: "Se relaciona con los fondos de retiro que también ves como descuentos (107, 108, 111, 152).",
      whenAppears: "En los casos que contempla el régimen de fondos.",
    },
    detailed: {
      howItWorks: "Liquidaciones del fondo de retiro conforme al régimen aplicable (cláusula 143 y capítulo V del Reglamento del fondo de retiro, referencia 2023).",
      whenItAppears: "En situaciones específicas de liquidación.",
      review: "No es recurrente: su aparición tiene causa específica.",
    },
    related: ["107", "108", "111", "152"],
    searchAliases: ["fondo de retiro", "liquidación"],
  },
  {
    code: "054",
    easy: {
      short: "Compensación por emanaciones radioactivas (personal no médico).",
      whyMatters: "Es un complemento que puede formar parte de tus bases de cálculo.",
      whenAppears: "Según tu área de trabajo y exposición.",
    },
    detailed: {
      howItWorks: "Concepto de compensación incluido en diversas bases de cálculo del tarjetón.",
      whenItAppears: "Para el personal cuyas funciones lo contemplan.",
    },
    related: ["063", "002", "011"],
  },
  {
    code: "055",
    easy: {
      short: "Es el fondo de ahorro: se entrega una vez al año, en la segunda quincena de julio.",
      whyMatters: "Es uno de los pagos anuales más esperados; una fuente provisional habla de 46 días de sueldo tabular.",
      whenAppears: "Segunda quincena de julio.",
      conditions: [{ what: "Incidencias del ejercicio (faltas, licencias sin sueldo, becas sin sueldo)", effect: "reduce" }],
    },
    detailed: {
      howItWorks: "El instituto entrega en la segunda quincena de julio el equivalente a días de sueldo tabular por concepto de fondo de ahorro, libre de impuestos y proporcional al tiempo trabajado del 1 de julio al 30 de junio (cláusula 144 CCT y artículo 18 del régimen, referencia 2023; el total de 46 días corresponde a la vigencia del contrato 2021-2023).",
      whenItAppears: "Segunda quincena de julio.",
      review: "Si tuviste incidencias, el importe puede ser proporcional.",
      calculation: {
        kind: "reference-only",
        formula: "(002 + 011) ÷ 15 × 46 días (fuente provisional; contrato 2021-2023, requiere actualización)",
      },
    },
    related: ["152", "192", "002", "011"],
    searchAliases: ["fondo de ahorro", "ahorro julio"],
  },
  {
    code: "057",
    easy: {
      short: "Concepto de atención integral que forma parte de las bases de cálculo.",
      whyMatters: "Aparece en varias combinaciones de cálculo del tarjetón.",
      whenAppears: "Según tu categoría.",
    },
    detailed: {
      howItWorks: "Se integra en las bases de cálculo de múltiples conceptos (una fuente provisional lo menciona como parte de las sumas base).",
      whenItAppears: "Mientras tu nombramiento lo contemple.",
    },
    related: ["002", "011", "058", "061"],
  },
  {
    code: "058",
    easy: {
      short: "Sobresueldo para enfermería con participación en docencia, enseñanza e investigación.",
      whyMatters: "una fuente provisional menciona un aumento del 31% sobre la base salarial.",
      whenAppears: "Quincenalmente para categorías de enfermería con actividades docentes.",
    },
    detailed: {
      howItWorks: "Trabajadores de ciertas categorías de enfermería reciben un aumento por participar en actividades docentes, de enseñanza e investigación (cláusula 151 CCT, referencia 2023).",
      whenItAppears: "Quincenalmente mientras acredites la actividad.",
      calculation: {
        kind: "reference-only",
        formula: "(002 + 011) × 31% (fuente provisional; validar cláusula y porcentaje vigentes)",
      },
    },
    related: ["002", "011"],
    searchAliases: ["docencia enfermería", "enfermería", "enseñanza"],
  },
  {
    code: "061",
    easy: {
      short: "Concepto que integra las bases de cálculo de varios pagos.",
      whyMatters: "Común en combinaciones salariales del personal médico.",
      whenAppears: "Según tu nombramiento.",
    },
    related: ["002", "011", "058"],
  },
  {
    code: "062",
    easy: {
      short: "Ayuda para libros dirigida al personal médico.",
      whyMatters: "La app lo reconoce con porcentaje para ciertas categorías.",
      whenAppears: "Quincenalmente para el personal médico con derecho.",
    },
    detailed: {
      howItWorks: "Ayuda para libros a médicos; la app tiene una tabla de porcentajes vigente para calcularlo.",
      whenItAppears: "Según categoría y tablas vigentes.",
      calculation: {
        kind: "current",
        engine: "Tabla de porcentajes de la app (concept-percentage-tables)",
      },
    },
    related: ["072", "002", "011"],
    searchAliases: ["libros médicos", "ayuda para libros"],
  },
  {
    code: "063",
    easy: {
      short: "Emanaciones radioactivas (personal médico).",
      whyMatters: "Forma parte de bases de cálculo y de combinaciones salariales.",
      whenAppears: "Según tu área de trabajo.",
    },
    related: ["054", "002", "011"],
  },
  {
    code: "070",
    easy: {
      short: "Es la devolución de impuesto (ISPT) de año anterior.",
      whyMatters: "Si te corresponde, se paga en la segunda quincena de marzo del año siguiente.",
      whenAppears: "Segunda quincena de marzo, si el cálculo anual de ISPT procede a tu favor.",
    },
    detailed: {
      howItWorks: "Se genera según la mecánica del cálculo anual de ISPT; si procede devolución, se efectúa en la segunda quincena de marzo del año siguiente (fuente provisional).",
      whenItAppears: "Una vez al año, cuando aplica.",
      review: "Depende del resultado de tu cálculo de impuestos anual.",
    },
    related: ["151"],
    searchAliases: ["devolución isr", "devoluciones ispt", "impuestos", "reembolso impuesto"],
  },
  {
    code: "072",
    easy: {
      short: "Ayuda para libros dirigida al personal no médico.",
      whyMatters: "La app lo reconoce con porcentaje para ciertas categorías.",
      whenAppears: "Según categoría y tablas vigentes.",
    },
    detailed: {
      howItWorks: "Ayuda para libros a personal no médico; la app tiene una tabla de porcentajes vigente.",
      whenItAppears: "Según categoría.",
      calculation: {
        kind: "current",
        engine: "Tabla de porcentajes de la app (concept-percentage-tables)",
      },
    },
    related: ["062", "002", "011"],
    searchAliases: ["libros no médicos", "ayuda para libros"],
  },
  {
    code: "078",
    easy: {
      short: "Pago relacionado con actividades académicas.",
      whyMatters: "La app lo reconoce en su catálogo de elegibilidad.",
      whenAppears: "Según tu categoría y funciones.",
    },
    detailed: {
      howItWorks: "Concepto de actividades académicas reconocido por la app en su motor de nómina.",
      whenItAppears: "Cuando tu situación lo contempla.",
    },
    related: ["083", "002", "011"],
    searchAliases: ["actividades académicas"],
  },
  {
    code: "083",
    easy: {
      short: "Sobresueldo por investigación y docencia.",
      whyMatters: "Complemento salarial para personal con actividades de investigación y docencia.",
      whenAppears: "Según tu nombramiento.",
    },
    detailed: {
      howItWorks: "Se integra en las combinaciones salariales; la app lo reconoce en su motor de nómina.",
      whenItAppears: "Mientras tu categoría lo contemple.",
    },
    related: ["058", "078", "002", "011"],
    searchAliases: ["investigación", "docencia"],
  },
  {
    code: "084",
    easy: {
      short: "Es el estímulo a la calidad y eficiencia: un bono por resultados excepcionales.",
      whyMatters: "Premia productividad y calidad; no es un pago fijo.",
      whenAppears: "Cuando se otorga el bono conforme al contrato.",
      conditions: [{ what: "Resultados excepcionales según tus funciones", effect: "informacion" }],
    },
    detailed: {
      howItWorks: "Todos los trabajadores de base tienen derecho a un bono que incentive productividad, eficiencia y calidad, premiando resultados excepcionales conforme a lo establecido en el contrato (cláusula transitoria, referencia 2023).",
      whenItAppears: "En los periodos en que se otorga el estímulo.",
      review: "No es recurrente: su aparición depende de la evaluación.",
    },
    related: ["033", "032"],
    searchAliases: ["calidad y eficiencia", "bono", "estímulo calidad"],
  },

  // ---------------------------------------------------------------------
  // DEDUCCIONES
  // ---------------------------------------------------------------------
  {
    code: "104",
    easy: {
      short: "Descuento de tu crédito hipotecario FOVI (Fondo de Vivienda).",
      whyMatters: "Es un descuento de crédito: verás su avance en la sección de Observaciones.",
      whenAppears: "Cada quincena, mientras tenga saldo tu crédito.",
      conditions: [{ what: "Saldo liquidado", effect: "suspende" }],
    },
    detailed: {
      howItWorks: "Crédito hipotecario FOVI; los créditos suelen mostrar en Observaciones la fecha de vencimiento y el avance del saldo.",
      whenItAppears: "Quincenalmente hasta liquidar el crédito.",
      review: "Revisa vencimiento y saldo en Observaciones.",
    },
    related: ["field:71", "field:73", "field:76"],
    searchAliases: ["fovi", "crédito hipotecario", "vivienda"],
  },
  {
    code: "106",
    easy: {
      short: "Descuento por el enganche de una casa-habitación adquirida con E.S.M.I.",
      whyMatters: "Es la recuperación del enganche de tu crédito de vivienda.",
      whenAppears: "Cada quincena mientras se recupera el enganche.",
    },
    detailed: {
      howItWorks: "Recuperación del enganche de casa-habitación de créditos E.S.M.I.",
      whenItAppears: "Hasta que se cubre el importe del enganche.",
    },
    related: ["130", "136"],
    searchAliases: ["enganche", "esmi", "casa habitación"],
  },
  {
    code: "107",
    easy: {
      short: "Es tu aportación adicional al fondo de jubilación (la parte que se descuenta con este concepto).",
      whyMatters: "Construye tu ahorro para la jubilación junto con el 152 (3%) y el 108 (RJP).",
      whenAppears: "Quincenalmente para los trabajadores de base de nuevo ingreso a los que aplica.",
      conditions: [{ what: "Régimen de jubilaciones aplicable", effect: "informacion" }],
    },
    detailed: {
      howItWorks: "El convenio adicional de jubilaciones y pensiones para trabajadores de base de nuevo ingreso (14 de octubre de 2005) estableció un aumento de aportación del 3% al 10% anual al fondo de jubilación; el 7% se descuenta con el concepto 107 (fundamento provisional).",
      whenItAppears: "Quincenalmente para los trabajadores a los que aplica el convenio.",
      review: "Es una aportación a tu propio fondo: revisa que el importe sea constante.",
      calculation: {
        kind: "reference-only",
        formula: "Base (002 + 011 al 019 + 057 + 058) × 1.25 + (020 + 022 + 023 + 050 + 062 + 063) × 0.07 (fuente provisional)",
        note: "Requiere validación de régimen vigente.",
      },
    },
    related: ["152", "108", "111", "053"],
    searchAliases: ["fondo de jubilación", "jubilación", "pensión"],
  },
  {
    code: "108",
    easy: {
      short: "Es la aportación a tu provisión RJP (régimen de jubilaciones y pensiones) para ciertas generaciones.",
      whyMatters: "Aporta a tu pensión futura; aplica según tu fecha de ingreso.",
      whenAppears: "Quincenalmente para quien está en ese régimen.",
    },
    detailed: {
      howItWorks: "La provisión RJP 2005 se estableció para trabajadores de base de nuevo ingreso entre el 16 de octubre de 2005 y el 31 de julio de 2008, con aportaciones del 4% al 10% (fundamento provisional).",
      whenItAppears: "Quincenalmente según tu generación de ingreso.",
      calculation: {
        kind: "reference-only",
        formula: "Base × 0.10 (fuente provisional; validar régimen aplicable)",
      },
    },
    related: ["107", "111", "152"],
    searchAliases: ["rjp", "provisión jubilación"],
  },
  {
    code: "109",
    easy: {
      short: "Prima de seguro de daños de vivienda ligada a tu crédito INFONAVIT.",
      whyMatters: "Es un descuento ligado a tu crédito de vivienda.",
      whenAppears: "Mientras esté vigente tu crédito y su seguro.",
    },
    related: ["154", "189"],
  },
  {
    code: "110",
    easy: {
      short: "Descuento por crédito de automóvil con terceros.",
      whyMatters: "Es la recuperación mensual de tu crédito vehicular.",
      whenAppears: "Cada quincena mientras dure el crédito.",
    },
    related: ["field:73"],
    searchAliases: ["automóvil", "crédito automóvil"],
  },
  {
    code: "111",
    easy: {
      short: "Es tu aportación complementaria a la AFORE.",
      whyMatters: "Aporta a tu cuenta de retiro; aplica según tu generación de ingreso.",
      whenAppears: "Quincenalmente para los trabajadores de nuevo ingreso a partir de agosto de 2008.",
    },
    detailed: {
      howItWorks: "El convenio del 27 de junio de 2008 estableció que los trabajadores de nuevo ingreso a partir del 1 de agosto de 2008 aportan del 7% al 15% a un esquema de pensiones de la Ley del Seguro Social (fundamento provisional).",
      whenItAppears: "Quincenalmente para la generación correspondiente.",
      calculation: {
        kind: "reference-only",
        formula: "Base × 0.15 (fuente provisional; validar régimen aplicable)",
      },
    },
    related: ["107", "108", "152"],
    searchAliases: ["afore", "aportación complementaria"],
  },
  {
    code: "112",
    easy: {
      short: "Fondo de ayuda sindical por defunción.",
      whyMatters: "una fuente provisional registra un importe quincenal de $42.12.",
      whenAppears: "Quincenalmente para los trabajadores agremiados.",
    },
    detailed: {
      howItWorks: "Este concepto sustituye a los conceptos 182 y 183; en caso de defunción de un trabajador miembro del sindicato, jubilado o pensionado, el fondo de ayuda sindical cubre una cantidad mayor (fundamento provisional).",
      whenItAppears: "Quincenalmente mientras seas miembro del sindicato.",
      calculation: {
        kind: "reference-only",
        formula: "$42.12 quincenales (fuente provisional)",
        note: "Cantidad de referencia; validar vigencia.",
      },
    },
    related: ["180", "187"],
    searchAliases: ["ayuda sindical", "defunción", "sindical"],
  },
  {
    code: "113",
    easy: {
      short: "Descuento por el seguro de guarderías.",
      whyMatters: "Es una aportación ligada al servicio de guarderías.",
      whenAppears: "Quincenalmente mientras tengas derecho al servicio.",
    },
    detailed: {
      howItWorks: "Seguro ligado a la rama de guarderías.",
      whenItAppears: "Mientras exista el derecho al servicio.",
    },
    related: ["025", "039"],
  },
  {
    code: "114",
    easy: {
      short: "Seguro individual voluntario de gastos médicos mayores.",
      whyMatters: "Es un seguro que elegiste o tienes asignado; su descuento es constante.",
      whenAppears: "Quincenalmente mientras esté vigente tu seguro.",
    },
    related: ["120", "195"],
    searchAliases: ["gastos médicos mayores", "seguro voluntario"],
  },
  {
    code: "116",
    easy: {
      short: "Descuento por servicio de telecomunicaciones.",
      whyMatters: "Suele ser un servicio adquirido; verifica que corresponda a tu consumo o renta.",
      whenAppears: "Mientras tengas contratado el servicio.",
    },
  },
  {
    code: "119",
    easy: {
      short: "Prima de seguro de automóvil.",
      whyMatters: "Descuento ligado al financiamiento o póliza de tu vehículo.",
      whenAppears: "Mientras esté vigente tu póliza o crédito.",
    },
    related: ["110"],
  },
  {
    code: "120",
    easy: {
      short: "Descuento por seguro médico.",
      whyMatters: "Es una aportación ligada a tu seguro; para personal médico incluye una bonificación (040).",
      whenAppears: "Quincenalmente mientras esté vigente.",
    },
    related: ["040", "114"],
    searchAliases: ["seguro médico"],
  },
  {
    code: "121",
    easy: {
      short: "Seguro de enfermería.",
      whyMatters: "Aportación ligada al ejercicio de la enfermería.",
      whenAppears: "Mientras esté vigente.",
    },
    related: ["058"],
  },
  {
    code: "122",
    easy: {
      short: "Crédito para trabajadores de confianza.",
      whyMatters: "Recuperación quincenal de un crédito otorgado.",
      whenAppears: "Mientras dure el crédito.",
    },
    searchAliases: ["crédito trabajadores confianza"],
  },
  {
    code: "125",
    easy: {
      short: "Retención a cuenta de terceros.",
      whyMatters: "Si aparece, hay una orden o acuerdo de retención a favor de un tercero.",
      whenAppears: "Mientras esté vigente la retención.",
    },
  },
  {
    code: "129",
    easy: {
      short: "Descuento por licencia sin goce de sueldo mayor a 3 días.",
      whyMatters: "Se descuenta proporcional a los días de tu licencia sin sueldo.",
      whenAppears: "En las quincenas que cubren tu licencia.",
    },
    related: ["171", "172"],
    searchAliases: ["licencia sin sueldo", "licencia"],
  },
  {
    code: "130",
    easy: {
      short: "Crédito hipotecario E.S.M.I.",
      whyMatters: "Recuperación quincenal de tu crédito hipotecario.",
      whenAppears: "Mientras dure el crédito.",
    },
    related: ["106", "136"],
  },
  {
    code: "133",
    easy: {
      short: "Ayuda de gastos de escrituración (E.S.M.I.).",
      whyMatters: "Recuperación del financiamiento de escrituración de tu vivienda.",
      whenAppears: "Mientras se recupere el financiamiento.",
    },
    searchAliases: ["escrituración"],
  },
  {
    code: "136",
    easy: {
      short: "Préstamo personal a mediano plazo (E.S.M.I.).",
      whyMatters: "Recuperación quincenal de un préstamo personal.",
      whenAppears: "Mientras dure el préstamo.",
    },
    related: ["137"],
  },
  {
    code: "137",
    easy: {
      short: "Seguro de vida del préstamo personal a mediano plazo.",
      whyMatters: "Seguro asociado a tu préstamo personal E.S.M.I.",
      whenAppears: "Mientras esté vigente el préstamo.",
    },
    related: ["136"],
  },
  {
    code: "151",
    easy: {
      short: "Es el Impuesto Sobre la Renta: lo que se retiene de tu pago para entregarlo a la Secretaría de Hacienda.",
      whyMatters: "Es el descuento más común del tarjetón; su importe depende de tus ingresos acumulados del año.",
      whenAppears: "Quincenalmente cuando tus percepciones generan impuesto.",
      conditions: [{ what: "Ingresos acumulados del año y deducciones aplicables", effect: "variable" }],
    },
    detailed: {
      howItWorks: "El instituto retiene el impuesto quincenal y lo entrega a la SHCP conforme a la Ley del Impuesto Sobre la Renta (fundamento provisional).",
      whenItAppears: "Quincenas en las que tu ingreso gravable supera el límite de no retención.",
      affects: ["Se relaciona con los días laborados en el año (base del cálculo anual)", "Puede dar devoluciones (070)"],
      review: "Revisa que la base use tus días laborados en el año; si el importe te sorprende, compara contra la tabla de ISR vigente.",
    },
    related: ["070", "153", "field:43"],
    searchAliases: ["isr", "impuesto sobre la renta", "impuestos", "retención"],
  },
  {
    code: "152",
    easy: {
      short: "Es tu aportación del 3% al fondo de jubilación.",
      whyMatters: "Junto con 107, 108 y 111, alimenta tu ahorro para la jubilación.",
      whenAppears: "Quincenalmente para los trabajadores de base a los que aplica.",
    },
    detailed: {
      howItWorks: "Los trabajadores aportan el 3% sobre los conceptos señalados por el régimen de jubilaciones y pensiones, además del mismo porcentaje sobre el fondo de ahorro (cláusula 110 CCT, fundamento fuente provisional).",
      whenItAppears: "Quincenalmente; también se aplica en la segunda quincena de julio sobre el fondo de ahorro.",
      calculation: {
        kind: "reference-only",
        formula: "Base × 0.03 (fuente provisional; validar régimen vigente)",
      },
    },
    related: ["107", "108", "111", "055"],
    searchAliases: ["fondo de jubilación", "jubilación", "3%"],
  },
  {
    code: "153",
    easy: {
      short: "Descuento complementario de ISR del año anterior.",
      whyMatters: "Sale cuando tu cálculo anual de impuestos quedó con diferencia a cargo.",
      whenAppears: "En los meses posteriores al cierre anual fiscal, si procede.",
    },
    related: ["151", "070"],
    searchAliases: ["isr año anterior", "complemento isr"],
  },
  {
    code: "154",
    easy: {
      short: "Descuento de tu crédito INFONAVIT.",
      whyMatters: "Es la recuperación quincenal de tu crédito de vivienda.",
      whenAppears: "Cada quincena mientras tenga saldo tu crédito.",
      conditions: [{ what: "Crédito liquidado", effect: "suspende" }],
    },
    detailed: {
      howItWorks: "Recuperación del crédito otorgado por INFONAVIT; en Observaciones puedes ver vencimiento y avance.",
      whenItAppears: "Quincenalmente hasta liquidar.",
      review: "Revisa el vencimiento y el saldo en Observaciones.",
    },
    related: ["189", "109", "field:56", "field:73", "field:76"],
    searchAliases: ["infonavit", "crédito infonavit"],
  },
  {
    code: "155",
    easy: {
      short: "Disposición judicial: pensión alimenticia.",
      whyMatters: "Si aparece, es por una orden judicial; conviene que lo conozcas y verifiques.",
      whenAppears: "Mientras esté vigente la disposición judicial.",
    },
    detailed: {
      howItWorks: "Retención ordenada por autoridad judicial para pago de pensión alimenticia.",
      whenItAppears: "Qiuincenalmente mientras la orden esté vigente.",
      review: "Es una retención con fundamento judicial: verifica el importe contra la orden.",
    },
    related: ["125"],
    searchAliases: ["pensión alimenticia", "disposición judicial", "alimenticia"],
  },
  {
    code: "156",
    easy: {
      short: "Descuento por viáticos no comprobados.",
      whyMatters: "Sale cuando no se comprueban gastos de viáticos recibidos.",
      whenAppears: "Después de un periodo de viáticos sin comprobar.",
    },
    searchAliases: ["viáticos"],
  },
  {
    code: "160",
    easy: {
      short: "Es la recuperación de un anticipo de sueldo de la cláusula 97.",
      whyMatters: "Si pediste un anticipo 042, este concepto lo recupera cada quincena.",
      whenAppears: "En las quincenas posteriores al anticipo, hasta cubrirlo.",
    },
    detailed: {
      howItWorks: "Recuperación del anticipo de la cláusula 97 del CCT.",
      whenItAppears: "Mientras se recupera el anticipo.",
      review: "Verifica que el total recuperado cuadre con lo solicitado.",
    },
    related: ["042"],
    searchAliases: ["recuperación cl 97", "cláusula 97", "recuperación anticipo"],
  },
  {
    code: "161",
    easy: {
      short: "Descuento por suspensión temporal.",
      whyMatters: "Corresponde a periodos de suspensión de la relación laboral.",
      whenAppears: "En las quincenas que cubren la suspensión.",
    },
  },
  {
    code: "162",
    easy: {
      short: "Responsabilidad sobre instrumentos de trabajo.",
      whyMatters: "Descuento por responsabilidad sobre herramientas o instrumentos a tu cargo.",
      whenAppears: "Cuando se determina la responsabilidad.",
    },
    searchAliases: ["instrumentos de trabajo", "responsabilidad"],
  },
  {
    code: "164",
    easy: {
      short: "Descuento por suspensión sindical.",
      whyMatters: "Corresponde a una suspensión determinada por el sindicato.",
      whenAppears: "En las quincenas que cubren la suspensión.",
    },
    related: ["180"],
  },
  {
    code: "166",
    easy: {
      short: "Descuento por compras en casas comerciales (comisión paritaria).",
      whyMatters: "Descuento de compras autorizadas a través de la comisión paritaria.",
      whenAppears: "Mientras exista el adeudo autorizado.",
    },
  },
  {
    code: "167",
    easy: {
      short: "Descuento por víveres.",
      whyMatters: "Recuperación de compras de víveres autorizadas.",
      whenAppears: "Mientras exista el adeudo.",
    },
  },
  {
    code: "168",
    easy: {
      short: "Descuento por ropa.",
      whyMatters: "Recuperación de compras de ropa autorizadas.",
      whenAppears: "Mientras exista el adeudo.",
    },
  },
  {
    code: "169",
    easy: {
      short: "Recuperación de vales a cuenta de sueldo.",
      whyMatters: "Recupera los vales que se te hayan otorgado a cuenta de sueldo.",
      whenAppears: "En las quincenas posteriores a la entrega del vale.",
    },
    related: ["043"],
  },
  {
    code: "170",
    easy: {
      short: "Descuento FONACOT (crédito para bienes y servicios).",
      whyMatters: "Si tienes un crédito FONACOT, aquí ves su recuperación quincenal.",
      whenAppears: "Cada quincena mientras dure el crédito.",
    },
    detailed: {
      howItWorks: "Crédito del Fondo Nacional para el Consumo de los Trabajadores; su recuperación se descuenta quincenalmente.",
      whenItAppears: "Hasta liquidar el crédito.",
      review: "Revisa vencimiento y saldo en Observaciones.",
    },
    related: ["field:73", "field:76"],
    searchAliases: ["fonacot", "crédito fonacot"],
  },
  {
    code: "171",
    easy: {
      short: "Descuento por licencia sin sueldo menor a 4 días.",
      whyMatters: "Proporcional a los días de tu licencia breve sin goce de sueldo.",
      whenAppears: "En las quincenas que cubren la licencia.",
    },
    related: ["129", "172"],
    searchAliases: ["licencia sin sueldo", "licencia 1 a 3 días"],
  },
  {
    code: "172",
    easy: {
      short: "Descuento por falta injustificada.",
      whyMatters: "Se descuenta el (los) día(s) no justificado(s); también afecta estímulos como el 032 y 033.",
      whenAppears: "En la quincena en que se procesa la falta.",
    },
    related: ["032", "033", "field:22"],
    searchAliases: ["falta injustificada", "faltas"],
  },
  {
    code: "173",
    easy: {
      short: "Descuento por pases de salida.",
      whyMatters: "Se descuenta el tiempo no laborado por pases de salida.",
      whenAppears: "En la quincena donde se registran los pases.",
    },
    related: ["field:21", "field:20"],
    searchAliases: ["pases de salida"],
  },
  {
    code: "174",
    easy: {
      short: "Descuento por retardos.",
      whyMatters: "Se descuenta el tiempo no laborado por llegadas tardías.",
      whenAppears: "En la quincena donde se registran los retardos.",
    },
    related: ["field:20", "033"],
    searchAliases: ["retardos"],
  },
  {
    code: "175",
    easy: {
      short: "Descuento por becas sin sueldo.",
      whyMatters: "Proporcional a los días de tu beca sin goce de salario.",
      whenAppears: "En las quincenas que cubren la beca.",
    },
    related: ["field:37"],
  },
  {
    code: "176",
    easy: {
      short: "Descuento por convenio T.A.T.",
      whyMatters: "Recuperación de un convenio de transporte (T.A.T.).",
      whenAppears: "Mientras exista el convenio o adeudo.",
    },
    searchAliases: ["tat", "convenio tat"],
  },
  {
    code: "177",
    easy: {
      short: "Descuento por salida antes.",
      whyMatters: "Se descuenta el tiempo no laborado por salidas anticipadas.",
      whenAppears: "En la quincena donde se registran.",
    },
  },
  {
    code: "178",
    easy: {
      short: "Descuento por reducción de jornada.",
      whyMatters: "Ajusta tu pago si tu jornada se redujo.",
      whenAppears: "Mientras esté vigente la reducción.",
    },
    related: ["field:11"],
  },
  {
    code: "179",
    easy: {
      short: "Descuento por notas de demérito.",
      whyMatters: "Las notas de demérito pueden restar días de aguinaldo.",
      whenAppears: "Cuando se registran notas de demérito.",
    },
    related: ["052", "field:29"],
  },
  {
    code: "180",
    easy: {
      short: "Cuota sindical.",
      whyMatters: "Es la cuota que aportas a tu sindicato.",
      whenAppears: "Quincenalmente para trabajadores agremiados.",
    },
    related: ["187", "112"],
    searchAliases: ["cuota sindical", "sindicato"],
  },
  {
    code: "187",
    easy: {
      short: "Cuota extraordinaria sindical.",
      whyMatters: "Cuota adicional aprobada por el sindicato.",
      whenAppears: "En los periodos en que se determine.",
    },
    related: ["180"],
  },
  {
    code: "189",
    easy: {
      short: "Aportación al INFONAVIT.",
      whyMatters: "Es tu aportación como trabajador al INFONAVIT.",
      whenAppears: "Quincenalmente.",
    },
    related: ["154", "109"],
    searchAliases: ["infonavit", "aportación infonavit"],
  },
  {
    code: "190",
    easy: {
      short: "Caja de ahorro (préstamo).",
      whyMatters: "Recuperación de un préstamo de tu caja de ahorro.",
      whenAppears: "Mientras dure el préstamo.",
    },
    related: ["192"],
  },
  {
    code: "192",
    easy: {
      short: "Caja de ahorro (ahorro).",
      whyMatters: "Es tu ahorro periódico en la caja de ahorro del instituto.",
      whenAppears: "Quincenalmente para quien participa en la caja.",
    },
    detailed: {
      howItWorks: "Aportación periódica de ahorro que se acumula a tu favor en la caja de ahorro.",
      whenItAppears: "Quincenalmente mientras estés inscrito.",
      review: "Es ahorro tuyo: verifica que el acumulado cuadre.",
    },
    related: ["190", "055"],
    searchAliases: ["caja de ahorro", "ahorro"],
  },
  {
    code: "194",
    easy: {
      short: "Mutualidad de becarios.",
      whyMatters: "Aportación ligada a la mutualidad de becarios.",
      whenAppears: "Para personal becario inscrito.",
    },
  },
  {
    code: "195",
    easy: {
      short: "Seguro individual voluntario de vida.",
      whyMatters: "Descuento de tu seguro de vida voluntario.",
      whenAppears: "Mientras esté vigente tu seguro.",
    },
    related: ["114"],
  },
  {
    code: "197",
    easy: {
      short: "Recuperación del anticipo de aguinaldo de enero.",
      whyMatters: "Recupera el anticipo 047 de aguinaldo de enero.",
      whenAppears: "En los meses siguientes al anticipo.",
    },
    related: ["047", "199"],
  },
  {
    code: "199",
    easy: {
      short: "Recuperación del vale a cuenta de aguinaldo.",
      whyMatters: "Recupera el vale 043 de aguinaldo.",
      whenAppears: "En las quincenas posteriores al vale.",
    },
    related: ["043", "197"],
  },
]

export const GUIDE_CONCEPT_CONTENT_BY_CODE: ReadonlyMap<string, GuideConceptContent> = new Map(
  GUIDE_CONCEPT_CONTENT.map((c) => [c.code, c])
)