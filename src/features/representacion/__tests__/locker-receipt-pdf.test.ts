import { describe, it, expect } from "vitest";
import {
  buildLockerReceiptPdf,
  buildLockerReceiptBuffer,
  type LockerReceiptPdfInput,
} from "../services/locker-receipt-pdf";

describe("LockerReceiptPdf Service", () => {
  const sampleInput: LockerReceiptPdfInput = {
    folio: "XXI-2026-LOK-000042",
    dateFormatted: "26 de septiembre de 2026, 13:30 hrs",
    delegationName: "Delegación Sindical XXI HGR No. 1 Charo",
    worker: {
      name: "JUAN PÉREZ LÓPEZ",
      employeeNumber: "99123456",
      category: "ENFERMERO GENERAL",
      assignment: "URGENCIAS ADULTOS",
      turn: "MATUTINO (07:00 A 15:00)",
      phone: "443-123-4567",
    },
    locker: {
      lockerNumber: "145",
      zoneName: "Vestidor General Hombres",
      bankName: "Batería B",
      physicalCode: "Candado Yale 40mm",
      condition: "ok",
      movementType: "actualizacion_2026",
      observations: "Llave propia resguardada por el trabajador.",
    },
    representativeName: "Dr. Roberto Silva Morales",
    representativeRole: "Secretario General Delegacional",
  };

  it("genera un documento jsPDF con formato Carta (Letter 612x792 pt)", () => {
    const doc = buildLockerReceiptPdf(sampleInput);
    expect(doc).toBeDefined();

    // Validar dimensiones de página (612 x 792 pt)
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    expect(Math.round(width)).toBe(612);
    expect(Math.round(height)).toBe(792);

    // Debe ser exactamente 1 página (contiene ambos tantos)
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("genera un buffer binario válido con cabecera %PDF-", () => {
    const buffer = buildLockerReceiptBuffer(sampleInput);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Los primeros 4 bytes deben ser %PDF
    const header = buffer.subarray(0, 4).toString("ascii");
    expect(header).toBe("%PDF");
  });

  it("maneja datos mínimos o incompletos sin fallar ni lanzar excepciones", () => {
    const minimalInput: LockerReceiptPdfInput = {
      folio: "XXI-2026-LOK-000001",
      dateFormatted: "26/09/2026",
      worker: {
        name: "",
        employeeNumber: "",
        category: "",
        assignment: "",
        turn: "",
      },
      locker: {
        lockerNumber: "1",
        condition: "ok",
        movementType: "asignacion_nueva",
      },
    };

    const buffer = buildLockerReceiptBuffer(minimalInput);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("genera correctamente un comprobante oficial de lista de espera", () => {
    const waitlistInput: LockerReceiptPdfInput = {
      folio: "XXI-2026-LOK-000099",
      dateFormatted: "26 de septiembre de 2026, 14:00 hrs",
      worker: {
        name: "EDUARDO BOLAÑOS VAZQUEZ",
        employeeNumber: "98173968",
        category: "TECNICO RADIOLOGO 80",
        assignment: "COORDINACION CLINICA",
        turn: "VESPERTINO",
        phone: "4433667106",
      },
      locker: {
        lockerNumber: "LISTA DE ESPERA",
        zoneName: "Vestidor General Hombres",
        bankName: "Por asignar según turno/área",
        condition: "ok",
        movementType: "lista_espera",
        observations: "Solicita casillero en vestidor de médicos PB",
      },
    };

    const doc = buildLockerReceiptPdf(waitlistInput);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);

    const buffer = buildLockerReceiptBuffer(waitlistInput);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
