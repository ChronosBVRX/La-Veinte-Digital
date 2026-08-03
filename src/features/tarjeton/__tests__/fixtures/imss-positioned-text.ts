import type { PositionedPdfText } from "@/shared/contracts/tarjeton-import"

function text(x: number, y: number, value: string, page = 1): PositionedPdfText {
  return {
    text: value,
    page,
    x,
    y,
    width: Math.max(12, value.length * 3),
    height: 10,
    confidence: 1,
    method: "native_text",
  }
}

function conceptRow(
  y: number,
  earning?: [string, string, string],
  deduction?: [string, string, string],
): PositionedPdfText[] {
  const items: PositionedPdfText[] = []
  if (earning) {
    items.push(text(35, y, earning[0]), text(72, y, earning[1]), text(270, y, earning[2]))
  }
  if (deduction) {
    items.push(text(340, y, deduction[0]), text(377, y, deduction[1]), text(580, y, deduction[2]))
  }
  return items
}

export const expectedRegressionValues = {
  employeeNumber: "98173968",
  fullName: "PERSONA TRABAJADORA DE PRUEBA",
  categoryCode: "20570080",
  categoryName: "TECNICO RADIOLOGO 80",
  entryDate: "2011-11-27",
  periodRaw: "2A-JUL-2026",
  folio: "9585",
  totalEarnings: 36191.55,
  totalDeductions: 24653.55,
  netPay: 11538,
} as const

export const imssPositionedTextFixture: PositionedPdfText[] = [
  text(30, 20, "INSTITUTO MEXICANO DEL SEGURO SOCIAL"),
  text(30, 38, "RECIBO DE PAGO DE NOMINA"),
  text(430, 38, "FOLIO:"), text(500, 38, "9585"),
  text(30, 58, "EMISOR"),
  text(30, 78, "NOMBRE:"), text(100, 78, "Instituto Mexicano del Seguro Social"),
  text(30, 112, "RECEPTOR"),

  text(40, 140, "MATRICULA:"), text(150, 140, "98173968"),
  text(270, 140, "RETARDOS:"), text(390, 140, "0"),
  text(440, 140, "PERIODO DE PAGO:"), text(565, 140, "2A-JUL-2026"),

  text(40, 158, "NOMBRE:"), text(150, 158, "PERSONA TRABAJADORA DE PRUEBA"),
  text(270, 158, "PASES DE SALIDA:"), text(390, 158, "3"),
  text(440, 158, "CAPACIDAD DE CREDITO:"), text(585, 158, "-2,390.73"),

  text(40, 176, "CLAVE CATEGORIA/PUESTO:"), text(190, 176, "20570080"),
  text(270, 176, "FALTAS:"), text(390, 176, "1"),
  text(440, 176, "DIAS LABORADOS EN EL AÑO:"), text(600, 176, "211"),

  text(40, 194, "NOMBRE CATEGORIA/PUESTO:"), text(190, 194, "TECNICO RADIOLOGO 80"),
  text(270, 194, "SIN RETARDO:"), text(390, 194, "2"),
  text(440, 194, "DIAS PAGADOS EN LA QUINCENA:"), text(610, 194, "15"),

  text(40, 212, "ANTIGUEDAD EFECTIVA:"), text(175, 212, "14 años 3 qnas 1 dias"),
  text(270, 212, "ASIDUIDAD:"), text(390, 212, "1"),
  text(440, 212, "VACACIONES DISFRUTADAS:"), text(600, 212, "42"),

  text(40, 230, "NOMBRE DE ADSCRIPCION:"), text(185, 230, "UNIDAD FICTICIA"),
  text(270, 230, "MATERNIDAD:"), text(390, 230, "0"),
  text(440, 230, "VACACIONES EN EL AÑO:"), text(600, 230, "26"),

  text(270, 248, "LICENCIA 140 BIS:"), text(390, 248, "0"),
  text(440, 248, "MARCA DE CONTINUIDAD:"), text(600, 248, "0"),

  text(270, 266, "LICENCIAS CON SUELDO:"), text(390, 266, "0"),
  text(440, 266, "PERIODO POR DISFRUTAR:"), text(600, 266, "43"),

  text(270, 284, "LICENCIAS SIN SUELDO:"), text(390, 284, "0"),
  text(440, 284, "FECHA DE INGRESO:"), text(565, 284, "27-11-2011"),

  text(270, 302, "COMISIONES:"), text(390, 302, "73"),
  text(440, 302, "SUELDO MENSUAL INTEGRADO:"), text(610, 302, "22,058.60"),

  text(270, 320, "DIAS DEL CONCEPTO 033:"), text(390, 320, "2"),

  text(30, 380, "PERCEPCIONES"), text(330, 380, "DEDUCCIONES"),
  text(35, 400, "CONCEPTO"), text(72, 400, "DESCRIPCION"), text(270, 400, "IMPORTE"),
  text(340, 400, "CONCEPTO"), text(377, 400, "DESCRIPCION"), text(580, 400, "IMPORTE"),
  ...conceptRow(420, ["002", "Sueldo Base Fijo", "3,937.64"], ["111", "Aport Complementaria Afore", "5,321.15"]),
  ...conceptRow(438, ["011", "Ayuda Renta Cláusula 63", "3,234.77"], ["112", "Fondo Ayuda Sindical por Defunción", "55.31"]),
  text(72, 448, "Bis Inc b"),
  ...conceptRow(456, ["020", "Ayuda Renta Cláusula 63 Bis Inc a", "250.00"], ["151", "ISR", "313.03"]),
  ...conceptRow(474, ["022", "Ayuda Renta Cláusula 63 Bis Inc c", "1,972.41"], ["154", "Descuento Crédito INFONAVIT", "2,670.42"]),
  ...conceptRow(492, ["032", "Estímulo por Asistencia", "1,721.37"], ["180", "Cuota Sindical", "143.45"]),
  ...conceptRow(510, ["033", "Estímulo por Puntualidad", "1,147.58"], ["190", "Caja de ahorro préstamo", "1,430.19"]),
  ...conceptRow(528, ["050", "Ayuda para Despensa", "200.00"], ["192", "Caja de Ahorro Ahorro", "14,720.00"]),
  ...conceptRow(546, ["054", "Emanaciones Radioactivas no Médicas", "1,434.48"]),
  ...conceptRow(564, ["055", "Fondo de Ahorro", "21,934.68"]),
  ...conceptRow(582, ["072", "Ayuda para Libros", "358.62"]),
  text(35, 608, "TOTAL PERCEPCIONES"), text(270, 608, "36,191.55"),
  text(340, 608, "TOTAL DEDUCCIONES"), text(580, 608, "24,653.55"),
  text(340, 626, "LIQUIDO"), text(580, 626, "11,538.00"),

  text(30, 650, "MENSAJES"),
  text(30, 668, "Conserva este comprobante para cualquier aclaración."),
  text(30, 700, "OBSERVACIONES"),
  text(30, 720, "CONCEPTO"), text(85, 720, "IMPORTE"), text(160, 720, "VENCIMIENTO"),
  text(250, 720, "UNIDADES"), text(310, 720, "NUM CONTROL"), text(400, 720, "CARGO INICIAL"), text(490, 720, "OBSERVACIONES"),
  text(30, 740, "154"), text(85, 740, "2,670.42"), text(160, 740, "2027001"), text(310, 740, "A01"),
  text(30, 758, "190"), text(85, 758, "1,430.19"), text(160, 758, "2026014"), text(400, 758, "8,000.00"),
  text(30, 776, "192"), text(85, 776, "7,000.00"), text(160, 776, "2026014"), text(250, 776, "1"),
  text(30, 794, "192"), text(85, 794, "7,720.00"), text(160, 794, "2026014"), text(250, 794, "1"),
  text(30, 812, "032"), text(85, 812, "1,721.37"), text(250, 812, "2"), text(490, 812, "Asistencia"),
  text(30, 830, "055"), text(85, 830, "21,934.68"), text(160, 830, "2026014"),
  text(30, 858, "CERTIFICACION 31-07-2026"),

  text(30, 30, "INFORMACION FISCAL", 2),
  text(30, 55, "FOLIO FISCAL:", 2), text(150, 55, "FOLIO-FICTICIO-NO-PERSISTIR", 2),
  text(30, 80, "SELLO DIGITAL FICTICIO", 2),
]
