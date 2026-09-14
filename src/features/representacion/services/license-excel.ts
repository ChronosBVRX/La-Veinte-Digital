// Excel de licencia 1A74-009-036 con ExcelJS (sin macros, .xlsx).
// Conserva disposición institucional: encabezados, periodo, adeudos, firmas,
// área de impresión A1:T58. Los valores provienen de UNA sola captura.

import ExcelJS from "exceljs";

export interface LicenseExcelWorker {
  paternalSurname: string;
  maternalSurname: string;
  firstName: string;
  employeeNumber: string;
  category: string;
  assignment: string;
  turn: string;
  schedule: string;
  restDays: string;
}

export interface LicenseExcelInput {
  ooad: string;
  place: string;
  folio: string;
  elaborationDay: string;
  elaborationMonth: string;
  elaborationYear: string;
  worker: LicenseExcelWorker;
  withPay: boolean;
  rangeLabel: string;
  startDay: string;
  startMonth: string;
  startYear: string;
  endDay: string;
  endMonth: string;
  endYear: string;
  totalDays: number;
  isExtension: boolean;
  reason: string;
  proof: string;
  phone: string;
  debtStatus: string;
}

function cell(ws: ExcelJS.Worksheet, addr: string, value: string | number, bold = false, size = 10): void {
  const c = ws.getCell(addr);
  c.value = value;
  c.font = { name: "Arial", size, bold };
  c.alignment = { vertical: "middle", wrapText: true };
}

export async function buildLicenseExcel(input: LicenseExcelInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "La Veinte Digital — Representación Sindical XXI";
  wb.created = new Date();
  const ws = wb.addWorksheet("Licencia", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  ws.pageSetup.printArea = "A1:T58";
  ws.columns = Array.from({ length: 20 }, () => ({ width: 9 }));

  cell(ws, "A1", `HORARIO: ${input.worker.schedule}`, true, 9);
  cell(ws, "A2", `DESCANSOS: ${input.worker.restDays}`, true, 9);
  cell(ws, "E3", "DIRECCIÓN DE ADMINISTRACIÓN", true, 11);
  cell(ws, "Q3", "SOLICITUD DE LICENCIA", true, 11);
  cell(ws, "E4", `OOAD: ${input.ooad || "MICHOACÁN"}`, false, 10);
  cell(ws, "E6", `LUGAR: ${input.place}`, false, 10);
  cell(ws, "M6", "FOLIO", true, 9);
  ws.mergeCells("M7:N7");
  cell(ws, "M7", input.folio, true, 10);
  cell(ws, "Q6", "DÍA / MES / AÑO", true, 9);
  ws.mergeCells("Q7:S7");
  cell(ws, "Q7", `${input.elaborationDay} / ${input.elaborationMonth} / ${input.elaborationYear}`, false, 10);
  cell(ws, "C8", "Responsable de los Servicios de Personal Presente", false, 10);
  cell(ws, "A9", "Vo. Bo. JEFA DE SERVICIO", true, 8);
  cell(ws, "I9", "LICENCIA CON SUELDO", true, 9);
  cell(ws, "Q9", "LICENCIA SIN SUELDO DE 1 A 3 DÍAS", true, 8);
  cell(ws, "I11", "LICENCIA SIN SUELDO DE 4 A 60 DÍAS", true, 8);
  cell(ws, "Q11", "LICENCIA SIN SUELDO DE 61 A 365 DÍAS", true, 8);
  cell(ws, "I12", input.withPay ? "[X]" : "[ ]", true, 12);
  const range = input.rangeLabel.toLowerCase();
  cell(ws, "Q12", range.includes("1 a 3") ? "[X]" : "[ ]", true, 12);
  cell(ws, "I13", range.includes("4 a 60") ? "[X]" : "[ ]", true, 12);
  cell(ws, "Q13", range.includes("61 a 365") ? "[X]" : "[ ]", true, 12);
  cell(ws, "B14", "APELLIDO PATERNO", true, 8);
  cell(ws, "F14", "APELLIDO MATERNO", true, 8);
  cell(ws, "J14", "NOMBRE(S)", true, 8);
  cell(ws, "Q14", "MATRÍCULA", true, 8);
  cell(ws, "S14", "TURNO", true, 8);
  cell(ws, "B15", input.worker.paternalSurname, false, 10);
  cell(ws, "F15", input.worker.maternalSurname, false, 10);
  cell(ws, "J15", input.worker.firstName, false, 10);
  cell(ws, "Q15", input.worker.employeeNumber, false, 10);
  cell(ws, "S15", input.worker.turn, false, 10);
  cell(ws, "B16", "CATEGORÍA", true, 8);
  cell(ws, "K16", "ADSCRIPCIÓN", true, 8);
  cell(ws, "C17", input.worker.category, false, 10);
  cell(ws, "K17", input.worker.assignment || "HOSPITAL GENERAL REGIONAL No. 1", false, 10);
  cell(ws, "C18", "PERIODO QUE SOLICITA", true, 9);
  cell(ws, "K18", "LICENCIAS ANTERIORES", true, 9);
  cell(ws, "B19", "INICIO", true, 8);
  cell(ws, "F19", "TÉRMINO", true, 8);
  ws.mergeCells("B20:D20");
  cell(ws, "B20", `DÍA ${input.startDay}  MES ${input.startMonth}  AÑO ${input.startYear}`, false, 10);
  ws.mergeCells("F20:H20");
  cell(ws, "F20", `DÍA ${input.endDay}  MES ${input.endMonth}  AÑO ${input.endYear}`, false, 10);
  cell(ws, "B23", `Es prórroga: ${input.isExtension ? "SÍ" : "NO"}`, false, 10);
  cell(ws, "F23", "TOTAL DE DÍAS", true, 9);
  cell(ws, "F24", `${input.totalDays}`, true, 12);
  cell(ws, "A26", `TEL. ${input.phone}`, false, 10);
  cell(ws, "B27", "Motivo:", true, 9);
  cell(ws, "F27", input.reason, false, 10);
  cell(ws, "B28", "Comprobante de la solicitud:", true, 9);
  cell(ws, "F28", input.proof, false, 10);
  cell(ws, "B29", "CONTROL DE ADEUDOS", true, 9);
  cell(ws, "B30", "LLÉNESE SI SE TRATASE DE LICENCIA CON GOCE DE SUELDO:", false, 8);
  cell(ws, "B34", "ESTA LICENCIA SE AUTORIZA SI NO HAY ADEUDO EN LOS SIGUIENTES CONCEPTOS", false, 8);
  cell(ws, "B35", "CONCEPTOS / CERTIFICADO DE NO ADEUDO (130, 133, 134, 136, 138–145, 148, 156, 160, 162, 166, 168, 169)", false, 8);
  cell(ws, "B36", `Certificación: ${input.debtStatus}`, true, 9);
  cell(ws, "B46", "Solicita", true, 9);
  cell(ws, "H46", "Certificación de Adeudos", true, 9);
  cell(ws, "O46", "Autorización", true, 9);
  cell(ws, "B47", `C. ${input.worker.firstName} ${input.worker.paternalSurname} ${input.worker.maternalSurname}`, false, 9);
  cell(ws, "B48", "Trabajadora/Trabajador — FIRMA (línea de firma, sin firma digital automática)", false, 8);
  cell(ws, "H48", "Responsable de los Servicios de Personal — NOMBRE Y FIRMA", false, 8);
  cell(ws, "O48", "Jefe de la Dependencia — NOMBRE Y FIRMA", false, 8);
  cell(ws, "B50", "FUNCIÓN / OFICINA DE CONTROL DE FUERZA DE TRABAJO", false, 8);
  cell(ws, "B52", "MATRÍCULA / MARCA DE BAJA / FECHA DE MOVIMIENTO / CLAVE DE PLANTILLA", false, 8);
  cell(ws, "J52", "ACUSE DE RECIBIDO / RESPONSABLE DEL REPORTE / QNA. PROCESO", false, 8);
  cell(ws, "Q58", "Clave: 1A74-009-036", false, 8);
  cell(ws, "A58", `Folio interno ${input.folio} — Formato listo para revisión. No es autorización.`, false, 7);

  for (let r = 1; r <= 58; r += 1) {
    ws.getRow(r).height = r === 3 || r === 15 ? 22 : 15;
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
