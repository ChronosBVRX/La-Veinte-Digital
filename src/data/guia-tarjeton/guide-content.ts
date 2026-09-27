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
        "Es la referencia de las calculadoras de la app.",
      ],
      review: "Compara que el importe corresponda a tu categoría. Si cambió sin que cambie tu categoría o jornada, conviene revisarlo.",
      calculation: {
        kind: "current",
        engine: "Tabulador de sueldos",
        note: "La app ya tiene el tabulador vigente; no se usa la fórmula duna fuente provisional.",
      },
    },
    related: ["011", "022", "032", "033", "037", "field:57", "field:11"],
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
      short: "Sobresueldo del 16.5% para personal médico, estomatólogos y cirujanos maxilofaciales que reconoce la alta especialización clínica.",
      whyMatters: "Tiene efecto cascada: eleva prima vacacional (029), dominical (030), asistencia (032), puntualidad (033), horas extra (037) y aguinaldo (049).",
      whenAppears: "Quincenalmente de forma ininterrumpida si tu categoría está listada en la Tabla Numérica 09 del SIAP.",
    },
    detailed: {
      howItWorks: "Fundamentado en la Cláusula 86 inciso a) del CCT 2025-2027. Se calcula sumando Sueldo Tabular (002) + Ayuda de Renta (011) y multiplicando por 16.5%.",
      whenItAppears: "Todas las quincenas ordinarias mientras se labore en la categoría médica.",
      affects: ["Faltas injustificadas (172) y licencias deducen proporcionalmente", "Permanece íntegro en incapacidades por riesgo de trabajo o vacaciones"],
      review: "Comprueba que la base del 16.5% sume el concepto 002 y el 011.",
      calculation: {
        kind: "current",
        formula: "(Sueldo Tabular 002 + Ayuda de Renta 011) × 16.5%",
      },
    },
    related: ["002", "011", "029", "032", "033", "049"],
    searchAliases: ["sobresueldo médicos", "cláusula 86", "especialidad médica"],
  },
  {
    code: "014",
    easy: {
      short: "Sobresueldo del 20% por exposición a agentes biológicos infecciosos para personal no médico (intendencia, lavandería, aislamiento, laboratorios).",
      whyMatters: "Eleva tu ingreso bruto en un 20% calculado sobre Sueldo Tabular (002) más Ayuda de Renta (011).",
      whenAppears: "Quincenalmente cuando tu clave departamental en SIAP pertenezca al catálogo de áreas infecciosas autorizadas.",
    },
    detailed: {
      howItWorks: "Regulado por la Cláusula 86 Bis del CCT 2025-2027 y dictámenes de la Comisión Mixta de Infectocontagiosidad. Requiere validación de plantilla en SIAP (Procedimiento 1A74-003-030).",
      whenItAppears: "Quincenalmente para personal asignado formalmente a zonas infecciosas hospitalarias.",
      affects: ["Comisiones verbales sin actualización en el catálogo departamental SIAP suprimen el pago"],
      review: "Si laboras en área de riesgo biológico y no recibes el 20%, verifica con tu representación sindical la clave departamental.",
      calculation: {
        kind: "current",
        formula: "(Sueldo Tabular 002 + Ayuda de Renta 011) × 20%",
      },
    },
    related: ["002", "011", "023", "field:7"],
    searchAliases: ["infectocontagiosidad no médica", "riesgo biológico", "cláusula 86 bis"],
  },
  {
    code: "015",
    easy: {
      short: "Incentivo extraordinario del 50% sobre el salario tabular para unidades médicas rurales, remotas o de difícil acceso.",
      whyMatters: "Compensa el arraigo y condiciones especiales de servicio en comunidades aisladas.",
      whenAppears: "Quincenalmente mientras prestes servicios en una unidad catalogada como zona aislada (Campo 9).",
    },
    detailed: {
      howItWorks: "Amparado en convenios locales y el Procedimiento 1A32-003-001. Aplica el 50% sobre el sueldo tabular (o integrado con concepto 706 según convenio).",
      whenItAppears: "Quincenalmente mientras la ubicación del centro de trabajo pertenezca al catálogo de zonas marginadas.",
      affects: ["Permutas o cambios de adscripción a zonas urbanas o no catalogadas suprimen automáticamente el concepto"],
      review: "Verifica que el Campo 9 (Ubicación) corresponda a la unidad médica rural.",
      calculation: {
        kind: "current",
        formula: "Sueldo Tabular 002 × 50%",
      },
    },
    related: ["002", "016", "field:9"],
    searchAliases: ["zona aislada", "arraigo rural", "unidad remota"],
  },
  {
    code: "016",
    easy: {
      short: "Compensación económica para neutralizar el encarecimiento de la vida en zonas urbanas fronterizas o turísticas con alta inflación.",
      whyMatters: "Protege tu poder adquisitivo calculándose sobre la integración del Sueldo Tabular (002) y la Ayuda de Renta (011).",
      whenAppears: "Quincenalmente mientras labores en delegaciones o unidades aprobadas en la franja fronteriza o turística.",
    },
    detailed: {
      howItWorks: "Pactado en convenios del CCT y Procedimiento 1A32-003-001 para zonas con alta inflación habitacional y comercial comprobada.",
      whenItAppears: "Quincenalmente en unidades de la zona económica especial.",
      affects: ["Traslados a centros de trabajo fuera de la franja autorizada"],
      review: "Confirma que tu unidad médica pertenezca al perímetro fronterizo o de alto costo de vida.",
      calculation: {
        kind: "current",
        formula: "(Sueldo Tabular 002 + Ayuda de Renta 011) × porcentaje de zona",
      },
    },
    related: ["002", "011", "015", "field:9"],
    searchAliases: ["alto costo de vida", "zona fronteriza", "zona turística"],
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
        note: "Requiere la tabla/factor contractual vigente.",
      },
    },
    related: ["field:13", "011", "002", "048", "field:45", "field:53"],
    searchAliases: ["ayuda de renta antigüedad", "renta por antigüedad", "inciso c"],
  },
  {
    code: "023",
    easy: {
      short: "Sobresueldo del 20% para personal clínico directo expuesto de manera continua a agentes patógenos e infectocontagiosos.",
      whyMatters: "Añade un 20% sobre tu Sueldo Tabular (002) más Ayuda de Renta (011) e integra para tu salario pensionable (152).",
      whenAppears: "Quincenalmente para personal médico y de enfermería adscrito a servicios clínicos de exposición continua.",
    },
    detailed: {
      howItWorks: "Cláusula 86 Bis del CCT 2025-2027. Dictaminado por la Comisión Mixta de Infectocontagiosidad y Emanaciones Radiactivas; integra la base del fondo de jubilación.",
      whenItAppears: "Quincenalmente mientras se labore en servicios hospitalarios de riesgo biológico.",
      affects: ["Reubicación o adscripción a servicios administrativos sin exposición"],
      review: "Asegúrate de que este concepto se integre en la base de cálculo de tu fondo de jubilación (152).",
      calculation: {
        kind: "current",
        formula: "(Sueldo Tabular 002 + Ayuda de Renta 011) × 20%",
      },
    },
    related: ["002", "011", "014", "152", "field:7"],
    searchAliases: ["infectocontagiosidad médica", "cláusula 86 bis", "riesgo biológico"],
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
        engine: "Reglamento de Asistencia y Puntualidad",
        note: "Se calcula con la fórmula y condiciones contractuales vigentes.",
      },
    },
    related: ["033", "field:30", "022", "002", "011"],
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
        engine: "Reglamento de Asistencia y Puntualidad",
        note: "Se calcula con la fórmula y condiciones contractuales vigentes.",
      },
    },
    related: ["032", "field:23", "field:39", "field:30", "002", "011"],
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
      short: "Es el anticipo de sueldo de la cláusula 97: en el CCT 2025-2027 se amplió de 3 hasta 4 meses íntegros de sueldo base sin intereses.",
      whyMatters: "Es la herramienta de liquidez sin intereses más poderosa; se descuenta y amortiza automáticamente en 40 quincenas (concepto 160).",
      whenAppears: "En la quincena en la que se te deposita el anticipo extraordinario.",
      conditions: [{ what: "Antigüedad mínima y liquidez salarial suficiente", effect: "informacion" }, { what: "Solicitud sindical y del trabajador", effect: "informacion" }],
    },
    detailed: {
      howItWorks: "Amparado en la Cláusula 97 del CCT 2025-2027: hasta 4 meses de sueldo base nominal sin intereses. Se amortiza en 40 quincenas; en licencias o suspensiones se requieren abonos directos para no elevar el descuento al reincorporarse.",
      whenItAppears: "En la quincena que lo solicitas; su recuperación se descuenta después (concepto 160).",
      affects: ["Se recupera mediante el descuento 160 en 40 quincenas"],
      review: "Si pediste un anticipo, ambas partes deben reflejarse: el pago y después la recuperación quincenal.",
      calculation: {
        kind: "current",
        engine: "Calculadora cláusula 97",
        formula: "Hasta 4 × Sueldo Tabular 002 (amortizado en 40 quincenas)",
      },
    },
    related: ["160", "002", "011"],
    calculator: { route: "/calculadoras/clausula-97", label: "Calcular anticipo cláusula 97" },
    searchAliases: ["anticipo de sueldo", "cláusula 97", "préstamo 4 meses"],
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
      whyMatters: "Forma parte de las combinaciones salariales registradas en el tabulador.",
      whenAppears: "Según tu categoría y condiciones laborales.",
    },
    detailed: {
      howItWorks: "Concepto registrado en el catálogo de percepciones; su presencia depende de tu nombramiento.",
      whenItAppears: "Cuando tu situación lo contempla.",
      review: "Corresponde a las percepciones contractuales tabulares.",
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
      short: "Sobresueldo por atención médica continua y disponibilidad permanente para personal clínico y técnico.",
      whyMatters: "Se calcula aplicando un porcentaje tabulado sobre la sumatoria de Sueldo Tabular (002) + Ayuda de Renta (011) e integra para el fondo de jubilación (152).",
      whenAppears: "Quincenalmente para categorías autorizadas en la Tabla Numérica 09 del SIAP.",
    },
    detailed: {
      howItWorks: "Cláusula 83 del CCT 2025-2027 y Norma 1000-001-020. Remunera la flexibilidad y disponibilidad de respuesta en servicios de salud continuos.",
      whenItAppears: "Todas las quincenas ordinarias mientras se desempeñe la categoría.",
      affects: ["Inasistencias injustificadas absolutas y pases de salida particulares excesivos (173) comprometen la condición de disponibilidad"],
      review: "Comprueba que sume los conceptos 002 y 011 antes de calcular el porcentaje.",
      calculation: {
        kind: "current",
        formula: "(Sueldo Tabular 002 + Ayuda de Renta 011) × porcentaje de disponibilidad",
      },
    },
    related: ["002", "011", "058", "152"],
    searchAliases: ["atención médica continua", "disponibilidad médica", "cláusula 83"],
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
      short: "Asignación económica directa para compra de material bibliográfico y científico para médicos.",
      whyMatters: "Multiplicador o cuota sobre el Sueldo Tabular (002); no requiere comprobación fiscal y apoya la actualización científica.",
      whenAppears: "Periódicamente según el calendario contractual de apoyos académicos.",
    },
    detailed: {
      howItWorks: "Acuerdo DG de octubre de 1990 y Norma 1000-001-020. Exclusivo para personal médico facultado; integra la base del fondo de jubilación (152).",
      whenItAppears: "En las quincenas designadas para apoyos bibliográficos.",
      review: "Diferenciar del concepto 064, el cual es exclusivo de Médicos Residentes.",
      calculation: {
        kind: "current",
        engine: "Tabla de porcentajes de la app (institutional-percentage-tables: tabla por categoría del 062)",
      },
    },
    related: ["072", "002", "011", "152"],
    searchAliases: ["libros médicos", "ayuda para libros", "acuerdo 1990"],
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
      short: "Asignación para compra de libros y material técnico para personal no médico del Instituto.",
      whyMatters: "Apoyo económico libre de comprobación fiscal que complementa tu salario para actualización laboral.",
      whenAppears: "Periódicamente conforme al calendario de prestaciones académicas y técnicas.",
    },
    detailed: {
      howItWorks: "Regulado bajo los acuerdos de capacitación del CCT y la Norma 1000-001-020 del IMSS.",
      whenItAppears: "En las quincenas autorizadas del ejercicio.",
      calculation: {
        kind: "current",
        engine: "Tabla de porcentajes de la app (institutional-percentage-tables: Apéndice F, Tabla 07)",
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
      short: "Es la aportación adicional del 7% al fondo de jubilación pactada en el rescate de 2005 para trabajadores del régimen tradicional.",
      whyMatters: "Para ingresos previos a octubre de 2005, la suma exacta de tu Concepto 152 (3%) más este 107 (7%) debe dar siempre el 10% del salario pensionable.",
      whenAppears: "Quincenalmente para los trabajadores del régimen tradicional (< oct 2005).",
      conditions: [{ what: "Régimen tradicional anterior a 2005", effect: "informacion" }],
    },
    detailed: {
      howItWorks: "El Convenio Adicional de Jubilaciones y Pensiones del 14 de octubre de 2005 implementó un rescate que aumentó la aportación en 1% anual desde 2006 hasta topar en 7% adicional en 2012.",
      whenItAppears: "Todas las quincenas ordinarias.",
      review: "Comprueba que la sumatoria de los conceptos 152 y 107 represente exactamente el 10% de tu salario base sujeto a jubilación.",
      calculation: {
        kind: "current",
        formula: "Base pensionable × 0.07",
      },
    },
    related: ["152", "108", "111"],
    searchAliases: ["fondo de jubilación", "provisión 7%", "convenio 2005"],
  },
  {
    code: "108",
    easy: {
      short: "Es la aportación global del 10% al RJP para la Generación de Transición (contratados entre oct 2005 y jul 2008).",
      whyMatters: "A diferencia del régimen anterior que divide en 152 y 107, este grupo aporta el 10% condensado en este único concepto con requisitos alterados de retiro.",
      whenAppears: "Quincenalmente para trabajadores contratados entre el 16 de octubre de 2005 y el 31 de julio de 2008.",
    },
    detailed: {
      howItWorks: "Convenio Adicional de 2005. Jubilación a partir de 60 años con 34 años de servicio (mujeres) y 35 (hombres) con cuantía del 100%.",
      whenItAppears: "Quincenalmente. Si ingresaste en 2009 o después y presentas este concepto, es un error de encuadre en el SIAP.",
      review: "Cruza tu fecha de ingreso en el Campo 13 para validar que pertenezcas a la generación 2005-2008.",
      calculation: {
        kind: "current",
        formula: "Base pensionable × 0.10",
      },
    },
    related: ["107", "111", "152", "field:13"],
    searchAliases: ["rjp", "provisión rjp 2005", "generación transición"],
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
      short: "Aportación complementaria patronal a cuentas individuales AFORE bajo la histórica Cláusula 157 del CCT 2025-2027.",
      whyMatters: "El IMSS aporta recursos patronales directos a tu subcuenta individual (del 1.75% hasta 8.55%) para elevar tu tasa de reemplazo al jubilarte.",
      whenAppears: "Quincenalmente para trabajadores de la Nueva Generación contratados a partir de 2008 bajo la Ley del Seguro Social.",
    },
    detailed: {
      howItWorks: "Conquista sindical del CCT 2025-2027 (Cláusula 157). El SIAP dispersa fondos complementarios institucionales hacia PROCESAR para tu cuenta AFORE.",
      whenItAppears: "Quincenalmente. Debe auditarse y cotejarse contra los estados de cuenta cuatrimestrales de tu AFORE.",
      review: "Revisa en tu estado de cuenta de la AFORE que las aportaciones patronales complementarias del IMSS se reflejen efectivamente.",
      calculation: {
        kind: "current",
        formula: "Salario base × porcentaje escalonado Cláusula 157 (1.75% a 8.55%)",
      },
    },
    related: ["107", "108", "152"],
    searchAliases: ["afore", "aportación complementaria", "cláusula 157"],
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
      short: "Es la aportación base del 3% al Fondo de Jubilaciones y Pensiones para trabajadores con ingreso anterior a octubre de 2005.",
      whyMatters: "Se calcula sobre base extendida y, junto con el Concepto 107 (7%), suma el 10% total de aportación al fondo de retiro.",
      whenAppears: "Quincenalmente para los trabajadores del régimen tradicional (< oct 2005).",
    },
    detailed: {
      howItWorks: "Regulado por el Régimen de Jubilaciones y Pensiones (Cláusula 110 CCT). La base integra Sueldo Tabular (002) + sobresueldos constantes (011 al 019, 057, 058) multiplicados por factor de aguinaldo 1.25, más prestaciones directas (020, 022, 023, 050, 062, 063).",
      whenItAppears: "Quincenalmente de forma regular.",
      review: "Comprueba que sume exactamente el 10% en conjunto con el Concepto 107.",
      calculation: {
        kind: "current",
        formula: "[(002 + 011 al 019 + 057 + 058) × 1.25 + (020 + 022 + 023 + 050 + 062 + 063)] × 0.03",
      },
    },
    related: ["107", "108", "111", "002", "011"],
    searchAliases: ["fondo de jubilación", "jubilación tradicional", "3% rjp"],
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
      short: "Descuento quincenal de amortización de tu crédito de vivienda INFONAVIT.",
      whyMatters: "El cobro del crédito es quincenal (154), mientras que el seguro de daños (109) opera de forma bimestral. En observaciones se controla: Cargo Inicial, Saldo Actual y Quincena de Vencimiento.",
      whenAppears: "Cada quincena mientras tenga saldo tu crédito.",
      conditions: [{ what: "Crédito liquidado", effect: "suspende" }],
    },
    detailed: {
      howItWorks: "Retención solidaria conforme al Procedimiento 1A14-003-010. Recursos Humanos valida liquidez suficiente antes de autorizar préstamos comerciales (166, 167, 168).",
      whenItAppears: "Quincenalmente mientras esté vigente el crédito.",
      review: "Cruza el saldo actual con la quincena de vencimiento. Si la quincena actual rebasa el vencimiento y sigue el descuento, se genera un cobro indebido resarcible (150).",
      calculation: {
        kind: "current",
        engine: "Procedimiento 1A14-003-010 (RH2000/SIAP)",
      },
    },
    related: ["189", "109", "155", "field:56", "field:73", "field:76"],
    searchAliases: ["infonavit", "crédito infonavit", "amortización infonavit"],
  },
  {
    code: "155",
    easy: {
      short: "Disposición judicial: pensión alimenticia dictada por orden de un juez de lo familiar.",
      whyMatters: "Tiene prelación legal absoluta sobre cualquier crédito comercial o personal conforme al Art. 110 de la LFT y la Cláusula 106 del CCT.",
      whenAppears: "Mientras esté vigente la orden judicial notificada formalmente al IMSS.",
    },
    detailed: {
      howItWorks: "Retención con máxima jerarquía legal. Si compite contra créditos comerciales o de nómina, la orden del juez tiene prioridad obligando al sistema a pausar otros cobros si se compromete el líquido vital.",
      whenItAppears: "Quincenalmente mientras la orden judicial no sea revocada o modificada.",
      review: "Verifica que el importe o porcentaje descontado coincida exactamente con la resolución judicial.",
      calculation: {
        kind: "current",
        formula: "Porcentaje o cuota líquida dictada por el juez de lo familiar",
      },
    },
    related: ["154", "field:77"],
    searchAliases: ["pensión alimenticia", "disposición judicial", "prelación judicial"],
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
      short: "Descuento por falta injustificada o retardo mayor a 30 minutos.",
      whyMatters: "Descuenta la cuota diaria del salario base, la proporción del séptimo día y anula automáticamente los estímulos de asistencia (032) y puntualidad (033).",
      whenAppears: "En la quincena de cobro SIAP (usualmente con dos quincenas de desfase respecto a la incidencia).",
    },
    detailed: {
      howItWorks: "Regulado por el Reglamento Interior de Trabajo (RIT Arts. 86-93). Se aplica por inasistencia sin justificación médica/oficial o por registrar entrada con más de 30 minutos de retraso, lo cual impide legalmente laborar la jornada y se computa como falta injustificada.",
      whenItAppears: "Procesado por el SIAP dos quincenas después de la fecha en que ocurrió la incidencia (quincena N vs corte N-2).",
      review: "Verifica que el descuento corresponda a días reales no laborados y que no exista justificación médica (incapacidad) o comisión oficial amparada en Campo 32.",
    },
    related: ["032", "033", "field:20", "field:22", "field:40"],
    searchAliases: ["falta injustificada", "faltas", "descuento por falta", "inasistencia"],
  },
  {
    code: "173",
    easy: {
      short: "Descuento por pases particulares de salida acumulados.",
      whyMatters: "Descuenta el tiempo no laborado amparado por pases personales autorizados. Si en la quincena acumulan una jornada completa, anulan el estímulo de asistencia (032).",
      whenAppears: "En la quincena en que el SIAP computa las incidencias del reloj checador.",
    },
    detailed: {
      howItWorks: "Conforme a los Arts. 90-93 del RIT, los pases de salida particulares permiten ausentarse de la jornada con autorización. Si la suma acumulada en la quincena iguala o supera la duración de la jornada del trabajador, el sistema SIAP descuenta el tiempo proporcional y cancela el estímulo de asistencia 032.",
      whenItAppears: "Aplicado en nómina ordinaria tras el corte quincenal de incidencias.",
      review: "Revisa el acumulado de minutos u horas de pase en Campo 21 y coteja que no te hayan descontado pases con carácter oficial o de comisión sindical.",
    },
    related: ["032", "field:21", "field:32", "field:40"],
    searchAliases: ["pases de salida", "pase particular", "descuento pases"],
  },
  {
    code: "174",
    easy: {
      short: "Descuento por retardos leves acumulados fuera de tolerancia.",
      whyMatters: "Descuenta minutos de llegadas tarde dentro del rango de tolerancia intermedia (6 a 30 minutos). Pierde el estímulo de puntualidad (033).",
      whenAppears: "En la quincena de aplicación de incidencias reloj.",
    },
    detailed: {
      howItWorks: "Conforme al Art. 86-89 del RIT: 1 a 5 minutos es tolerancia de gracia (acredita puntualidad y suma al Campo 23); de 6 a 30 minutos permite el acceso a laborar pero descuenta el tiempo tarde y cancela el estímulo 033; más de 30 minutos se convierte en falta (Concepto 172).",
      whenItAppears: "Liquidado en nómina según los registros del reloj checador biométrico o tarjeta checadora.",
      review: "Revisa Campo 20 (retardos) y confirma que los minutos descontados no excedan los 30 minutos por evento (pues más de 30 min debe clasificarse en 172).",
    },
    related: ["033", "172", "field:20", "field:23", "field:40"],
    searchAliases: ["retardos", "descuento retardos", "minutos tarde"],
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