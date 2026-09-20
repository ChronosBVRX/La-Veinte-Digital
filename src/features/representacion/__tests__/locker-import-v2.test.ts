import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import { parseAndPreviewLockerImport } from "../services/worker-importer/locker-importer";
import { createClient } from "@/lib/supabase/server";

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../services/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe("Locker Import V2 (Hoja1 Architecture & Invariants)", () => {
  const delegationId = "del-test-v2";
  const userId = "user-test-v2";
  const mockBatchId = "batch-v2-synthetic";

  function setupMockSupabase(existingWorkers: Array<{ employee_number: string; full_name: string }> = []) {
    const insertedSourceRows: Record<string, unknown>[] = [];
    const insertedStagingRows: Record<string, unknown>[] = [];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "union_workers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: existingWorkers.map((w, idx) => ({
                  id: `worker-uuid-${idx}`,
                  employee_number: w.employee_number,
                  full_name: w.full_name,
                  category: "ENFERMERA GENERAL",
                  department: "URGENCIAS",
                  active: true,
                })),
                error: null,
              }),
            }),
          };
        }
        if (table === "union_lockers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "locker-uuid-10", locker_number: "10", status: "assigned" },
                  { id: "locker-uuid-200", locker_number: "200", status: "available" },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "union_locker_assignments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "asgn-uuid-10",
                    locker_id: "locker-uuid-10",
                    worker_id: "worker-uuid-0",
                    status: "active",
                  },
                ],
                error: null,
              }),
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
                single: vi.fn().mockResolvedValue({
                  data: { id: mockBatchId },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === "union_locker_import_source_rows") {
          return {
            insert: vi.fn().mockImplementation((rows: Record<string, unknown>[]) => {
              insertedSourceRows.push(...rows);
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === "union_worker_import_rows") {
          return {
            insert: vi.fn().mockImplementation((rows: Record<string, unknown>[]) => {
              insertedStagingRows.push(...rows);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

    return { insertedSourceRows, insertedStagingRows };
  }

  // 1. Strict Hoja1 enforcement
  it("strictly requires worksheet name to be 'Hoja1' and rejects other sheets", async () => {
    setupMockSupabase();

    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Casilleros"); // Not "Hoja1"
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    await expect(
      parseAndPreviewLockerImport({
        fileBuffer: buffer,
        fileName: "wrong_sheet.xlsx",
        delegationId,
        userId,
      })
    ).rejects.toThrow(/El archivo no contiene la hoja requerida "Hoja1"/);
  });

  // 2. Comprehensive Synthetic Scenario with Cases A-H
  it("correctly reconciles all cases (A-H) and maintains exact mathematical identity", async () => {
    // Worker 1111111 exists in roster. Workers 2222222, 3333333, etc. do NOT exist in roster.
    const { insertedSourceRows } = setupMockSupabase([
      { employee_number: "1111111", full_name: "GOMEZ JUAN" },
    ]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Hoja1");

    // Standard headers
    ws.addRow([
      "MATRICULA", // Col A (1)
      "NOMBRE", // Col B (2)
      "PLAZA", // Col C (3)
      "TURNO", // Col D (4)
      "CATEGORIA", // Col E (5)
      "HORARIO", // Col F (6)
      "AREA", // Col G (7)
      "JEFE", // Col H (8)
      "LOCKER", // Col I (9)
      "OBSERVACIONES", // Col J (10)
    ]);

    // Row 2: Case A - Known worker 1111111, locker 10 (safe unchanged)
    ws.addRow(["1111111", "GOMEZ JUAN", "P10", "MAT", "ENFERMERA", "07-14", "URG", "JEFE", "10", ""]);

    // Row 3: Case B - Unknown worker 2222222 with valid locker 200 (created from Excel)
    ws.addRow(["2222222", "PEREZ HERNANDEZ MARIA", "P20", "VESP", "MEDICO", "14-21", "CONS", "JEFE", "200", ""]);

    // Row 4: Case F - Unknown worker 3333333 with locker 200-B (suffix preserved distinctly from 200)
    ws.addRow(["3333333", "RUIZ DIAZ ALBERTO", "P30", "MAT", "ADMIN", "08-16", "DIR", "JEFE", "200-B", ""]);

    // Row 5: Case C - Locker without worker: valid physical locker 500, no matricula
    ws.addRow(["", "", "", "", "", "", "", "", "500", ""]);

    // Rows 6 & 7: Case D - Temporal Resolution (Worker 4444444 has 2024 update on locker 101, and 2025 update on locker 102)
    ws.addRow(["4444444", "HERRERA CARLOS", "P40", "MAT", "ENF", "07-14", "LAB", "JEFE", "101", "ACTUALIZADO 2024"]);
    ws.addRow(["4444444", "HERRERA CARLOS", "P40", "MAT", "ENF", "07-14", "LAB", "JEFE", "102", "CAMBIO 2025"]);

    // Rows 8 & 9: Case E - Real Conflict: two distinct workers claiming same locker 700 with same year 2025
    ws.addRow(["5555555", "SILVA SOFIA", "P50", "MAT", "ENF", "07-14", "LAB", "JEFE", "700", "ACTUALIZADO 2025"]);
    ws.addRow(["6666666", "TORRES RAUL", "P60", "VESP", "ENF", "14-21", "LAB", "JEFE", "700", "ACTUALIZADO 2025"]);

    // Row 10: Case G - Semantic non-physical locker: "S/N"
    ws.addRow(["7777777", "LOPEZ MONICA", "P70", "MAT", "ENF", "07-14", "LAB", "JEFE", "S/N", ""]);

    // Row 11: Case H - Row without locker
    ws.addRow(["8888888", "CASTILLO FERNANDO", "P80", "MAT", "ENF", "07-14", "LAB", "JEFE", "", ""]);

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const result = await parseAndPreviewLockerImport({
      fileBuffer: buffer,
      fileName: "hoja1_synthetic_test.xlsx",
      delegationId,
      userId,
    });

    const summary = result.summary;

    // Total useful rows = 10 (rows 2 through 11)
    expect(summary.totalRows).toBe(10);

    // Case A: Row 2 (known worker, locker 10)
    const r2 = result.rows.find((r) => r.rowNumber === 2);
    expect(r2?.status).toBe("unchanged");
    expect(r2?.lockerExcel).toBe("10");

    // Case B: Row 3 (unknown worker 2222222 -> created from Excel)
    const r3 = result.rows.find((r) => r.rowNumber === 3);
    expect(r3?.status).toBe("new");
    expect(r3?.conflictReasonCode).toBe("WORKER_NOT_FOUND_CREATED_FROM_SOURCE");
    expect(r3?.lockerExcel).toBe("200");

    // Case F: Row 4 (suffix 200-B preserved distinctly)
    const r4 = result.rows.find((r) => r.rowNumber === 4);
    expect(r4?.lockerExcel).toBe("200-B");
    expect(summary.uniquePhysicalLockers).toBe(7); // 10, 200, 200-B, 500, 101, 102, 700

    // Case C: Row 5 (locker without worker 500)
    const r5 = result.rows.find((r) => r.rowNumber === 5);
    expect(r5?.conflictReasonCode).toBe("LOCKER_WITHOUT_WORKER");
    expect(summary.lockersWithoutWorkerCount).toBe(1);

    // Case D: Rows 6 & 7 (2024 is superseded, 2025 is assigned)
    const r6 = result.rows.find((r) => r.rowNumber === 6);
    const r7 = result.rows.find((r) => r.rowNumber === 7);
    expect(r6?.conflictReasonCode).toBe("HISTORICAL_SUPERSEDED");
    expect(r6?.status).toBe("ignored");
    expect(r7?.status).toBe("new");
    expect(summary.historicalSupersededCount).toBe(1);

    // Case E: Rows 8 & 9 (real conflict on locker 700)
    const r8 = result.rows.find((r) => r.rowNumber === 8);
    const r9 = result.rows.find((r) => r.rowNumber === 9);
    expect(r8?.conflictReasonCode).toBe("DUPLICATE_LOCKER_DIFFERENT_WORKERS");
    expect(r9?.conflictReasonCode).toBe("DUPLICATE_LOCKER_DIFFERENT_WORKERS");
    expect(r8?.status).toBe("conflict");
    expect(r9?.status).toBe("conflict");
    expect(summary.realConflictsCount).toBe(2);

    // Case G: Row 10 (S/N is semantic)
    const r10 = result.rows.find((r) => r.rowNumber === 10);
    expect(r10?.conflictReasonCode).toBe("SEMANTIC_LOCKER");
    expect(summary.semanticLockersCount).toBe(1);

    // Case H: Row 11 (no locker)
    const r11 = result.rows.find((r) => r.rowNumber === 11);
    expect(r11?.conflictReasonCode).toBe("ROW_WITHOUT_LOCKER");
    expect(summary.rowsWithoutLockerCount).toBe(1);

    // Mathematical reconciliation check:
    // safe (4) + noWorker (1) + historical (1) + duplicates (0) + conflicts (2) + semantic (1) + noLocker (1) = 10
    expect(summary.safeAssignmentsCount).toBe(4); // r2 (10), r3 (200), r4 (200-B), r7 (102)
    expect(summary.totalRowsAccounted).toBe(10);
    expect(summary.totalRowsAccounted).toBe(summary.totalRows);

    // Verify source rows persisted
    expect(insertedSourceRows.length).toBe(10);
    expect(insertedSourceRows[0].batch_id).toBe(mockBatchId);
    expect(insertedSourceRows[0].raw_cells).toBeDefined();
    expect(insertedSourceRows[0].row_number).toBe(2);
  });
});
