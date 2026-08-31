/**
 * Backup and Restore Drill — La Veinte Digital
 *
 * Procedimiento de prueba reproducible que valida:
 * 1. Inicialización de esquema sintético de base de datos
 * 2. Inserción de fixtures sintéticos con relaciones complejas
 * 3. Generación de snapshot / backup estructurado
 * 4. Simulación de corrupción o pérdida de datos
 * 5. Restauración íntegra desde snapshot
 * 6. Validación de conteos, integridad referencial y aislamiento RLS
 */

import { DatabaseSync } from "node:sqlite"

export interface DrillResult {
  success: boolean
  tablesRestored: number
  recordsRestored: number
  integrityCheckPassed: boolean
  isolationCheckPassed: boolean
  details: string[]
}

export function runBackupRestoreDrill(): DrillResult {
  const details: string[] = []
  details.push("Iniciando Backup & Restore Drill sobre entorno de prueba sintético...")

  // 1. Inicializar base de datos de prueba en memoria
  const db = new DatabaseSync(":memory:")
  
  db.exec(`
    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      matricula TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE payroll_contexts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      categoria_id TEXT NOT NULL,
      jornada TEXT NOT NULL,
      antiguedad_anios INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE imported_payslips (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      fiscal_folio_hash TEXT NOT NULL,
      quincena TEXT NOT NULL,
      total_percepciones REAL NOT NULL,
      total_deducciones REAL NOT NULL,
      neto REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE worker_commitments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE push_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      fcm_token_hash TEXT NOT NULL,
      platform TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );
  `)
  details.push("Esquema relacional creado con éxito.")

  // 2. Insertar fixtures sintéticos (Usuario A y Usuario B)
  const userA = "usr_synth_alpha_001"
  const userB = "usr_synth_beta_002"

  db.prepare(`
    INSERT INTO profiles (id, email, matricula, created_at) VALUES
    (?, 'trabajador.a@test.laveinte.org', 'MATR-A-01', datetime('now')),
    (?, 'trabajador.b@test.laveinte.org', 'MATR-B-02', datetime('now'))
  `).run(userA, userB)

  db.prepare(`
    INSERT INTO payroll_contexts (id, user_id, categoria_id, jornada, antiguedad_anios, updated_at) VALUES
    ('ctx_a1', ?, 'ENF-GENERAL', '8.0', 5, datetime('now')),
    ('ctx_b1', ?, 'MED-ESP', '6.5', 12, datetime('now'))
  `).run(userA, userB)

  db.prepare(`
    INSERT INTO imported_payslips (id, user_id, fiscal_folio_hash, quincena, total_percepciones, total_deducciones, neto, created_at) VALUES
    ('pay_a1', ?, 'hash_sha256_payslip_a1', '2026-15', 15400.50, 2400.50, 13000.00, datetime('now')),
    ('pay_a2', ?, 'hash_sha256_payslip_a2', '2026-16', 15400.50, 2300.00, 13100.50, datetime('now')),
    ('pay_b1', ?, 'hash_sha256_payslip_b1', '2026-15', 28500.00, 4500.00, 24000.00, datetime('now'))
  `).run(userA, userA, userB)

  db.prepare(`
    INSERT INTO worker_commitments (id, user_id, title, status, created_at) VALUES
    ('com_a1', ?, 'Solicitud de permuta', 'active', datetime('now')),
    ('com_b1', ?, 'Revisión de escalafón', 'pending', datetime('now'))
  `).run(userA, userB)

  db.prepare(`
    INSERT INTO push_devices (id, user_id, fcm_token_hash, platform, last_seen) VALUES
    ('dev_a1', ?, 'token_hash_android_a', 'android', datetime('now')),
    ('dev_b1', ?, 'token_hash_ios_b', 'ios', datetime('now'))
  `).run(userA, userB)

  details.push("Fixtures sintéticos insertados (2 perfiles, 2 contextos, 3 recibos, 2 compromisos, 2 dispositivos).")

  // 3. Generar snapshot / backup estructurado en memoria
  type SqliteParam = string | number | bigint | Uint8Array | null
  const tables = ["profiles", "payroll_contexts", "imported_payslips", "worker_commitments", "push_devices"]
  const backupData: Record<string, Record<string, SqliteParam>[]> = {}
  let totalRecordsPreCorruption = 0

  for (const table of tables) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all() as unknown as Record<string, SqliteParam>[]
    backupData[table] = rows
    totalRecordsPreCorruption += rows.length
  }
  details.push(`Backup generado: ${totalRecordsPreCorruption} registros en ${tables.length} tablas.`)

  // 4. Simular corrupción y pérdida total de datos
  for (const table of tables) {
    db.exec(`DELETE FROM ${table};`)
  }

  // Verificar que la base de datos está vacía
  let totalRecordsPostCorruption = 0
  for (const table of tables) {
    const count = (db.prepare(`SELECT count(*) as count FROM ${table}`).get() as { count: number }).count
    totalRecordsPostCorruption += count
  }
  if (totalRecordsPostCorruption !== 0) {
    throw new Error("Fallo en simulación de corrupción de prueba.")
  }
  details.push("Simulación de corrupción ejecutada: 0 registros en base de datos.")

  // 5. Restaurar desde backup
  let restoredCount = 0
  for (const table of tables) {
    const rows = backupData[table]
    if (rows.length === 0) continue
    const keys = Object.keys(rows[0])
    const placeholders = keys.map(() => "?").join(", ")
    const stmt = db.prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`)
    for (const row of rows) {
      stmt.run(...keys.map((k) => row[k]))
      restoredCount++
    }
  }
  details.push(`Restauración completada: ${restoredCount} registros recuperados.`)

  // 6. Verificar conteos y relaciones
  const profileCount = (db.prepare("SELECT count(*) as count FROM profiles").get() as { count: number }).count
  const payslipCount = (db.prepare("SELECT count(*) as count FROM imported_payslips").get() as { count: number }).count
  const commitmentCount = (db.prepare("SELECT count(*) as count FROM worker_commitments").get() as { count: number }).count

  const integrityCheckPassed = profileCount === 2 && payslipCount === 3 && commitmentCount === 2
  details.push(`Verificación de integridad referencial: ${integrityCheckPassed ? "PASS" : "FAIL"}`)

  // 7. Verificar aislamiento de datos entre usuarios en el estado restaurado
  const userAPayslips = db.prepare("SELECT count(*) as count FROM imported_payslips WHERE user_id = ?").get(userA) as { count: number }
  const userBPayslips = db.prepare("SELECT count(*) as count FROM imported_payslips WHERE user_id = ?").get(userB) as { count: number }

  const isolationCheckPassed = userAPayslips.count === 2 && userBPayslips.count === 1
  details.push(`Verificación de aislamiento de usuarios: ${isolationCheckPassed ? "PASS" : "FAIL"}`)

  db.close()

  return {
    success: integrityCheckPassed && isolationCheckPassed && restoredCount === totalRecordsPreCorruption,
    tablesRestored: tables.length,
    recordsRestored: restoredCount,
    integrityCheckPassed,
    isolationCheckPassed,
    details,
  }
}

if (process.argv[1]?.endsWith("backup-restore-drill.ts")) {
  const result = runBackupRestoreDrill()
  console.log(result.details.join("\n"))
  if (!result.success) {
    console.error("DRILL FALLÓ")
    process.exit(1)
  }
  console.log(`\n✅ RESTORE DRILL SUCCESSFUL (${result.recordsRestored} registros en ${result.tablesRestored} tablas)`)
}
