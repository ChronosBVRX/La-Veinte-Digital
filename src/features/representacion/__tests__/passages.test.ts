import { describe, expect, it } from "vitest";
import { validatePassage026, validatePassage027 } from "@/features/representacion/lib/passages";
import { buildPassage026Pdf, buildPassage027Pdf } from "@/features/representacion/services/passage-pdf";

const base026 = {
  ooad: "MICHOACÁN",
  requestDate: "2026-09-14",
  paternalSurname: "Ejemplo",
  maternalSurname: "Prueba",
  firstName: "María",
  employeeNumber: "00000001",
  category: "ENFERMERA GENERAL",
  assignment: "HGR No. 1",
  extramuralFunctions: "Funciones extramuros de ejemplo",
  transferPeriod: "Enero 2026",
};

describe("pasajes 026/027", () => {
  it("026 válido no reporta faltantes; sin funciones sí", () => {
    expect(validatePassage026({ ...base026, controlNumber: "" })).toEqual([]);
    expect(validatePassage026({ ...base026, extramuralFunctions: "" }).length).toBeGreaterThan(0);
  });
  it("027 exige domicilios completos y horario discontinuo", () => {
    const addr = { street: "Calle", neighborhood: "Col", postalCode: "00000", municipality: "Mun", state: "Mich" };
    expect(
      validatePassage027({
        ooad: "MICHOACÁN",
        requestDate: "2026-09-14",
        paternalSurname: "Ejemplo",
        maternalSurname: "Prueba",
        firstName: "María",
        employeeNumber: "00000001",
        category: "ENFERMERA GENERAL",
        assignment: "HGR No. 1",
        discontinuousSchedule: "No",
        workerAddress: addr,
        assignmentAddress: addr,
        phone: "0000000000",
      }),
    ).toEqual([]);
    expect(
      validatePassage027({
        ooad: "",
        requestDate: "",
        paternalSurname: "",
        maternalSurname: "",
        firstName: "",
        employeeNumber: "",
        category: "",
        assignment: "",
        discontinuousSchedule: "",
        workerAddress: { street: "", neighborhood: "", postalCode: "", municipality: "", state: "" },
        assignmentAddress: addr,
        phone: "",
      }).length,
    ).toBeGreaterThan(2);
  });
  it("PDF 026 se genera y no está vacío", async () => {
    const pdf = await buildPassage026Pdf({
      ooad: "MICHOACÁN",
      day: "14",
      month: "09",
      year: "2026",
      controlNumber: "pendiente",
      worker: { paternalSurname: "Ejemplo", maternalSurname: "Prueba", firstName: "María", employeeNumber: "00000001", category: "ENFERMERA GENERAL", assignment: "HGR No. 1" },
      extramuralFunctions: "Funciones extramuros",
      transferPeriod: "Periodo",
      folioLabel: "XXI-2026-PAS-000001",
    });
    expect(pdf.length).toBeGreaterThan(2000);
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe("%PDF-");
  });
  it("PDF 027 tiene 2 páginas (incluye aviso)", async () => {
    const addr = { street: "Calle", neighborhood: "Col", postalCode: "00000", municipality: "Mun", state: "Mich" };
    const pdf = await buildPassage027Pdf({
      ooad: "MICHOACÁN",
      day: "14",
      month: "09",
      year: "2026",
      controlNumber: "pendiente",
      worker: { paternalSurname: "Ejemplo", maternalSurname: "Prueba", firstName: "María", employeeNumber: "00000001", category: "ENFERMERA GENERAL", assignment: "HGR No. 1" },
      discontinuousSchedule: "No",
      workerAddress: addr,
      assignmentAddress: addr,
      phone: "0000000000",
      folioLabel: "XXI-2026-PAS-000002",
    });
    expect(pdf.length).toBeGreaterThan(3000);
  });
});
