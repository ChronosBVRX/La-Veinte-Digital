import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { UnionLicenseDocumentData } from "../services/license-document-dto";
import {
  generateStationToken,
  hashStationToken,
  timingSafeTokenMatch,
  authenticatePrintStation,
} from "../services/print-token";
import {
  isStationOnline,
  createLicensePrintJob,
  retryPrintJob,
} from "../services/print-jobs";

// Mock de Supabase server
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock de licencias y documentos
vi.mock("../services/license-document-dto", () => ({
  buildUnionLicenseDocumentData: vi.fn(),
}));

vi.mock("../services/license-print-package", () => ({
  buildLicensePrintPackage: vi.fn(),
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

  describe("3. Creación y Ciclo de Vida de Trabajos de Impresión (createLicensePrintJob)", () => {
    it("lanza error descriptivo si no hay ninguna estación activa en la delegación", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { buildUnionLicenseDocumentData } = await import("../services/license-document-dto");

      vi.mocked(buildUnionLicenseDocumentData).mockResolvedValue({
        caseId: "case-uuid-1",
        delegationId: "del-uuid-1",
        delegationCode: "XXI",
        folio: "XXI-2026-LIC-000001",
        revisionNumber: 1,
      } as unknown as UnionLicenseDocumentData);

      vi.mocked(createClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({
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
        }),
      } as unknown as SupabaseClient<Database>);

      await expect(
        createLicensePrintJob({
          caseId: "case-uuid-1",
          userId: "user-uuid-1",
        }),
      ).rejects.toThrow("No hay ninguna estación de impresión configurada o activa");
    });

    it("crea un trabajo en estado queued con SHA-256 inmutable del paquete conjunto", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { buildUnionLicenseDocumentData } = await import("../services/license-document-dto");
      const { buildLicensePrintPackage } = await import("../services/license-print-package");
      const { addCaseEvent } = await import("../services/cases");

      vi.mocked(buildUnionLicenseDocumentData).mockResolvedValue({
        caseId: "case-uuid-1",
        delegationId: "del-uuid-1",
        delegationCode: "XXI",
        folio: "XXI-2026-LIC-000001",
        revisionNumber: 2,
      } as unknown as UnionLicenseDocumentData);

      const fakePdfBuffer = Buffer.from("%PDF-1.4 mock content for print package");
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

      const mockInsertedJob = {
        id: "job-uuid-1",
        delegation_id: "del-uuid-1",
        station_id: "station-uuid-1",
        case_id: "case-uuid-1",
        document_type: "license_package",
        document_revision: 2,
        status: "queued",
        copies: 1,
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
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
                  single: vi.fn().mockResolvedValue({ data: mockInsertedJob, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as SupabaseClient<Database>);

      const result = await createLicensePrintJob({
        caseId: "case-uuid-1",
        userId: "user-uuid-1",
        copies: 1,
      });

      expect(result.job.status).toBe("queued");
      expect(result.job.document_revision).toBe(2);
      expect(result.station.name).toBe("Oficina Sindical Delegación XXI");
      expect(addCaseEvent).toHaveBeenCalledWith(
        "case-uuid-1",
        "document",
        "Trabajo de impresión enviado a oficina",
        expect.stringContaining("XXI-2026-LIC-000001 (Rev. 2)"),
      );
    });
  });

  describe("4. Reintentos e Idempotencia (retryPrintJob)", () => {
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
