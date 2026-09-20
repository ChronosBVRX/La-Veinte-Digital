import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import { parseAndPreviewLockerImport, applyLockerImportBatch } from "../services/worker-importer/locker-importer";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../services/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe("Locker Import Authoritative Snapshot Reconciliation", () => {
  const delegationId = "del-test-snapshot";
  const userId = "user-test-snapshot";
  const mockBatchId = "batch-test-snapshot-1";

  async function createExcelBuffer(
    rows: Array<{
      matricula: string;
      nombre: string;
      plaza?: string;
      turno?: string;
      categoria?: string;
      horario?: string;
      locker: string;
      colJ?: string;
    }>
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Hoja1");

    sheet.addRow([
      "MATRICULA",
      "NOMBRE",
      "PLAZA",
      "TURNO",
      "CATEGORIA",
      "HORARIO",
      "COL_G",
      "COL_H",
      "# LOCKER",
      "COL_J",
    ]);

    for (const r of rows) {
      sheet.addRow([
        r.matricula,
        r.nombre,
        r.plaza ?? "",
        r.turno ?? "",
        r.categoria ?? "",
        r.horario ?? "",
        "",
        "",
        r.locker,
        r.colJ ?? "",
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  it("Scenario 1 & 2: Replaces previous imported occupant and protects manual occupant", async () => {
    // Locker 10 is occupied by worker-1 (previous import)
    // Locker 20 is occupied by worker-2 (manual assignment)
    // Hoja1 assigns Locker 10 to worker-3 and Locker 20 to worker-4
    const existingWorkers = [
      { id: "w-1", employee_number: "990001", first_name: "JUAN", paternal_surname: "PEREZ", category: "ENF", assignment: "URG" },
      { id: "w-2", employee_number: "990002", first_name: "MARIA", paternal_surname: "LOPEZ", category: "MED", assignment: "CONS" },
      { id: "w-3", employee_number: "990003", first_name: "CARLOS", paternal_surname: "GARCIA", category: "ENF", assignment: "URG" },
      { id: "w-4", employee_number: "990004", first_name: "ANA", paternal_surname: "RAMIREZ", category: "MED", assignment: "CONS" },
    ];

    const existingLockers = [
      { id: "loc-10", locker_number: "10", status: "assigned" },
      { id: "loc-20", locker_number: "20", status: "assigned" },
    ];

    const existingAssignments = [
      {
        id: "asgn-10",
        locker_id: "loc-10",
        worker_id: "w-1",
        status: "active",
        source: "locker_excel",
        source_batch_id: "batch-prev",
        assignment_reason: "import_locker_batch:batch-prev",
        admin_override: false,
      },
      {
        id: "asgn-20",
        locker_id: "loc-20",
        worker_id: "w-2",
        status: "active",
        source: "manual",
        source_batch_id: null,
        assignment_reason: "Asignación directa en ventanilla",
        admin_override: false,
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "union_workers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: existingWorkers, error: null }),
            }),
          };
        }
        if (table === "union_lockers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: existingLockers, error: null }),
            }),
          };
        }
        if (table === "union_locker_assignments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: existingAssignments, error: null }),
            }),
          };
        }
        if (table === "union_worker_import_batches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: mockBatchId }, error: null }),
              }),
            }),
          };
        }
        if (table === "union_locker_import_source_rows" || table === "union_worker_import_rows") {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const fileBuffer = await createExcelBuffer([
      { matricula: "990003", nombre: "CARLOS GARCIA", locker: "10" },
      { matricula: "990004", nombre: "ANA RAMIREZ", locker: "20" },
    ]);

    const preview = await parseAndPreviewLockerImport({
      fileBuffer,
      fileName: "test_snapshot.xlsx",
      delegationId,
      userId,
    });

    // Row 1 (Locker 10): Authoritative replacement of previous import
    const row1 = preview.rows.find((r) => r.matricula === "990003");
    expect(row1).toBeDefined();
    expect(row1?.status).toBe("updated");
    expect(row1?.conflictReasonCode).toBe("REPLACE_PREVIOUS_IMPORT_ASSIGNMENT");
    expect(row1?.autoResolvable).toBe(true);

    // Row 2 (Locker 20): Protected manual conflict
    const row2 = preview.rows.find((r) => r.matricula === "990004");
    expect(row2).toBeDefined();
    expect(row2?.status).toBe("conflict");
    expect(row2?.conflictReasonCode).toBe("CONFLICT_WITH_MANUAL_CHANGE");
    expect(row2?.autoResolvable).toBe(false);

    expect(preview.summary.replacedPreviousCount).toBe(1);
    expect(preview.summary.conflictBreakdown?.CONFLICT_WITH_MANUAL_CHANGE).toBe(1);
  });

  it("Scenario 3 & 4: Clears empty locker with previous import and detects stale assignments", async () => {
    // Locker 30 is occupied by worker-1 (previous import)
    // Locker 40 is occupied by worker-2 (previous import)
    // Hoja1 has Locker 30 with NO worker (empty in new snapshot)
    // Locker 40 is completely absent from Hoja1
    const existingWorkers = [
      { id: "w-1", employee_number: "990001", first_name: "JUAN", paternal_surname: "PEREZ", category: "ENF", assignment: "URG" },
      { id: "w-2", employee_number: "990002", first_name: "MARIA", paternal_surname: "LOPEZ", category: "MED", assignment: "CONS" },
    ];

    const existingLockers = [
      { id: "loc-30", locker_number: "30", status: "assigned" },
      { id: "loc-40", locker_number: "40", status: "assigned" },
    ];

    const existingAssignments = [
      {
        id: "asgn-30",
        locker_id: "loc-30",
        worker_id: "w-1",
        status: "active",
        source: "locker_excel",
        source_batch_id: "batch-prev",
        assignment_reason: "import_locker_batch:batch-prev",
        admin_override: false,
      },
      {
        id: "asgn-40",
        locker_id: "loc-40",
        worker_id: "w-2",
        status: "active",
        source: "locker_excel",
        source_batch_id: "batch-prev",
        assignment_reason: "import_locker_batch:batch-prev",
        admin_override: false,
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "union_workers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: existingWorkers, error: null }),
            }),
          };
        }
        if (table === "union_lockers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: existingLockers, error: null }),
            }),
          };
        }
        if (table === "union_locker_assignments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: existingAssignments, error: null }),
            }),
          };
        }
        if (table === "union_worker_import_batches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: mockBatchId }, error: null }),
              }),
            }),
          };
        }
        if (table === "union_locker_import_source_rows" || table === "union_worker_import_rows") {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

    // Hoja1 only has Locker 30 without matricula
    const fileBuffer = await createExcelBuffer([
      { matricula: "", nombre: "", locker: "30" },
    ]);

    const preview = await parseAndPreviewLockerImport({
      fileBuffer,
      fileName: "test_empty_and_stale.xlsx",
      delegationId,
      userId,
    });

    // Locker 30 without worker clears previous import
    const rowClear = preview.rows[0];
    expect(rowClear.conflictReasonCode).toBe("CLEAR_PREVIOUS_IMPORT_ASSIGNMENT");
    expect(rowClear.status).toBe("updated");
    expect(preview.summary.clearedPreviousCount).toBe(1);

    // Locker 40 was absent, so it is counted as stale
    expect(preview.summary.stalePreviousCount).toBe(1);
  });

  it("Scenario 5: applyLockerImportBatch maps allowReimport to allow_reimport and returns snapshot metrics", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        batch_id: mockBatchId,
        status: "confirmed",
        new_physical_lockers: 5,
        new_locker_assignments: 10,
        locker_changes: 3,
        unchanged_assignments: 50,
        replaced_previous_assignments: 2,
        cleared_previous_assignments: 1,
        stale_previous_released: 4,
        total_active_assignments: 63,
        new_workers_created: 0,
        skipped_conflicts: 0,
        pending_review_count: 0,
      },
      error: null,
    });

    const mockSupabase = {
      rpc: mockRpc,
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await applyLockerImportBatch({
      batchId: mockBatchId,
      delegationId,
      userId,
      options: {
        allowReimport: true,
      },
    });

    // Verify option mapping
    expect(mockRpc).toHaveBeenCalledWith("union_apply_locker_import", {
      p_batch_id: mockBatchId,
      p_resolutions: {},
      p_options: {
        allow_reimport: true,
      },
    });

    // Verify snapshot metrics returned
    expect(result.newLockerAssignments).toBe(10);
    expect(result.lockerChangesCount).toBe(3);
    expect(result.replacedPreviousCount).toBe(2);
    expect(result.clearedPreviousCount).toBe(1);
    expect(result.stalePreviousCount).toBe(4);
    expect(result.releasedAssignmentsCount).toBe(7); // 2 + 1 + 4
    expect(result.totalActiveAssignmentsAfterImport).toBe(63);
  });
});
