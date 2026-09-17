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
        if (table === "union_worker_import_rows") {
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

    expect(result.summary.newWorkers).toBe(0);
    expect(result.summary.updatedWorkers).toBe(0);

    // Row 1 (known worker): Valid assignment
    const row1 = result.rows.find((r) => r.matricula === "1234567");
    expect(row1).toBeDefined();
    expect(row1?.status).toBe("new");
    expect(row1?.lockerExcel).toBe("10");

    // Row 2 (unknown worker): MUST be conflict and NOT created
    const row2 = result.rows.find((r) => r.matricula === "9999999");
    expect(row2).toBeDefined();
    expect(row2?.status).toBe("conflict");
    expect(row2?.issues.some((i) => i.message === "Trabajador no encontrado en el padrón")).toBe(true);
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
});
