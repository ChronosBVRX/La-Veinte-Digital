/**
 * Generador de tarjetón IMSS SINTÉTICO para E2E.
 *
 * Réplica la disposición que el parser real (`buildImssLayoutRegions` +
 * `parseImssProfile`) necesita:
 *   - Sección `RECEPTOR` (ancla obligatoria: sin ella no se extrae identidad).
 *   - Filas de identidad aisladas (una por campo) para evitar que PDF.js fusione
 *     el valor con la columna vecina.
 *   - Anclas `RETARDOS:` / `PERIODO DE PAGO:` que definen los divisores de columna.
 *   - Bloque de conceptos en dos columnas (`PERCEPCIONES` / `DEDUCCIONES`) con
 *     `CONCEPTO` / `DESCRIPCION` / `IMPORTE`, totales y `LIQUIDO`.
 *   - Columnas dentro del ancho de página (612 pt) para que PDF.js no recorte.
 *
 * Identidades y cantidades 100% ficticias. Salida determinista para la misma
 * entrada (necesario para la prueba de duplicado por SHA-256). Sin información real.
 */
import { jsPDF } from "jspdf"

export interface SyntheticTarjetonIdentity {
  fullName: string
  matricula: string
  /** Formato esperado por el parser: `1A-ENE-2026` o `2A-JUL-2026`. */
  periodRaw: string
  folio?: string
}

export const SYNTHETIC_TARJETON_AMOUNTS = {
  concept002: "5,000.00",
  concept011: "4,100.00",
  totalEarnings: "9,100.00",
  concept111: "1,000.00",
  totalDeductions: "1,000.00",
  netPay: "8,100.00",
} as const

export function buildSyntheticTarjetonPdf(identity: SyntheticTarjetonIdentity): Buffer {
  const { fullName, matricula, periodRaw, folio = "4321" } = identity
  const a = SYNTHETIC_TARJETON_AMOUNTS

  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const t = (x: number, y: number, s: string) => doc.text(s, x, y)

  t(30, 20, "INSTITUTO MEXICANO DEL SEGURO SOCIAL")
  t(30, 38, "RECIBO DE PAGO DE NOMINA")
  t(470, 38, "FOLIO:")
  t(505, 38, folio)
  t(30, 58, "RECEPTOR")

  // Identidad: una fila por campo (evita fusión de columnas en PDF.js).
  t(40, 80, "MATRICULA:")
  t(170, 80, matricula)
  t(40, 98, "NOMBRE:")
  t(170, 98, fullName)
  t(40, 116, "CLAVE CATEGORIA/PUESTO:")
  t(200, 116, "6112")
  t(40, 134, "NOMBRE CATEGORIA/PUESTO:")
  t(200, 134, "ENFERMERA GENERAL 80")
  t(40, 152, "ANTIGUEDAD EFECTIVA:")
  t(185, 152, "12 anos 4 qnas 2 dias")
  t(40, 170, "NOMBRE DE ADSCRIPCION:")
  t(210, 170, "UNIDAD FICTICIA")
  t(40, 188, "FECHA DE INGRESO:")
  t(175, 188, "01-04-2012")
  // Anclas de columna (fila aislada): definen los divisores del bloque Receptor.
  // Se mantienen dentro del ancho de página (612 pt) para evitar recortes de PDF.js.
  t(350, 206, "RETARDOS:")
  t(415, 206, "0")
  t(450, 206, "PERIODO DE PAGO:")
  t(545, 206, periodRaw)

  t(30, 240, "PERCEPCIONES")
  t(340, 240, "DEDUCCIONES")
  t(35, 258, "CONCEPTO")
  t(105, 258, "DESCRIPCION")
  t(255, 258, "IMPORTE")
  t(345, 258, "CONCEPTO")
  t(415, 258, "DESCRIPCION")
  t(520, 258, "IMPORTE")
  t(35, 276, "002")
  t(105, 276, "SUELDO BASE")
  t(255, 276, a.concept002)
  t(345, 276, "111")
  t(415, 276, "ISR")
  t(520, 276, a.concept111)
  t(35, 294, "011")
  t(105, 294, "AYUDA RENTA")
  t(255, 294, a.concept011)
  t(35, 312, "TOTAL PERCEPCIONES")
  t(255, 312, a.totalEarnings)
  t(345, 312, "TOTAL DEDUCCIONES")
  t(520, 312, a.totalDeductions)
  t(345, 330, "LIQUIDO")
  t(520, 330, a.netPay)
  t(30, 360, "MENSAJES")
  t(30, 378, "OBSERVACIONES")
  t(30, 396, "CERTIFICACION 31-01-2026")

  return Buffer.from(doc.output("arraybuffer"))
}
