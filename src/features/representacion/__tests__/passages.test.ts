import { describe, expect, it, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { validatePassage026, validatePassage027 } from "@/features/representacion/lib/passages";
import { resolveUnionWorkerName } from "@/features/representacion/services/worker-name-resolver";
import { buildPassage026Pdf, buildPassage027Pdf } from "@/features/representacion/services/passage-pdf";
import {
  getActiveUnionDocumentTemplate,
  clearUnionTemplateCache,
  UnionTemplateError,
} from "@/features/representacion/services/union-document-template-repository";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const template026Path = path.resolve(process.cwd(), "assets/templates/union/pasajes/formato-concepto-026.pdf");
const template027Path = path.resolve(process.cwd(), "assets/templates/union/pasajes/formato-concepto-027.pdf");

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

const baseWorker = {
  paternalSurname: "BOLAÑOS",
  maternalSurname: "VÁZQUEZ",
  firstName: "EDUARDO PRUEBA",
  employeeNumber: "12345678",
  category: "TÉCNICO RADIÓLOGO",
  assignment: "HOSPITAL GENERAL REGIONAL No. 1",
};

const baseAddress = {
  street: "AV. FRANCISCO I. MADERO PONIENTE 1234 INT 5",
  neighborhood: "CENTRO HISTÓRICO",
  postalCode: "58000",
  municipality: "MORELIA",
  state: "MICHOACÁN",
};

describe("pasajes 026/027 - validaciones de entrada", () => {
  it("026 válido no reporta faltantes; sin funciones sí", () => {
    expect(validatePassage026({ ...base026, controlNumber: "" })).toEqual([]);
    expect(validatePassage026({ ...base026, extramuralFunctions: "" }).length).toBeGreaterThan(0);
  });

  it("027 exige domicilios completos y horario discontinuo", () => {
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
        workerAddress: baseAddress,
        assignmentAddress: baseAddress,
        phone: "4431234567",
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
        assignmentAddress: baseAddress,
        phone: "",
      }).length,
    ).toBeGreaterThan(2);
  });

  it("reproduce el bug: trabajador SIAP tiene display name válido pero falla al validar con campos crudos", () => {
    const SIAP_ONLY_WORKER = {
      id: "w-siap-001",
      employee_number: "98173968",
      first_name: "",
      paternal_surname: "",
      maternal_surname: "",
      siap_full_name: "BOLA&OS/VAZQUEZ/EDUARDO",
      category: "TÉCNICO RADIÓLOGO",
      assignment: "HGR No. 1",
      turn: "VESPERTINO",
    };

    // 1. Resolver canónico sí produce el nombre completo correcto
    const resolved = resolveUnionWorkerName(SIAP_ONLY_WORKER);
    expect(resolved.displayName).toBe("BOLAÑOS VAZQUEZ EDUARDO");
    expect(resolved.paternalSurname).toBe("BOLAÑOS");
    expect(resolved.maternalSurname).toBe("VAZQUEZ");
    expect(resolved.givenNames).toBe("EDUARDO");
    expect(resolved.validForLicense).toBe(true);

    // 2. Si se usan campos crudos directamente (como hacía PassageWizard):
    const missingWithRawFields = validatePassage027({
      ooad: "MICHOACÁN",
      requestDate: "2026-09-14",
      paternalSurname: SIAP_ONLY_WORKER.paternal_surname,
      maternalSurname: SIAP_ONLY_WORKER.maternal_surname,
      firstName: SIAP_ONLY_WORKER.first_name,
      employeeNumber: SIAP_ONLY_WORKER.employee_number,
      category: SIAP_ONLY_WORKER.category,
      assignment: SIAP_ONLY_WORKER.assignment,
      discontinuousSchedule: "No",
      workerAddress: baseAddress,
      assignmentAddress: baseAddress,
      phone: "4431234567",
    });

    // Confirma el síntoma exacto del bug reportado en producción:
    expect(missingWithRawFields).toContain("Apellido paterno");
    expect(missingWithRawFields).toContain("Nombre(s)");

    // 3. Al usar los campos resueltos por resolveUnionWorkerName:
    const missingWithResolvedFields = validatePassage027({
      ooad: "MICHOACÁN",
      requestDate: "2026-09-14",
      paternalSurname: resolved.paternalSurname,
      maternalSurname: resolved.maternalSurname,
      firstName: resolved.givenNames,
      employeeNumber: SIAP_ONLY_WORKER.employee_number,
      category: SIAP_ONLY_WORKER.category,
      assignment: SIAP_ONLY_WORKER.assignment,
      discontinuousSchedule: "No",
      workerAddress: baseAddress,
      assignmentAddress: baseAddress,
      phone: "4431234567",
    });

    expect(missingWithResolvedFields).toEqual([]);
  });
});

describe("pasajes 026 - generación sobre plantilla oficial", () => {
  it("carga la plantilla oficial, conserva exactamente 1 página y no altera el archivo en disco", async () => {
    const originalBuffer = fs.readFileSync(template026Path);
    const originalHash = crypto.createHash("sha256").update(originalBuffer).digest("hex");

    const pdf = await buildPassage026Pdf(
      {
        ooad: "MICHOACÁN",
        day: "21",
        month: "09",
        year: "2026",
        controlNumber: "12345678",
        worker: baseWorker,
        extramuralFunctions: "FUNCIONES EXTRAMUROS DE PRUEBA EN DIVERSAS CLÍNICAS",
        transferPeriod: "01/01/2026 AL 31/01/2026",
        folioLabel: "XXI-2026-PAS-000001",
      },
      originalBuffer,
    );

    // 1. Cabecera %PDF-
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(50000);

    // 2. Exactamente 1 página
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);

    // 3. Plantilla en disco intacta
    const diskBuffer = fs.readFileSync(template026Path);
    const diskHash = crypto.createHash("sha256").update(diskBuffer).digest("hex");
    expect(diskHash).toBe(originalHash);
  });

  it("falla si la plantilla está vacía o si la cantidad de páginas no es 1", async () => {
    await expect(
      buildPassage026Pdf(
        {
          ooad: "MICHOACÁN",
          day: "21",
          month: "09",
          year: "2026",
          controlNumber: "12345678",
          worker: baseWorker,
          extramuralFunctions: "Funciones",
          transferPeriod: "Periodo",
        },
        Buffer.from(""),
      ),
    ).rejects.toThrow(/vacío/i);

    // Usar la plantilla de 027 (que tiene 2 páginas) debe fallar para 026
    const buf027 = fs.readFileSync(template027Path);
    await expect(
      buildPassage026Pdf(
        {
          ooad: "MICHOACÁN",
          day: "21",
          month: "09",
          year: "2026",
          controlNumber: "12345678",
          worker: baseWorker,
          extramuralFunctions: "Funciones",
          transferPeriod: "Periodo",
        },
        buf027,
      ),
    ).rejects.toThrow(/se esperaban 1 pero el documento tiene 2/i);
  });

  it("genera PDF de pasaje 026 correctamente con trabajador resuelto desde SIAP", async () => {
    const siapWorkerRaw = {
      id: "w-siap-001",
      employee_number: "98173968",
      first_name: "",
      paternal_surname: "",
      maternal_surname: "",
      siap_full_name: "BOLA&OS/VAZQUEZ/EDUARDO",
      category: "TÉCNICO RADIÓLOGO",
      assignment: "HGR No. 1",
    };

    const resolvedName = resolveUnionWorkerName(siapWorkerRaw);
    expect(resolvedName.paternalSurname).toBe("BOLAÑOS");
    expect(resolvedName.maternalSurname).toBe("VAZQUEZ");
    expect(resolvedName.givenNames).toBe("EDUARDO");

    const originalBuffer = fs.readFileSync(template026Path);
    const pdf = await buildPassage026Pdf(
      {
        ooad: "MICHOACÁN",
        day: "21",
        month: "09",
        year: "2026",
        controlNumber: "12345678",
        worker: {
          paternalSurname: resolvedName.paternalSurname,
          maternalSurname: resolvedName.maternalSurname,
          firstName: resolvedName.givenNames,
          employeeNumber: siapWorkerRaw.employee_number,
          category: siapWorkerRaw.category,
          assignment: siapWorkerRaw.assignment,
        },
        extramuralFunctions: "FUNCIONES EXTRAMUROS EN RADIOLOGÍA",
        transferPeriod: "ENERO 2026",
        folioLabel: "XXI-2026-PAS-000004",
      },
      originalBuffer,
    );

    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("pasajes 027 - generación sobre plantilla oficial", () => {
  it("conserva exactamente 2 páginas, preserva el aviso de privacidad y marca Horario Discontinuo", async () => {
    const originalBuffer = fs.readFileSync(template027Path);
    const originalHash = crypto.createHash("sha256").update(originalBuffer).digest("hex");

    const pdf = await buildPassage027Pdf(
      {
        ooad: "MICHOACÁN",
        day: "21",
        month: "09",
        year: "2026",
        controlNumber: "12345678",
        worker: baseWorker,
        discontinuousSchedule: "Si",
        workerAddress: baseAddress,
        assignmentAddress: baseAddress,
        phone: "4431234567",
        folioLabel: "XXI-2026-PAS-000002",
      },
      originalBuffer,
    );

    // 1. Cabecera %PDF-
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(50000);

    // 2. Exactamente 2 páginas
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(2);

    // 3. Plantilla en disco intacta
    const diskBuffer = fs.readFileSync(template027Path);
    const diskHash = crypto.createHash("sha256").update(diskBuffer).digest("hex");
    expect(diskHash).toBe(originalHash);
  });

  it("falla si la cantidad de páginas de la plantilla no es 2", async () => {
    const buf026 = fs.readFileSync(template026Path);
    await expect(
      buildPassage027Pdf(
        {
          ooad: "MICHOACÁN",
          day: "21",
          month: "09",
          year: "2026",
          controlNumber: "12345678",
          worker: baseWorker,
          discontinuousSchedule: "No",
          workerAddress: baseAddress,
          assignmentAddress: baseAddress,
          phone: "4431234567",
        },
        buf026,
      ),
    ).rejects.toThrow(/se esperaban 2 pero el documento tiene 1/i);
  });

  it("genera PDF de pasaje 027 correctamente con trabajador resuelto desde SIAP", async () => {
    const siapWorkerRaw = {
      id: "w-siap-001",
      employee_number: "98173968",
      first_name: "",
      paternal_surname: "",
      maternal_surname: "",
      siap_full_name: "BOLA&OS/VAZQUEZ/EDUARDO",
      category: "TÉCNICO RADIÓLOGO",
      assignment: "HGR No. 1",
    };

    const resolvedName = resolveUnionWorkerName(siapWorkerRaw);
    expect(resolvedName.paternalSurname).toBe("BOLAÑOS");
    expect(resolvedName.maternalSurname).toBe("VAZQUEZ");
    expect(resolvedName.givenNames).toBe("EDUARDO");

    const originalBuffer = fs.readFileSync(template027Path);
    const pdf = await buildPassage027Pdf(
      {
        ooad: "MICHOACÁN",
        day: "21",
        month: "09",
        year: "2026",
        controlNumber: "12345678",
        worker: {
          paternalSurname: resolvedName.paternalSurname,
          maternalSurname: resolvedName.maternalSurname,
          firstName: resolvedName.givenNames,
          employeeNumber: siapWorkerRaw.employee_number,
          category: siapWorkerRaw.category,
          assignment: siapWorkerRaw.assignment,
        },
        discontinuousSchedule: "Si",
        workerAddress: baseAddress,
        assignmentAddress: baseAddress,
        phone: "4431234567",
        folioLabel: "XXI-2026-PAS-000003",
      },
      originalBuffer,
    );

    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(2);
  });
});

describe("plantillas de pasajes en repositorio y seguridad", () => {
  const delegationId = "25c737ef-7475-4515-a4b5-347a5dcf7c15";
  const fakeContent = Buffer.from("fake-official-passage-template");
  const validSha256 = crypto.createHash("sha256").update(fakeContent).digest("hex");

  beforeEach(() => {
    clearUnionTemplateCache();
    vi.clearAllMocks();
  });

  function createMockSupabase(overrides?: {
    record?: Record<string, unknown> | null;
    queryError?: Error | null;
    downloadBlob?: Blob | null;
    downloadError?: Error | null;
  }) {
    const record =
      overrides?.record !== undefined
        ? overrides.record
        : {
            id: "passage-template-123",
            delegation_id: delegationId,
            template_kind: "passage_027",
            version: "2026.09-v1",
            storage_bucket: "union-private",
            storage_path: "templates/pasajes/027/2026.09-v1/formato-concepto-027.pdf",
            mime_type: "application/pdf",
            sha256: validSha256,
            file_size: fakeContent.length,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
          };

    const downloadBlob =
      overrides?.downloadBlob !== undefined
        ? overrides.downloadBlob
        : new Blob([fakeContent]);

    const downloadFn = vi.fn().mockResolvedValue({
      data: downloadBlob,
      error: overrides?.downloadError ?? null,
    });

    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: record,
          error: overrides?.queryError ?? null,
        }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          download: downloadFn,
        }),
      },
    } as unknown as SupabaseClient<Database>;

    return { mockClient, downloadFn };
  }

  it("resuelve plantilla de pasaje, verifica SHA-256 y utiliza bucket privado union-private", async () => {
    const { mockClient, downloadFn } = createMockSupabase();

    const result = await getActiveUnionDocumentTemplate({
      delegationId,
      templateKind: "passage_027",
      supabase: mockClient,
    });

    expect(result.record.template_kind).toBe("passage_027");
    expect(result.record.storage_bucket).toBe("union-private");
    expect(result.sha256).toBe(validSha256);
    expect(downloadFn).toHaveBeenCalledWith("templates/pasajes/027/2026.09-v1/formato-concepto-027.pdf");
  });

  it("lanza UNION_TEMPLATE_NOT_FOUND si no existe plantilla activa", async () => {
    const { mockClient } = createMockSupabase({ record: null });

    await expect(
      getActiveUnionDocumentTemplate({
        delegationId,
        templateKind: "passage_026",
        supabase: mockClient,
      }),
    ).rejects.toThrow(UnionTemplateError);
  });

  it("lanza UNION_TEMPLATE_INTEGRITY_ERROR si el SHA-256 descargado difiere del registro", async () => {
    const corruptedBlob = new Blob([Buffer.from("corrupted-bytes")]);
    const { mockClient } = createMockSupabase({ downloadBlob: corruptedBlob });

    await expect(
      getActiveUnionDocumentTemplate({
        delegationId,
        templateKind: "passage_027",
        supabase: mockClient,
      }),
    ).rejects.toThrow(/Violación de integridad SHA-256/i);
  });
});
