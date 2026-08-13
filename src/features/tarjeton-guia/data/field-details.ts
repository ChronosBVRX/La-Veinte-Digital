/**
 * Contenido educativo curado para los campos principales del tarjetón.
 *
 * Los campos sin entrada curada se muestran con el estado "información
 * insuficiente". `sources` solo referencia documentos oficiales IMSS/CCT
 * confirmados a nivel documento; `verification` indica el estado normativo
 * (`verified` / `partially_verified` / `pending_verification`). No se citan
 * cláusulas o artículos no confirmados.
 */
import type { VerificationState } from "@/features/tarjeton-guia/lib/types"

export interface GuideFieldDetail {
  simple: string
  whyItMatters?: string
  where?: string
  related?: Array<{ ref: string; label: string; why?: string }>
  calculator?: { route: string; label: string }
  sources?: string[]
  verification?: VerificationState
}

export const fieldDetails: Record<string, GuideFieldDetail> = {
  "1": {
    simple: "Es tu número de matrícula: la clave que el IMSS te asigna para identificarte dentro del Instituto.",
    whyItMatters: "Es tu identificador laboral: aparece en trámites, escritos y consultas.",
    where: "Receptor — Datos del trabajador.",
    sources: [], verification: "pending_verification",
  },
  "2": {
    simple: "Son tus apellidos y nombre, tal como están registrados en el IMSS.",
    whyItMatters: "Conviene verificar que esté escrito correctamente: es el dato que usan para identificarte.",
    where: "Receptor — Datos del trabajador.",
    sources: [], verification: "pending_verification",
  },
  "3": {
    simple: "Es tu Registro Federal de Contribuyentes: la clave que Hacienda usa para identificar a la persona que paga impuestos.",
    whyItMatters: "Es un dato fiscal: aparece en tu tarjetón con fines de retención de impuestos.",
    where: "Receptor — Datos del trabajador.",
    sources: [], verification: "pending_verification",
  },
  "4": {
    simple: "Es tu Clave Única de Registro Poblacional: el identificador que el gobierno usa para cada persona.",
    whyItMatters: "Es único e irrepetible: no existen dos CURP iguales.",
    where: "Receptor — Datos del trabajador.",
    sources: [], verification: "pending_verification",
  },
  "5": {
    simple: "Es tu Número de Seguridad Social: la clave que te identifica en el IMSS.",
    whyItMatters: "Con él te identificas en consultas, certificaciones y servicios del IMSS.",
    where: "Receptor — Datos del trabajador.",
    sources: [], verification: "pending_verification",
  },
  "6": {
    simple: "Describe cómo fuiste contratado: por ejemplo, trabajador de base o de confianza.",
    whyItMatters: "Tu tipo de contratación define derechos y prestaciones distintos.",
    where: "Receptor — Datos del trabajador.",
    sources: ["cct-2025-2027"], verification: "partially_verified",
  },
  "7": {
    simple: "Es la clave de tu adscripción: identifica tu delegación, unidad o dependencia.",
    whyItMatters: "Es un dato de ubicación laboral que aparece en trámites.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-003-030"], verification: "partially_verified",
  },
  "8": {
    simple: "Es el nombre de la dependencia donde prestas tus servicios (por ejemplo, un hospital).",
    whyItMatters: "Es la forma oficial de nombrar tu lugar de trabajo.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-003-030"], verification: "partially_verified",
  },
  "9": {
    simple: "Es la ubicación física del centro de trabajo donde laboras.",
    whyItMatters: "Sirve para ubicar dónde se presta el servicio.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-003-030"], verification: "partially_verified",
  },
  "10": {
    simple: "Es la clave de tu estructura organizacional: la clave departamental donde estás adscrito.",
    whyItMatters: "Sus primeras posiciones identifican tu delegación.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-003-030"], verification: "partially_verified",
  },
  "11": {
    simple: "Es la clave numérica de tu categoría o puesto, según el Tabulador de Sueldos.",
    whyItMatters: "De tu categoría depende tu sueldo base y varias prestaciones.",
    where: "Receptor — Datos del trabajador.",
    sources: ["cct-2025-2027", "tabulador-base-2025-2026"], verification: "partially_verified",
  },
  "12": {
    simple: "Es el nombre de tu categoría o puesto (por ejemplo, Auxiliar de Enfermería).",
    whyItMatters: "Es la forma en la que se identifica tu puesto y tu jornada.",
    where: "Receptor — Datos del trabajador.",
    sources: ["cct-2025-2027", "tabulador-base-2025-2026"], verification: "partially_verified",
  },
  "13": {
    simple: "Es el tiempo efectivo de servicios que el IMSS reconoce que llevas acumulado, contado con años, quincenas y días.",
    whyItMatters: "De tu antigüedad dependen prestaciones como la ayuda de renta por antigüedad, tus vacaciones y algunos estímulos.",
    where: "Receptor — Datos del trabajador.",
    related: [
      { ref: "concept:022", label: "Ayuda de renta por antigüedad" },
      { ref: "concept:048", label: "Actividades culturales y recreativas" },
      { ref: "field:45", label: "Vacaciones disfrutadas" },
      { ref: "field:46", label: "Vacaciones de 20 años o más" },
    ],
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "14": {
    simple: "Es la clave de la plaza que ocupas, tal como la identifica el SIAP.",
    whyItMatters: "La plaza define tu puesto y puede ser definitiva o interina.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-003-030"], verification: "partially_verified",
  },
  "15": {
    simple: "Es la clave que explica por qué ocupas tu plaza: definitiva, interina, temporal, entre otras.",
    whyItMatters: "Si ocupas una plaza de forma no definitiva, conviene conocer tu situación y sus efectos.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-003-030"], verification: "partially_verified",
  },
  "16": {
    simple: "Es la matrícula del trabajador titular de la plaza que estás cubriendo interinamente.",
    whyItMatters: "Solo aparece cuando sustituyes a otra persona en una plaza no definitiva.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-003-030"], verification: "partially_verified",
  },
  "17": {
    simple: "Es la fecha en que termina tu contrato, beca o residencia.",
    whyItMatters: "Si no eres titular de la plaza, esta fecha define la vigencia de tu ocupación.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-003-030"], verification: "partially_verified",
  },
  "18": {
    simple: "Es la institución bancaria donde se deposita tu pago.",
    whyItMatters: "Si cambias de banco o cuenta, verifícalo aquí.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-a03-027"], verification: "partially_verified",
  },
  "19": {
    simple: "Es el número de cuenta donde recibes tu nómina.",
    whyItMatters: "Es un dato sensible: verifica que coincida con la cuenta que registraste.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-a03-027"], verification: "partially_verified",
  },
  "20": {
    simple: "Cuenta los retardos registrados en el periodo.",
    whyItMatters: "Los retardos pueden afectar el estímulo por puntualidad.",
    where: "Receptor — Asistencia.",
    related: [{ ref: "concept:033", label: "Estímulo por puntualidad" }],
    sources: [], verification: "pending_verification",
  },
  "21": {
    simple: "Cuenta los pases de salida del periodo.",
    whyItMatters: "Los pases de salida pueden descontase o afectar estímulos.",
    where: "Receptor — Asistencia.",
    related: [{ ref: "concept:173", label: "Pases de salida (deducción)" }],
    sources: [], verification: "pending_verification",
  },
  "22": {
    simple: "Cuenta las faltas del periodo.",
    whyItMatters: "Las faltas injustificadas se descuentan y pueden cancelar estímulos.",
    where: "Receptor — Asistencia.",
    related: [{ ref: "concept:172", label: "Falta injustificada (deducción)" }],
    sources: [], verification: "pending_verification",
  },
  "23": {
    simple: "Son los días sin retardo del periodo.",
    whyItMatters: "Es uno de los datos que alimentan el estímulo por puntualidad.",
    where: "Receptor — Asistencia.",
    related: [{ ref: "concept:033", label: "Estímulo por puntualidad" }],
    sources: [], verification: "pending_verification",
  },
  "24": {
    simple: "Es tu nivel de asiduidad: la constancia con la que asistes a trabajar.",
    whyItMatters: "Una buena asiduidad mantiene tus estímulos de asistencia y puntualidad.",
    where: "Receptor — Asistencia.",
    related: [{ ref: "concept:032", label: "Estímulo por asistencia" }],
    sources: [], verification: "pending_verification",
  },
  "25": {
    simple: "Registra los días de incapacidad por enfermedad general.",
    whyItMatters: "Las incapacidades son justificadas: no son faltas.",
    where: "Receptor — Incidencias.",
    sources: [], verification: "pending_verification",
  },
  "26": {
    simple: "Registra los días de incapacidad por riesgo de trabajo.",
    whyItMatters: "Estas incapacidades tienen protección especial del IMSS.",
    where: "Receptor — Incidencias.",
    sources: [], verification: "pending_verification",
  },
  "27": {
    simple: "Registra los días de incapacidad por maternidad.",
    whyItMatters: "La incapacidad por maternidad está protegida y pagada por el IMSS.",
    where: "Receptor — Incidencias.",
    sources: [], verification: "pending_verification",
  },
  "30": {
    simple: "Es la quincena en la que ocurrió la incidencia que afecta el pago.",
    whyItMatters: "Un concepto puede generarse por una incidencia de una quincena anterior. Por eso, aunque tu pago sea de esta quincena, la incidencia puede ser de la anterior.",
    where: "Receptor — Incidencias.",
    related: [{ ref: "concept:032", label: "Estímulo por asistencia", why: "Se evalúa con la quincena de incidencia" }],
    sources: [], verification: "pending_verification",
  },
  "31": {
    simple: "Registra tus vales a cuenta de aguinaldo.",
    whyItMatters: "Los vales se recuperan después: este dato te anticipa los descuentos futuros.",
    where: "Receptor — Datos del trabajador.",
    related: [{ ref: "concept:043", label: "Vale a cuenta de aguinaldo" }],
    sources: [], verification: "pending_verification",
  },
  "41": {
    simple: "Es la forma en que recibes tu pago: depósito bancario, cheque u otro medio.",
    whyItMatters: "Verifica que el método sea el que esperas.",
    where: "Receptor — Datos del trabajador.",
    sources: ["proc-1a74-a03-027"], verification: "partially_verified",
  },
  "42": {
    simple: "Es el monto máximo de crédito que el IMSS determina que puedes manejar.",
    whyItMatters: "Aparece en el tarjetón y puede usarse en trámites crediticios.",
    where: "Receptor — Datos del trabajador.",
    sources: [], verification: "pending_verification",
  },
  "43": {
    simple: "Son los días laborados en el año, acumulados hasta tu quincena.",
    whyItMatters: "Se usa para calcular prestaciones anuales como el aguinaldo.",
    where: "Receptor — Datos del trabajador.",
    related: [{ ref: "concept:049", label: "Aguinaldo" }],
    sources: [], verification: "pending_verification",
  },
  "44": {
    simple: "Son los días pagados en esta quincena.",
    whyItMatters: "Si tomaste días sin goce de sueldo, este número baja.",
    where: "Receptor — Datos del trabajador.",
    sources: [], verification: "pending_verification",
  },
  "45": {
    simple: "Son los días de vacaciones que ya disfrutaste.",
    whyItMatters: "Te indica cuánto de tu periodo vacacional ya usaste.",
    where: "Receptor — Vacaciones.",
    calculator: { route: "/vacaciones", label: "Consultar mis vacaciones" },
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "46": {
    simple: "Son los días de vacaciones adicionales por tener 20 años o más de servicio.",
    whyItMatters: "La antigüedad de 20 años o más otorga días extra de vacaciones.",
    where: "Receptor — Vacaciones.",
    related: [{ ref: "field:13", label: "Antigüedad efectiva" }],
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "47": {
    simple: "Son los periodos vacacionales que vencieron sin disfrutarse.",
    whyItMatters: "Los periodos vencidos pueden pagarse en efectivo o perderse según la normativa.",
    where: "Receptor — Vacaciones.",
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "48": {
    simple: "Son los días de vacaciones que te corresponden en el año.",
    whyItMatters: "Es tu derecho anual: el número depende de tu antigüedad.",
    where: "Receptor — Vacaciones.",
    calculator: { route: "/vacaciones", label: "Calcular mis vacaciones" },
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "49": {
    simple: "Es la marca de continuidad de tus vacaciones: indica si disfrutas el periodo de forma continua.",
    whyItMatters: "Una marca de continuidad distinta puede indicar vacaciones fraccionadas.",
    where: "Receptor — Vacaciones.",
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "50": {
    simple: "Son los días de vacaciones que te faltan por disfrutar antes de que venzan.",
    whyItMatters: "Te ayuda a planear: si se acercan a vencer, conviene programarlas.",
    where: "Receptor — Vacaciones.",
    calculator: { route: "/vacaciones", label: "Calcular mis vacaciones" },
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "51": {
    simple: "Es el número de periodo vacacional que te falta por disfrutar.",
    whyItMatters: "Con este dato puedes saber cuántos periodos te quedan pendientes.",
    where: "Receptor — Vacaciones.",
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "53": {
    simple: "Son los días de vacaciones acumulados para tu jubilación.",
    whyItMatters: "Se convierten en días pagados al pensionarte.",
    where: "Receptor — Vacaciones.",
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "54": {
    simple: "Es la fecha programada del inicio de tu primer periodo de vacaciones.",
    whyItMatters: "Es la fecha de tu periodo vigente por disfrutar.",
    where: "Receptor — Vacaciones.",
    calculator: { route: "/vacaciones", label: "Calcular mis vacaciones" },
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "55": {
    simple: "Es la fecha programada del inicio de tu segundo periodo de vacaciones.",
    whyItMatters: "Si tienes dos periodos, aquí se registra el segundo.",
    where: "Receptor — Vacaciones.",
    sources: ["cct-2025-2027", "rit-cct-2025-2027"], verification: "partially_verified",
  },
  "56": {
    simple: "Es el dato de tu crédito INFONAVIT.",
    whyItMatters: "Si tienes crédito, verás el descuento quincenal y su seguimiento.",
    where: "Receptor — Datos del trabajador.",
    related: [{ ref: "concept:154", label: "Descuento crédito INFONAVIT" }],
    sources: ["proc-1a14-003-010"], verification: "partially_verified",
  },
  "57": {
    simple: "Es tu sueldo mensual integrado: el sueldo ordinario más todas las prestaciones que se suman para calcular ciertos pagos.",
    whyItMatters: "Es la base de cálculo de prestaciones como la prima vacacional, la prima dominical y el tiempo extraordinario.",
    where: "Receptor — Datos del trabajador.",
    related: [
      { ref: "concept:029", label: "Prima vacacional", why: "Se calcula sobre el sueldo integrado" },
      { ref: "concept:037", label: "Tiempo extraordinario" },
      { ref: "concept:048", label: "Actividades culturales y recreativas" },
    ],
    sources: [], verification: "pending_verification",
  },
  "58": {
    simple: "Es la fecha en que ingresaste al Instituto.",
    whyItMatters: "Es el punto de partida de tu antigüedad.",
    where: "Receptor — Datos del trabajador.",
    related: [{ ref: "field:13", label: "Antigüedad efectiva", why: "Se cuenta desde esta fecha" }],
    sources: [], verification: "pending_verification",
  },
  "59": {
    simple: "Es la marca de crédito: indica si tienes algún crédito activo.",
    whyItMatters: "Si no la ves, puede que no tengas créditos registrados.",
    where: "Receptor — Datos del trabajador.",
    related: [{ ref: "field:56", label: "Crédito INFONAVIT", why: "Los créditos se marcan aquí" }],
    sources: ["proc-1a14-003-010"], verification: "partially_verified",
  },
  "60": {
    simple: "Es la sección donde se listan tus percepciones: todo lo que recibes.",
    whyItMatters: "Cada percepción tiene un código, una descripción y un importe.",
    where: "Percepciones.",
    related: [{ ref: "field:61", label: "Concepto (percepciones)" }],
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "61": {
    simple: "Es el código de tres dígitos del concepto de percepción (por ejemplo, 002 Sueldo base).",
    whyItMatters: "Con el código puedes buscar qué significa cada pago en esta guía.",
    where: "Percepciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "62": {
    simple: "Es el nombre del concepto de percepción.",
    whyItMatters: "Describe qué tipo de pago recibiste.",
    where: "Percepciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "63": {
    simple: "Es el importe en pesos que recibiste por ese concepto.",
    whyItMatters: "Es el dinero efectivo de cada percepción.",
    where: "Percepciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "64": {
    simple: "Es la suma de todas tus percepciones de la quincena.",
    whyItMatters: "Es lo que ganaste bruto, antes de descuentos.",
    where: "Percepciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "65": {
    simple: "Es la sección donde se listan tus deducciones: todo lo que se te descuenta.",
    whyItMatters: "Aquí ves impuestos, créditos, fondos y recuperaciones.",
    where: "Deducciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "66": {
    simple: "Es el código de tres dígitos del concepto de deducción (por ejemplo, 151 ISR).",
    whyItMatters: "Con el código puedes buscar qué significa cada descuento.",
    where: "Deducciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "69": {
    simple: "Es la suma de todas tus deducciones de la quincena.",
    whyItMatters: "De aquí sale todo lo que se resta de tus percepciones.",
    where: "Deducciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "70": {
    simple: "Es tu pago líquido: lo que realmente recibes después de todas las deducciones.",
    whyItMatters: "Es el número que importa: total de percepciones menos total de deducciones.",
    where: "Percepciones y Deducciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "71": {
    simple: "Es el código del concepto al que se refiere la observación.",
    whyItMatters: "Las observaciones dan detalle de conceptos: saldos, vencimientos y unidades.",
    where: "Observaciones.",
    related: [{ ref: "field:73", label: "Vencimiento", why: "Dato habitual de la observación" }],
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "72": {
    simple: "Es el importe asociado a la observación.",
    whyItMatters: "Suele registrar montos pendientes o pagos parciales.",
    where: "Observaciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "73": {
    simple: "Es la fecha de vencimiento de la observación (por ejemplo, el fin de un crédito o descuento).",
    whyItMatters: "Te dice hasta cuándo seguirá el descuento.",
    where: "Observaciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "74": {
    simple: "Son las unidades asociadas al concepto (por ejemplo, las unidades de un crédito).",
    whyItMatters: "En créditos como INFONAVIT, las unidades muestran el avance del pago.",
    where: "Observaciones.",
    related: [{ ref: "concept:154", label: "Descuento crédito INFONAVIT" }],
    sources: ["proc-1a14-003-010"], verification: "partially_verified",
  },
  "75": {
    simple: "Es el número de control interno de la observación.",
    whyItMatters: "Sirve para rastrear el movimiento en los sistemas del IMSS.",
    where: "Observaciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "76": {
    simple: "Es el cargo inicial del concepto observado.",
    whyItMatters: "Te muestra cuánto se cargó originalmente y cuánto falta por pagar.",
    where: "Observaciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
  "77": {
    simple: "Son los mensajes y detalles adicionales de la observación.",
    whyItMatters: "Aquí se explican saldos, fechas y condiciones de los conceptos.",
    where: "Observaciones.",
    sources: ["proc-6b11-003-008"], verification: "partially_verified",
  },
}
