/**
 * Diagnóstico contextual y de naturaleza laboral para discrepancias de conceptos.
 *
 * Cuando un concepto habitual desaparece, disminuye o aparece como deducción imprevista,
 * este motor detecta su fundamento contractual (CCT IMSS-SNTSS y RIT), explica la causa
 * probable en lenguaje claro (ej. "te llegó una falta", "retardo en checador") y orienta
 * al trabajador sobre la acción sindical y administrativa inmediata a realizar.
 */
import { normalizeCode } from "@/features/tarjeton-guia/lib/normalize"
import { conceptDetails } from "@/features/tarjeton-guia/data/concept-details"
import { getGuideConcept } from "@/features/tarjeton-guia/lib/catalog"

export type ConceptDiscrepancyType = "desaparecio" | "bajo" | "nuevo" | "subio"

export type ConceptCategory =
  | "asistencia"
  | "puntualidad"
  | "sueldo"
  | "renta"
  | "prevision_social"
  | "sobresueldo_riesgo"
  | "tiempo_extra"
  | "estacional"
  | "deduccion_disciplinaria"
  | "credito_prestamo"
  | "impuesto_fiscal"
  | "seguridad_social"
  | "otro"

export type DiscrepancySeverity = "critical" | "warning" | "info"

export interface ConceptDiscrepancyDiagnosis {
  code: string
  label: string
  nature: string
  category: ConceptCategory
  severity: DiscrepancySeverity
  headline: string
  probableCause: string
  laborContext: string
  recommendedAction: string
}

interface ConceptDiagnosticRule {
  name: string
  nature: string
  category: ConceptCategory
  diagnose: (
    type: ConceptDiscrepancyType,
    context: { previousAmount?: number; amount?: number; label?: string }
  ) => {
    headline: string
    probableCause: string
    laborContext: string
    recommendedAction: string
    severity: DiscrepancySeverity
  }
}

/** Catálogo de reglas diagnósticas para conceptos contractuales de alta frecuencia IMSS */
const DIAGNOSTIC_RULES: Record<string, ConceptDiagnosticRule> = {
  // -------------------------------------------------------------------------
  // ESTÍMULO DE ASISTENCIA (032)
  // -------------------------------------------------------------------------
  "032": {
    name: "Estímulo por Asistencia",
    nature: "Estímulo por Asistencia Perfecta (Cláusula 38 CCT / Arts. 91-92 del RIT)",
    category: "asistencia",
    diagnose: (type) => {
      if (type === "desaparecio") {
        return {
          headline: "Te llegó una falta que conviene revisar: el estímulo de asistencia no aparece",
          probableCause:
            "El sistema SIAP registró una falta injustificada (Concepto 172), licencia sin sueldo o incidencia no justificada en el reloj checador en tu quincena de corte (desfase N-2).",
          laborContext:
            "El estímulo de asistencia equivale a 3 días de aguinaldo nominal por cada quincena con asistencia íntegra. Conforme a los Arts. 91 y 92 del Reglamento Interior de Trabajo (RIT), una sola falta o acumulación de pases particulares que exceda tu jornada anula el 100% del pago de este estímulo en el periodo evaluado.",
          recommendedAction:
            "Revisa de inmediato tus checadas en Tu Perfil IMSS para ubicar el día exacto de la supuesta falta. Si asististe normalmente o existió falla en el lector biométrico, acude cuanto antes con tu Delegado Sindical para ingresar el formato de aclaración o justificación oficial ante la Oficina de Personal.",
          severity: "critical",
        }
      }
      if (type === "bajo") {
        return {
          headline: "El importe del estímulo de asistencia disminuyó respecto a la quincena anterior",
          probableCause:
            "Disminución en los días pagados de tu Sueldo Base (002) o recálculo en la base nominal de aguinaldo.",
          laborContext:
            "El valor del estímulo 032 se determina sobre tu cuota diaria nominal (Sueldo 002 + Ayuda de renta). Si tu sueldo base vino con días descontados, el monto del estímulo disminuye en idéntica proporción.",
          recommendedAction:
            "Verifica que tus 15 días de sueldo tabular 002 estén pagados al 100% y sin deducciones por inasistencia.",
          severity: "warning",
        }
      }
      return {
        headline: "Estímulo por Asistencia (032) acreditado en tu tarjetón",
        probableCause: "Registro de asistencia perfecta en la quincena de incidencia evaluada.",
        laborContext: "Se liquidan 3 días de aguinaldo nominal por asistencia ininterrumpida.",
        recommendedAction: "Conserva tus comprobantes de nómina para tu historial laboral y cómputo de asiduidad.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // ESTÍMULO DE PUNTUALIDAD (033)
  // -------------------------------------------------------------------------
  "033": {
    name: "Estímulo por Puntualidad",
    nature: "Estímulo por Puntualidad (Cláusula 38 CCT / Arts. 86-93 del RIT)",
    category: "puntualidad",
    diagnose: (type) => {
      if (type === "desaparecio") {
        return {
          headline: "Revisa tus checadas: el estímulo de puntualidad no aparece por retardos o entradas fuera de tolerancia",
          probableCause:
            "Se registraron retardos (Concepto 174, entre minuto 6 y 30) o entradas fuera de los 5 minutos de tolerancia que interrumpieron la decena continua de registros puntuales requerida.",
          laborContext:
            "El estímulo de puntualidad equivale a 2 días de aguinaldo nominal por cada bloque de 10 días hábiles registrando tu entrada hasta el minuto 5 de tolerancia (Art. 93 RIT). Checar a partir del minuto 6 rompe la secuencia continua y reprograma la acumulación hasta la siguiente quincena de corte.",
          recommendedAction:
            "Consulta tu reporte de checadas en Tu Perfil IMSS. Si el reloj checador biométrico de tu unidad presentó filas anormales, caída de red o descalibración horaria avalada por tu servicio, solicita a tu Delegado Sindical el oficio de justificación de checada para reclamar la reposición del estímulo.",
          severity: "critical",
        }
      }
      if (type === "bajo") {
        return {
          headline: "El importe del estímulo de puntualidad es menor",
          probableCause:
            "Menor cantidad de bloques de puntualidad completados o recálculo sobre la base nominal de aguinaldo.",
          laborContext:
            "El concepto 033 paga 2 días por cada decena de checadas en tolerancia acumuladas en el Campo 23/39 del tarjetón.",
          recommendedAction:
            "Revisa en tu tarjetón el Campo 39 ('Días concepto 033') para verificar cuántas decenas fueron reconocidas.",
          severity: "warning",
        }
      }
      return {
        headline: "Estímulo por Puntualidad (033) acreditado en tu nómina",
        probableCause: "Cumplimiento del bloque continuo de registros de entrada dentro de los 5 minutos de tolerancia.",
        laborContext: "Se abonan 2 días de aguinaldo nominal por cada 10 registros puntuales computados.",
        recommendedAction: "Mantén tus registros biométricos dentro del minuto 0 al 5 para no interrumpir el ciclo.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // SUELDO TABULAR BASE (002)
  // -------------------------------------------------------------------------
  "002": {
    name: "Sueldo Tabular Base",
    nature: "Sueldo Base Contractual (Cláusulas 56 y 137 del CCT / Tabulador de Sueldos)",
    category: "sueldo",
    diagnose: (type) => {
      if (type === "desaparecio" || type === "bajo") {
        return {
          headline: "Alerta crítica: tu sueldo tabular base no aparece completo en esta quincena",
          probableCause:
            "Descuento masivo por faltas injustificadas, licencia sin goce de sueldo (129/171), incapacidad médica prolongada pagada por subsidio directo o alta intermedia en el SIAP.",
          laborContext:
            "El concepto 002 es la columna vertebral de tu nómina y debe cubrir 15 días en cada quincena ordinaria. Si viene reducido, disminuye en cadena la ayuda de renta (011/022), estímulos y tu aportación al fondo de jubilaciones.",
          recommendedAction:
            "Acude urgentemente con tu Representante Sindical y a la Oficina de Personal con tu tarjetón anterior y reporte de asistencia para constatar por qué tus días pagados de sueldo vinieron incompletos.",
          severity: "critical",
        }
      }
      if (type === "subio") {
        return {
          headline: "Tu sueldo tabular base aumentó respecto a la quincena previa",
          probableCause:
            "Incremento salarial contractual derivado de la revisión del Tabulador CCT, pago de retroactivo o regularización de días trabajados.",
          laborContext:
            "El tabulador fija la cuota diaria nominal de tu categoría y jornada. Todo ajuste al alza eleva la base de tus prestaciones secundarias.",
          recommendedAction:
            "Verifica que el nuevo importe coincida con el Tabulador de Sueldos IMSS-SNTSS vigente para tu categoría y jornada.",
          severity: "info",
        }
      }
      return {
        headline: "Sueldo Tabular Base (002) registrado",
        probableCause: "Pago ordinario correspondiente a los 15 días laborales de la quincena.",
        laborContext: "Base de cálculo para renta, estímulos y seguridad social.",
        recommendedAction: "Revisa periódicamente el tabulador correspondiente a tu rama y jornada laboral.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // AYUDA DE RENTA (011 / 020 / 022)
  // -------------------------------------------------------------------------
  "011": {
    name: "Ayuda de Renta",
    nature: "Ayuda de Renta Contractual (Cláusula 63 Bis del CCT / Inciso B)",
    category: "renta",
    diagnose: (type) => {
      if (type === "desaparecio" || type === "bajo") {
        return {
          headline: "La ayuda de renta disminuyó o no aparece en esta quincena",
          probableCause:
            "Reducción proporcional por días no devengados de sueldo base (002), licencia sin goce de sueldo o cambio en la asignación de categoría.",
          laborContext:
            "Se calcula como porcentaje directo sobre tu sueldo tabular. Si tu sueldo base se vio afectado por inasistencias o descuentos, la ayuda de renta desciende en igual porcentaje.",
          recommendedAction:
            "Coteja que tus 15 días de sueldo 002 estén pagados al 100%. Si tu sueldo está íntegro y la renta bajó, solicita a Personal la revisión de la Cláusula 63 Bis.",
          severity: "warning",
        }
      }
      return {
        headline: "Ayuda de Renta (011) reflejada",
        probableCause: "Porcentaje contractual calculado sobre tu sueldo tabular de la quincena.",
        laborContext: "Prestación quincenal ligada a tu jornada y categoría.",
        recommendedAction: "Revisa que el porcentaje corresponda a tu tabulador contractual.",
        severity: "info",
      }
    },
  },

  "022": {
    name: "Ayuda de Renta por Antigüedad",
    nature: "Ayuda de Renta por Antigüedad (Cláusula 63 Bis del CCT / Inciso C)",
    category: "renta",
    diagnose: (type) => {
      if (type === "desaparecio" || type === "bajo") {
        return {
          headline: "La ayuda de renta por antigüedad disminuyó o no aparece",
          probableCause:
            "Afectación en los días pagados de sueldo base o falta de actualización del porcentaje de antigüedad y años de servicio en el SIAP.",
          laborContext:
            "Se incrementa de manera porcentual por cada quinquenio o año de antigüedad efectiva sobre tu sueldo base. Días incompletos de sueldo base reducen el monto final.",
          recommendedAction:
            "Revisa si tus años de antigüedad efectiva en el tarjetón (Campo 12) están correctos y si tus días de sueldo base están completos.",
          severity: "warning",
        }
      }
      return {
        headline: "Ayuda de Renta por Antigüedad (022) acreditada",
        probableCause: "Porcentaje contractual por años de servicio acreditados en tu cédula laboral.",
        laborContext: "Prestación progresiva conforme a tu antigüedad en el Instituto.",
        recommendedAction: "Verifica que coincida con tus años de servicio efectivos.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // INFECTO-RIESGO / ALTO RIESGO (023)
  // -------------------------------------------------------------------------
  "023": {
    name: "Infecto-Riesgo / Compensación por Riesgo",
    nature: "Sobresueldo por Área de Riesgo e Infectocontagiosidad (Cláusula 63 Bis del CCT)",
    category: "sobresueldo_riesgo",
    diagnose: (type) => {
      if (type === "desaparecio") {
        return {
          headline: "El concepto de riesgo / infecto-riesgo no apareció en este tarjetón",
          probableCause:
            "Reubicación provisional de servicio, licencia médica prolongada o falta de refrendo de la clave de riesgo en plantilla por la Oficina de Personal.",
          laborContext:
            "El pago del 023 está estrictamente condicionado a encontrarse adscrito y laborando físicamente en áreas catalogadas de infectocontagiosidad, emanaciones o alto riesgo hospitalario.",
          recommendedAction:
            "Si continúas laborando en tu servicio de riesgo habitual, solicita de inmediato a tu jefatura y al Sindicato la ratificación de adscripción de riesgo para tramitar el pago retroactivo.",
          severity: "warning",
        }
      }
      return {
        headline: "Sobresueldo por Infecto-Riesgo (023) acreditado",
        probableCause: "Adscripción activa en servicio o unidad con riesgo catalogado.",
        laborContext: "Compensación contractual por laborar en áreas de exposición médica o ambiental.",
        recommendedAction: "Verifica que el servicio en el que estás laborando mantenga su registro en catálogo.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // AYUDA PARA DESPENSA (050)
  // -------------------------------------------------------------------------
  "050": {
    name: "Ayuda para Despensa",
    nature: "Previsión Social - Ayuda para Despensa (Cláusula 142 Bis del CCT)",
    category: "prevision_social",
    diagnose: (type) => {
      if (type === "desaparecio" || type === "bajo") {
        return {
          headline: "La ayuda para despensa (050) no aparece o presenta variación en el importe",
          probableCause:
            "Omisión administrativa en nómina o suspensión temporal por licencia sin sueldo mayor a 3 días.",
          laborContext:
            "Es una prestación fija ($400.00 base nominal CCT) liquidada quincenalmente a toda la plantilla activa y además integra directamente la base del Fondo de Jubilación (RJP). En quincenas ordinarias no debe suspenderse.",
          recommendedAction:
            "Reporta la omisión ante la Secretaría de Conflictos de tu Sección Sindical para exigir el reintegro inmediato en la próxima nómina.",
          severity: "warning",
        }
      }
      return {
        headline: "Ayuda para Despensa (050) acreditada",
        probableCause: "Prestación contractual fija quincenal para toda la plantilla.",
        laborContext: "Integra la base del Fondo de Jubilaciones y Pensiones conforme al Art. 5 del RJP.",
        recommendedAction: "Verifica que aparezca de manera constante en todas tus quincenas ordinarias.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // AYUDA PARA LIBROS / COMPENSACIONES (054)
  // -------------------------------------------------------------------------
  "054": {
    name: "Ayuda para Libros / Compensación",
    nature: "Prestación de Previsión Social / Ayuda Educativa y Compensaciones CCT",
    category: "prevision_social",
    diagnose: (type) => {
      if (type === "desaparecio") {
        return {
          headline: "El concepto 054 no se refleja en esta quincena",
          probableCause:
            "Es una prestación con calendario específico de dispersión o ligada a categorías y turnos determinados en el CCT.",
          laborContext:
            "Diversas prestaciones complementarias se dispersan en quincenas fijadas en el calendario sindical anual o al renovarse periodos escolares.",
          recommendedAction:
            "Revisa con tu representación sindical el calendario oficial de pagos de prestaciones sindicales complementarias.",
          severity: "info",
        }
      }
      return {
        headline: "Compensación / Ayuda Contractual (054) acreditada",
        probableCause: "Dispersión de prestación educativa o compensación especial conforme a calendario.",
        laborContext: "Prestación de apoyo familiar y superación profesional convenida en CCT.",
        recommendedAction: "Coteja el importe con el tabulador de ayudas sindicales.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // PRIMA DOMINICAL (030)
  // -------------------------------------------------------------------------
  "030": {
    name: "Prima Dominical",
    nature: "Prima Dominical Contractual (Cláusula 46 del CCT - 25% sobre sueldo base diario)",
    category: "sobresueldo_riesgo",
    diagnose: (type) => {
      if (type === "desaparecio" || type === "bajo") {
        return {
          headline: "La prima dominical no aparece o disminuyó respecto a la quincena anterior",
          probableCause:
            "No laboraste turnos dominicales en el rol de la quincena de corte evaluada, o disfrutaste de pase/descanso en domingo.",
          laborContext:
            "Se devenga exclusivamente por cada domingo efectivamente trabajado en tu jornada ordinaria. Si en la quincena previa tuviste 2 domingos trabajados y en esta solo 1 o ninguno, la variación es normal.",
          recommendedAction:
            "Revisa tu rol de guardias mensual y verifica cuántos domingos trabajaste en la quincena de incidencia del tarjetón.",
          severity: "info",
        }
      }
      return {
        headline: "Prima Dominical (030) acreditada",
        probableCause: "Pago del 25% adicional por laborar en día domingo dentro de tu jornada ordinaria.",
        laborContext: "Regulada por la Cláusula 46 del CCT por cada domingo de turno cumplido.",
        recommendedAction: "Verifica que el número de domingos pagados coincida con tu rol de asistencia.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // TIEMPO EXTRAORDINARIO (037)
  // -------------------------------------------------------------------------
  "037": {
    name: "Tiempo Extraordinario",
    nature: "Jornadas Extraordinarias (Cláusula 45 del CCT)",
    category: "tiempo_extra",
    diagnose: (type) => {
      if (type === "desaparecio" || type === "bajo") {
        return {
          headline: "El pago de tiempo extra no aparece o fue menor en este tarjetón",
          probableCause:
            "No se capturaron tarjetas de tiempo extraordinario en las fechas límite de corte del SIAP o laboraste menos horas extras.",
          laborContext:
            "El tiempo extraordinario es variable y requiere trámite de papeleta debidamente sellada y autorizada por la jefatura médica o administrativa antes de las fechas de corte.",
          recommendedAction:
            "Si laboraste tiempo extra y no apareció reflejado, acude con tu jefe de servicio para confirmar si la tarjeta fue turnada a tiempo a la Oficina de Personal.",
          severity: "info",
        }
      }
      return {
        headline: "Tiempo Extraordinario (037) pagado",
        probableCause: "Captura y validación de horas extraordinarias laboradas en tu unidad.",
        laborContext: "Liquidado al doble conforme a la Cláusula 45 del CCT.",
        recommendedAction: "Guarda copia de tus tarjetas de tiempo extra autorizadas por tu jefatura.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // PRIMA VACACIONAL (029) Y AGUINALDO (049) - PRESTACIONES ESTACIONALES
  // -------------------------------------------------------------------------
  "029": {
    name: "Prima Vacacional",
    nature: "Prima Vacacional Contractual (Cláusula 47 del CCT)",
    category: "estacional",
    diagnose: (type) => {
      if (type === "desaparecio") {
        return {
          headline: "Conclusión esperada del periodo vacacional (prima 029)",
          probableCause:
            "Tu periodo vacacional concluyó. La prima solo se liquida en la quincena previa al disfrute de tus vacaciones.",
          laborContext:
            "Es un pago estacional que acompaña a los días de descanso vacacional reglamentario. Su salida en quincenas ordinarias es el comportamiento regular normal.",
          recommendedAction: "No requiere trámite. Se volverá a liquidar al programar tu próximo periodo vacacional.",
          severity: "info",
        }
      }
      return {
        headline: "Prima Vacacional (029) acreditada",
        probableCause: "Pago contractual previo al disfrute de tu periodo vacacional programado.",
        laborContext: "Equivalente a los días fijados en la Cláusula 47 del CCT según tu antigüedad.",
        recommendedAction: "Verifica que las fechas de tus vacaciones coincidan con tu programación oficial.",
        severity: "info",
      }
    },
  },

  "049": {
    name: "Aguinaldo",
    nature: "Gratificación Anual Contractual (Cláusula 107 del CCT - 3 meses de sueldo nominal)",
    category: "estacional",
    diagnose: (type) => {
      if (type === "desaparecio") {
        return {
          headline: "Conclusión de la temporada de pago de aguinaldo (concepto 049)",
          probableCause:
            "El aguinaldo se liquida exclusivamente en las quincenas de fin de año (quincenas 23 y 24). Su ausencia en el resto del año es esperada y correcta.",
          laborContext:
            "Prestación anual equivalente a 3 meses de sueldo tabular y ayuda de renta que se abona en noviembre y diciembre.",
          recommendedAction: "No requiere trámite alguno durante el transcurso regular del año.",
          severity: "info",
        }
      }
      return {
        headline: "Aguinaldo (049) acreditado en tu tarjetón",
        probableCause: "Dispersión de la gratificación anual de fin de año.",
        laborContext: "Prestación de 90 días de salario nominal estipulada en la Cláusula 107 del CCT.",
        recommendedAction: "Revisa que tu monto corresponda a tu sueldo nominal completo.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // FALTA INJUSTIFICADA (172) - DEDUCCIÓN DISCIPLINARIA
  // -------------------------------------------------------------------------
  "172": {
    name: "Falta Injustificada",
    nature: "Deducción Disciplinaria por Inasistencia (Reglamento Interior de Trabajo)",
    category: "deduccion_disciplinaria",
    diagnose: (type) => {
      if (type === "nuevo" || type === "subio") {
        return {
          headline: "¡Alerta urgente! Te llegó un descuento por falta injustificada en tu tarjetón",
          probableCause:
            "Personal registró una inasistencia o entrada con retardo superior a 30 minutos sin justificación médica ni pase oficial.",
          laborContext:
            "Esta deducción descuenta el valor de la jornada diaria completa y provoca la anulación inmediata del 100% de tus estímulos de asistencia (032) y puntualidad (033) en esa quincena.",
          recommendedAction:
            "Revisa en el apartado de observaciones la fecha exacta descontada. Acude con urgencia ante tu Delegado Sindical con copias de pases, justificante médico, rol o registro biométrico para tramitar el reclamo y reembolso por descuento indebido y reposición de estímulos.",
          severity: "critical",
        }
      }
      return {
        headline: "El descuento por falta injustificada (172) ya no aparece",
        probableCause: "Regularización de asistencia o conclusión del periodo sancionado en quincenas previas.",
        laborContext: "Al no registrar faltas, recuperas tu elegibilidad para estímulos quincenales.",
        recommendedAction: "Mantén tus registros de checador para salvaguardar tu asistencia completa.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // PASES DE SALIDA (173) - DEDUCCIÓN
  // -------------------------------------------------------------------------
  "173": {
    name: "Pases de Salida Particulares",
    nature: "Descuento por Tiempo de Pases Particulares (Art. 92 del RIT)",
    category: "deduccion_disciplinaria",
    diagnose: (type) => {
      if (type === "nuevo" || type === "subio") {
        return {
          headline: "Aparece descuento por pases de salida particulares (173)",
          probableCause:
            "Deducción de tiempo efectivo por pases particulares solicitados durante la jornada laboral en la quincena de corte.",
          laborContext:
            "Conforme al Art. 92 del RIT, los pases particulares descuentan el tiempo acumulado. Solo anulan el estímulo de asistencia (032) si la suma de minutos en la quincena iguala o excede una jornada completa contratada.",
          recommendedAction:
            "Verifica que el tiempo descontado en observaciones coincida con las papeletas de pase que autorizaste.",
          severity: "warning",
        }
      }
      return {
        headline: "Sin descuentos por pases de salida particulares",
        probableCause: "No se acumularon pases particulares en el periodo de corte.",
        laborContext: "Asistencia íntegra dentro de la jornada contractual.",
        recommendedAction: "Revisa tus papeletas ante la jefatura de servicio.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // RETARDOS (174) - DEDUCCIÓN
  // -------------------------------------------------------------------------
  "174": {
    name: "Retardos en Reloj Checador",
    nature: "Deducción por Retardo en Entrada (minuto 6 al 30 de tolerancia - RIT)",
    category: "deduccion_disciplinaria",
    diagnose: (type) => {
      if (type === "nuevo" || type === "subio") {
        return {
          headline: "Se registró un descuento por retardos que cancela tu estímulo de puntualidad",
          probableCause:
            "Checadas registradas entre el minuto 6 y el minuto 30 posterior a tu hora oficial de entrada.",
          laborContext:
            "El concepto 174 descuenta las fracciones de tiempo no laboradas y además cancela la decena de puntualidad requerida para el pago del estímulo 033.",
          recommendedAction:
            "Revisa en tu reporte de checador de Tu Perfil IMSS qué días fueron marcados con retardo. Si el reloj checador presentó fallas de lectura biométrica en tu turno, contacta a tu Delegado Sindical.",
          severity: "warning",
        }
      }
      return {
        headline: "Sin retenciones por retardos (174)",
        probableCause: "Entradas registradas dentro de la tolerancia de 5 minutos.",
        laborContext: "Registro puntual que respalda la acreditación del estímulo 033.",
        recommendedAction: "Checa puntualmente para preservar tus estímulos quincenales.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // IMPUESTO SOBRE LA RENTA (151) - FISCAL
  // -------------------------------------------------------------------------
  "151": {
    name: "Impuesto sobre la Renta (ISR)",
    nature: "Retención Fiscal Federal (Ley del Impuesto sobre la Renta)",
    category: "impuesto_fiscal",
    diagnose: (type) => {
      if (type === "subio") {
        return {
          headline: "La retención de ISR aumentó debido a mayores percepciones gravadas",
          probableCause:
            "Percepciones gravables adicionales en la quincena (tiempo extra, primas, estímulos o compensaciones).",
          laborContext:
            "El ISR se calcula con la tarifa progresiva del SAT. A mayores percepciones brutas gravadas, se aplica una tasa marginal más alta de retención.",
          recommendedAction:
            "Verifica que el incremento guarde proporción con el incremento de tus percepciones brutas del periodo.",
          severity: "info",
        }
      }
      if (type === "bajo") {
        return {
          headline: "La retención de ISR disminuyó conforme a tus ingresos del periodo",
          probableCause:
            "Menor monto de percepciones gravables o ajuste de retención proporcional.",
          laborContext:
            "Al disminuir la base gravable en el SIAP, el cálculo de impuesto federal desciende automáticamente.",
          recommendedAction:
            "Revisa que todas tus percepciones devengadas hayan sido procesadas correctamente.",
          severity: "info",
        }
      }
      return {
        headline: "Retención ordinaria de ISR (151)",
        probableCause: "Cálculo fiscal de ley sobre tus percepciones gravadas.",
        laborContext: "Retención federal enterada a la Secretaría de Hacienda.",
        recommendedAction: "Conserva tus CFDI de nómina para tu declaración anual si estás obligado.",
        severity: "info",
      }
    },
  },

  // -------------------------------------------------------------------------
  // FONDO DE JUBILACIÓN / RJP (152 / 107 / 108 / 111)
  // -------------------------------------------------------------------------
  "152": {
    name: "Fondo de Jubilación (3%)",
    nature: "Aportación Contractual al Fondo de Jubilaciones y Pensiones (Convenio RJP 2005)",
    category: "seguridad_social",
    diagnose: () => ({
      headline: "Aportación al Fondo de Jubilación (RJP)",
      probableCause: "Retención ordinaria del 3% sobre tu base pensionable para el régimen anterior a 2005.",
      laborContext:
        "Forma parte de la cuota del 10% global del Régimen de Jubilaciones y Pensiones, concurriendo habitualmente con el concepto 107 (7%).",
      recommendedAction: "Verifica que tu régimen de ingreso corresponda a tu fecha de contratación.",
      severity: "info",
    }),
  },

  // -------------------------------------------------------------------------
  // AMORTIZACIONES Y CRÉDITOS (150 / 154 / 170)
  // -------------------------------------------------------------------------
  "154": {
    name: "Crédito INFONAVIT",
    nature: "Amortización de Crédito de Vivienda (INFONAVIT / Cláusula 97 CCT)",
    category: "credito_prestamo",
    diagnose: (type) => {
      if (type === "desaparecio") {
        return {
          headline: "El descuento por crédito INFONAVIT ya no aparece en tu tarjetón",
          probableCause:
            "Liquidación total del crédito hipotecario o suspensión notificada por el instituto de vivienda.",
          laborContext:
            "Al cumplirse el calendario de amortización, el SIAP cesa el descuento quincenal.",
          recommendedAction:
            "Solicita tu carta de suspensión de retenciones y constancia de no adeudo en el portal Mi Cuenta INFONAVIT.",
          severity: "info",
        }
      }
      return {
        headline: "Amortización de crédito de vivienda INFONAVIT",
        probableCause: "Retención quincenal estipulada en tu aviso de retención de descuentos.",
        laborContext: "Descuento institucional enterado al Fondo de la Vivienda.",
        recommendedAction: "Verifica tu estado de cuenta en el portal de INFONAVIT periódicamente.",
        severity: "info",
      }
    },
  },

  "170": {
    name: "Crédito FONACOT",
    nature: "Amortización de Crédito al Consumo (FONACOT)",
    category: "credito_prestamo",
    diagnose: (type) => {
      if (type === "desaparecio") {
        return {
          headline: "El descuento de crédito FONACOT concluyó o no aparece",
          probableCause:
            "Liquidación del plazo de amortización convenido con FONACOT.",
          laborContext:
            "Al cubrirse las cuotas pactadas en el contrato de crédito, la retención concluye.",
          recommendedAction:
            "Verifica tu saldo en cero en el portal oficial de FONACOT y tramita tu carta finiquito.",
          severity: "info",
        }
      }
      return {
        headline: "Descuento por Crédito FONACOT",
        probableCause: "Retención quincenal programada para liquidar financiamiento activo.",
        laborContext: "Descuento directo por nómina tramitado ante el instituto FONACOT.",
        recommendedAction: "Revisa en observaciones el número de amortizaciones restantes.",
        severity: "info",
      }
    },
  },
}

/**
 * Resuelve el diagnóstico de un cambio de concepto basándose en su naturaleza laboral.
 * Si el concepto tiene regla específica en DIAGNOSTIC_RULES, la aplica.
 * De lo contrario, inspecciona dinámicamente el catálogo educativo oficial (conceptDetails / guideConcepts)
 * para inferir de forma inteligente el contexto normativo y causa probable.
 */
export function diagnoseConceptDiscrepancy(
  code: string,
  type: ConceptDiscrepancyType,
  context: { previousAmount?: number; amount?: number; label?: string } = {}
): ConceptDiscrepancyDiagnosis {
  const norm = normalizeCode(code) || code

  // 1. Regla específica prioritaria
  const specific = DIAGNOSTIC_RULES[norm]
  if (specific) {
    const diag = specific.diagnose(type, context)
    return {
      code: norm,
      label: specific.name,
      nature: specific.nature,
      category: specific.category,
      severity: diag.severity,
      headline: diag.headline,
      probableCause: diag.probableCause,
      laborContext: diag.laborContext,
      recommendedAction: diag.recommendedAction,
    }
  }

  // 2. Consulta dinámica al catálogo de la Guía
  const details = conceptDetails[norm]
  const catalogEntry = getGuideConcept(norm)
  const isDeduction = catalogEntry?.kind === "deduction"
  const conceptName = catalogEntry?.name || context.label || `Concepto ${norm}`
  const descriptor = details?.descriptor || (isDeduction ? "Deducción" : "Percepción")

  let category: ConceptCategory = "otro"
  if (isDeduction) {
    category = "credito_prestamo"
  } else if (descriptor.toLowerCase().includes("sueldo") || descriptor.toLowerCase().includes("tabular")) {
    category = "sueldo"
  } else if (descriptor.toLowerCase().includes("riesgo") || descriptor.toLowerCase().includes("jornada")) {
    category = "sobresueldo_riesgo"
  } else if (descriptor.toLowerCase().includes("previsión") || descriptor.toLowerCase().includes("ayuda")) {
    category = "prevision_social"
  }

  // Construcción contextual según tipo de cambio
  if (type === "desaparecio") {
    const severity: DiscrepancySeverity = isDeduction ? "info" : "warning"
    const headline = isDeduction
      ? `El descuento del concepto ${norm} (${conceptName}) ya no aparece en tu tarjetón`
      : `El concepto ${norm} (${conceptName}) no aparece en esta quincena`

    const probableCause = isDeduction
      ? "Conclusión del periodo de retención, liquidación de saldo o regularización administrativa."
      : details?.affects?.[0] ||
        "Omisión administrativa, cambio temporal de adscripción, licencia o condición contractual no acreditada en la quincena de corte."

    const laborContext = details?.simple
      ? `${details.simple} ${details.whyItMatters ? `(${details.whyItMatters})` : ""}`
      : `Concepto contractual registrado como ${descriptor} en el catálogo institucional del IMSS.`

    const recommendedAction = isDeduction
      ? "Verifica en tu estado de cuenta o con Personal que no existan cuotas pendientes."
      : "Revisa con tu Delegado Sindical y la Oficina de Personal si tu categoría o servicio requería trámite de ratificación de nómina."

    return {
      code: norm,
      label: conceptName,
      nature: details?.whyItAppears || `Normativa institucional IMSS (${descriptor})`,
      category,
      severity,
      headline,
      probableCause,
      laborContext,
      recommendedAction,
    }
  }

  if (type === "nuevo") {
    const severity: DiscrepancySeverity = isDeduction ? "warning" : "info"
    const headline = isDeduction
      ? `Aparece un nuevo descuento en tu tarjetón: concepto ${norm} (${conceptName})`
      : `Aparece una nueva percepción en tu tarjetón: concepto ${norm} (${conceptName})`

    const probableCause = isDeduction
      ? "Carga de nuevo crédito, retención judicial, seguro sindical o deducción por trámite reciente."
      : details?.whenItAppears || "Asignación de prestación, sobresueldo por función o pago extraordinario del periodo."

    const laborContext = details?.simple
      ? details.simple
      : `Concepto clasificado institucionalmente como ${descriptor}.`

    const recommendedAction = isDeduction
      ? "Revisa en el apartado de observaciones el folio o documento que respalda este cobro. Si no lo autorizaste, acude con tu Delegado Sindical."
      : "Verifica que el importe coincida con el cálculo normado para tu puesto o trámite realizado."

    return {
      code: norm,
      label: conceptName,
      nature: details?.whyItAppears || `Catálogo de nómina IMSS (${descriptor})`,
      category,
      severity,
      headline,
      probableCause,
      laborContext,
      recommendedAction,
    }
  }

  if (type === "bajo") {
    return {
      code: norm,
      label: conceptName,
      nature: details?.whyItAppears || `Catálogo de nómina IMSS (${descriptor})`,
      category,
      severity: isDeduction ? "info" : "warning",
      headline: `El importe del concepto ${norm} (${conceptName}) es menor al de la quincena anterior`,
      probableCause: isDeduction
        ? "Ajuste a la baja en la base imponible o menor saldo por retener."
        : "Días no devengados completos, variación de base de cálculo o recálculo de cuotas.",
      laborContext: details?.simple || `Concepto catalogado como ${descriptor}.`,
      recommendedAction: isDeduction
        ? "No suele requerir reclamo si tu base de cálculo disminuyó."
        : "Verifica con tu representación sindical que tus días de sueldo y condiciones de trabajo estén íntegros.",
    }
  }

  // type === "subio"
  return {
    code: norm,
    label: conceptName,
    nature: details?.whyItAppears || `Catálogo de nómina IMSS (${descriptor})`,
    category,
    severity: isDeduction ? "warning" : "info",
    headline: `El importe del concepto ${norm} (${conceptName}) aumentó respecto a la quincena anterior`,
    probableCause: isDeduction
      ? "Incremento proporcional por mayores percepciones gravadas o reestructuración de crédito."
      : "Incremento por ajuste de tabulador, horas adicionales o acreditación retroactiva.",
    laborContext: details?.simple || `Concepto catalogado como ${descriptor}.`,
    recommendedAction: isDeduction
      ? "Si el descuento subió sin causa clara, consulta en Personal el detalle de las unidades o cuotas."
      : "Confirma que el incremento corresponda a tus percepciones devengadas.",
  }
}
