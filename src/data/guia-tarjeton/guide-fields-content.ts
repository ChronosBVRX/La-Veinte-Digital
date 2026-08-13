// Capa editorial de campos del tarjetón para "Guía de mi Tarjetón".
// ÍNDICE PROVISIONAL: el catálogo base de campos vive en `fields.ts`.
// Aquí se agrega contenido educativo curado, la agrupación campo → sección
// y datos de ejemplo anonimizados para el Explorador. No es autoridad
// normativa.

export interface GuideFieldContent {
  fieldId: number
  blob: string // "datos trabajador" | "adscripcion" | "incidencias" | "periodo" | "vacaciones" | "creditos" | "percepciones" | "deducciones" | "observaciones"
  easy?: string
  whenToCheck?: string
  related?: string[] // conceptos ("032"), campos ("field:13") o secciones ("section:observaciones")
}

export const GUIDE_FIELD_CONTENT: GuideFieldContent[] = [
  { fieldId: 1, blob: "datos trabajador", easy: "Es el número que te identifica como trabajador del IMSS en la nómina.", related: ["field:58"] },
  { fieldId: 2, blob: "datos trabajador", easy: "Tu nombre completo, tal como está registrado en tu expediente laboral." },
  { fieldId: 3, blob: "datos trabajador", easy: "Registro Federal de Contribuyentes: tu clave fiscal asignada por la SHCP.", whenToCheck: "Que coincida con tu RFC real; es un dato sensible que no compartas." },
  { fieldId: 4, blob: "datos trabajador", easy: "Clave Única de Registro Poblacional: tu identificación personal de 18 caracteres.", whenToCheck: "Que coincida con tu CURP real; es un dato sensible que no compartas." },
  { fieldId: 5, blob: "datos trabajador", easy: "Número de Seguridad Social: la clave numérica única que el IMSS te asigna.", whenToCheck: "Es tu llave ante el IMSS: guárdalo bien y no lo compartas." },
  { fieldId: 6, blob: "datos trabajador", easy: "Describe cómo fue tu contratación: Confianza o Base.", related: ["field:11"] },
  { fieldId: 7, blob: "adscripcion", easy: "Clave de 15 dígitos que identifica tu delegación, unidad y función dentro del Instituto." },
  { fieldId: 8, blob: "adscripcion", easy: "El nombre de la dependencia donde prestas servicios, por ejemplo un hospital o clínica." },
  { fieldId: 9, blob: "adscripcion", easy: "El domicilio de la unidad donde trabajas." },
  { fieldId: 10, blob: "adscripcion", easy: "Clave de la estructura organizacional: identifica tu clave departamental y delegación." },
  { fieldId: 11, blob: "adscripcion", easy: "Clave de 8 dígitos que identifica tu puesto y jornada (por ejemplo, 8.0 horas).", related: ["field:12", "field:6"] },
  { fieldId: 12, blob: "adscripcion", easy: "El nombre de tu categoría o puesto, según tu último nombramiento.", related: ["field:11"] },
  {
    fieldId: 13,
    blob: "datos trabajador",
    easy: "Es el tiempo efectivo de servicios que el IMSS reconoce que llevas acumulado, contado desde tu fecha de ingreso.",
    whenToCheck: "Muchas prestaciones dependen de ella (vacaciones, ayuda de renta): si no cuadra con tu antigüedad real, conviene revisarla.",
    related: ["022", "048", "029", "field:45", "field:53"],
  },
  { fieldId: 14, blob: "adscripcion", easy: "El número de tu plaza, identificada por el sistema SIAP.", related: ["field:15"] },
  {
    fieldId: 15,
    blob: "adscripcion",
    easy: "Clave que explica por qué ocupas una plaza de forma no definitiva (interinato, promoción, temporalidad).",
    whenToCheck: "Si ves 01, 02, 03, 90 o 98 significa que no eres titular de la plaza; la 00/20 indica plaza definitiva.",
    related: ["field:16", "field:17"],
  },
  { fieldId: 16, blob: "adscripcion", easy: "Matrícula del trabajador titular de la plaza que estás sustituyendo.", related: ["field:15"] },
  { fieldId: 17, blob: "adscripcion", easy: "Fecha en que termina tu contrato, beca o residencia si no eres titular de la plaza.", related: ["field:15"] },
  { fieldId: 18, blob: "datos trabajador", easy: "El banco donde recibes tu pago si elegiste acreditamiento en cuenta.", related: ["field:41"] },
  { fieldId: 19, blob: "datos trabajador", easy: "Tu número de cuenta bancaria. Es un dato sensible: no lo compartas." },
  { fieldId: 20, blob: "incidencias", easy: "Minutos de retardo acumulados en el ejercicio (del 1 de noviembre al 31 de octubre siguiente).", whenToCheck: "Los retardos de 6 a 30 minutos descuentan tiempo no laborado.", related: ["174", "field:23"] },
  { fieldId: 21, blob: "incidencias", easy: "Horas acumuladas que te autorizaron por pases de salida, intermedios o de entrada.", related: ["173"] },
  { fieldId: 22, blob: "incidencias", easy: "Días acumulados de ausencias injustificadas en el ejercicio.", related: ["172"] },
  { fieldId: 23, blob: "incidencias", easy: "Número de veces que registraste asistencia dentro de los 5 minutos de tolerancia: por cada 10 marcas se genera el estímulo 033.", related: ["033"] },
  { fieldId: 24, blob: "incidencias", easy: "Contador de ausentismo por trimestre (faltas, licencias, becas sin sueldo e incapacidades)." },
  { fieldId: 25, blob: "incidencias", easy: "Días de ausencia amparados por incapacidad por enfermedad general.", related: ["032"] },
  { fieldId: 26, blob: "incidencias", easy: "Días de ausencia por incapacidad por riesgo de trabajo.", related: ["032"] },
  { fieldId: 27, blob: "incidencias", easy: "Días de ausencia por incapacidad por maternidad.", related: ["032"] },
  { fieldId: 28, blob: "incidencias", easy: "Días con derecho a pago por notas de mérito (acumulado del ejercicio).", related: ["052"] },
  { fieldId: 29, blob: "incidencias", easy: "Notas de demérito registradas en el ejercicio.", related: ["179"] },
  { fieldId: 30, blob: "incidencias", easy: "La quincena a la que corresponde el pago de estímulos de asistencia: los registros se reflejan con un mes de desfase.", whenToCheck: "Si un estímulo no aparece, revisa aquí la quincena de incidencia.", related: ["032", "033"] },
  { fieldId: 31, blob: "periodo", easy: "Si solicitaste (SÍ/NO) el vale a cuenta de aguinaldo de agosto.", related: ["043"] },
  { fieldId: 32, blob: "incidencias", easy: "Días acumulados por comisiones fuera de tu centro de trabajo.", related: ["032"] },
  { fieldId: 33, blob: "incidencias", easy: "Días acumulados por comisiones de capacitación." },
  { fieldId: 34, blob: "incidencias", easy: "Días acumulados por licencias con goce de sueldo.", related: ["032"] },
  { fieldId: 35, blob: "incidencias", easy: "Días por licencia sin sueldo." },
  { fieldId: 36, blob: "incidencias", easy: "Días totales de licencia sin sueldo a partir de la vigencia del CCT." },
  { fieldId: 37, blob: "incidencias", easy: "Días de ausencia por becas sin sueldo.", related: ["175"] },
  { fieldId: 38, blob: "incidencias", easy: "Días de ausencia por becas con sueldo.", related: ["032"] },
  { fieldId: 39, blob: "incidencias", easy: "Días que generan el estímulo de puntualidad (033): por cada 10 marcas puntuales son 2 días.", related: ["033"] },
  { fieldId: 40, blob: "periodo", easy: "La quincena de pago, por ejemplo 1ª ENE 2026." },
  { fieldId: 41, blob: "periodo", easy: "Cómo se te paga: efectivo, cheque o acreditamiento en cuenta.", related: ["field:18"] },
  { fieldId: 42, blob: "periodo", easy: "El importe máximo de descuento que se te puede aplicar por un crédito.", whenToCheck: "Si el importe es 0 o negativo, no puedes obtener un nuevo crédito.", related: ["field:56", "field:59"] },
  { fieldId: 43, blob: "periodo", easy: "Días laborados en el año: base del cálculo del impuesto.", related: ["151"] },
  { fieldId: 44, blob: "periodo", easy: "Los días efectivos que se te pagaron en la quincena." },
  { fieldId: 45, blob: "vacaciones", easy: "Periodos vacacionales que has disfrutado en tu vida laboral.", related: ["029"] },
  { fieldId: 46, blob: "vacaciones", easy: "El último periodo vacacional extraordinario por 20 o más años de servicio.", related: ["field:53"] },
  { fieldId: 47, blob: "vacaciones", easy: "Periodos de vacaciones vencidos que aún no disfrutas." },
  { fieldId: 48, blob: "vacaciones", easy: "Días de vacaciones disfrutados en el ejercicio actual.", related: ["029"] },
  { fieldId: 49, blob: "vacaciones", easy: "Un dígito que describe cómo disfrutaste el último periodo y cómo será el siguiente (fracciones, pago del concepto 48).", whenToCheck: "Según la marca (0 a 5, 9) cambia el pago de la ayuda cultural (48).", related: ["048"] },
  { fieldId: 50, blob: "vacaciones", easy: "La fecha en la que cumplirás 180 días laborados para tener derecho a un periodo más." },
  { fieldId: 51, blob: "vacaciones", easy: "El número del próximo periodo vacacional por disfrutar." },
  { fieldId: 52, blob: "vacaciones", easy: "Días acumulados por sustituciones y temporalidades, para efectos de vacaciones." },
  { fieldId: 53, blob: "vacaciones", easy: "Días acumulados para efectos de jubilación.", whenToCheck: "Si con 20+ años optas por laborar el periodo extraordinario, se reduce en 30 días tu tiempo de jubilación.", related: ["field:46"] },
  { fieldId: 54, blob: "vacaciones", easy: "Fecha programada para el primer periodo de vacaciones del año." },
  { fieldId: 55, blob: "vacaciones", easy: "Fecha programada para el segundo periodo de vacaciones del año." },
  { fieldId: 56, blob: "creditos", easy: "El número de tu crédito INFONAVIT.", related: ["154"] },
  {
    fieldId: 57,
    blob: "periodo",
    easy: "El importe mensual que refleja todo lo que te corresponde por tu categoría: es la base de la prima vacacional, la dominical, guardias, tiempo extra y la ayuda cultural.",
    whenToCheck: "Es una de las cifras más usadas del tarjetón: si cambia sin motivo, revisa tu categoría.",
    related: ["029", "030", "037", "048"],
  },
  { fieldId: 58, blob: "datos trabajador", easy: "El día en que iniciaste tu relación laboral con el Instituto.", related: ["field:13"] },
  { fieldId: 59, blob: "creditos", easy: "El tipo de crédito que tienes: INFONAVIT, hipotecario, préstamo personal, gastos de escrituración, entre otros.", related: ["field:42", "154", "104"] },
  { fieldId: 60, blob: "percepciones", easy: "La columna donde aparecen tus ingresos de la quincena, con su clave, descripción e importe." },
  { fieldId: 61, blob: "percepciones", easy: "Clave de 3 dígitos de cada ingreso: las percepciones van del 001 al 084." },
  { fieldId: 62, blob: "percepciones", easy: "La descripción de cada ingreso, por ejemplo “Estímulo por puntualidad”." },
  { fieldId: 63, blob: "percepciones", easy: "El importe de cada ingreso de la quincena." },
  { fieldId: 64, blob: "percepciones", easy: "La suma de todos tus ingresos de la quincena, antes de descuentos." },
  { fieldId: 65, blob: "deducciones", easy: "La columna donde aparecen tus descuentos de la quincena." },
  { fieldId: 66, blob: "deducciones", easy: "Clave de 3 dígitos de cada descuento: las deducciones van del 104 al 199." },
  { fieldId: 67, blob: "deducciones", easy: "La descripción de cada descuento (ISR, fondo de jubilación, créditos…)." },
  { fieldId: 68, blob: "deducciones", easy: "El importe de cada descuento de la quincena." },
  { fieldId: 69, blob: "deducciones", easy: "La suma de todos tus descuentos de la quincena." },
  { fieldId: 70, blob: "deducciones", easy: "El importe neto que efectivamente recibes: total de percepciones menos total de deducciones.", whenToCheck: "Es lo que llega a tu cuenta o caja.", related: ["field:64", "field:69"] },
  { fieldId: 71, blob: "observaciones", easy: "La clave del concepto que se está detallando en Observaciones.", related: ["section:observaciones"] },
  { fieldId: 72, blob: "observaciones", easy: "El importe del concepto detallado." },
  { fieldId: 73, blob: "observaciones", easy: "La quincena y año en que vence un concepto (por ejemplo, un crédito).", whenToCheck: "Si un crédito se acerca a su vencimiento, revisa que el saldo cuadre." },
  { fieldId: 74, blob: "observaciones", easy: "Las unidades del concepto: días, horas o décimas." },
  { fieldId: 75, blob: "observaciones", easy: "El número de control que se asigna a cada reporte según la norma del concepto." },
  { fieldId: 76, blob: "observaciones", easy: "El importe inicial de un cargo o crédito y los saldos en proceso de recuperación." },
  { fieldId: 77, blob: "observaciones", easy: "Mensajes y detalles del concepto: fechas, abonos, saldo, intereses y capital, o el acumulado en veces del salario mensual integrado.", whenToCheck: "Es la sección que más información oculta: léela cuando un descuento no te quede claro.", related: ["section:observaciones"] },
]

export const GUIDE_FIELD_CONTENT_BY_ID: ReadonlyMap<number, GuideFieldContent> = new Map(
  GUIDE_FIELD_CONTENT.map((f) => [f.fieldId, f])
)

// Agrupación campo → sección del recibo (según la estructura del recibo).
export const GUIDE_SECTION_FIELD_RANGES: Readonly<Record<string, number[]>> = {
  emisor: [],
  receptor: Array.from({ length: 59 }, (_, i) => i + 1),
  "percepciones-deducciones": Array.from({ length: 11 }, (_, i) => 60 + i),
  mensajes: [],
  observaciones: Array.from({ length: 7 }, (_, i) => 71 + i),
}

// Datos de ejemplo anonimizados (NUNCA datos reales) para el Explorador.
export const GUIDE_SECTION_SAMPLE: Readonly<Record<string, { label: string; value: string; blurred?: boolean }[]>> = {
  emisor: [
    { label: "Emisor", value: "Instituto Mexicano del Seguro Social" },
    { label: "RFC institucional", value: "XXX-000000-XXX", blurred: true },
    { label: "Registro patronal", value: "ZZZ-0000", blurred: true },
    { label: "Folio", value: "F-00000000", blurred: true },
  ],
  receptor: [
    { label: "Matrícula", value: "00000000", blurred: true },
    { label: "Nombre", value: "TRABAJADOR (A) EJEMPLO", blurred: true },
    { label: "Adscripción", value: "Hospital General de Zona" },
    { label: "Categoría", value: "Auxiliar de servicios (jornada 8 h)" },
  ],
  "percepciones-deducciones": [
    { label: "Percepciones", value: "002 Sueldo base · 011 Ayuda de renta · 033 Estímulo por puntualidad" },
    { label: "Deducciones", value: "151 ISR · 152 Fondo de jubilación" },
    { label: "Líquido", value: "El importe neto de la quincena" },
  ],
  mensajes: [
    { label: "Mensajes", value: "Avisos e información del patrón para ti (programas, invitaciones, avisos institucionales)." },
  ],
  observaciones: [
    { label: "Concepto", value: "154 · Crédito INFONAVIT" },
    { label: "Vencimiento", value: "Ej. 1ª QNA · 2027" },
    { label: "Unidades", value: "Ej. 27 — unidades o días" },
    { label: "Cargo inicial", value: "Ej. un importe en pesos o en veces del salario mensual integrado" },
  ],
}