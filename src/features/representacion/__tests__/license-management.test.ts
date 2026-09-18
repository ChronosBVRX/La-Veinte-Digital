import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveLicenseDraft,
  completeLicenseCase,
  updateCompletedLicense,
  listLicenseCases,
  softDeleteLicenseCase,
  restoreLicenseCase,
  hardDeleteLicenseCase,
  markLicenseDocumentsGenerated,
  ConcurrencyConflictError,
} from "../services/license-management";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../services/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe("License Management Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveLicenseDraft", () => {
    it("crea un nuevo borrador cuando no se proporciona caseId", async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: "XXI-2026-LIC-000010", error: null });
      const mockInsertCase = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "case-new-1", folio: "XXI-2026-LIC-000010" },
            error: null,
          }),
        }),
      });
      const mockUpsertLicense = vi.fn().mockResolvedValue({ error: null });
      const mockInsertEvent = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        rpc: mockRpc,
        from: vi.fn((table: string) => {
          if (table === "union_workers") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "worker-1",
                      employee_number: "123456",
                      first_name: "MARIA",
                      paternal_surname: "LOPEZ",
                      maternal_surname: "PEREZ",
                      category: "ENFERMERA",
                      assignment: "HGR 1",
                      turn: "MATUTINO",
                      schedule: "07:00-15:00",
                      rest_days: "SAB-DOM",
                      phone: "5551234567",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_cases") {
            return { insert: mockInsertCase };
          }
          if (table === "union_license_cases") {
            return { upsert: mockUpsertLicense };
          }
          if (table === "union_case_events") {
            return { insert: mockInsertEvent };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const res = await saveLicenseDraft({
        delegationId: "del-xxi",
        delegationCode: "XXI",
        userId: "user-1",
        workerId: "worker-1",
        currentStep: 1,
        withPay: false,
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        reason: "ASUNTOS PARTICULARES",
      });

      expect(res.caseId).toBe("case-new-1");
      expect(res.folio).toBe("XXI-2026-LIC-000010");
      expect(res.currentStep).toBe(1);
      expect(res.status).toBe("draft");
      expect(mockRpc).toHaveBeenCalledWith("union_next_folio", expect.objectContaining({
        p_delegation_code: "XXI",
        p_prefix: "LIC",
      }));
      expect(mockInsertCase).toHaveBeenCalledWith(expect.objectContaining({
        delegation_id: "del-xxi",
        status: "draft",
        current_step: 1,
        folio: "XXI-2026-LIC-000010",
      }));
    });

    it("actualiza el borrador existente sin cambiar de folio ni caseId", async () => {
      const mockUpdateCase = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockUpsertLicense = vi.fn().mockResolvedValue({ error: null });
      const mockInsertEvent = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        rpc: vi.fn(),
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "case-existing-1", folio: "XXI-2026-LIC-000005", status: "draft", delegation_id: "del-xxi" },
                    error: null,
                  }),
                }),
              }),
              update: mockUpdateCase,
            };
          }
          if (table === "union_license_cases") {
            return { upsert: mockUpsertLicense };
          }
          if (table === "union_case_events") {
            return { insert: mockInsertEvent };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const res = await saveLicenseDraft({
        delegationId: "del-xxi",
        delegationCode: "XXI",
        userId: "user-1",
        caseId: "case-existing-1",
        currentStep: 2,
        withPay: true,
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        reason: "ARTICULO 42",
      });

      expect(res.caseId).toBe("case-existing-1");
      expect(res.folio).toBe("XXI-2026-LIC-000005");
      expect(res.currentStep).toBe(2);
      expect(mockUpdateCase).toHaveBeenCalledWith(expect.objectContaining({
        current_step: 2,
        updated_by: "user-1",
      }));
    });
  });

  describe("completeLicenseCase", () => {
    it("completa un trámite cambiando estado a completed", async () => {
      const mockUpdateCase = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockUpsertLicense = vi.fn().mockResolvedValue({ error: null });
      const mockInsertEvent = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_workers") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "worker-1",
                      employee_number: "123456",
                      first_name: "MARIA",
                      paternal_surname: "LOPEZ",
                      maternal_surname: "PEREZ",
                      category: "ENFERMERA",
                      assignment: "HGR 1",
                      turn: "MATUTINO",
                      schedule: "07:00-15:00",
                      rest_days: "SAB-DOM",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "case-1", folio: "XXI-2026-LIC-000001", status: "draft", delegation_id: "del-xxi" },
                    error: null,
                  }),
                }),
              }),
              update: mockUpdateCase,
            };
          }
          if (table === "union_license_cases") {
            return { upsert: mockUpsertLicense };
          }
          if (table === "union_case_events") {
            return { insert: mockInsertEvent };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const res = await completeLicenseCase({
        caseId: "case-1",
        userId: "user-1",
        workerId: "worker-1",
        withPay: false,
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        reason: "ASUNTOS PARTICULARES",
      });

      expect(res.status).toBe("completed");
      expect(res.calcResult.totalDays).toBe(15);
      expect(mockUpdateCase).toHaveBeenCalledWith(expect.objectContaining({
        status: "completed",
        current_step: 3,
      }));
    });

    it("completa trámite exitosamente para trabajador con siap_full_name legacy (ej. 98173968) sin nombres estructurados", async () => {
      const mockUpdateCase = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockUpsertLicense = vi.fn().mockResolvedValue({ error: null });
      const mockInsertEvent = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_workers") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "worker-98173968",
                      employee_number: "98173968",
                      first_name: "",
                      paternal_surname: "",
                      maternal_surname: "",
                      siap_full_name: "BOLA&OS/VAZQUEZ/EDUARDO",
                      category: "TECNICO RADIOLOGO",
                      assignment: "HGR 1",
                      turn: "VESPERTINO",
                      schedule: "14:00-21:30",
                      rest_days: "SAB-DOM",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "case-98173968", folio: "XXI-2026-LIC-000099", status: "draft", delegation_id: "del-xxi" },
                    error: null,
                  }),
                }),
              }),
              update: mockUpdateCase,
            };
          }
          if (table === "union_license_cases") {
            return { upsert: mockUpsertLicense };
          }
          if (table === "union_case_events") {
            return { insert: mockInsertEvent };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const res = await completeLicenseCase({
        caseId: "case-98173968",
        userId: "user-1",
        workerId: "worker-98173968",
        withPay: false,
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        reason: "ASUNTOS PARTICULARES",
      });

      expect(res.status).toBe("completed");
      expect(res.folio).toBe("XXI-2026-LIC-000099");
      expect(mockUpdateCase).toHaveBeenCalledWith(expect.objectContaining({
        status: "completed",
        current_step: 3,
        worker_snapshot: expect.objectContaining({
          siap_full_name: "BOLA&OS/VAZQUEZ/EDUARDO",
          employee_number: "98173968",
        }),
      }));
    });

    it("bloquea finalización si el trabajador carece de todo nombre registrado", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_workers") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "worker-empty",
                      employee_number: "111111",
                      first_name: "",
                      paternal_surname: "",
                      maternal_surname: "",
                      siap_full_name: "",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "case-empty", folio: "XXI-2026-LIC-000002", status: "draft", delegation_id: "del-xxi" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      await expect(
        completeLicenseCase({
          caseId: "case-empty",
          userId: "user-1",
          workerId: "worker-empty",
          withPay: false,
          startDate: "2026-10-01",
          endDate: "2026-10-03",
          reason: "ASUNTOS PARTICULARES",
        }),
      ).rejects.toThrow("El trabajador no tiene nombre registrado en el sistema.");
    });
  });

  describe("updateCompletedLicense & Optimistic Concurrency", () => {
    it("lanza ConcurrencyConflictError si expectedRevision no coincide con la versión en base de datos", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-1",
                      folio: "XXI-2026-LIC-000001",
                      status: "completed",
                      revision_number: 2, // Ya va en revisión 2
                      document_revision: 2,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      // El cliente envía expectedRevision: 1 (desactualizado)
      await expect(
        updateCompletedLicense({
          caseId: "case-1",
          userId: "user-1",
          expectedRevision: 1,
          withPay: false,
          startDate: "2026-10-01",
          endDate: "2026-10-15",
          reason: "MODIFICADO",
        })
      ).rejects.toThrow(ConcurrencyConflictError);
    });

    it("incrementa revision_number y guarda snapshot cuando la revisión coincide", async () => {
      const mockInsertRevision = vi.fn().mockResolvedValue({ error: null });
      const mockUpdateCase = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockUpsertLicense = vi.fn().mockResolvedValue({ error: null });
      const mockInsertEvent = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-1",
                      folio: "XXI-2026-LIC-000001",
                      status: "completed",
                      revision_number: 1,
                      document_revision: 1,
                      worker_id: "w-1",
                      worker_snapshot: { first_name: "MARIA" },
                      delegation_id: "del-xxi",
                    },
                    error: null,
                  }),
                }),
              }),
              update: mockUpdateCase,
            };
          }
          if (table === "union_license_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { with_pay: false, start_date: "2026-10-01", end_date: "2026-10-15" },
                    error: null,
                  }),
                }),
              }),
              upsert: mockUpsertLicense,
            };
          }
          if (table === "union_license_revisions") {
            return { insert: mockInsertRevision };
          }
          if (table === "union_case_events") {
            return { insert: mockInsertEvent };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const res = await updateCompletedLicense({
        caseId: "case-1",
        userId: "user-1",
        expectedRevision: 1,
        withPay: true,
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        reason: "CAMBIO A CON GOCE",
      });

      expect(res.revisionNumber).toBe(2);
      expect(res.isOutdated).toBe(true); // doc revision es 1, rev actual es 2 -> outdated
      expect(mockInsertRevision).toHaveBeenCalledWith(expect.objectContaining({
        case_id: "case-1",
        revision_number: 1,
      }));
      expect(mockUpdateCase).toHaveBeenCalledWith(expect.objectContaining({
        revision_number: 2,
      }));
    });
  });

  describe("markLicenseDocumentsGenerated", () => {
    it("actualiza document_revision al valor de revision_number", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { revision_number: 3 },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        })),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const newDocRev = await markLicenseDocumentsGenerated("case-1");
      expect(newDocRev).toBe(3);
      expect(mockUpdate).toHaveBeenCalledWith({
        document_revision: 3,
        status: "completed",
      });
    });
  });

  describe("Manual rest_days and phone capture (Casos 1, 2, 3, 4)", () => {
    it("Caso 1: guarda borrador con descansos y teléfono correctamente en union_license_cases", async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: "XXI-2026-LIC-000020", error: null });
      const mockInsertCase = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "case-draft-1", folio: "XXI-2026-LIC-000020" },
            error: null,
          }),
        }),
      });
      const mockUpsertLicense = vi.fn().mockResolvedValue({ error: null });
      const mockInsertEvent = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        rpc: mockRpc,
        from: vi.fn((table: string) => {
          if (table === "union_cases") return { insert: mockInsertCase };
          if (table === "union_license_cases") return { upsert: mockUpsertLicense };
          if (table === "union_case_events") return { insert: mockInsertEvent };
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const res = await saveLicenseDraft({
        delegationId: "del-xxi",
        delegationCode: "XXI",
        userId: "user-1",
        currentStep: 2,
        withPay: false,
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        reason: "TRAMITE PERSONAL",
        restDays: "SÁB - DOM",
        phone: "443 123 4567",
      });

      expect(res.caseId).toBe("case-draft-1");
      expect(mockUpsertLicense).toHaveBeenCalledWith(
        expect.objectContaining({
          rest_days: "SÁB - DOM",
          phone: "443 123 4567",
        }),
        expect.anything(),
      );
    });

    it("Caso 2: edición cambiando descansos de 'SÁB - DOM' a 'VIE - SÁB' incrementa revisión y conserva folio", async () => {
      const mockInsertRevision = vi.fn().mockResolvedValue({ error: null });
      const mockUpdateCase = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockUpsertLicense = vi.fn().mockResolvedValue({ error: null });
      const mockInsertEvent = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-edit-1",
                      folio: "XXI-2026-LIC-000001",
                      status: "completed",
                      revision_number: 1,
                      document_revision: 1,
                      worker_id: "w-1",
                      worker_snapshot: { first_name: "MARIA" },
                      delegation_id: "del-xxi",
                    },
                    error: null,
                  }),
                }),
              }),
              update: mockUpdateCase,
            };
          }
          if (table === "union_license_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { with_pay: false, start_date: "2026-10-01", end_date: "2026-10-03", rest_days: "SÁB - DOM", phone: "4431234567" },
                    error: null,
                  }),
                }),
              }),
              upsert: mockUpsertLicense,
            };
          }
          if (table === "union_license_revisions") {
            return { insert: mockInsertRevision };
          }
          if (table === "union_case_events") {
            return { insert: mockInsertEvent };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const res = await updateCompletedLicense({
        caseId: "case-edit-1",
        userId: "user-1",
        expectedRevision: 1,
        withPay: false,
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        reason: "CAMBIO DE DESCANSOS",
        restDays: "VIE - SÁB",
      });

      expect(res.folio).toBe("XXI-2026-LIC-000001");
      expect(res.revisionNumber).toBe(2);
      expect(mockUpsertLicense).toHaveBeenCalledWith(
        expect.objectContaining({
          rest_days: "VIE - SÁB",
        }),
      );
      // Snapshot anterior contiene rest_days original
      expect(mockInsertRevision).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot: expect.objectContaining({
            license: expect.objectContaining({
              rest_days: "SÁB - DOM",
            }),
          }),
        }),
      );
    });

    it("Caso 3: teléfono con formato libre guardado como texto exacto ('044 443 123 4567')", async () => {
      const mockUpsertLicense = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: "XXI-2026-LIC-000030", error: null }),
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "case-phone-1", folio: "XXI-2026-LIC-000030" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_license_cases") return { upsert: mockUpsertLicense };
          if (table === "union_case_events") return { insert: vi.fn().mockResolvedValue({ error: null }) };
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      await saveLicenseDraft({
        delegationId: "del-xxi",
        delegationCode: "XXI",
        userId: "user-1",
        currentStep: 2,
        withPay: false,
        phone: "044 443 123 4567",
      });

      expect(mockUpsertLicense).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: "044 443 123 4567",
        }),
        expect.anything(),
      );
      const callArg = mockUpsertLicense.mock.calls[0][0];
      expect(typeof callArg.phone).toBe("string");
      expect(callArg.phone).toBe("044 443 123 4567");
    });

    it("Caso 4: teléfono que empieza con cero no pierde el cero al persistirse", async () => {
      const mockUpsertLicense = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: "XXI-2026-LIC-000031", error: null }),
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "case-zero-1", folio: "XXI-2026-LIC-000031" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_license_cases") return { upsert: mockUpsertLicense };
          if (table === "union_case_events") return { insert: vi.fn().mockResolvedValue({ error: null }) };
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      await saveLicenseDraft({
        delegationId: "del-xxi",
        delegationCode: "XXI",
        userId: "user-1",
        currentStep: 2,
        withPay: false,
        phone: "0123456789",
      });

      const callArg = mockUpsertLicense.mock.calls[0][0];
      expect(callArg.phone).toBe("0123456789");
      expect(callArg.phone.startsWith("0")).toBe(true);
    });
  });

  describe("softDeleteLicenseCase & restoreLicenseCase", () => {
    it("marca un expediente como deleted preservando status_before_delete", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockInsertEvent = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "case-1", folio: "XXI-2026-LIC-000001", status: "completed", delegation_id: "del-xxi" },
                    error: null,
                  }),
                }),
              }),
              update: mockUpdate,
            };
          }
          if (table === "union_case_events") {
            return { insert: mockInsertEvent };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      await softDeleteLicenseCase("case-1", "user-admin");

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: "deleted",
        status_before_delete: "completed",
        deleted_by: "user-admin",
      }));
    });

    it("restaura un expediente a su estado previo", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockInsertEvent = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "case-1",
                      folio: "XXI-2026-LIC-000001",
                      status: "deleted",
                      status_before_delete: "completed",
                      delegation_id: "del-xxi",
                    },
                    error: null,
                  }),
                }),
              }),
              update: mockUpdate,
            };
          }
          if (table === "union_case_events") {
            return { insert: mockInsertEvent };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const res = await restoreLicenseCase("case-1", "user-admin");

      expect(res.previousStatus).toBe("completed");
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: "completed",
        status_before_delete: null,
        deleted_at: null,
        deleted_by: null,
      }));
    });
  });

  describe("hardDeleteLicenseCase", () => {
    it("rechaza si el texto de confirmación no es exactamente ELIMINAR", async () => {
      await expect(
        hardDeleteLicenseCase("case-1", "user-admin", "eliminar")
      ).rejects.toThrow(/Confirmación inválida/);

      await expect(
        hardDeleteLicenseCase("case-1", "user-admin", "DELETE")
      ).rejects.toThrow(/Confirmación inválida/);
    });

    it("elimina físicamente el caso cuando la confirmación es ELIMINAR y no toca plantillas", async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "case-1", folio: "XXI-2026-LIC-000001", delegation_id: "del-xxi" },
                    error: null,
                  }),
                }),
              }),
              delete: mockDelete,
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      await hardDeleteLicenseCase("case-1", "user-admin", "ELIMINAR");

      expect(mockDelete).toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalledWith("union_document_templates");
    });
  });

  describe("listLicenseCases", () => {
    it("calcula summary y clasifica trámites correctamente", async () => {
      function createChainable(data: unknown, count = 0) {
        const q: Record<string, unknown> = {};
        q.select = vi.fn(() => q);
        q.eq = vi.fn(() => q);
        q.in = vi.fn(() => q);
        q.is = vi.fn(() => q);
        q.not = vi.fn(() => q);
        q.order = vi.fn(() => q);
        q.limit = vi.fn(() => q);
        q.range = vi.fn(() => q);
        q.single = vi.fn().mockResolvedValue({ data, count, error: null });
        (q as unknown as { then: (fn: (val: unknown) => unknown) => unknown }).then = (resolve) =>
          Promise.resolve({ data, count, error: null }).then(resolve);
        return q;
      }

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_cases") {
            return {
              select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.count === "exact" && opts?.head) {
                  return createChainable([], 2);
                }
                return createChainable([
                  {
                    id: "c-1",
                    folio: "XXI-2026-LIC-000001",
                    status: "completed",
                    current_step: 3,
                    revision_number: 1,
                    document_revision: 1,
                    created_at: "2026-09-17T10:00:00Z",
                    updated_at: "2026-09-17T10:00:00Z",
                    deleted_at: null,
                    worker_id: "w-1",
                  },
                  {
                    id: "c-2",
                    folio: "XXI-2026-LIC-000002",
                    status: "draft",
                    current_step: 2,
                    revision_number: 1,
                    document_revision: 0,
                    created_at: "2026-09-17T11:00:00Z",
                    updated_at: "2026-09-17T11:00:00Z",
                    deleted_at: null,
                    worker_id: "w-2",
                  },
                ]);
              }),
            };
          }
          if (table === "union_license_cases") {
            return createChainable([
              { case_id: "c-1", with_pay: false, start_date: "2026-10-01", end_date: "2026-10-15", total_days: 15, reason: "MOTIVO 1" },
              { case_id: "c-2", with_pay: true, start_date: null, end_date: null, total_days: 0, reason: "" },
            ]);
          }
          if (table === "union_workers") {
            return createChainable([
              { id: "w-1", employee_number: "11111", first_name: "JUAN", paternal_surname: "PEREZ", maternal_surname: "GOMEZ", category: "ENFERMERO" },
              { id: "w-2", employee_number: "22222", first_name: "ANA", paternal_surname: "RUIZ", maternal_surname: "DIAZ", category: "MEDICO" },
            ]);
          }
          return createChainable([]);
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const res = await listLicenseCases({
        delegationId: "del-xxi",
        status: "all",
      });

      expect(res.cases.length).toBe(2);
      expect(res.cases[0].id).toBe("c-1");
      expect(res.cases[0].worker?.fullName).toBe("PEREZ GOMEZ JUAN");
      expect(res.cases[1].id).toBe("c-2");
      expect(res.cases[1].status).toBe("draft");
    });
  });
});
