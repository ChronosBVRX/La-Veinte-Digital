/**
 * Contenido educativo curado para los conceptos prioritarios de la Guía de mi Tarjetón.
 *
 * - `simple`: "En palabras simples" (capa Fácil).
 * - `whyItMatters`: "¿Por qué debería importarme?" (capa Fácil).
 * - `whyItAppears`: "¿Por qué aparece?" (capa Detallado).
 * - `whenItAppears`: "¿Cuándo debería aparecer?" (capa Detallado).
 * - `affects`: "¿Qué puede hacer que no lo genere?" (solo condiciones documentadas).
 * - `related`: relaciones navegables respaldadas (códigos de concepto o ids de campo `field:N`).
 * - `calculator`: vínculo opcional a un simulador existente (nunca fórmulas nuevas).
 * - `sources`: ids de `guideSources` (conceptDetails solo referencia, no normativa vigente).
 *
 * Este archivo es CONTENIDO educacional: las cantidades y fórmulas vigentes viven en los
 * motores de La Veinte (nominas/calculadores). Nunca colocar fórmulas de producción aquí.
 */
import type { GuideConceptRef } from "@/features/tarjeton-guia/lib/types"

export interface GuideDetailContent {
  simple: string
  whyItMatters?: string
  whyItAppears?: string
  whenItAppears?: string
  affects?: string[]
  related?: Array<{ ref: GuideConceptRef; label: string; why?: string }>
  calculator?: { route: string; label: string }
  sources?: string[]
}

/** Contenido curado por código de concepto (3 dígitos). */
export const conceptDetails: Record<string, GuideDetailContent> = {
  // ------------------------------------------------------------------ PERCEPCIONES
  "002": {
    simple: "Es el pago base que recibes cada quincena por tu categoría y jornada. Casi todas las demás prestaciones se calculan a partir de este sueldo.",
    whyItMatters: "Es la cifra más importante de tu tarjetón: de ella dependen tu ayuda de renta, tu aguinaldo, tus vacaciones y muchos descuentos.",
    whyItAppears: "Es tu sueldo tabular: el monto fijo que corresponde a tu categoría dentro del Tabulador de Sueldos del CCT, pagado por quincena.",
    whenItAppears: "Debe aparecer en todas tus quincenas. Si no aparece, conviene revisar la quincena de incidencia y tu situación laboral.",
    affects: ["Incidencia (faltas, retardos, licencias sin sueldo)", "Periodo de pago incompleto"],
    related: [
      { ref: "concept:011", label: "Ayuda de renta", why: "Se calcula sobre tu sueldo base" },
      { ref: "concept:022", label: "Ayuda de renta por antigüedad" },
      { ref: "concept:029", label: "Prima vacacional" },
      { ref: "concept:049", label: "Aguinaldo" },
      { ref: "concept:151", label: "Impuesto sobre la renta (ISR)" },
      { ref: "field:57", label: "Sueldo mensual integrado" },
    ],
    sources: ["manual-imss-2023"],
  },
  "011": {
    simple: "Es una ayuda mensual equivalente a un porcentaje del concepto 002 (sueldo base), establecida en la cláusula 63 Bis de la contratación colectiva.",
    whyItMatters: "Normalmente es, después de tu sueldo, el ingreso más alto de tu quincena.",
    whyItAppears: "El IMSS paga esta prestación a los trabajadores que cumplen los requisitos de la cláusula 63 Bis, inciso b.",
    whenItAppears: "Aparece quincenalmente como percepción recurrente. Puede variar si cambia tu categoría o jornada.",
    related: [
      { ref: "concept:002", label: "Sueldo base", why: "Es la base de cálculo de esta ayuda" },
      { ref: "concept:020", label: "Ayuda de renta (otra variante)" },
      { ref: "concept:022", label: "Ayuda de renta por antigüedad" },
    ],
    sources: ["manual-imss-2023", "cct-2023-2025-mentioned"],
  },
  "012": {
    simple: "Es un pago adicional por tener jornada discontinua: cuando tu jornada laboral se divide en dos partes, te corresponde un sobresueldo.",
    whyItMatters: "Es un ingreso extra que refleja las condiciones especiales de tu jornada.",
    whyItAppears: "El IMSS la paga a trabajadores cuya jornada se interrumpe, conforme a la normatividad de jornadas discontinuas.",
    whenItAppears: "Aparece en las quincenas donde tu jornada continua siendo discontinua. Cambia al modificar tu jornada de trabajo.",
    related: [
      { ref: "concept:002", label: "Sueldo base", why: "Base de la proyección de tu jornada" },
      { ref: "concept:013", label: "Sobresueldo médico" },
    ],
    sources: ["manual-imss-2023"],
  },
  "020": {
    simple: "Es una ayuda de renta que el IMSS paga a trabajadores de ciertas categorías, con un importe fijo establecido en su normativa.",
    whyItMatters: "Es un ingreso recurrente que conviene identificar: se abona cada quincena en las categorías que la tienen asignada.",
    whyItAppears: "El pago corresponde a los trabajadores incluidos en las disposiciones de la ayuda de renta con importe fijo.",
    whenItAppears: "Aparece quincenalmente mientras tu categoría la tenga asignada.",
    related: [
      { ref: "concept:011", label: "Ayuda de renta (sobre sueldo)", why: "Otra modalidad de la misma prestación" },
      { ref: "concept:022", label: "Ayuda de renta por antigüedad" },
    ],
    sources: ["manual-imss-2023", "cct-2023-2025-mentioned"],
  },
  "022": {
    simple: "Es una ayuda de renta adicional que depende de tu antigüedad: entre más años de servicio, mayor es el factor que se te paga.",
    whyItMatters: "Es la forma en que tu antigüedad se refleja directamente en tu bolsillo.",
    whyItAppears: "El IMSS paga esta ayuda a los trabajadores conforme a la tabla de antigüedad de la cláusula 63 Bis, inciso c.",
    whenItAppears: "Aparece de forma periódica y su importe crece según los años de servicios acreditados.",
    affects: ["Antigüedad efectiva no actualizada"],
    related: [
      { ref: "field:13", label: "Antigüedad efectiva", why: "Es el dato del que depende esta ayuda" },
      { ref: "concept:002", label: "Sueldo base" },
      { ref: "concept:011", label: "Ayuda de renta" },
    ],
    sources: ["manual-imss-2023", "cct-2023-2025-mentioned"],
  },
  "025": {
    simple: "Es el pago supletorio de guardería: cubre el servicio de guardería cuando por alguna razón el IMSS no puede otorgarlo directamente.",
    whyItMatters: "Si tienes derecho a guardería y aparece este concepto, es porque el servicio se cubrió de forma supletoria.",
    whyItAppears: "Se genera en los periodos en que el derecho a guardería se cubre mediante pago en lugar del servicio.",
    whenItAppears: "Aparece únicamente en los periodos donde corresponde el pago supletorio.",
    related: [{ ref: "concept:039", label: "Bonificación de guarderías", why: "Concepto relacionado con servicios de guardería" }],
    sources: ["manual-imss-2023"],
  },
  "026": {
    simple: "Es una compensación fija por pasajes: el IMSS paga una cantidad para apoyar el transporte de los trabajadores.",
    whyItMatters: "Es un ingreso fijo que puedes esperar en tus quincenas.",
    whyItAppears: "Se paga a los trabajadores que tienen asignada la compensación por pasajes.",
    whenItAppears: "Aparece quincenalmente mientras mantengas el derecho a la compensación.",
    related: [{ ref: "concept:027", label: "Compensación de pasajes", why: "Modalidad relacionada" }],
    sources: ["manual-imss-2023"],
  },
  "027": {
    simple: "Es una compensación por pasajes que se ajusta según las condiciones del servicio o traslado.",
    whyItMatters: "Conviene revisarla cuando varíe tu adscripción o tu servicio, porque el importe puede cambiar.",
    whyItAppears: "Se genera en los periodos donde corresponde la compensación ajustada de pasajes.",
    whenItAppears: "Aparece en las quincenas donde corresponde según tus condiciones de trabajo.",
    related: [{ ref: "concept:026", label: "Pasajes fijos", why: "Modalidad fija de la misma prestación" }],
    sources: ["manual-imss-2023"],
  },
  "029": {
    simple: "Es el pago por tus vacaciones: un porcentaje adicional que se te paga cuando disfrutas tu periodo vacacional.",
    whyItMatters: "Es una prestación que se suma a tu sueldo en el periodo donde tomas tus vacaciones (disfrutadas o pagadas en efectivo).",
    whyItAppears: "El IMSS paga la prima vacacional cuando se disfrutan los días de vacaciones.",
    whenItAppears: "Aparece en la quincena en que disfrutas vacaciones o cuando se pagan en efectivo.",
    affects: ["Quincena de incidencia de tus vacaciones"],
    related: [
      { ref: "field:13", label: "Antigüedad efectiva", why: "Define los días de vacaciones a los que tienes derecho" },
      { ref: "field:45", label: "Vacaciones disfrutadas" },
      { ref: "concept:038", label: "Pago en efectivo de vacaciones" },
      { ref: "concept:049", label: "Aguinaldo" },
    ],
    calculator: { route: "/vacaciones", label: "Calcular mis vacaciones" },
    sources: ["manual-imss-2023", "cct-2023-2025-mentioned"],
  },
  "030": {
    simple: "Es un porcentaje extra que se paga cuando trabajas en domingo.",
    whyItMatters: "Es una compensación directa por los domingos laborados.",
    whyItAppears: "Se genera en las quincenas en las que laboraste días domingo conforme a tu jornada.",
    whenItAppears: "Aparece en los periodos donde tu jornada incluye trabajo en domingo.",
    related: [{ ref: "concept:002", label: "Sueldo base", why: "Se calcula sobre tu sueldo" }],
    sources: ["manual-imss-2023"],
  },
  "031": {
    simple: "Es una compensación por cambio de lugar de adscripción: apoya los gastos cuando te trasladan temporal o definitivamente.",
    whyItMatters: "Aparece en periodos específicos, no es recurrente. Si cambiaste de adscripción, identifícalo.",
    whyItAppears: "Se paga cuando el trabajador es cambiado de lugar de adscripción.",
    whenItAppears: "Aparece en la quincena donde corresponde el cambio de lugar.",
    related: [{ ref: "field:8", label: "Nombre de adscripción", why: "Tu adscripción actual se refleja en el receptor" }],
    sources: ["manual-imss-2023"],
  },
  "032": {
    simple: "Es un estímulo económico por tener asistencia perfecta: se paga por días de asistencia sin faltas.",
    whyItMatters: "Es un ingreso adicional que depende de tu puntualidad y asistencia del periodo anterior.",
    whyItAppears: "El IMSS premia la asistencia con un estímulo pagado por los días asistidos.",
    whenItAppears: "Aparece cuando se registra el número de días de asistencia requeridos en la quincena de incidencia.",
    affects: ["Faltas o retardos en el periodo", "Licencias, becas o comisiones sin goce de sueldo"],
    related: [
      { ref: "concept:033", label: "Estímulo por puntualidad", why: "Comparte condiciones y matriz de incidencias" },
      { ref: "field:23", label: "Sin retardo" },
      { ref: "field:24", label: "Asiduidad" },
      { ref: "field:30", label: "Quincena de incidencia" },
    ],
    sources: ["manual-imss-2023"],
  },
  "033": {
    simple: "Es un estímulo por llegadas puntuales: se paga cuando no tienes retardos en el periodo que se evalúa.",
    whyItMatters: "Es un ingreso que cambia según tu asistencia: entenderlo te ayuda a saber por qué aparece o deja de aparecer.",
    whyItAppears: "El IMSS premia la puntualidad con un estímulo por los días sin retardo.",
    whenItAppears: "Aparece cuando no se registran retardos en la quincena de incidencia. La asistencia se evalúa con un desfase: la incidencia de un periodo puede reflejarse en el pago del siguiente.",
    affects: ["Retardos registrados", "Faltas injustificadas", "Licencias sin goce de sueldo"],
    related: [
      { ref: "concept:032", label: "Estímulo por asistencia", why: "Comparte matriz de incidencias" },
      { ref: "field:20", label: "Retardos" },
      { ref: "field:39", label: "Días concepto 033" },
      { ref: "field:30", label: "Quincena de incidencia" },
    ],
    sources: ["manual-imss-2023"],
  },
  "037": {
    simple: "Es el pago de las horas extra que trabajaste más allá de tu jornada ordinaria.",
    whyItMatters: "Es un ingreso variable: su importe depende de las horas autorizadas y del tipo de día en que se trabajaron.",
    whyItAppears: "Se genera cuando hay horas extraordinarias autorizadas.",
    whenItAppears: "Aparece en la quincena donde se registran las horas extra. Si trabajaste horas extra y no aparece, revisa la autorización.",
    affects: ["Horas extra no autorizadas"],
    related: [{ ref: "concept:002", label: "Sueldo base", why: "Es la base de cálculo de las horas extra" }],
    calculator: { route: "/calculadoras/tiempo-extra", label: "Calcular mi tiempo extra" },
    sources: ["manual-imss-2023", "cct-2023-2025-mentioned"],
  },
  "038": {
    simple: "Es el pago de tus vacaciones cuando no las disfrutas como descanso y se te pagan en efectivo.",
    whyItMatters: "Si dejaste vencer días de vacaciones o solicitaste su pago, este concepto lo refleja.",
    whyItAppears: "Se paga cuando los días de vacaciones correspondientes se liquidan en efectivo.",
    whenItAppears: "Aparece en la quincena donde se autoriza el pago en efectivo de vacaciones.",
    related: [
      { ref: "concept:029", label: "Prima vacacional", why: "Se paga junto con los días de vacaciones" },
      { ref: "field:47", label: "Periodos vacacionales vencidos" },
    ],
    calculator: { route: "/vacaciones", label: "Consultar mis vacaciones" },
    sources: ["manual-imss-2023"],
  },
  "039": {
    simple: "Es una bonificación relacionada con el servicio de guarderías.",
    whyItMatters: "Es un ingreso adicional ligado a los servicios de guardería del IMSS.",
    whyItAppears: "Se paga en los periodos donde corresponde la bonificación por servicios de guardería.",
    whenItAppears: "Aparece en los periodos donde corresponde según tu situación.",
    related: [{ ref: "concept:025", label: "Pago supletorio de guardería", why: "Concepto relacionado con guarderías" }],
    sources: ["manual-imss-2023"],
  },
  "040": {
    simple: "Es una bonificación por el seguro médico.",
    whyItMatters: "Es un ingreso que reconoce tu permanencia en el seguro médico.",
    whyItAppears: "Se paga en los periodos donde corresponde la bonificación de seguro médico.",
    whenItAppears: "Aparece en las quincenas donde corresponde según las condiciones del trabajador.",
    related: [{ ref: "concept:039", label: "Bonificación de guarderías", why: "Otras bonificaciones del IMSS" }],
    sources: ["manual-imss-2023"],
  },
  "042": {
    simple: "Es un anticipo de sueldo: una parte de tu sueldo que se adelanta antes de la quincena.",
    whyItMatters: "Conviene revisar estos conceptos: el anticipo que hoy recibes como percepción, después aparece como descuento.",
    whyItAppears: "Se paga cuando solicitas un anticipo de tu sueldo.",
    whenItAppears: "Aparece en la quincena donde se otorga el anticipo, y su recuperación se registra después.",
    related: [
      { ref: "concept:169", label: "Recuperación de vale a cuenta de sueldo", why: "Descuento relacionado con anticipos" },
      { ref: "concept:043", label: "Vale a cuenta de aguinaldo" },
    ],
    sources: ["manual-imss-2023"],
  },
  "043": {
    simple: "Es un vale a cuenta de aguinaldo: un adelanto del aguinaldo que se descuenta después.",
    whyItMatters: "Si lo solicitas, tu aguinaldo de fin de año llega reducido por la recuperación del vale.",
    whyItAppears: "Se otorga como anticipo de la prestación de aguinaldo.",
    whenItAppears: "Aparece cuando solicitas el vale, y su recuperación se descuenta en quincenas posteriores.",
    related: [
      { ref: "concept:049", label: "Aguinaldo", why: "El vale se descuenta del aguinaldo" },
      { ref: "concept:047", label: "Anticipo de aguinaldo" },
    ],
    calculator: { route: "/calculadoras/clausula-97", label: "Calcular la recuperación Cl. 97" },
    sources: ["manual-imss-2023", "cct-2023-2025-mentioned"],
  },
  "044": {
    simple: "Es una ayuda para refrigerio.",
    whyItMatters: "Es un ingreso adicional ligado a la jornada de los trabajadores que la tienen asignada.",
    whyItAppears: "Se paga a los trabajadores con derecho a la ayuda para refrigerio.",
    whenItAppears: "Aparece quincenalmente mientras tengas asignado el concepto.",
    related: [{ ref: "concept:050", label: "Ayuda para despensa", why: "Otras ayudas fijas" }],
    sources: ["manual-imss-2023"],
  },
  "047": {
    simple: "Es un anticipo del aguinaldo, similar al vale pero con otra forma de recuperación.",
    whyItMatters: "Si lo solicitas, se recupera en quincenas posteriores: debes esperar descuentos asociados.",
    whyItAppears: "Se otorga como anticipo de la prestación de aguinaldo.",
    whenItAppears: "Aparece cuando se autoriza el anticipo.",
    related: [
      { ref: "concept:043", label: "Vale a cuenta de aguinaldo", why: "Forma alternativa de adelanto" },
      { ref: "concept:049", label: "Aguinaldo" },
    ],
    calculator: { route: "/calculadoras/clausula-97", label: "Calcular la recuperación Cl. 97" },
    sources: ["manual-imss-2023", "cct-2023-2025-mentioned"],
  },
  "048": {
    simple: "Es una ayuda para actividades culturales y recreativas.",
    whyItMatters: "Es un beneficio social que el IMSS otorga a los trabajadores.",
    whyItAppears: "Se paga en el periodo donde corresponde la ayuda de actividades culturales y recreativas.",
    whenItAppears: "Aparece en la quincena donde corresponde según tu antigüedad y los días asignados.",
    related: [
      { ref: "field:13", label: "Antigüedad efectiva", why: "Los días asignados dependen de la antigüedad" },
      { ref: "concept:049", label: "Aguinaldo" },
    ],
    sources: ["manual-imss-2023"],
  },
  "049": {
    simple: "Es tu aguinaldo: la prestación anual obligatoria que se paga a final de año.",
    whyItMatters: "Es una de las prestaciones más esperadas del año; su importe depende de tu sueldo y de los días trabajados.",
    whyItAppears: "Se paga en la quincena de aguinaldo conforme a la normatividad y al CCT.",
    whenItAppears: "Aparece en la quincena donde se cubre la prestación. Puede llegar en más de un pago.",
    affects: ["Vales o anticipos de aguinaldo solicitados durante el año"],
    related: [
      { ref: "concept:002", label: "Sueldo base", why: "Base del cálculo del aguinaldo" },
      { ref: "concept:043", label: "Vale a cuenta de aguinaldo", why: "Recuperación descontada del aguinaldo" },
      { ref: "concept:047", label: "Anticipo de aguinaldo" },
    ],
    calculator: { route: "/calculadoras/aguinaldo", label: "Calcular mi aguinaldo" },
    sources: ["manual-imss-2023", "cct-2023-2025-mentioned"],
  },
  "050": {
    simple: "Es la ayuda para despensa: una prestación que se paga quincenalmente a los trabajadores que la tienen asignada.",
    whyItMatters: "Es un ingreso recurrente y fijo que conviene identificar en tu tarjetón.",
    whyItAppears: "Se paga a los trabajadores con derecho a la ayuda para despensa.",
    whenItAppears: "Aparece quincenalmente mientras tengas asignado el concepto.",
    related: [{ ref: "concept:044", label: "Ayuda para refrigerio", why: "Otras ayudas fijas" }],
    sources: ["manual-imss-2023"],
  },
  "052": {
    simple: "Son las notas de mérito: un reconocimiento económico o registral por desempeño sobresaliente.",
    whyItMatters: "Es un reconocimiento que conviene conservar: puede influir en tu expediente.",
    whyItAppears: "Se otorga cuando se emite una nota de mérito a tu favor.",
    whenItAppears: "Aparece en la quincena donde se registra la nota.",
    related: [{ ref: "field:28", label: "Notas de mérito (casos)", why: "Se refleja en el receptor" }],
    sources: ["manual-imss-2023"],
  },
  "053": {
    simple: "Es una percepción relacionada con tu fondo de retiro.",
    whyItMatters: "Es parte del ahorro para tu retiro; conviene saber cuánto se acumula.",
    whyItAppears: "Se registra como percepción en los periodos donde corresponde.",
    whenItAppears: "Aparece en los periodos donde corresponde según disposiciones del fondo.",
    related: [
      { ref: "concept:107", label: "Provisión fondo de jubilación", why: "Concepto de deducción vinculado" },
      { ref: "concept:108", label: "Provisión RJP" },
    ],
    sources: ["manual-imss-2023"],
  },
  "055": {
    simple: "Es una percepción de fondo de ahorro: junto con la deducción equivalente, forma tu ahorro.",
    whyItMatters: "Se paga periódicamente (por ejemplo en julio): es ahorro tuyo que después puedes retirar.",
    whyItAppears: "Se registra como aportación al fondo de ahorro en el periodo establecido.",
    whenItAppears: "Aparece en los periodos donde se paga el fondo de ahorro.",
    related: [{ ref: "concept:055", label: "Deducción de fondo de ahorro", why: "Aportación y descuento van de la mano" }],
    sources: ["manual-imss-2023"],
  },
  "058": {
    simple: "Es un sobresueldo por actividades de docencia y enfermería.",
    whyItMatters: "Es un ingreso adicional ligado a las funciones docentes o de enfermería.",
    whyItAppears: "Se paga a los trabajadores que desempeñan funciones de docencia o enfermería.",
    whenItAppears: "Aparece en las quincenas donde se desempeña la función.",
    related: [{ ref: "concept:002", label: "Sueldo base", why: "Base de los sobresueldos" }],
    sources: ["manual-imss-2023"],
  },
  "070": {
    simple: "Es la devolución de ISPT: cuando se te retuvo impuesto de más, se te devuelve.",
    whyItMatters: "Es un ajuste a tu favor: significa que la retención anterior se corrigió.",
    whyItAppears: "Se genera cuando el cálculo del impuesto resulta en una devolución a tu favor.",
    whenItAppears: "Aparece en la quincena donde se aplica el ajuste de impuestos.",
    related: [{ ref: "concept:151", label: "Impuesto sobre la renta (ISR)", why: "Retención vinculada" }],
    sources: ["manual-imss-2023"],
  },
  "084": {
    simple: "Es un estímulo por calidad y eficiencia.",
    whyItMatters: "Es un reconocimiento económico por el desempeño evaluado.",
    whyItAppears: "Se paga cuando se acredita el estímulo de calidad y eficiencia.",
    whenItAppears: "Aparece en la quincena donde se otorga el estímulo.",
    related: [{ ref: "concept:052", label: "Notas de mérito", why: "Otros reconocimientos" }],
    sources: ["manual-imss-2023"],
  },

  // ------------------------------------------------------------------ DEDUCCIONES
  "107": {
    simple: "Es la aportación complementaria a tu fondo de jubilación, además de la aportación base.",
    whyItMatters: "Es parte de tu ahorro para el retiro: la aportación crece con el tiempo.",
    whyItAppears: "Se descuenta a los trabajadores de nuevo ingreso conforme al convenio adicional de jubilaciones.",
    whenItAppears: "Aparece quincenalmente como descuento.",
    related: [
      { ref: "concept:152", label: "Fondo de jubilación", why: "Aportación base del fondo" },
      { ref: "concept:108", label: "Provisión RJP" },
    ],
    sources: ["manual-imss-2023"],
  },
  "108": {
    simple: "Es la provisión del Régimen de Jubilaciones y Pensiones (RJP) para trabajadores incorporados entre 2005 y 2008.",
    whyItMatters: "Define las condiciones de tu jubilación: edad y años de servicio requeridos.",
    whyItAppears: "Se descuenta a los trabajadores base de nuevo ingreso comprendidos en la fecha de incorporación del esquema.",
    whenItAppears: "Aparece quincenalmente como descuento.",
    related: [
      { ref: "concept:107", label: "Provisión fondo de jubilación" },
      { ref: "concept:152", label: "Fondo de jubilación" },
    ],
    sources: ["manual-imss-2023"],
  },
  "111": {
    simple: "Es la aportación complementaria a tu Afore.",
    whyItMatters: "Es parte de tu ahorro para el retiro administrado en tu cuenta Afore.",
    whyItAppears: "Se descuenta conforme a las disposiciones vigentes del ahorro complementario.",
    whenItAppears: "Aparece quincenalmente como descuento.",
    related: [{ ref: "concept:107", label: "Provisión fondo de jubilación" }],
    sources: ["manual-imss-2023"],
  },
  "113": {
    simple: "Es la aportación al seguro de guarderías.",
    whyItMatters: "Es un descuento ligado al derecho de guardería.",
    whyItAppears: "Se descuenta en los periodos donde corresponde la aportación al seguro.",
    whenItAppears: "Aparece mientras esté vigente la aportación al seguro de guarderías.",
    related: [{ ref: "concept:039", label: "Bonificación de guarderías" }],
    sources: ["manual-imss-2023"],
  },
  "129": {
    simple: "Es el descuento por licencia sin sueldo mayor a 3 días.",
    whyItMatters: "Cuando tomas una licencia sin goce de sueldo, se descuentan los días correspondientes.",
    whyItAppears: "Se genera cuando se autoriza una licencia sin sueldo mayor a 3 días.",
    whenItAppears: "Aparece en la quincena donde se aplica la licencia.",
    related: [
      { ref: "concept:171", label: "Licencia sin sueldo menor a 4 días", why: "Duración distinta de la misma incidencia" },
      { ref: "field:35", label: "Licencia sin sueldo" },
    ],
    sources: ["manual-imss-2023"],
  },
  "151": {
    simple: "Es el Impuesto Sobre la Renta (ISR): la retención que el patrón hace de tu sueldo por concepto de impuestos.",
    whyItMatters: "Es normalmente el descuento más grande de tu tarjetón: entenderlo evita sorpresas.",
    whyItAppears: "El IMSS, como patrón, está obligado a retener el ISR de tus percepciones gravadas.",
    whenItAppears: "Aparece cada quincena cuando tus percepciones superan el monto exento.",
    affects: ["Percepciones gravadas del periodo", "Tabulador de impuestos vigente"],
    related: [
      { ref: "concept:002", label: "Sueldo base", why: "Base de la retención" },
      { ref: "concept:070", label: "Devoluciones ISPT", why: "Ajuste cuando la retención fue de más" },
      { ref: "concept:153", label: "Descuento complementario ISR", why: "Ajuste de periodos anteriores" },
    ],
    sources: ["manual-imss-2023"],
  },
  "152": {
    simple: "Es la aportación base a tu fondo de jubilación.",
    whyItMatters: "Es parte de tu ahorro para el retiro: conviene conocer cuánto se te descuenta por este fondo.",
    whyItAppears: "Se descuenta a los trabajadores de base conforme al convenio de jubilaciones.",
    whenItAppears: "Aparece quincenalmente como descuento.",
    related: [
      { ref: "concept:107", label: "Provisión fondo de jubilación", why: "Aportación complementaria" },
      { ref: "concept:108", label: "Provisión RJP" },
    ],
    sources: ["manual-imss-2023"],
  },
  "153": {
    simple: "Es un descuento complementario de ISR del año anterior: corrige la retención cuando el cálculo anual resulta en un faltante.",
    whyItMatters: "Aparece como ajuste anual: no es un cargo nuevo, es la regularización de tu impuesto.",
    whyItAppears: "Se genera al regularizar la retención anual de impuestos.",
    whenItAppears: "Aparece en el periodo donde se aplica la regularización anual.",
    related: [
      { ref: "concept:151", label: "Impuesto sobre la renta (ISR)" },
      { ref: "concept:070", label: "Devoluciones ISPT", why: "Ajuste inverso a tu favor" },
    ],
    sources: ["manual-imss-2023"],
  },
  "154": {
    simple: "Es el descuento del crédito INFONAVIT: el pago mensual de tu crédito de vivienda.",
    whyItMatters: "Es un descuento recurrente mientras dure el crédito; su saldo se refleja en las observaciones.",
    whyItAppears: "Se descuenta cuando tienes un crédito INFONAVIT activo.",
    whenItAppears: "Aparece quincenalmente mientras tu crédito esté vigente.",
    related: [
      { ref: "field:56", label: "Crédito INFONAVIT", why: "Dato de tu tarjetón" },
      { ref: "field:59", label: "Marca de crédito" },
      { ref: "field:74", label: "Unidades (observaciones)", why: "Las unidades registran el avance del crédito" },
    ],
    sources: ["manual-imss-2023"],
  },
  "155": {
    simple: "Es un descuento por disposición judicial, como una pensión alimenticia dictada por un juez.",
    whyItMatters: "Es un descuento obligatorio: se aplica solo si existe una orden judicial.",
    whyItAppears: "Se retiene conforme a una disposición judicial notificada al IMSS.",
    whenItAppears: "Aparece mientras esté vigente la disposición judicial.",
    related: [{ ref: "field:77", label: "Observaciones", why: "Puede detallar el cargo" }],
    sources: ["manual-imss-2023"],
  },
  "156": {
    simple: "Es un descuento por viáticos no comprobados.",
    whyItMatters: "Cuando recibes viáticos y no compruebas su uso, se recupera el importe.",
    whyItAppears: "Se genera cuando los viáticos entregados no se comprueban.",
    whenItAppears: "Aparece en la quincena donde se realiza la recuperación.",
    related: [{ ref: "field:77", label: "Observaciones" }],
    sources: ["manual-imss-2023"],
  },
  "160": {
    simple: "Es la recuperación de la cláusula 97 del CCT: descuentos relacionados con vale o anticipo de aguinaldo.",
    whyItMatters: "Aparece en los periodos siguientes a recibir un vale: es la recuperación del adelanto.",
    whyItAppears: "Se descuenta para recuperar los vales o anticipos otorgados conforme a la cláusula 97.",
    whenItAppears: "Aparece en las quincenas donde se programó la recuperación.",
    related: [
      { ref: "concept:043", label: "Vale a cuenta de aguinaldo", why: "El descuento recupera este adelanto" },
      { ref: "concept:047", label: "Anticipo de aguinaldo" },
    ],
    calculator: { route: "/calculadoras/clausula-97", label: "Calcular la recuperación Cl. 97" },
    sources: ["manual-imss-2023", "cct-2023-2025-mentioned"],
  },
  "161": {
    simple: "Es un descuento por suspensión temporal de la relación laboral.",
    whyItMatters: "Aparece en periodos donde hubo una suspensión: conviene revisar la causa.",
    whyItAppears: "Se genera cuando se aplica una suspensión temporal.",
    whenItAppears: "Aparece en la quincena donde se aplica la suspensión.",
    related: [{ ref: "concept:164", label: "Suspensión sindical", why: "Suspensión por causas sindicales" }],
    sources: ["manual-imss-2023"],
  },
  "162": {
    simple: "Es un descuento por responsabilidad sobre instrumentos de trabajo.",
    whyItMatters: "Aparece cuando se determina responsabilidad sobre herramientas o instrumentos.",
    whyItAppears: "Se descuenta conforme a la determinación de responsabilidad.",
    whenItAppears: "Aparece en la quincena donde se aplica la recuperación.",
    related: [{ ref: "field:77", label: "Observaciones", why: "Puede detallar el cargo" }],
    sources: ["manual-imss-2023"],
  },
  "164": {
    simple: "Es un descuento por suspensión sindical.",
    whyItMatters: "Aparece en periodos donde se aplicó una suspensión de carácter sindical.",
    whyItAppears: "Se genera conforme a la determinación sindical correspondiente.",
    whenItAppears: "Aparece en la quincena donde se aplica la suspensión.",
    related: [{ ref: "concept:161", label: "Suspensión temporal", why: "Tipo de suspensión" }],
    sources: ["manual-imss-2023"],
  },
  "169": {
    simple: "Es la recuperación de los vales a cuenta de sueldo.",
    whyItMatters: "Si recibiste un vale a cuenta de sueldo, este descuento lo recupera.",
    whyItAppears: "Se descuenta para recuperar anticipos otorgados a cuenta de sueldo.",
    whenItAppears: "Aparece en las quincenas donde se programó la recuperación.",
    related: [
      { ref: "concept:042", label: "Anticipo de sueldo", why: "El descuento recupera este adelanto" },
      { ref: "field:76", label: "Cargo inicial (observaciones)", why: "Registra el monto original" },
    ],
    sources: ["manual-imss-2023"],
  },
  "170": {
    simple: "Es el descuento de crédito FONACOT.",
    whyItMatters: "Es un descuento recurrente mientras pagues tu crédito FONACOT.",
    whyItAppears: "Se descuenta cuando tienes un crédito FONACOT activo.",
    whenItAppears: "Aparece quincenalmente mientras tu crédito esté vigente.",
    related: [
      { ref: "field:56", label: "Crédito INFONAVIT", why: "Otros créditos con descuento quincenal" },
      { ref: "field:73", label: "Vencimiento (observaciones)", why: "Fecha de fin del descuento" },
    ],
    sources: ["manual-imss-2023"],
  },
  "171": {
    simple: "Es el descuento de licencias sin sueldo menores a 4 días.",
    whyItMatters: "Cuando tomas una licencia sin goce de sueldo corta, se descuentan los días.",
    whyItAppears: "Se genera cuando se autoriza una licencia sin sueldo menor a 4 días.",
    whenItAppears: "Aparece en la quincena donde se aplica la licencia.",
    related: [
      { ref: "concept:129", label: "Licencia sin sueldo mayor a 3 días", why: "Misma incidencia con mayor duración" },
      { ref: "field:35", label: "Licencia sin sueldo" },
    ],
    sources: ["manual-imss-2023"],
  },
  "172": {
    simple: "Es la deducción por falta injustificada.",
    whyItMatters: "Las faltas injustificadas se descuentan de tu sueldo además de afectar estímulos como 032 y 033.",
    whyItAppears: "Se genera cuando se registra una falta sin justificación.",
    whenItAppears: "Aparece en la quincena donde se aplica la falta.",
    affects: ["Falta justificada correctamente (con la documentación correspondiente)"],
    related: [
      { ref: "field:22", label: "Faltas", why: "Se registra en el receptor" },
      { ref: "concept:032", label: "Estímulo por asistencia", why: "Las faltas afectan este estímulo" },
      { ref: "concept:033", label: "Estímulo por puntualidad" },
    ],
    sources: ["manual-imss-2023"],
  },
  "173": {
    simple: "Es la deducción por pases de salida.",
    whyItMatters: "Cuando sales del trabajo con pase autorizado (o no autorizado), los pases se descuentan o afectan estímulos.",
    whyItAppears: "Se genera cuando se registran pases de salida.",
    whenItAppears: "Aparece en la quincena donde se aplica.",
    related: [
      { ref: "field:21", label: "Pases de salida", why: "Se registra en el receptor" },
      { ref: "concept:033", label: "Estímulo por puntualidad", why: "Los pases pueden afectar el estímulo" },
    ],
    sources: ["manual-imss-2023"],
  },
  "122": {
    simple: "Es el descuento del crédito de trabajadores de confianza.",
    whyItMatters: "Es un descuento recurrente mientras pagues el crédito.",
    whyItAppears: "Se descuenta cuando tienes un crédito de trabajadores de confianza.",
    whenItAppears: "Aparece quincenalmente mientras el crédito esté vigente.",
    related: [{ ref: "field:77", label: "Observaciones", why: "Puede detallar el saldo y el vencimiento" }],
    sources: ["manual-imss-2023"],
  },
  "109": {
    simple: "Es la prima de seguro de daños de vivienda INFONAVIT.",
    whyItMatters: "Está ligada a tu crédito INFONAVIT: protege tu vivienda.",
    whyItAppears: "Se descuenta cuando tienes un crédito INFONAVIT vigente.",
    whenItAppears: "Aparece quincenalmente mientras esté vigente.",
    related: [
      { ref: "concept:154", label: "Descuento crédito INFONAVIT", why: "Ambos dependen de tu crédito" },
      { ref: "field:56", label: "Crédito INFONAVIT" },
    ],
    sources: ["manual-imss-2023"],
  },
}