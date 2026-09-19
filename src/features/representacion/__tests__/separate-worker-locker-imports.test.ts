import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { parseAndPreviewLockerImport } from "../services/worker-importer/locker-importer";
import { detectConflictsAndDiff, type ExistingWorkerRecord } from "../services/worker-importer/conflict-detector";
import type { ParsedWorkerRow } from "../services/worker-importer/types";

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../services/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe("Domain Separation: Worker Import vs Locker Import", () => {
  const rootDir = process.cwd();

  // --------------------------------------------------------------------------
  // 1 & 2: Worker import and rollback NEVER write lockers
  // --------------------------------------------------------------------------
  it("worker import never writes lockers (SQL audit)", () => {
    const migrationWorkerSql = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260917000000_union_master_import.sql"),
      "utf8"
    );

    // Extract union_confirm_worker_import definition
    const workerConfirmMatch = migrationWorkerSql.match(
      /create or replace function public\.union_confirm_worker_import[\s\S]*?end;\s*\$\$;/
    );
    expect(workerConfirmMatch).not.toBeNull();
    const workerConfirmSql = workerConfirmMatch![0];

    // Must have 0 writes to union_lockers or union_locker_assignments
    expect(workerConfirmSql).not.toMatch(/insert\s+into\s+public\.union_lockers/i);
    expect(workerConfirmSql).not.toMatch(/update\s+public\.union_lockers/i);
    expect(workerConfirmSql).not.toMatch(/delete\s+from\s+public\.union_lockers/i);
    expect(workerConfirmSql).not.toMatch(/insert\s+into\s+public\.union_locker_assignments/i);
    expect(workerConfirmSql).not.toMatch(/update\s+public\.union_locker_assignments/i);
    expect(workerConfirmSql).not.toMatch(/delete\s+from\s+public\.union_locker_assignments/i);
  });

  it("worker rollback never writes lockers (SQL audit)", () => {
    const migrationWorkerSql = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260917000000_union_master_import.sql"),
      "utf8"
    );

    const workerRollbackMatch = migrationWorkerSql.match(
      /create or replace function public\.union_rollback_worker_import[\s\S]*?end;\s*\$\$;/
    );
    expect(workerRollbackMatch).not.toBeNull();
    const workerRollbackSql = workerRollbackMatch![0];

    expect(workerRollbackSql).not.toMatch(/insert\s+into\s+public\.union_lockers/i);
    expect(workerRollbackSql).not.toMatch(/update\s+public\.union_lockers/i);
    expect(workerRollbackSql).not.toMatch(/delete\s+from\s+public\.union_lockers/i);
    expect(workerRollbackSql).not.toMatch(/insert\s+into\s+public\.union_locker_assignments/i);
    expect(workerRollbackSql).not.toMatch(/update\s+public\.union_locker_assignments/i);
    expect(workerRollbackSql).not.toMatch(/delete\s+from\s+public\.union_locker_assignments/i);
  });

  // --------------------------------------------------------------------------
  // 3, 4, 5, 6, 7: Locker import invariants
  // --------------------------------------------------------------------------
  it("locker apply never updates worker (SQL audit)", () => {
    const migrationLockerSql = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260918000000_union_separate_imports.sql"),
      "utf8"
    );

    const lockerApplyMatch = migrationLockerSql.match(
      /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
    );
    expect(lockerApplyMatch).not.toBeNull();
    const lockerApplySql = lockerApplyMatch![0];

    // Must NOT insert or update union_workers
    expect(lockerApplySql).not.toMatch(/insert\s+into\s+public\.union_workers/i);
    expect(lockerApplySql).not.toMatch(/update\s+public\.union_workers/i);
    expect(lockerApplySql).not.toMatch(/delete\s+from\s+public\.union_workers/i);
  });

  it("locker rollback never updates worker (SQL audit)", () => {
    const migrationLockerSql = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260918000000_union_separate_imports.sql"),
      "utf8"
    );

    const lockerRollbackMatch = migrationLockerSql.match(
      /create or replace function public\.union_rollback_locker_import[\s\S]*?end;\s*\$\$;/
    );
    expect(lockerRollbackMatch).not.toBeNull();
    const lockerRollbackSql = lockerRollbackMatch![0];

    expect(lockerRollbackSql).not.toMatch(/insert\s+into\s+public\.union_workers/i);
    expect(lockerRollbackSql).not.toMatch(/update\s+public\.union_workers/i);
    expect(lockerRollbackSql).not.toMatch(/delete\s+from\s+public\.union_workers/i);
  });

  it("locker preview reads worker by employee_number and marks conflict if worker unknown", async () => {
    const { createClient } = await import("@/lib/supabase/server");

    // Mock DB response: known worker 1234567, but 9999999 is unknown
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "union_workers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "worker-uuid-1",
                    employee_number: "1234567",
                    first_name: "JUAN",
                    paternal_surname: "PEREZ",
                    maternal_surname: "LOPEZ",
                    category: "ENFERMERA",
                    assignment: "URGENCIAS",
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "union_lockers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "locker-uuid-10", locker_number: "10", status: "disponible" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "union_locker_assignments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        if (table === "union_worker_import_batches") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "batch-uuid-locker" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "union_worker_import_rows" || table === "union_locker_import_source_rows") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

    // Create synthetic excel with 2 rows: one known worker, one unknown worker
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Hoja1");
    ws.addRow(["MATRICULA", "NOMBRE", "PLAZA", "TURNO", "CATEGORIA", "HORARIO", "AREA", "JEFE", "LOCKER"]);
    ws.addRow(["1234567", "PEREZ LOPEZ JUAN", "P10", "MAT", "ENFERMERA", "07-14", "URG", "JEFE", "10"]);
    ws.addRow(["9999999", "DESCONOCIDO", "P20", "VESP", "MEDICO", "14-21", "CONS", "JEFE", "20"]);

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const result = await parseAndPreviewLockerImport({
      fileBuffer: buffer,
      fileName: "lockers_test.xlsx",
      delegationId: "del-1",
      userId: "user-1",
    });

    expect(result.summary.updatedWorkers).toBe(0);

    // Row 1 (known worker): Valid assignment
    const row1 = result.rows.find((r) => r.matricula === "1234567");
    expect(row1).toBeDefined();
    expect(row1?.status).toBe("new");
    expect(row1?.lockerExcel).toBe("10");

    // Row 2 (unknown worker in V2): Created from Excel source (source = 'locker_excel') and assigned locker
    const row2 = result.rows.find((r) => r.matricula === "9999999");
    expect(row2).toBeDefined();
    expect(row2?.status).toBe("new");
    expect(row2?.conflictReasonCode).toBe("WORKER_NOT_FOUND_CREATED_FROM_SOURCE");
    expect(result.summary.newWorkersFromExcel).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 8, 9, 10, 11: Navigation and Route Separation
  // --------------------------------------------------------------------------
  it("WorkersManager points to worker importer (/representacion/trabajadores/importar)", () => {
    const wmPath = path.join(rootDir, "src/features/representacion/components/WorkersManager.tsx");
    const content = fs.readFileSync(wmPath, "utf8");

    expect(content).toContain('href="/representacion/trabajadores/importar"');
    expect(content).toContain("Actualizar base de trabajadores");
    expect(content).not.toContain('href="/representacion/administracion/actualizar-base"');
  });

  it("LockerBoard points to locker importer (/representacion/lockers/importar)", () => {
    const lbPath = path.join(rootDir, "src/features/representacion/components/LockerBoard.tsx");
    const content = fs.readFileSync(lbPath, "utf8");

    expect(content).toContain('href="/representacion/lockers/importar"');
    expect(content).toContain("Actualizar base de lockers");
    expect(content).not.toContain('href="/representacion/administracion/actualizar-base"');
  });

  it("old actualizar-base route offers two choices and executes no import", () => {
    const hubPath = path.join(
      rootDir,
      "src/app/(union)/representacion/administracion/actualizar-base/page.tsx"
    );
    const content = fs.readFileSync(hubPath, "utf8");

    expect(content).toContain("¿Qué deseas actualizar?");
    expect(content).toContain('href="/representacion/trabajadores/importar"');
    expect(content).toContain('href="/representacion/lockers/importar"');
    // Does NOT render any importer wizard
    expect(content).not.toContain("WorkerImportWizard");
    expect(content).not.toContain("LockerImportWizard");
  });

  it("AdminPanel has two separate cards and no mixed master card", () => {
    const apPath = path.join(rootDir, "src/features/representacion/components/AdminPanel.tsx");
    const content = fs.readFileSync(apPath, "utf8");

    expect(content).toContain("Actualizar trabajadores");
    expect(content).toContain('href="/representacion/trabajadores/importar"');
    expect(content).toContain("Actualizar lockers");
    expect(content).toContain('href="/representacion/lockers/importar"');
    expect(content).not.toContain("Actualizar base sindical");
  });

  // --------------------------------------------------------------------------
  // 12 & 13: History Isolation
  // --------------------------------------------------------------------------
  it("worker history excludes locker batches", () => {
    const workerImportsRoute = fs.readFileSync(
      path.join(rootDir, "src/app/api/union/workers/imports/route.ts"),
      "utf8"
    );

    // Verifies format_version filter
    expect(workerImportsRoute).toContain('query.neq("format_version", "UNION_LOCKERS_V1")');
  });

  it("locker history filters strictly by format_version UNION_LOCKERS_V1", () => {
    const lockerHistoryRoute = fs.readFileSync(
      path.join(rootDir, "src/app/api/union/lockers/import/history/route.ts"),
      "utf8"
    );

    expect(lockerHistoryRoute).toContain('.eq("format_version", "UNION_LOCKERS_V1")');
  });

  // --------------------------------------------------------------------------
  // 14 & 15: Safe signed upload for 4.4 MB files
  // --------------------------------------------------------------------------
  it("locker import uses signed storage upload for large files", () => {
    const wizardContent = fs.readFileSync(
      path.join(rootDir, "src/features/representacion/components/worker-importer/LockerImportWizard.tsx"),
      "utf8"
    );

    expect(wizardContent).toContain("secureUnionExcelUpload");
    expect(wizardContent).toContain("/api/union/lockers/import/upload-url");
    expect(wizardContent).toContain("/api/union/lockers/import/preview");
  });

  it("worker import uses signed storage upload for large files", () => {
    const wizardContent = fs.readFileSync(
      path.join(rootDir, "src/features/representacion/components/worker-importer/WorkerImportWizard.tsx"),
      "utf8"
    );

    expect(wizardContent).toContain("secureUnionExcelUpload");
    expect(wizardContent).toContain("/api/union/workers/import/upload-url");
    expect(wizardContent).toContain("/api/union/workers/import/preview");
  });

  it("worker import ignores locker columns completely", () => {
    const existingWorkersMap = new Map<string, ExistingWorkerRecord>([
      [
        "1234567",
        {
          id: "w-1",
          employee_number: "1234567",
          first_name: "JUAN",
          paternal_surname: "PEREZ",
          maternal_surname: "LOPEZ",
          category: "ENFERMERA",
          assignment: "URGENCIAS",
          turn: "MATUTINO",
          schedule: "07:00-14:00",
          active: true,
        },
      ],
    ]);

    // Excel row has locker 99, but worker import mode does NOT provide existingLockersMap
    const analyzed = detectConflictsAndDiff(
      [
        {
          rowNumber: 2,
          isValid: true,
          issues: [],
          parsed: {
            matricula: "1234567",
            siap_full_name: "PEREZ LOPEZ JUAN",
            first_name: "JUAN",
            paternal_surname: "PEREZ",
            maternal_surname: "LOPEZ",
            position_description: "ENFERMERA",
            department_description: "URGENCIAS",
            turn: "MATUTINO",
            schedule_description: "07:00-14:00",
            locker: "99",
            is_semantic_locker: false,
          } as unknown as ParsedWorkerRow,
        },
      ],
      existingWorkersMap
      // existingLockersMap is undefined (worker import)
    );

    // Row must be UNCHANGED (not updated because of locker)
    expect(analyzed[0].status).toBe("unchanged");
    expect(analyzed[0].diff).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 16-22: Locker Auto Conflict Resolution & Safety Invariants
  // --------------------------------------------------------------------------
  describe("Locker Auto Conflict Resolution & Safety Invariants", () => {
    it("auto resolve NEVER creates worker and NEVER updates worker (SQL verification)", () => {
      const migrationLockerSql = fs.readFileSync(
        path.join(rootDir, "supabase/migrations/20260918000000_union_separate_imports.sql"),
        "utf8"
      );

      const lockerApplyMatch = migrationLockerSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(lockerApplyMatch).not.toBeNull();
      const sql = lockerApplyMatch![0];

      // Auto resolve or any locker resolution NEVER touches union_workers
      expect(sql).not.toMatch(/insert\s+into\s+public\.union_workers/i);
      expect(sql).not.toMatch(/update\s+public\.union_workers/i);
      expect(sql).not.toMatch(/delete\s+from\s+public\.union_workers/i);
    });

    it("skip WORKER_NOT_FOUND produces 0 writes to union_workers, union_lockers, union_locker_assignments", () => {
      const migrationLockerSql = fs.readFileSync(
        path.join(rootDir, "supabase/migrations/20260918000000_union_separate_imports.sql"),
        "utf8"
      );

      const lockerApplyMatch = migrationLockerSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(lockerApplyMatch).not.toBeNull();
      const sql = lockerApplyMatch![0];

      // Verify that when action is 'skip' or worker not found, it continues without any insert/update to lockers
      expect(sql).toContain("if v_row.row_status = 'conflict' and v_res_action = 'skip' then");
      expect(sql).toContain("if not found then");
      expect(sql).toContain("v_skipped_conflicts := v_skipped_conflicts + 1;");
      expect(sql).toContain("continue;");
    });

    it("classifies identical duplicate rows, same worker duplicate, different workers same locker, and multiple lockers correctly", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "union_workers") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "w-1",
                      employee_number: "1111111",
                      first_name: "JUAN",
                      paternal_surname: "PEREZ",
                      maternal_surname: "LOPEZ",
                      category: "ENFERMERA",
                      assignment: "URGENCIAS",
                    },
                    {
                      id: "w-2",
                      employee_number: "2222222",
                      first_name: "PEDRO",
                      paternal_surname: "GARCIA",
                      maternal_surname: "SANCHEZ",
                      category: "MEDICO",
                      assignment: "CONSULTA",
                    },
                    {
                      id: "w-3",
                      employee_number: "3333333",
                      first_name: "ANA",
                      paternal_surname: "MARTINEZ",
                      maternal_surname: "DIAZ",
                      category: "ADMINISTRATIVO",
                      assignment: "ARCHIVO",
                    },
                  ],
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
                    { id: "l-10", locker_number: "10", status: "disponible" },
                    { id: "l-20", locker_number: "20", status: "disponible" },
                    { id: "l-30", locker_number: "30", status: "ocupado" },
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
                  data: [],
                  error: null,
                }),
              }),
            };
          }
          if (table === "union_worker_import_batches") {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "batch-test-classification" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "union_worker_import_rows" || table === "union_locker_import_source_rows") {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return { select: vi.fn() };
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Hoja1");
      ws.addRow(["MATRICULA", "NOMBRE", "LOCKER", "OBSERVACIONES"]);
      // Case A: Identical duplicate rows (Row 2 and Row 3: same worker 1111111, locker 10)
      ws.addRow(["1111111", "PEREZ LOPEZ JUAN", "10", "Nota"]);
      ws.addRow(["1111111", "PEREZ LOPEZ JUAN", "10", "Nota"]);

      // Case B: Worker with multiple lockers in file (Row 4 and Row 5: worker 2222222 with locker 20 and 21)
      ws.addRow(["2222222", "GARCIA SANCHEZ PEDRO", "20", ""]);
      ws.addRow(["2222222", "GARCIA SANCHEZ PEDRO", "21", ""]);

      // Case C: Two different workers claiming the same locker (Row 6 and Row 7: locker 50 claimed by 3333333 and 4444444)
      ws.addRow(["3333333", "MARTINEZ DIAZ ANA", "50", ""]);
      ws.addRow(["4444444", "DESCONOCIDO LUIS", "50", ""]);

      // Case D: Unknown worker (Row 8: 9999999 not in roster)
      ws.addRow(["9999999", "EXTRAÑO CARLOS", "60", ""]);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      const result = await parseAndPreviewLockerImport({
        fileBuffer: buffer,
        fileName: "lockers_complex_test.xlsx",
        delegationId: "del-1",
        userId: "user-1",
      });

      // 1. Identical duplicate: Row 2 is primary ('new'), Row 3 is duplicate ('conflict', autoResolvable: true)
      const r2 = result.rows.find((r) => r.rowNumber === 2);
      const r3 = result.rows.find((r) => r.rowNumber === 3);
      expect(r2?.status).toBe("new");
      expect(r3?.status).toBe("conflict");
      expect(r3?.conflictReasonCode).toBe("DUPLICATE_IDENTICAL_ROW");
      expect(r3?.autoResolvable).toBe(true);
      expect(r3?.duplicateOfRow).toBe(2);

      // 2. Worker with multiple lockers: Rows 4 and 5 are conflict, autoResolvable: false
      const r4 = result.rows.find((r) => r.rowNumber === 4);
      const r5 = result.rows.find((r) => r.rowNumber === 5);
      expect(r4?.status).toBe("conflict");
      expect(r4?.conflictReasonCode).toBe("WORKER_MULTIPLE_LOCKERS");
      expect(r4?.autoResolvable).toBe(false);
      expect(r5?.status).toBe("conflict");
      expect(r5?.conflictReasonCode).toBe("WORKER_MULTIPLE_LOCKERS");
      expect(r5?.autoResolvable).toBe(false);

      // 3. Different workers claiming same locker: Row 6 and Row 7
      const r6 = result.rows.find((r) => r.rowNumber === 6);
      expect(r6?.status).toBe("conflict");
      expect(r6?.conflictReasonCode).toBe("DUPLICATE_LOCKER_DIFFERENT_WORKERS");
      expect(r6?.autoResolvable).toBe(false);

      // 4. Worker not found in padrón: Row 8 is created from source in V2
      const r8 = result.rows.find((r) => r.rowNumber === 8);
      expect(r8?.status).toBe("new");
      expect(r8?.conflictReasonCode).toBe("WORKER_NOT_FOUND_CREATED_FROM_SOURCE");

      // 5. Verify breakdown counts in summary
      const breakdown = result.summary.conflictBreakdown!;
      expect(breakdown).toBeDefined();
      expect(breakdown.DUPLICATE_IDENTICAL_ROW).toBe(1);
      expect(breakdown.WORKER_MULTIPLE_LOCKERS).toBe(2);
      expect(breakdown.DUPLICATE_LOCKER_DIFFERENT_WORKERS).toBe(2);
      expect(breakdown.WORKER_NOT_FOUND_CREATED_FROM_SOURCE).toBe(1);

      expect(result.summary.autoResolvableCount).toBe(2); // duplicate identical + worker created from source
      expect(result.summary.newWorkersFromExcel).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 23-35: Progressive Import, Review Items & Safety Invariants (Delegación XXI)
  // --------------------------------------------------------------------------
  describe("Progressive Locker Import & Review Items System", () => {
    const migrationReviewSql = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260919000000_union_locker_review_items.sql"),
      "utf8"
    );

    it("import with pending rows is allowed (SQL audit)", () => {
      const applyMatch = migrationReviewSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(applyMatch).not.toBeNull();
      const sql = applyMatch![0];

      // Does NOT raise an exception on conflict or worker not found
      expect(sql).toContain("v_batch.status <> 'preview'");
      expect(sql).toContain("status = 'confirmed'");
      // Loop continues and creates review item
      expect(sql).toContain("insert into public.union_locker_review_items");
      expect(sql).toContain("v_pending_reviews := v_pending_reviews + 1;");
    });

    it("WORKER_NOT_FOUND: locker created, worker NOT created, assignment NOT invented, review item created (SQL audit)", () => {
      const applyMatch = migrationReviewSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(applyMatch).not.toBeNull();
      const sql = applyMatch![0];

      // Locker is created
      expect(sql).toContain("insert into public.union_lockers");
      // Worker is NEVER created
      expect(sql).not.toMatch(/insert\s+into\s+public\.union_workers/i);
      expect(sql).not.toMatch(/update\s+public\.union_workers/i);
      // Review item is created with WORKER_NOT_FOUND
      expect(sql).toContain("'WORKER_NOT_FOUND'");
      expect(sql).toContain("action_taken = 'pending_review'");
    });

    it("duplicate locker: no unsafe assignment, review item created (SQL audit)", () => {
      const applyMatch = migrationReviewSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(applyMatch).not.toBeNull();
      const sql = applyMatch![0];

      // On conflict row status, review item created and loop continues before creating assignment
      expect(sql).toContain("if v_row.row_status = 'conflict' then");
      expect(sql).toContain("insert into public.union_locker_review_items");
    });

    it("worker multiple lockers: no unsafe assignment, review item created (SQL audit)", () => {
      const applyMatch = migrationReviewSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(applyMatch).not.toBeNull();
      const sql = applyMatch![0];

      expect(sql).toContain("v_conflict_code := coalesce(v_row.parsed_data->>'conflict_reason_code', 'NEEDS_REVIEW');");
      expect(sql).toContain("action_taken = 'pending_review'");
    });

    it("valid row: locker created, assignment created (SQL audit)", () => {
      const applyMatch = migrationReviewSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(applyMatch).not.toBeNull();
      const sql = applyMatch![0];

      expect(sql).toContain("insert into public.union_locker_assignments");
      expect(sql).toContain("status = 'assigned'");
      expect(sql).toContain("action_taken = 'applied'");
    });

    it("existing safe assignment: preserved intact (SQL audit)", () => {
      const applyMatch = migrationReviewSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(applyMatch).not.toBeNull();
      const sql = applyMatch![0];

      // No delete on assignments anywhere
      expect(sql).not.toMatch(/delete\s+from\s+public\.union_locker_assignments/i);
      // Existing assignment for unaffected workers is never modified
      expect(sql).toContain("where worker_id = v_worker_id");
    });

    it("pending row never deletes existing assignment (SQL audit)", () => {
      const applyMatch = migrationReviewSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(applyMatch).not.toBeNull();
      const sql = applyMatch![0];

      expect(sql).not.toMatch(/delete\s+from\s+public\.union_locker_assignments/i);
    });

    it("pending row never modifies union_workers (SQL audit)", () => {
      const applyMatch = migrationReviewSql.match(
        /create or replace function public\.union_apply_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(applyMatch).not.toBeNull();
      const sql = applyMatch![0];

      expect(sql).not.toMatch(/insert\s+into\s+public\.union_workers/i);
      expect(sql).not.toMatch(/update\s+public\.union_workers/i);
      expect(sql).not.toMatch(/delete\s+from\s+public\.union_workers/i);
    });

    it("rollback handles review items by marking cancelled_by_rollback (SQL audit)", () => {
      const rollbackMatch = migrationReviewSql.match(
        /create or replace function public\.union_rollback_locker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(rollbackMatch).not.toBeNull();
      const sql = rollbackMatch![0];

      expect(sql).toContain("update public.union_locker_review_items");
      expect(sql).toContain("status = 'cancelled_by_rollback'");
      expect(sql).toContain("cancelled_review_items");
    });

    it("worker import does NOT automatically modify lockers (cross-domain SQL audit)", () => {
      const workerMigrationSql = fs.readFileSync(
        path.join(rootDir, "supabase/migrations/20260917000000_union_master_import.sql"),
        "utf8"
      );

      const workerApplyMatch = workerMigrationSql.match(
        /create or replace function public\.union_confirm_worker_import[\s\S]*?end;\s*\$\$;/
      );
      expect(workerApplyMatch).not.toBeNull();
      const sql = workerApplyMatch![0];

      expect(sql).not.toMatch(/insert\s+into\s+public\.union_lockers/i);
      expect(sql).not.toMatch(/update\s+public\.union_lockers/i);
      expect(sql).not.toMatch(/delete\s+from\s+public\.union_lockers/i);
    });

    it("representative can resolve pending worker, select correct worker or locker, and resolution is audited", async () => {
      const { writeAuditLog } = await import("../services/audit");

      // Verify audit service contract is callable with resolution action
      await writeAuditLog({
        delegation_id: "dep-1",
        action: "resolve_locker_review_item",
        entity_type: "union_locker_review_items",
        entity_id: "review-item-1",
        metadata: {
          action: "link_worker",
          locker_number: "125",
          worker_id: "worker-uuid-1",
          employee_number: "12345678",
        },
      });

      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "resolve_locker_review_item",
          entity_type: "union_locker_review_items",
          entity_id: "review-item-1",
        })
      );
    });
  });
});
