import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import crypto from "node:crypto";
import type { UnionLicenseDocumentData } from "../services/license-document-dto";
import {
  generateStationToken,
  hashStationToken,
  timingSafeTokenMatch,
  authenticatePrintStation,
} from "../services/print-token";
import {
  isStationOnline,
  createUnionPrintJob,
  createLicensePrintJob,
  retryPrintJob,
} from "../services/print-jobs";
import {
  getPrintableDocumentLabel,
  resolvePrintableDocumentTypeForCase,
  getPrintableDocumentDefinition,
  isPrintableCaseType,
} from "../services/print-document-registry";
import { GET as downloadJobDocument } from "@/app/api/union/print-agent/jobs/[id]/document/route";

// Mock de Supabase server
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock de permisos sindicales para pruebas unitarias
vi.mock("../services/permissions", () => ({
  requireUnionMembership: vi.fn().mockResolvedValue([{ delegation_id: "del-uuid-1" }]),
}));

// Mock de licencias y documentos
vi.mock("../services/license-document-dto", () => ({
  buildUnionLicenseDocumentData: vi.fn(),
}));

vi.mock("../services/license-print-package", () => ({
  buildLicensePrintPackage: vi.fn(),
}));

vi.mock("../services/passage-document-service", () => ({
  buildPassageDocument: vi.fn(),
}));

vi.mock("../services/cases", () => ({
  addCaseEvent: vi.fn(),
}));

describe("Módulo de Impresión Sindical — Seguridad, Tokens y Ciclo de Vida", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Tokens Criptográficos de Estación (print-token.ts)", () => {
    it("genera un token aleatorio de 64 caracteres hex y su hash SHA-256 correspondiente", () => {
      const { rawToken, tokenHash } = generateStationToken();
      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(hashStationToken(rawToken)).toBe(tokenHash);
    });

    it("valida tokens de forma segura con timingSafeTokenMatch", () => {
      const { rawToken, tokenHash } = generateStationToken();
      expect(timingSafeTokenMatch(rawToken, tokenHash)).toBe(true);
      expect(timingSafeTokenMatch("token-falso-o-invalido", tokenHash)).toBe(false);
      expect(timingSafeTokenMatch("", tokenHash)).toBe(false);
      expect(timingSafeTokenMatch(rawToken, "")).toBe(false);
    });

    it("autentica correctamente peticiones de la estación con x-station-token", async () => {
      const { rawToken } = generateStationToken();

      const mockStation = {
        id: "station-uuid-1",
        delegation_id: "del-uuid-1",
        name: "Oficina Sindical Delegación XXI",
        printer_name: "HP LaserJet Pro M501dn",
        is_active: true,
        last_seen_at: new Date().toISOString(),
        agent_version: "1.0.0",
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockStation, error: null }),
            }),
          }),
        }),
      };

      const req = new Request("http://localhost:3000/api/union/print-agent/heartbeat", {
        headers: { "x-station-token": rawToken },
      });

      const result = await authenticatePrintStation(req, mockSupabase as unknown as SupabaseClient<Database>);
      expect(result.errorResponse).toBeNull();
      expect(result.station).toEqual(mockStation);
    });

    it("rechaza peticiones sin token o con token vacío con 401", async () => {
      const mockSupabase = { from: vi.fn() };
      const req = new Request("http://localhost:3000/api/union/print-agent/heartbeat");

      const result = await authenticatePrintStation(req, mockSupabase as unknown as SupabaseClient<Database>);
      expect(result.station).toBeNull();
      expect(result.errorResponse?.status).toBe(401);
    });

    it("rechaza peticiones de estaciones desactivadas con 403", async () => {
      const { rawToken } = generateStationToken();

      const mockStation = {
        id: "station-uuid-1",
        is_active: false,
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockStation, error: null }),
            }),
          }),
        }),
      };

      const req = new Request("http://localhost:3000/api/union/print-agent/heartbeat", {
        headers: { "x-station-token": rawToken },
      });

      const result = await authenticatePrintStation(req, mockSupabase as unknown as SupabaseClient<Database>);
      expect(result.station).toBeNull();
      expect(result.errorResponse?.status).toBe(403);
    });
  });

  describe("2. Estado de Conexión de la Estación (isStationOnline)", () => {
    it("determina que una estación está en línea si el latido es reciente (< 45s)", () => {
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
      expect(isStationOnline(tenSecondsAgo)).toBe(true);
    });

    it("determina que una estación está desconectada si supera el umbral", () => {
      const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
      expect(isStationOnline(twoMinutesAgo)).toBe(false);
    });

    it("retorna false si last_seen_at es nulo", () => {
      expect(isStationOnline(null)).toBe(false);
    });
  });

  describe("3. Registro Central de Documentos Imprimibles (print-document-registry.ts)", () => {
    it("deriva correctamente los document_type desde los case_type oficiales", () => {
      expect(resolvePrintableDocumentTypeForCase("license")).toBe("license_package");
      expect(resolvePrintableDocumentTypeForCase("passage_026")).toBe("passage_026");
      expect(resolvePrintableDocumentTypeForCase("passage_027")).toBe("passage_027");
      expect(() => resolvePrintableDocumentTypeForCase("maternity")).toThrow(
        "no cuenta con un documento PDF imprimible",
      );
      expect(() => resolvePrintableDocumentTypeForCase("lactation")).toThrow(
        "no cuenta con un documento PDF imprimible",
      );
    });

    it("identifica tipos imprimibles con isPrintableCaseType", () => {
      expect(isPrintableCaseType("license")).toBe(true);
      expect(isPrintableCaseType("passage_026")).toBe(true);
      expect(isPrintableCaseType("passage_027")).toBe(true);
      expect(isPrintableCaseType("maternity")).toBe(false);
      expect(isPrintableCaseType("locker")).toBe(false);
    });

    it("genera etiquetas legibles para la UI y no rompe con tipos desconocidos", () => {
      expect(getPrintableDocumentLabel("license_package")).toBe("Licencia");
      expect(getPrintableDocumentLabel("passage_026")).toBe("Pasaje 026");
      expect(getPrintableDocumentLabel("passage_027")).toBe("Pasaje 027");
      expect(getPrintableDocumentLabel("otro_futuro")).toBe("Documento sindical");
      expect(getPrintableDocumentLabel(null)).toBe("Documento sindical");
    });

    it("provee metadata central correcta por definición", () => {
      const defLic = getPrintableDocumentDefinition("license_package");
      expect(defLic?.label).toBe("Licencia");
      expect(defLic?.defaultCopies).toBe(1);
      expect(defLic?.defaultDuplex).toBe(false);

      const def026 = getPrintableDocumentDefinition("passage_026");
      expect(def026?.label).toBe("Pasaje 026");

      const def027 = getPrintableDocumentDefinition("passage_027");
      expect(def027?.label).toBe("Pasaje 027");
    });
  });

  describe("4. Creación y Ciclo de Vida de Trabajos de Impresión (createUnionPrintJob)", () => {
    it("lanza error descriptivo si no hay ninguna estación activa en la delegación", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-uuid-1",
                      delegation_id: "del-uuid-1",
                      folio: "XXI-2026-LIC-000001",
                      case_type: "license",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      await expect(
        createUnionPrintJob({
          caseId: "case-uuid-1",
          userId: "user-uuid-1",
        }),
      ).rejects.toThrow("No hay ninguna estación de impresión configurada o activa");
    });

    it("crea un trabajo de Licencia (2 páginas) con SHA-256 inmutable y almacenamiento en union-private", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { buildUnionLicenseDocumentData } = await import("../services/license-document-dto");
      const { buildLicensePrintPackage } = await import("../services/license-print-package");
      const { addCaseEvent } = await import("../services/cases");

      vi.mocked(buildUnionLicenseDocumentData).mockResolvedValue({
        caseId: "case-uuid-lic",
        delegationId: "del-uuid-1",
        delegationCode: "XXI",
        folio: "XXI-2026-LIC-000001",
        revisionNumber: 2,
      } as unknown as UnionLicenseDocumentData);

      const fakePdfBuffer = Buffer.from("%PDF-1.4 mock license print package 2 pages");
      const expectedSha = crypto.createHash("sha256").update(fakePdfBuffer).digest("hex");

      vi.mocked(buildLicensePrintPackage).mockResolvedValue({
        buffer: fakePdfBuffer,
        pageCount: 2,
      });

      const mockStation = {
        id: "station-uuid-1",
        delegation_id: "del-uuid-1",
        name: "Oficina Sindical Delegación XXI",
        printer_name: "HP LaserJet Pro M501dn",
        is_active: true,
      };

      const mockUpload = vi.fn().mockResolvedValue({ data: { path: "some/path.pdf" }, error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-uuid-lic",
                      delegation_id: "del-uuid-1",
                      folio: "XXI-2026-LIC-000001",
                      case_type: "license",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: mockStation }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              insert: vi.fn().mockImplementation((payload) => ({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      ...payload,
                      id: payload.id || "job-uuid-lic",
                    },
                    error: null,
                  }),
                }),
              })),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const result = await createUnionPrintJob({
        caseId: "case-uuid-lic",
        userId: "user-uuid-1",
        copies: 1,
      });

      expect(result.job.status).toBe("queued");
      expect(result.job.document_type).toBe("license_package");
      expect(result.job.document_revision).toBe(2);
      expect(result.job.document_sha256).toBe(expectedSha);
      expect(result.job.document_storage_path).toContain("print-jobs/del-uuid-1/case-uuid-lic/");
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining("print-jobs/del-uuid-1/case-uuid-lic/"),
        fakePdfBuffer,
        expect.objectContaining({ contentType: "application/pdf", upsert: false }),
      );
      expect(addCaseEvent).toHaveBeenCalledWith(
        "case-uuid-lic",
        "document",
        "Trabajo de impresión enviado a oficina",
        expect.stringContaining("Licencia XXI-2026-LIC-000001 (Rev. 2)"),
      );
    });

    it("crea un trabajo de Pasaje 026 (1 página) reutilizando la plantilla oficial y guardándolo en storage", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { buildPassageDocument } = await import("../services/passage-document-service");
      const { addCaseEvent } = await import("../services/cases");

      const fakePdfBuffer026 = Buffer.from("%PDF-1.4 mock passage 026 1 page");
      const expectedSha026 = crypto.createHash("sha256").update(fakePdfBuffer026).digest("hex");

      vi.mocked(buildPassageDocument).mockResolvedValue({
        buffer: fakePdfBuffer026,
        documentType: "passage_026",
        delegationId: "del-uuid-1",
        caseId: "case-uuid-026",
        folio: "XXI-2026-PAS-000126",
        concept: "026",
        filename: "pasaje-026-XXI-2026-PAS-000126.pdf",
        pageCount: 1,
      });

      const mockStation = {
        id: "station-uuid-1",
        delegation_id: "del-uuid-1",
        name: "Oficina Sindical Delegación XXI",
        printer_name: "HP LaserJet Pro M501dn",
        is_active: true,
      };

      const mockUpload = vi.fn().mockResolvedValue({ data: { path: "some/path026.pdf" }, error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-uuid-026",
                      delegation_id: "del-uuid-1",
                      folio: "XXI-2026-PAS-000126",
                      case_type: "passage_026",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: mockStation }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              insert: vi.fn().mockImplementation((payload) => ({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...payload, id: payload.id || "job-uuid-026" },
                    error: null,
                  }),
                }),
              })),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const result = await createUnionPrintJob({
        caseId: "case-uuid-026",
        userId: "user-uuid-1",
      });

      expect(result.job.status).toBe("queued");
      expect(result.job.document_type).toBe("passage_026");
      expect(result.job.document_revision).toBe(1);
      expect(result.job.document_sha256).toBe(expectedSha026);
      expect(result.job.document_storage_path).toContain("print-jobs/del-uuid-1/case-uuid-026/");
      expect(addCaseEvent).toHaveBeenCalledWith(
        "case-uuid-026",
        "document",
        "Trabajo de impresión enviado a oficina",
        expect.stringContaining("Pasaje 026 XXI-2026-PAS-000126 (Rev. 1)"),
      );
    });

    it("crea un trabajo de Pasaje 027 (2 páginas) reutilizando la plantilla oficial y guardándolo en storage", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { buildPassageDocument } = await import("../services/passage-document-service");

      const fakePdfBuffer027 = Buffer.from("%PDF-1.4 mock passage 027 2 pages");
      const expectedSha027 = crypto.createHash("sha256").update(fakePdfBuffer027).digest("hex");

      vi.mocked(buildPassageDocument).mockResolvedValue({
        buffer: fakePdfBuffer027,
        documentType: "passage_027",
        delegationId: "del-uuid-1",
        caseId: "case-uuid-027",
        folio: "XXI-2026-PAS-000127",
        concept: "027",
        filename: "pasaje-027-XXI-2026-PAS-000127.pdf",
        pageCount: 2,
      });

      const mockStation = {
        id: "station-uuid-1",
        delegation_id: "del-uuid-1",
        name: "Oficina Sindical Delegación XXI",
        printer_name: "HP LaserJet Pro M501dn",
        is_active: true,
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-uuid-027",
                      delegation_id: "del-uuid-1",
                      folio: "XXI-2026-PAS-000127",
                      case_type: "passage_027",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: mockStation }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              insert: vi.fn().mockImplementation((payload) => ({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...payload, id: payload.id || "job-uuid-027" },
                    error: null,
                  }),
                }),
              })),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ data: { path: "p" }, error: null }),
            remove: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const result = await createUnionPrintJob({
        caseId: "case-uuid-027",
        userId: "user-uuid-1",
        copies: 2,
      });

      expect(result.job.status).toBe("queued");
      expect(result.job.document_type).toBe("passage_027");
      expect(result.job.copies).toBe(2);
      expect(result.job.document_sha256).toBe(expectedSha027);
    });

    it("limpia el archivo huérfano en Storage si la inserción del job en DB falla", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { buildUnionLicenseDocumentData } = await import("../services/license-document-dto");
      const { buildLicensePrintPackage } = await import("../services/license-print-package");

      vi.mocked(buildUnionLicenseDocumentData).mockResolvedValue({
        caseId: "case-uuid-err",
        delegationId: "del-uuid-1",
        folio: "XXI-2026-LIC-000001",
        revisionNumber: 1,
      } as unknown as UnionLicenseDocumentData);

      vi.mocked(buildLicensePrintPackage).mockResolvedValue({
        buffer: Buffer.from("pdf-data"),
        pageCount: 2,
      });

      const mockStation = {
        id: "station-uuid-1",
        delegation_id: "del-uuid-1",
        name: "Oficina Sindical",
        is_active: true,
      };

      const mockRemove = vi.fn().mockResolvedValue({ data: [], error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-uuid-err",
                      delegation_id: "del-uuid-1",
                      folio: "XXI-2026-LIC-000001",
                      case_type: "license",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: mockStation }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: new Error("DB connection error") }),
                }),
              }),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ data: { path: "p" }, error: null }),
            remove: mockRemove,
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      await expect(
        createUnionPrintJob({
          caseId: "case-uuid-err",
          userId: "user-uuid-1",
        }),
      ).rejects.toThrow("Error al registrar el trabajo en la cola de impresión");

      expect(mockRemove).toHaveBeenCalled();
    });

    it("mantiene createLicensePrintJob como wrapper 100% compatible", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { buildUnionLicenseDocumentData } = await import("../services/license-document-dto");
      const { buildLicensePrintPackage } = await import("../services/license-print-package");

      vi.mocked(buildUnionLicenseDocumentData).mockResolvedValue({
        caseId: "case-uuid-wrap",
        delegationId: "del-uuid-1",
        folio: "XXI-2026-LIC-000001",
        revisionNumber: 1,
      } as unknown as UnionLicenseDocumentData);

      vi.mocked(buildLicensePrintPackage).mockResolvedValue({
        buffer: Buffer.from("pdf-data"),
        pageCount: 2,
      });

      const mockStation = {
        id: "station-uuid-1",
        delegation_id: "del-uuid-1",
        name: "Oficina Sindical",
        is_active: true,
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-uuid-wrap",
                      delegation_id: "del-uuid-1",
                      folio: "XXI-2026-LIC-000001",
                      case_type: "license",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: mockStation }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              insert: vi.fn().mockImplementation((payload) => ({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...payload, id: "j-wrap" }, error: null }),
                }),
              })),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ data: { path: "p" }, error: null }),
            remove: vi.fn(),
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const result = await createLicensePrintJob({
        caseId: "case-uuid-wrap",
        userId: "user-uuid-1",
      });

      expect(result.job.status).toBe("queued");
      expect(result.job.document_type).toBe("license_package");
    });
  });

  describe("5. Inmutabilidad e Integridad en Descarga (/api/union/print-agent/jobs/[id]/document)", () => {
    it("descarga exactamente los bytes almacenados sin regenerar el PDF (Inmutabilidad garantizada)", async () => {
      const { rawToken } = generateStationToken();
      const { createClient } = await import("@/lib/supabase/server");

      const originalPdfBuffer = Buffer.from("%PDF-1.4 Original Inmutable PDF Bytes");
      const originalSha = crypto.createHash("sha256").update(originalPdfBuffer).digest("hex");

      const mockStation = {
        id: "station-uuid-1",
        delegation_id: "del-uuid-1",
        name: "Oficina Sindical",
        is_active: true,
      };

      const mockJob = {
        id: "job-uuid-imm",
        station_id: "station-uuid-1",
        case_id: "case-uuid-1",
        document_type: "passage_026",
        document_revision: 1,
        status: "claimed",
        document_sha256: originalSha,
        document_size_bytes: originalPdfBuffer.length,
        document_storage_path: "print-jobs/del-uuid-1/case-uuid-1/job-uuid-imm.pdf",
      };

      const mockDownload = vi.fn().mockResolvedValue({
        data: {
          arrayBuffer: async () => originalPdfBuffer.buffer.slice(
            originalPdfBuffer.byteOffset,
            originalPdfBuffer.byteOffset + originalPdfBuffer.byteLength,
          ),
        },
        error: null,
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockStation, error: null }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            download: mockDownload,
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const req = new Request("http://localhost:3000/api/union/print-agent/jobs/job-uuid-imm/document", {
        headers: { "x-station-token": rawToken },
      });

      const response = await downloadJobDocument(req, {
        params: Promise.resolve({ id: "job-uuid-imm" }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("X-Document-SHA256")).toBe(originalSha);

      const downloadedBytes = Buffer.from(await response.arrayBuffer());
      expect(downloadedBytes.equals(originalPdfBuffer)).toBe(true);
    });

    it("falla con DOCUMENT_INTEGRITY_MISMATCH (422) si el SHA almacenado fue alterado", async () => {
      const { rawToken } = generateStationToken();
      const { createClient } = await import("@/lib/supabase/server");

      const corruptedBuffer = Buffer.from("%PDF-1.4 Corrupted or Altered Bytes");

      const mockStation = {
        id: "station-uuid-1",
        is_active: true,
      };

      const mockJob = {
        id: "job-uuid-corrupted",
        station_id: "station-uuid-1",
        case_id: "case-uuid-1",
        document_type: "license_package",
        document_revision: 1,
        status: "printing",
        document_sha256: "0000000000000000000000000000000000000000000000000000000000000000", // Hash diferente
        document_size_bytes: corruptedBuffer.length,
        document_storage_path: "print-jobs/del-uuid-1/case-uuid-1/job-corrupt.pdf",
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockStation, error: null }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            download: vi.fn().mockResolvedValue({
              data: {
                arrayBuffer: async () => corruptedBuffer.buffer.slice(
                  corruptedBuffer.byteOffset,
                  corruptedBuffer.byteOffset + corruptedBuffer.byteLength,
                ),
              },
              error: null,
            }),
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const req = new Request("http://localhost:3000/api/union/print-agent/jobs/job-uuid-corrupted/document", {
        headers: { "x-station-token": rawToken },
      });

      const response = await downloadJobDocument(req, {
        params: Promise.resolve({ id: "job-uuid-corrupted" }),
      });

      expect(response.status).toBe(422);
      const json = await response.json();
      expect(json.error).toBe("DOCUMENT_INTEGRITY_MISMATCH");
    });

    it("bloquea con 403 si una estación intenta descargar un trabajo asignado a otra estación", async () => {
      const { rawToken } = generateStationToken();
      const { createClient } = await import("@/lib/supabase/server");

      const mockStationA = {
        id: "station-A",
        is_active: true,
      };

      const mockJobStationB = {
        id: "job-b",
        station_id: "station-B", // Estación ajena
        status: "claimed",
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockStationA, error: null }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockJobStationB, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const req = new Request("http://localhost:3000/api/union/print-agent/jobs/job-b/document", {
        headers: { "x-station-token": rawToken },
      });

      const response = await downloadJobDocument(req, {
        params: Promise.resolve({ id: "job-b" }),
      });

      expect(response.status).toBe(403);
    });

    it("bloquea con 409 si el trabajo aún no ha sido reclamado (status queued)", async () => {
      const { rawToken } = generateStationToken();
      const { createClient } = await import("@/lib/supabase/server");

      const mockStation = {
        id: "station-uuid-1",
        is_active: true,
      };

      const mockJob = {
        id: "job-queued",
        station_id: "station-uuid-1",
        status: "queued", // Aún no reclamado
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockStation, error: null }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const req = new Request("http://localhost:3000/api/union/print-agent/jobs/job-queued/document", {
        headers: { "x-station-token": rawToken },
      });

      const response = await downloadJobDocument(req, {
        params: Promise.resolve({ id: "job-queued" }),
      });

      expect(response.status).toBe(409);
    });
  });

  describe("6. Retrocompatibilidad con Trabajos Legacy (document_storage_path = null)", () => {
    it("reconstruye y sirve el documento legacy de licencia solo si el SHA coincide exactamente", async () => {
      const { rawToken } = generateStationToken();
      const { createClient } = await import("@/lib/supabase/server");
      const { buildUnionLicenseDocumentData } = await import("../services/license-document-dto");
      const { buildLicensePrintPackage } = await import("../services/license-print-package");

      const legacyPdfBuffer = Buffer.from("%PDF-1.4 Legacy Reconstructed Document");
      const legacySha = crypto.createHash("sha256").update(legacyPdfBuffer).digest("hex");

      vi.mocked(buildUnionLicenseDocumentData).mockResolvedValue({
        caseId: "case-legacy",
        delegationId: "del-uuid-1",
        folio: "XXI-2026-LIC-000001",
        revisionNumber: 1,
      } as unknown as UnionLicenseDocumentData);

      vi.mocked(buildLicensePrintPackage).mockResolvedValue({
        buffer: legacyPdfBuffer,
        pageCount: 2,
      });

      const mockStation = {
        id: "station-uuid-1",
        is_active: true,
      };

      const mockLegacyJob = {
        id: "job-legacy-1",
        station_id: "station-uuid-1",
        case_id: "case-legacy",
        document_type: "license_package",
        document_revision: 1,
        status: "claimed",
        document_sha256: legacySha,
        document_storage_path: null, // Legacy sin ruta
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockStation, error: null }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockLegacyJob, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ data: { path: "p" }, error: null }),
          }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const req = new Request("http://localhost:3000/api/union/print-agent/jobs/job-legacy-1/document", {
        headers: { "x-station-token": rawToken },
      });

      const response = await downloadJobDocument(req, {
        params: Promise.resolve({ id: "job-legacy-1" }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Document-SHA256")).toBe(legacySha);
    });

    it("falla con LEGACY_DOCUMENT_CHANGED si los datos del expediente cambiaron y no coinciden con el SHA histórico", async () => {
      const { rawToken } = generateStationToken();
      const { createClient } = await import("@/lib/supabase/server");
      const { buildUnionLicenseDocumentData } = await import("../services/license-document-dto");
      const { buildLicensePrintPackage } = await import("../services/license-print-package");

      const modifiedPdfBuffer = Buffer.from("%PDF-1.4 Reconstructed with Newer Data");

      vi.mocked(buildUnionLicenseDocumentData).mockResolvedValue({
        caseId: "case-legacy-mod",
        delegationId: "del-uuid-1",
        folio: "XXI-2026-LIC-000001",
        revisionNumber: 1,
      } as unknown as UnionLicenseDocumentData);

      vi.mocked(buildLicensePrintPackage).mockResolvedValue({
        buffer: modifiedPdfBuffer,
        pageCount: 2,
      });

      const mockStation = {
        id: "station-uuid-1",
        is_active: true,
      };

      const mockLegacyJob = {
        id: "job-legacy-mod",
        station_id: "station-uuid-1",
        case_id: "case-legacy-mod",
        document_type: "license_package",
        document_revision: 1,
        status: "claimed",
        document_sha256: "historical-sha-that-no-longer-matches",
        document_storage_path: null,
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_print_stations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockStation, error: null }),
                }),
              }),
            };
          }
          if (table === "union_print_jobs") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockLegacyJob, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const req = new Request("http://localhost:3000/api/union/print-agent/jobs/job-legacy-mod/document", {
        headers: { "x-station-token": rawToken },
      });

      const response = await downloadJobDocument(req, {
        params: Promise.resolve({ id: "job-legacy-mod" }),
      });

      expect(response.status).toBe(422);
      const json = await response.json();
      expect(json.error).toBe("LEGACY_DOCUMENT_CHANGED");
    });
  });

  describe("7. Reintentos e Idempotencia (retryPrintJob)", () => {
    it("permite reintentar un trabajo fallido cambiándolo a queued", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockFailedJob = {
        id: "job-uuid-failed",
        status: "failed",
        case_id: "case-uuid-1",
      };

      const mockUpdatedJob = {
        id: "job-uuid-failed",
        status: "queued",
        case_id: "case-uuid-1",
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockFailedJob, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockUpdatedJob, error: null }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const res = await retryPrintJob("job-uuid-failed", "user-uuid-1");
      expect(res.status).toBe("queued");
    });

    it("bloquea el reintento si el trabajo ya está en proceso de impresión", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "j1", status: "printing" }, error: null }),
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      await expect(retryPrintJob("j1", "user-uuid-1")).rejects.toThrow(
        "El trabajo ya se está procesando actualmente en la impresora",
      );
    });

    it("bloquea el reintento de un trabajo ya impreso para exigir Reimprimir", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "j1", status: "printed" }, error: null }),
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      await expect(retryPrintJob("j1", "user-uuid-1")).rejects.toThrow(
        "Este trabajo ya fue impreso exitosamente",
      );
    });
  });
});
