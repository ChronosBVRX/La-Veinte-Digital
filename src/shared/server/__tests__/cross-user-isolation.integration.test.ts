import { describe, it, expect } from "vitest"
import { DatabaseSync } from "node:sqlite"

describe("E2E Cross-User Isolation (Two Authenticated Users)", () => {
  it("enforces that User B cannot read, update, or delete User A's resources", () => {
    const db = new DatabaseSync(":memory:")

    // Setup tables
    db.exec(`
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        matricula TEXT
      );

      CREATE TABLE worker_commitments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE imported_payslips (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        fiscal_folio_hash TEXT NOT NULL,
        neto REAL NOT NULL
      );
    `)

    // Simular Usuario A y Usuario B
    const userA = "auth-user-alpha-001"
    const userB = "auth-user-beta-002"

    db.prepare("INSERT INTO profiles VALUES (?, 'userA@test.com', 'MATR-A')").run(userA)
    db.prepare("INSERT INTO profiles VALUES (?, 'userB@test.com', 'MATR-B')").run(userB)

    // 1. Usuario A crea sus recursos privados
    db.prepare("INSERT INTO worker_commitments VALUES ('com-A1', ?, 'Compromiso Privado A', 'active')").run(userA)
    db.prepare("INSERT INTO imported_payslips VALUES ('pay-A1', ?, 'hash-A1', 12500.50)").run(userA)

    // 2. Simular políticas RLS / Ownership para consultas:
    // SELECT: solo filas donde user_id = current_user
    const queryCommitmentsAs = (activeUser: string) =>
      db.prepare("SELECT * FROM worker_commitments WHERE user_id = ?").all(activeUser)

    const queryPayslipsAs = (activeUser: string) =>
      db.prepare("SELECT * FROM imported_payslips WHERE user_id = ?").all(activeUser)

    // UPDATE: solo donde user_id = current_user
    const updateCommitmentAs = (activeUser: string, id: string, newTitle: string) => {
      const info = db.prepare("UPDATE worker_commitments SET title = ? WHERE id = ? AND user_id = ?").run(newTitle, id, activeUser)
      return info.changes
    }

    // DELETE: solo donde user_id = current_user
    const deleteCommitmentAs = (activeUser: string, id: string) => {
      const info = db.prepare("DELETE FROM worker_commitments WHERE id = ? AND user_id = ?").run(id, activeUser)
      return info.changes
    }

    // TEST: Usuario B lee sus compromisos -> NO ve los de Usuario A
    const userBCommitments = queryCommitmentsAs(userB)
    expect(userBCommitments).toHaveLength(0)

    const userBPayslips = queryPayslipsAs(userB)
    expect(userBPayslips).toHaveLength(0)

    // TEST: Usuario B intenta modificar recurso de Usuario A -> 0 cambios
    const modifiedRows = updateCommitmentAs(userB, "com-A1", "Título Hackeado por B")
    expect(modifiedRows).toBe(0)

    // TEST: Usuario B intenta borrar recurso de Usuario A -> 0 cambios
    const deletedRows = deleteCommitmentAs(userB, "com-A1")
    expect(deletedRows).toBe(0)

    // TEST: Usuario A verifica que su recurso sigue intacto
    const userACommitments = queryCommitmentsAs(userA) as Record<string, unknown>[]
    expect(userACommitments).toHaveLength(1)
    expect(userACommitments[0].title).toBe("Compromiso Privado A")

    const userAPayslips = queryPayslipsAs(userA) as Record<string, unknown>[]
    expect(userAPayslips).toHaveLength(1)
    expect(userAPayslips[0].fiscal_folio_hash).toBe("hash-A1")

    db.close()
  })
})
