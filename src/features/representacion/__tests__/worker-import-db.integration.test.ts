/**
 * Integration Test for SIAP Worker Import on PostgreSQL (Local Supabase).
 *
 * Verifies:
 * 1. Atomicity: Complete rollback on mid-batch failure (no orphan workers).
 * 2. Concurrency: Row-level lock (FOR UPDATE) prevents race conditions.
 * 3. Non-destructive rollback: Preserves foreign keys (union_cases), active status, notes, phone, and manual names.
 * 4. Rollback conflict: Rejection if subsequent changes occurred (ROLLBACK_CONFLICT_NEWER_CHANGES).
 * 5. RLS Security: Strict enforcement for anon, standard authenticated user, union_rep, other delegation admin, and delegation union_admin.
 * 6. Continuous update, idempotency, manual fields preservation, and unobserved MO.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { execSync, spawn } from "child_process"

const DOCKER_CONTAINER = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_La_Veinte_Digital"

function isDockerDbAvailable(): boolean {
  try {
    execSync(`docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d postgres -t -A -c "SELECT 1;"`, {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    })
    return true
  } catch {
    return false
  }
}

const isAvailable = isDockerDbAvailable()

function execDb(sql: string): string {
  return execSync(
    `docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A`,
    {
      input: sql,
      encoding: "utf-8",
    }
  ).trim()
}

function execDbScalar(sql: string): string {
  const raw = execDb(sql)
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const ignorable = new Set(["BEGIN", "COMMIT", "ROLLBACK", "SET", "ALTER TABLE", "CREATE INDEX", "DROP POLICY", "CREATE POLICY"])
  const resultLines = lines.filter((l) => !ignorable.has(l) && !l.startsWith("INSERT ") && !l.startsWith("DELETE ") && !l.startsWith("UPDATE "))
  return resultLines[resultLines.length - 1] ?? ""
}

function execDbAsync(sql: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("docker", [
      "exec",
      "-i",
      DOCKER_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
    ])

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on("close", (code: number | null) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 0 })
    })

    proc.stdin.write(sql)
    proc.stdin.end()
  })
}

// Test fixtures (UUIDs)
const DELEGATION_A_ID = "630c52a5-0576-47fc-8d6b-ee7e1c279d0b"
const DELEGATION_B_ID = "77777777-7777-7777-7777-777777777777"

const ADMIN_A_ID = "a1111111-1111-1111-1111-111111111111"
const REP_A_ID   = "a2222222-2222-2222-2222-222222222222"
const ADMIN_B_ID = "b1111111-1111-1111-1111-111111111111"
const REGULAR_USER_ID = "c3333333-3333-3333-3333-333333333333"
const GLOBAL_ADMIN_ID = "d4444444-4444-4444-4444-444444444444"

const TEST_USERS = [ADMIN_A_ID, REP_A_ID, ADMIN_B_ID, REGULAR_USER_ID, GLOBAL_ADMIN_ID]

function setupFixtures() {
  const usersList = TEST_USERS.map((id) => `'${id}'`).join(",")
  execDb(`
    -- Cleanup previous test data
    DELETE FROM public.union_cases WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}');
    DELETE FROM public.union_worker_change_history WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}');
    DELETE FROM public.union_workers WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}');
    DELETE FROM public.union_worker_import_rows WHERE batch_id IN (
      SELECT id FROM public.union_worker_import_batches WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}')
    );
    DELETE FROM public.union_worker_import_batches WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}');
    DELETE FROM public.union_members WHERE user_id IN (${usersList});
    DELETE FROM public.profiles WHERE id IN (${usersList});
    DELETE FROM auth.users WHERE id IN (${usersList});
    DELETE FROM public.union_delegations WHERE id = '${DELEGATION_B_ID}';

    -- Ensure Delegations A and B exist
    INSERT INTO public.union_delegations (id, code, name, section, facility, active, created_at, updated_at)
    VALUES
      ('${DELEGATION_A_ID}', 'DEL_A', 'Delegación A de Prueba', 'XX', 'HGR 1', true, now(), now()),
      ('${DELEGATION_B_ID}', 'DEL_B', 'Delegación B de Prueba', 'XXI', 'HGR 2', true, now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Ensure Auth users
    INSERT INTO auth.users (id, email) VALUES
      ('${ADMIN_A_ID}', 'admin_a@test.local'),
      ('${REP_A_ID}', 'rep_a@test.local'),
      ('${ADMIN_B_ID}', 'admin_b@test.local'),
      ('${REGULAR_USER_ID}', 'regular@test.local'),
      ('${GLOBAL_ADMIN_ID}', 'global_admin@test.local');

    -- Global Admin profile (role='admin' in profiles table, NO union membership)
    INSERT INTO public.profiles (id, full_name, role)
    VALUES ('${GLOBAL_ADMIN_ID}', 'Global Admin', 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    -- Memberships
    INSERT INTO public.union_members (delegation_id, user_id, role, active) VALUES
      ('${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'union_admin', true),
      ('${DELEGATION_A_ID}', '${REP_A_ID}', 'union_rep', true),
      ('${DELEGATION_B_ID}', '${ADMIN_B_ID}', 'union_admin', true);
  `)
}

describe.skipIf(!isAvailable)("PostgreSQL Integration: SIAP Worker Importer", { timeout: 30000 }, () => {
  beforeEach(() => {
    setupFixtures()
  })

  afterAll(() => {
    if (isAvailable) {
      const usersList = TEST_USERS.map((id) => `'${id}'`).join(",")
      execDb(`
        DELETE FROM public.union_cases WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}');
        DELETE FROM public.union_worker_change_history WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}');
        DELETE FROM public.union_workers WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}');
        DELETE FROM public.union_worker_import_rows WHERE batch_id IN (
          SELECT id FROM public.union_worker_import_batches WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}')
        );
        DELETE FROM public.union_worker_import_batches WHERE delegation_id IN ('${DELEGATION_A_ID}', '${DELEGATION_B_ID}');
        DELETE FROM public.union_members WHERE user_id IN (${usersList});
        DELETE FROM public.profiles WHERE id IN (${usersList});
        DELETE FROM auth.users WHERE id IN (${usersList});
        DELETE FROM public.union_delegations WHERE id = '${DELEGATION_B_ID}';
      `)
    }
  })

  it("1. Atomicity: Fails mid-batch and completely rolls back (zero orphan workers)", () => {
    const batchId = "10000000-0000-0000-0000-000000000001"

    execDb(`
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, new_workers_count, updated_workers_count,
        unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
        missing_in_file_count, status, notes
      ) VALUES (
        '${batchId}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'lote_fallido.xlsx', 1024, 'sha_fail_1',
        'v1', 2, 2, 0, 0, 0, 0, 0, 0, 'preview', ''
      );

      -- Row 1: Valid worker
      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batchId}', 1, 'M_ATOM_1', 'HERNANDEZ PEREZ LUIS', '{}'::jsonb,
        '{"siap_full_name": "HERNANDEZ PEREZ LUIS", "position_description": "MEDICO GENERAL", "turn": "Matutino"}'::jsonb,
        'new', 'pending', '[]'::jsonb, '{}'::jsonb
      );

      -- Row 2: Invalid date that will cause cast exception during INSERT
      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batchId}', 2, 'M_ATOM_2', 'GOMEZ RUIZ MARIA', '{}'::jsonb,
        '{"siap_full_name": "GOMEZ RUIZ MARIA", "occupation_start_date": "INVALID_DATE_XYZ"}'::jsonb,
        'new', 'pending', '[]'::jsonb, '{}'::jsonb
      );
    `)

    // Attempt confirm: must throw
    expect(() => {
      execDb(`
        BEGIN;
        SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
        SELECT public.union_confirm_worker_import('${batchId}');
        COMMIT;
      `)
    }).toThrow(/invalid input syntax for type date/)

    // Assert: No workers were inserted (Row 1 was rolled back)
    const workerCount = execDb(`
      SELECT count(*) FROM public.union_workers WHERE delegation_id = '${DELEGATION_A_ID}';
    `)
    expect(Number(workerCount)).toBe(0)

    // Assert: Batch remains in preview
    const batchStatus = execDb(`
      SELECT status FROM public.union_worker_import_batches WHERE id = '${batchId}';
    `)
    expect(batchStatus).toBe("preview")
  })

  it("2. Concurrency: Two simultaneous confirms lock row and second fails with INVALID_BATCH_STATUS", async () => {
    const batchId = "20000000-0000-0000-0000-000000000002"

    execDb(`
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, new_workers_count, updated_workers_count,
        unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
        missing_in_file_count, status, notes
      ) VALUES (
        '${batchId}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'lote_concurrente.xlsx', 1024, 'sha_conc_1',
        'v1', 1, 1, 0, 0, 0, 0, 0, 0, 'preview', ''
      );

      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batchId}', 1, 'M_CONC_1', 'RAMIREZ SOLIS JORGE', '{}'::jsonb,
        '{"siap_full_name": "RAMIREZ SOLIS JORGE", "position_description": "ENFERMERO", "turn": "Vespertino"}'::jsonb,
        'new', 'pending', '[]'::jsonb, '{}'::jsonb
      );
    `)

    const confirmSql = `
      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_confirm_worker_import('${batchId}');
      COMMIT;
    `

    // Execute concurrently
    const [res1, res2] = await Promise.all([execDbAsync(confirmSql), execDbAsync(confirmSql)])

    const codes = [res1.code, res2.code]
    const outputs = [res1.stdout + res1.stderr, res2.stdout + res2.stderr]

    // Exactly one must succeed (code 0), exactly one must fail (code 1)
    expect(codes.filter((c) => c === 0).length).toBe(1)
    expect(codes.filter((c) => c !== 0).length).toBe(1)

    // The failing one must have raised INVALID_BATCH_STATUS
    const failedOutput = outputs.find((out) => out.includes("INVALID_BATCH_STATUS"))
    expect(failedOutput).toBeDefined()
    expect(failedOutput).toContain("INVALID_BATCH_STATUS")

    // Worker was inserted exactly once
    const workerCount = execDb(`
      SELECT count(*) FROM public.union_workers WHERE delegation_id = '${DELEGATION_A_ID}' AND employee_number = 'M_CONC_1';
    `)
    expect(Number(workerCount)).toBe(1)

    // Batch status is confirmed
    const batchStatus = execDb(`
      SELECT status FROM public.union_worker_import_batches WHERE id = '${batchId}';
    `)
    expect(batchStatus).toBe("confirmed")
  })

  it("3. Non-destructive rollback: Preserves union_cases, active, notes, phone, manual names and marks rolled_back", () => {
    const batchId = "30000000-0000-0000-0000-000000000003"
    const caseId  = "30000000-0000-0000-0000-00000000000c"

    // 1. Setup and confirm batch
    execDb(`
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, new_workers_count, updated_workers_count,
        unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
        missing_in_file_count, status, notes
      ) VALUES (
        '${batchId}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'lote_rollback.xlsx', 1024, 'sha_roll_1',
        'v1', 1, 1, 0, 0, 0, 0, 0, 0, 'preview', ''
      );

      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batchId}', 1, 'M_ROLL_1', 'ALVAREZ DIAZ CARLOS', '{}'::jsonb,
        '{"siap_full_name": "ALVAREZ DIAZ CARLOS", "position_description": "ADMINISTRATIVO", "turn": "Matutino"}'::jsonb,
        'new', 'pending', '[]'::jsonb, '{}'::jsonb
      );

      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_confirm_worker_import('${batchId}');
      COMMIT;
    `)

    // Obtain worker id
    const workerId = execDb(`
      SELECT id FROM public.union_workers WHERE employee_number = 'M_ROLL_1';
    `)
    expect(workerId).toBeTruthy()

    // 2. Add manual information and create a union case referencing worker_id
    execDb(`
      UPDATE public.union_workers
      SET
        notes = 'Nota sindical confidencial de prueba',
        phone = '5559876543',
        first_name = 'Carlos'
      WHERE id = '${workerId}';

      INSERT INTO public.union_cases (
        id, delegation_id, worker_id, case_type, folio, status, opened_at, worker_snapshot, created_at, updated_at
      ) VALUES (
        '${caseId}', '${DELEGATION_A_ID}', '${workerId}', 'license', 'FOL-TEST-001', 'draft', now(),
        '{"name": "ALVAREZ DIAZ CARLOS"}'::jsonb, now(), now()
      );
    `)

    // 3. Execute rollback
    const rollbackResultJson = execDb(`
      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_rollback_worker_import('${batchId}');
      COMMIT;
    `)
    expect(rollbackResultJson).toContain('"status": "rolled_back"')

    // 4. Assert non-destructive invariants:
    // A) Case in union_cases STILL EXISTS (foreign key not broken, case not deleted)
    const caseCount = execDb(`
      SELECT count(*) FROM public.union_cases WHERE id = '${caseId}';
    `)
    expect(Number(caseCount)).toBe(1)

    // B) Worker still exists physically in database (NOT DELETED)
    const workerExists = execDb(`
      SELECT count(*) FROM public.union_workers WHERE id = '${workerId}';
    `)
    expect(Number(workerExists)).toBe(1)

    // C) Worker fields: source_import_state = 'rolled_back', source_rolled_back_at IS NOT NULL
    // Manual fields (active, notes, phone, manual name) PRESERVED UNCHANGED
    const workerState = execDb(`
      SELECT source_import_state || '|' || active || '|' || notes || '|' || phone || '|' || first_name
      FROM public.union_workers WHERE id = '${workerId}';
    `)
    expect(workerState).toBe("rolled_back|true|Nota sindical confidencial de prueba|5559876543|Carlos")

    // D) Operational query excludes rolled_back workers
    const activeOperationalWorkers = execDb(`
      SELECT count(*) FROM public.union_workers
      WHERE delegation_id = '${DELEGATION_A_ID}' AND source_import_state != 'rolled_back';
    `)
    expect(Number(activeOperationalWorkers)).toBe(0)
  })

  it("4. Rollback Conflict: Rejects rollback with ROLLBACK_CONFLICT_NEWER_CHANGES if touched by newer batch", () => {
    const batch1Id = "40000000-0000-0000-0000-000000000001"
    const batch2Id = "40000000-0000-0000-0000-000000000002"

    // Batch 1: Creates worker with category ENFERMERA GENERAL
    execDb(`
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, new_workers_count, updated_workers_count,
        unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
        missing_in_file_count, status, notes
      ) VALUES (
        '${batch1Id}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'lote1.xlsx', 1024, 'sha_batch_1',
        'v1', 1, 1, 0, 0, 0, 0, 0, 0, 'preview', ''
      );

      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batch1Id}', 1, 'M_CONF_1', 'LARA VAZQUEZ PATRICIA', '{}'::jsonb,
        '{"siap_full_name": "LARA VAZQUEZ PATRICIA", "position_description": "ENFERMERA GENERAL", "turn": "Matutino"}'::jsonb,
        'new', 'pending', '[]'::jsonb, '{}'::jsonb
      );

      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_confirm_worker_import('${batch1Id}');
      COMMIT;
    `)

    // Batch 2: Updates worker to ENFERMERA ESPECIALISTA
    execDb(`
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, new_workers_count, updated_workers_count,
        unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
        missing_in_file_count, status, notes
      ) VALUES (
        '${batch2Id}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'lote2.xlsx', 1024, 'sha_batch_2',
        'v1', 1, 0, 1, 0, 0, 0, 0, 0, 'preview', ''
      );

      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batch2Id}', 1, 'M_CONF_1', 'LARA VAZQUEZ PATRICIA', '{}'::jsonb,
        '{"siap_full_name": "LARA VAZQUEZ PATRICIA", "position_description": "ENFERMERA ESPECIALISTA", "turn": "Matutino"}'::jsonb,
        'updated', 'pending', '[]'::jsonb,
        '{"hasChanges": true, "changes": [{"field": "position_description", "oldValue": "ENFERMERA GENERAL", "newValue": "ENFERMERA ESPECIALISTA"}]}'::jsonb
      );

      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_confirm_worker_import('${batch2Id}');
      COMMIT;
    `)

    // Attempt rollback of batch 1: MUST FAIL with ROLLBACK_CONFLICT_NEWER_CHANGES
    expect(() => {
      execDb(`
        BEGIN;
        SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
        SELECT public.union_rollback_worker_import('${batch1Id}');
        COMMIT;
      `)
    }).toThrow(/ROLLBACK_CONFLICT_NEWER_CHANGES/)

    // Data in worker remains 'ENFERMERA ESPECIALISTA'
    const workerCategory = execDb(`
      SELECT category FROM public.union_workers WHERE employee_number = 'M_CONF_1';
    `)
    expect(workerCategory).toBe("ENFERMERA ESPECIALISTA")

    // Batch 1 status is still confirmed
    const batch1Status = execDb(`
      SELECT status FROM public.union_worker_import_batches WHERE id = '${batch1Id}';
    `)
    expect(batch1Status).toBe("confirmed")
  })

  it("5. RLS Security: Strict enforcement for anon, standard user, union_rep, other delegation admin, and delegation admin", () => {
    const batchId = "50000000-0000-0000-0000-000000000001"

    // Setup 1 batch and 1 confirmed worker in Delegation A
    execDb(`
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, new_workers_count, updated_workers_count,
        unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
        missing_in_file_count, status, notes
      ) VALUES (
        '${batchId}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'lote_rls.xlsx', 1024, 'sha_rls_1',
        'v1', 1, 1, 0, 0, 0, 0, 0, 0, 'preview', ''
      );

      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batchId}', 1, 'M_RLS_1', 'MORALES CASTRO SOFIA', '{}'::jsonb,
        '{"siap_full_name": "MORALES CASTRO SOFIA", "position_description": "QUIMICO", "turn": "Nocturno"}'::jsonb,
        'new', 'pending', '[]'::jsonb, '{}'::jsonb
      );

      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_confirm_worker_import('${batchId}');
      COMMIT;
    `)

    // A) ANON: Cannot SELECT batches or workers (permission denied)
    expect(() => {
      execDb(`
        BEGIN;
        SET LOCAL ROLE anon;
        SELECT count(*) FROM public.union_worker_import_batches;
        COMMIT;
      `)
    }).toThrow(/permission denied/)

    expect(() => {
      execDb(`
        BEGIN;
        SET LOCAL ROLE anon;
        SELECT count(*) FROM public.union_workers;
        COMMIT;
      `)
    }).toThrow(/permission denied/)

    // B) AUTHENTICATED USER WITHOUT MEMBERSHIP:
    // Can SELECT but RLS returns 0 rows
    const countUserWorkers = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${REGULAR_USER_ID}';
      SELECT count(*) FROM public.union_workers WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countUserWorkers)).toBe(0)

    const countUserBatches = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${REGULAR_USER_ID}';
      SELECT count(*) FROM public.union_worker_import_batches WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countUserBatches)).toBe(0)

    // C) UNION_REP OF DELEGATION A:
    // Can read workers in Delegation A
    const countRepWorkers = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${REP_A_ID}';
      SELECT count(*) FROM public.union_workers WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countRepWorkers)).toBe(1)

    // Cannot read batches in Delegation A (admin only policy)
    const countRepBatches = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${REP_A_ID}';
      SELECT count(*) FROM public.union_worker_import_batches WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countRepBatches)).toBe(0)

    // Cannot rollback (raises UNAUTHORIZED_UNION_ADMIN)
    expect(() => {
      execDb(`
        BEGIN;
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '${REP_A_ID}';
        SELECT public.union_rollback_worker_import('${batchId}');
        COMMIT;
      `)
    }).toThrow(/UNAUTHORIZED_UNION_ADMIN/)

    // Cannot confirm (raises UNAUTHORIZED_UNION_ADMIN)
    expect(() => {
      execDb(`
        BEGIN;
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '${REP_A_ID}';
        SELECT public.union_confirm_worker_import('${batchId}');
        COMMIT;
      `)
    }).toThrow(/UNAUTHORIZED_UNION_ADMIN/)

    // D) UNION_ADMIN OF DELEGATION B:
    // Cannot read workers of Delegation A
    const countAdminBWorkers = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_B_ID}';
      SELECT count(*) FROM public.union_workers WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countAdminBWorkers)).toBe(0)

    // Cannot read batches of Delegation A
    const countAdminBBatches = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_B_ID}';
      SELECT count(*) FROM public.union_worker_import_batches WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countAdminBBatches)).toBe(0)

    // Cannot confirm or rollback Delegation A's batch
    expect(() => {
      execDb(`
        BEGIN;
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '${ADMIN_B_ID}';
        SELECT public.union_rollback_worker_import('${batchId}');
        COMMIT;
      `)
    }).toThrow(/UNAUTHORIZED_UNION_ADMIN/)

    // E) GLOBAL ADMIN (profiles.role = 'admin') WITHOUT UNION MEMBERSHIP:
    // Global admin role does NOT grant union permissions
    const countGlobalAdminWorkers = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${GLOBAL_ADMIN_ID}';
      SELECT count(*) FROM public.union_workers WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countGlobalAdminWorkers)).toBe(0)

    const countGlobalAdminBatches = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${GLOBAL_ADMIN_ID}';
      SELECT count(*) FROM public.union_worker_import_batches WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countGlobalAdminBatches)).toBe(0)

    expect(() => {
      execDb(`
        BEGIN;
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '${GLOBAL_ADMIN_ID}';
        SELECT public.union_rollback_worker_import('${batchId}');
        COMMIT;
      `)
    }).toThrow(/UNAUTHORIZED_UNION_ADMIN/)

    // F) UNION_ADMIN OF DELEGATION A:
    // Can read workers of Delegation A
    const countAdminAWorkers = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT count(*) FROM public.union_workers WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countAdminAWorkers)).toBe(1)

    // Can read batches of Delegation A
    const countAdminABatches = execDbScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT count(*) FROM public.union_worker_import_batches WHERE delegation_id = '${DELEGATION_A_ID}';
      COMMIT;
    `)
    expect(Number(countAdminABatches)).toBe(1)

    // Can execute rollback on Delegation A's batch
    const rollbackRes = execDb(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_rollback_worker_import('${batchId}');
      COMMIT;
    `)
    expect(rollbackRes).toContain('"status": "rolled_back"')
  }, 30000)

  it("6. Continuous update, idempotency, manual fields preservation, unobserved MO, and rollback", () => {
    const workerId = "60000000-0000-0000-0000-000000000001"
    const caseId   = "60000000-0000-0000-0000-00000000000c"
    const batch1Id = "60000000-0000-0000-0000-0000000000b1"
    const batch2Id = "60000000-0000-0000-0000-0000000000b2"
    const batch3Id = "60000000-0000-0000-0000-0000000000b3"

    // Paso 1: Importar un lote nuevo (Batch 1)
    execDb(`
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, new_workers_count, updated_workers_count,
        unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
        missing_in_file_count, status, notes
      ) VALUES (
        '${batch1Id}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'lote1.xlsx', 1024, 'sha_b1',
        'v1', 1, 1, 0, 0, 0, 0, 0, 0, 'preview', ''
      );

      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batch1Id}', 1, 'M_CYCLE_1', 'HERRERA BUSTOS JUAN', '{}'::jsonb,
        '{"siap_full_name": "HERRERA BUSTOS JUAN", "position_description": "ENFERMERO GENERAL", "turn": "Matutino", "occupation_mark_code": "0"}'::jsonb,
        'new', 'pending', '[]'::jsonb, '{}'::jsonb
      );

      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_confirm_worker_import('${batch1Id}');
      COMMIT;
    `)

    // Obtener id asignado y agregar campos manuales y expediente sindical
    const createdWorkerId = execDb(`SELECT id FROM public.union_workers WHERE employee_number = 'M_CYCLE_1';`)
    expect(createdWorkerId).toBeTruthy()

    execDb(`
      UPDATE public.union_workers
      SET
        first_name = 'Juan',
        paternal_surname = 'Herrera',
        maternal_surname = 'Bustos',
        phone = '5512345678',
        notes = 'Nota manual de resguardo sindical'
      WHERE id = '${createdWorkerId}';

      INSERT INTO public.union_cases (
        id, delegation_id, worker_id, case_type, folio, status, opened_at, worker_snapshot, created_at, updated_at
      ) VALUES (
        '${caseId}', '${DELEGATION_A_ID}', '${createdWorkerId}', 'maternity', 'FOL-MAT-601', 'draft', now(),
        '{"name": "HERRERA BUSTOS JUAN"}'::jsonb, now(), now()
      );
    `)

    // Paso 2: Volver a importar exactamente el mismo archivo (Batch 2 idempotente)
    execDb(`
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, new_workers_count, updated_workers_count,
        unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
        missing_in_file_count, status, notes
      ) VALUES (
        '${batch2Id}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'lote2_mismo.xlsx', 1024, 'sha_b2',
        'v1', 1, 0, 0, 1, 0, 0, 0, 0, 'preview', ''
      );

      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batch2Id}', 1, 'M_CYCLE_1', 'HERRERA BUSTOS JUAN', '{}'::jsonb,
        '{"siap_full_name": "HERRERA BUSTOS JUAN", "position_description": "ENFERMERO GENERAL", "turn": "Matutino", "occupation_mark_code": "0"}'::jsonb,
        'unchanged', 'pending', '[]'::jsonb, '{}'::jsonb
      );

      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_confirm_worker_import('${batch2Id}');
      COMMIT;
    `)

    // Paso 3: Resultado esperado: sin duplicados y sin cambios falsos
    const workerCount = execDb(`SELECT count(*) FROM public.union_workers WHERE employee_number = 'M_CYCLE_1';`)
    expect(Number(workerCount)).toBe(1)

    // Pasos 4, 7, 8: Importar versión con cambios en columnas SIAP y MO no observado ('123')
    execDb(`
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, new_workers_count, updated_workers_count,
        unchanged_workers_count, warnings_count, invalid_rows_count, conflicts_count,
        missing_in_file_count, status, notes
      ) VALUES (
        '${batch3Id}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'lote3_cambios.xlsx', 1024, 'sha_b3',
        'v1', 1, 0, 1, 0, 0, 0, 0, 0, 'preview', ''
      );

      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batch3Id}', 1, 'M_CYCLE_1', 'HERRERA BUSTOS JUAN', '{}'::jsonb,
        '{"siap_full_name": "HERRERA BUSTOS JUAN", "position_description": "SUBJEFE DE AREA", "turn": "Vespertino", "occupation_mark_code": "123"}'::jsonb,
        'updated', 'pending', '[]'::jsonb,
        '{"hasChanges": true, "changes": [{"field": "position_description", "oldValue": "ENFERMERO GENERAL", "newValue": "SUBJEFE DE AREA"}, {"field": "turn", "oldValue": "Matutino", "newValue": "Vespertino"}, {"field": "occupation_mark_code", "oldValue": "0", "newValue": "123"}]}'::jsonb
      );

      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_confirm_worker_import('${batch3Id}');
      COMMIT;
    `)

    // Pasos 5 y 6: Resultado esperado: actualizar sólo columnas SIAP; campos manuales y expediente NO cambian
    const workerAfterB3 = execDb(`
      SELECT category || '|' || turn || '|' || occupation_mark_code || '|' || first_name || '|' || paternal_surname || '|' || phone || '|' || notes || '|' || active
      FROM public.union_workers WHERE id = '${createdWorkerId}';
    `)
    expect(workerAfterB3).toBe("SUBJEFE DE AREA|Vespertino|123|Juan|Herrera|5512345678|Nota manual de resguardo sindical|true")

    const caseAfterB3 = execDb(`SELECT count(*) FROM public.union_cases WHERE id = '${caseId}';`)
    expect(Number(caseAfterB3)).toBe(1)

    // Pasos 9 y 10: Ejecutar rollback del último lote (Batch 3)
    execDb(`
      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_rollback_worker_import('${batch3Id}');
      COMMIT;
    `)

    // Debe restaurarse el estado SIAP anterior sin tocar información manual
    const workerRestored = execDb(`
      SELECT category || '|' || turn || '|' || occupation_mark_code || '|' || first_name || '|' || paternal_surname || '|' || phone || '|' || notes || '|' || active
      FROM public.union_workers WHERE id = '${createdWorkerId}';
    `)
    expect(workerRestored).toBe("ENFERMERO GENERAL|Matutino|0|Juan|Herrera|5512345678|Nota manual de resguardo sindical|true")

    const caseRestored = execDb(`SELECT count(*) FROM public.union_cases WHERE id = '${caseId}';`)
    expect(Number(caseRestored)).toBe(1)

    // Pasos 11 y 12: Intentar rollback de un lote antiguo después de una modificación posterior
    // Debe abortar completamente con ROLLBACK_CONFLICT_NEWER_CHANGES
    expect(() => {
      execDb(`
        BEGIN;
        SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
        SELECT public.union_rollback_worker_import('${batch1Id}');
        COMMIT;
      `)
    }).toThrow(/ROLLBACK_CONFLICT_NEWER_CHANGES/)
  })

  it("7. Reactivation of rolled-back worker and inclusion of NULL source_import_state", () => {
    const batchRevertId = "70000000-0000-0000-0000-0000000000b1"
    const batchReactivateId = "70000000-0000-0000-0000-0000000000b2"

    // A) Insert a worker with source_import_state = NULL (simulating legacy pre-import worker)
    execDb(`
      INSERT INTO public.union_workers (
        id, delegation_id, employee_number, siap_full_name, first_name, paternal_surname, maternal_surname,
        category, assignment, turn, schedule, rest_days, active, notes, source_import_state, created_by, updated_by
      ) VALUES (
        '70000000-0000-0000-0000-000000000001', '${DELEGATION_A_ID}', 'LEGACY_NULL_1', 'LEGACY WORKER NULL', 'Carlos', 'Ruiz', '',
        'MEDICO', 'HGR 1', 'M', '08-16', 'S-D', true, '', NULL, '${ADMIN_A_ID}', '${ADMIN_A_ID}'
      );
    `)

    // Query with IS DISTINCT FROM 'rolled_back' logic (source_import_state IS NULL OR != 'rolled_back')
    const nullIncluded = execDb(`
      SELECT count(*) FROM public.union_workers
      WHERE delegation_id = '${DELEGATION_A_ID}'
        AND employee_number = 'LEGACY_NULL_1'
        AND source_import_state IS DISTINCT FROM 'rolled_back';
    `)
    expect(Number(nullIncluded)).toBe(1)

    // B) Create a worker via batch and then rollback
    execDb(`
      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, status
      ) VALUES (
        '${batchRevertId}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'revert.xlsx', 100, 'hashrev',
        'SIAP_2026', 1, 'preview'
      );
      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batchRevertId}', 1, 'REACTIVATED_1', 'REACTIVATED WORKER', '{}'::jsonb,
        '{"siap_full_name": "REACTIVATED WORKER", "position_description": "ENFERMERO"}'::jsonb,
        'new', 'pending', '[]'::jsonb, '{}'::jsonb
      );
      SELECT public.union_confirm_worker_import('${batchRevertId}');
      COMMIT;
    `)

    // Rollback batch
    execDb(`
      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      SELECT public.union_rollback_worker_import('${batchRevertId}');
      COMMIT;
    `)

    const rolledBackState = execDb(`
      SELECT source_import_state FROM public.union_workers WHERE employee_number = 'REACTIVATED_1';
    `)
    expect(rolledBackState).toBe("rolled_back")

    // C) Re-import the exact same matricula with a new batch (re-activation without duplication)
    execDb(`
      BEGIN;
      SET LOCAL "request.jwt.claim.sub" = '${ADMIN_A_ID}';
      INSERT INTO public.union_worker_import_batches (
        id, delegation_id, imported_by, file_name, file_size_bytes, file_sha256,
        format_version, total_rows, status
      ) VALUES (
        '${batchReactivateId}', '${DELEGATION_A_ID}', '${ADMIN_A_ID}', 'reactivate.xlsx', 100, 'hashreact',
        'SIAP_2026', 1, 'preview'
      );
      INSERT INTO public.union_worker_import_rows (
        batch_id, row_number, matricula, full_name, raw_data, parsed_data, row_status, action_taken, issues, diff
      ) VALUES (
        '${batchReactivateId}', 1, 'REACTIVATED_1', 'REACTIVATED WORKER', '{}'::jsonb,
        '{"siap_full_name": "REACTIVATED WORKER", "position_description": "ENFERMERO"}'::jsonb,
        'unchanged', 'pending', '[]'::jsonb, '{}'::jsonb
      );
      SELECT public.union_confirm_worker_import('${batchReactivateId}');
      COMMIT;
    `)

    // Verify: not duplicated, state is active, rolled_back_at is null
    const workerCount = execDb(`
      SELECT count(*) FROM public.union_workers WHERE employee_number = 'REACTIVATED_1';
    `)
    expect(Number(workerCount)).toBe(1)

    const reactivatedData = execDb(`
      SELECT source_import_state || '|' || (source_rolled_back_at IS NULL)::text
      FROM public.union_workers WHERE employee_number = 'REACTIVATED_1';
    `)
    expect(reactivatedData).toBe("active|true")
  })
})
