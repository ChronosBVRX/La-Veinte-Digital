/**
 * Enrutador de herramientas de la plataforma La Veinte Digital.
 * Mapea intenciones y términos de la consulta a herramientas interactivas nativas.
 */

export interface PlatformToolRecommendation {
  id: string
  titulo: string
  descripcion: string
  ruta: string
  chipLabel: string
}

export const PLATFORM_TOOLS: Record<string, PlatformToolRecommendation> = {
  TIEMPO_EXTRA: {
    id: "tiempo-extra",
    titulo: "Calculadora de Tiempo Extra",
    descripcion: "Calcula el importe exacto de tus horas extras según tu jornada y salario.",
    ruta: "/calculadoras/tiempo-extra",
    chipLabel: "🧮 Calculadora de Horas Extra",
  },
  AGUINALDO: {
    id: "aguinaldo",
    titulo: "Calculadora de Aguinaldo",
    descripcion: "Estima tus días de aguinaldo según antigüedad y CCT.",
    ruta: "/calculadoras/aguinaldo",
    chipLabel: "🎁 Calcular mi Aguinaldo",
  },
  PRESTAMOS: {
    id: "prestamos",
    titulo: "Simulador de Préstamos y Fondo de Ahorro",
    descripcion: "Consulta condiciones y plazos de préstamos sindicales e institucionales.",
    ruta: "/calculadoras/prestamos",
    chipLabel: "💰 Simulador de Préstamos",
  },
  CLAUSULA_97: {
    id: "clausula-97",
    titulo: "Préstamo de Anticipo de Sueldo (Cláusula 97)",
    descripcion: "Calcula el anticipo de hasta 3 meses de sueldo tabular sin intereses ni comisiones.",
    ruta: "/calculadoras/clausula-97",
    chipLabel: "💵 Préstamo Cláusula 97",
  },
  VACACIONES: {
    id: "vacaciones",
    titulo: "Control y Calendario de Vacaciones",
    descripcion: "Revisa tus periodos vacacionales, fechas límite y días acumulados.",
    ruta: "/vacaciones",
    chipLabel: "📅 Mi Calendario de Vacaciones",
  },
  REGRESO_VACACIONES: {
    id: "regreso-vacaciones",
    titulo: "Simulador de Regreso de Vacaciones",
    descripcion: "Determina la fecha exacta en que debes presentarte a laborar tras tus vacaciones.",
    ruta: "/calculadoras/regreso-vacaciones",
    chipLabel: "🏖️ Fecha de Regreso de Vacaciones",
  },
  SEGUNDA_JULIO: {
    id: "segunda-julio",
    titulo: "Calculadora de Segunda de Julio",
    descripcion: "Estima la prestación de la segunda quincena de julio según tu categoría.",
    ruta: "/calculadoras/segunda-julio",
    chipLabel: "💵 Calculadora Segunda de Julio",
  },
  SEGUNDA_JULIO_PROP: {
    id: "segunda-julio-proporcional",
    titulo: "Segunda de Julio Proporcional",
    descripcion: "Calcula el importe proporcional de la segunda de julio según tus meses laborados.",
    ruta: "/calculadoras/segunda-julio-proporcional",
    chipLabel: "📊 Segunda de Julio Proporcional",
  },
  CALENDARIO: {
    id: "calendario",
    titulo: "Calendario Laboral IMSS",
    descripcion: "Consulta descansos obligatorios, guardias y días festivos contractuales del CCT.",
    ruta: "/calendario",
    chipLabel: "🗓️ Calendario IMSS y Descansos",
  },
  MI_QUINCENA: {
    id: "mi-quincena",
    titulo: "Análisis de Mi Quincena",
    descripcion: "Desglose claro de percepciones, deducciones y conceptos de tu pago quincenal.",
    ruta: "/guia/mi-quincena",
    chipLabel: "📊 Analizar mi Quincena",
  },
  CALCULADORAS_HUB: {
    id: "calculadoras-hub",
    titulo: "Centro de Calculadoras CCT",
    descripcion: "Accede a todas las calculadoras y simuladores oficiales del Contrato Colectivo.",
    ruta: "/calculadoras",
    chipLabel: "🧮 Ver Todas las Calculadoras",
  },
  ESCRITOS: {
    id: "escritos",
    titulo: "Generador de Escritos y Oficios",
    descripcion: "Redacta oficios formales, inconformidades y solicitudes sindicales.",
    ruta: "/escritos",
    chipLabel: "✍️ Redactar un Escrito",
  },
  BITACORA: {
    id: "bitacora",
    titulo: "Bitácora de Incidencias Laborales",
    descripcion: "Lleva un registro privado con fecha, lugar y testigos de lo sucedido.",
    ruta: "/bitacora",
    chipLabel: "📝 Registrar en mi Bitácora",
  },
  TARJETON: {
    id: "tarjeton",
    titulo: "Mi Información Laboral y Tarjetón",
    descripcion: "Sube tu tarjetón digital para análisis automático de percepciones y deducciones.",
    ruta: "/profile/mi-informacion-laboral",
    chipLabel: "📄 Subir o Ver mi Tarjetón",
  },
  BIBLIOTECA: {
    id: "biblioteca",
    titulo: "Biblioteca Normativa Oficial",
    descripcion: "Consulta los textos completos y vigentes del CCT, Estatutos y Reglamentos.",
    ruta: "/biblioteca-normativa",
    chipLabel: "📚 Abrir Biblioteca Normativa",
  },
  GUIA_CONCEPTOS: {
    id: "guia-conceptos",
    titulo: "Guía de Conceptos de Nómina",
    descripcion: "Diccionario interactivo con el significado de cada código de tu recibo.",
    ruta: "/guia/conceptos",
    chipLabel: "ℹ️ Guía de Conceptos",
  },
}

/**
 * Recomienda herramientas según las señales semánticas de la pregunta.
 */
export function recommendPlatformTools(question: string): PlatformToolRecommendation[] {
  const q = question.toLowerCase()
  const tools: PlatformToolRecommendation[] = []

  // Cláusula 97 / Anticipo de sueldo
  if (/(cl[aá]usula\s*97|anticipo.*sueldo|anticipo.*3 meses|pr[eé]stamo.*sin inter[eé]s)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.CLAUSULA_97)
  }

  // Horas extra
  if (/(horas? extra|tiempo extraordinario|guardia festiva|doblar turno|tiempo extra)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.TIEMPO_EXTRA)
  }

  // Aguinaldo
  if (/(aguinaldo|fin de a[ñn]o|gratificaci[oó]n anual)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.AGUINALDO)
  }

  // Préstamos o fondo de ahorro
  if (/(pr[eé]stamo|fondo de ahorro|anticipo|caja de ahorro)/i.test(q)) {
    if (/(cl[aá]usula\s*97|3 meses|sin inter[eé]s)/i.test(q)) {
      tools.push(PLATFORM_TOOLS.CLAUSULA_97)
    } else {
      tools.push(PLATFORM_TOOLS.PRESTAMOS)
    }
  }

  // Vacaciones / Regreso
  if (/(regreso.*vacacion|cu[aá]ndo regreso|qu[eé] d[ií]a me presento|presentarme a trabajar)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.REGRESO_VACACIONES)
  } else if (/(vacacion|d[ií]as de descanso|rol vacacional|periodo vacacional)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.VACACIONES)
  }

  // Calendario / Festivos / Guardias / Inhábiles
  if (/(calendario|d[ií]as? festivo|d[ií]a inh[aá]bil|descanso obligatorio|descansos obligatorios|puente)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.CALENDARIO)
  }

  // Segunda de julio
  if (/(segunda.*julio|quincena.*julio|bono de julio)/i.test(q)) {
    if (/(proporcional|meses trabajados|menos de un a[ñn]o)/i.test(q)) {
      tools.push(PLATFORM_TOOLS.SEGUNDA_JULIO_PROP)
    } else {
      tools.push(PLATFORM_TOOLS.SEGUNDA_JULIO)
    }
  }

  // Conflictos / Actas / Sanciones / Inconformidades / Escritos
  if (/(acta|sanci[oó]n|disciplin|inconform|queja|oficio|redactar|escrito|carta|hostig|acoso|fuera de categor|descuento indebido|negar.*vacacion|negativa.*vacacion|reclam)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.ESCRITOS)
  }

  if (/(hostig|acoso|amenaz|jefe|maltrato|arbitrar|testigo|bit[aá]cora|hechos)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.BITACORA)
  }

  // Conceptos, Recibo o Tarjetón
  if (/(mi quincena|desglose quincenal|revisar mi recibo|cu[aá]nto me depositaron|descuentos en recibo|percepciones y deducciones|mi cobro|cu[aá]nto cobr[eé]|mi neto|sueldo neto)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.MI_QUINCENA)
    tools.push(PLATFORM_TOOLS.TARJETON)
  } else if (/(concepto\s*\d{2,3}|clave\s*\d{2,3}|qu[eé] significa el concepto|mi tarjet[oó]n|tarjet[oó]n|desglose|marcas? de asistencia|sin retardo|asistencia puntual|marca de continuidad)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.GUIA_CONCEPTOS)
    tools.push(PLATFORM_TOOLS.TARJETON)
  }

  // Calculadoras en general
  if (/(calculadora|simulador|todas las calculadoras|calcular)/i.test(q) && tools.length === 0) {
    tools.push(PLATFORM_TOOLS.CALCULADORAS_HUB)
  }

  // Normativa completa
  if (/(contrato completo|cct completo|ver el reglamento|estatutos completos|descargar pdf)/i.test(q)) {
    tools.push(PLATFORM_TOOLS.BIBLIOTECA)
  }

  // Deduplicar por id
  const seen = new Set<string>()
  return tools.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })
}
