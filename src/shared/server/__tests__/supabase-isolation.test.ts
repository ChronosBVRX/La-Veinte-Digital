import { describe, it, expect } from "vitest"

/**
 * Modelización rigurosa de las políticas RLS activas en Supabase.
 * Cada regla replica exactamente las expresiones `USING` y `WITH CHECK`
 * definidas en las migraciones SQL de PostgreSQL.
 */
interface SecurityContext {
  role: "anon" | "authenticated" | "service_role"
  uid: string | null
  userRole?: "user" | "admin"
}

interface TableRow {
  id?: string
  user_id?: string
  full_name?: string
  matricula?: string
  categoria?: string
  base_salary?: number
  role?: string
  title?: string
  status?: string
  [key: string]: unknown
}

interface TablePolicy {
  canSelect: (ctx: SecurityContext, row: TableRow) => boolean
  canInsert: (ctx: SecurityContext, newRow: TableRow) => boolean
  canUpdate: (ctx: SecurityContext, oldRow: TableRow, newRow: TableRow) => boolean
  canDelete: (ctx: SecurityContext, row: TableRow) => boolean
}

const RLS_POLICIES: Record<string, TablePolicy> = {
  profiles: {
    canSelect: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.id,
    canInsert: (ctx, newRow) =>
      ctx.role === "authenticated" && ctx.uid === newRow.id && newRow.role === "user",
    canUpdate: (ctx, oldRow, newRow) =>
      ctx.role === "authenticated" &&
      ctx.uid === oldRow.id &&
      ctx.uid === newRow.id &&
      oldRow.role === newRow.role, // role is immutable for users
    canDelete: () => false, // Only cascade or service role
  },

  payroll_contexts: {
    canSelect: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
    canInsert: (ctx, newRow) => ctx.role === "authenticated" && ctx.uid === newRow.user_id,
    canUpdate: (ctx, oldRow, newRow) =>
      ctx.role === "authenticated" && ctx.uid === oldRow.user_id && ctx.uid === newRow.user_id,
    canDelete: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
  },

  worker_commitments: {
    canSelect: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
    canInsert: (ctx, newRow) => ctx.role === "authenticated" && ctx.uid === newRow.user_id,
    canUpdate: (ctx, oldRow, newRow) =>
      ctx.role === "authenticated" && ctx.uid === oldRow.user_id && ctx.uid === newRow.user_id,
    canDelete: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
  },

  worker_active_context: {
    canSelect: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
    canInsert: (ctx, newRow) => ctx.role === "authenticated" && ctx.uid === newRow.user_id,
    canUpdate: (ctx, oldRow, newRow) =>
      ctx.role === "authenticated" && ctx.uid === oldRow.user_id && ctx.uid === newRow.user_id,
    canDelete: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
  },

  push_devices: {
    canSelect: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
    canInsert: (ctx, newRow) => ctx.role === "authenticated" && ctx.uid === newRow.user_id,
    canUpdate: (ctx, oldRow, newRow) =>
      ctx.role === "authenticated" && ctx.uid === oldRow.user_id && ctx.uid === newRow.user_id,
    canDelete: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
  },

  ai_chat_history: {
    canSelect: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
    canInsert: (ctx, newRow) => ctx.role === "authenticated" && ctx.uid === newRow.user_id,
    canUpdate: () => false,
    canDelete: () => false,
  },

  worker_preferences: {
    canSelect: (ctx, row) => ctx.role === "authenticated" && ctx.uid === row.user_id,
    canInsert: () => false, // Only domain RPC / service_role
    canUpdate: () => false, // Only domain RPC / service_role
    canDelete: () => false,
  },
}

describe("Supabase Cross-User Isolation & RLS Security Invariants", () => {
  const userA: SecurityContext = {
    role: "authenticated",
    uid: "00000000-0000-0000-0000-0000000000aa",
    userRole: "user",
  }

  const userB: SecurityContext = {
    role: "authenticated",
    uid: "00000000-0000-0000-0000-0000000000bb",
    userRole: "user",
  }

  const anonUser: SecurityContext = {
    role: "anon",
    uid: null,
  }

  const rowUserA = {
    id: "00000000-0000-0000-0000-0000000000aa",
    user_id: "00000000-0000-0000-0000-0000000000aa",
    full_name: "Usuario A",
    base_salary: 15000,
    role: "user",
    title: "Compromiso A",
  }

  describe("Invariante 1: Usuario Anónimo (anon) no accede a datos personales", () => {
    it("denies anon from reading any personal table", () => {
      for (const [tableName, policy] of Object.entries(RLS_POLICIES)) {
        expect(
          policy.canSelect(anonUser, rowUserA),
          `anon no debe leer filas de ${tableName}`
        ).toBe(false)
      }
    })

    it("denies anon from inserting into any personal table", () => {
      for (const [tableName, policy] of Object.entries(RLS_POLICIES)) {
        expect(
          policy.canInsert(anonUser, rowUserA),
          `anon no debe insertar filas en ${tableName}`
        ).toBe(false)
      }
    })
  })

  describe("Invariante 2: Usuario B NO puede leer datos de Usuario A", () => {
    it("denies User B from SELECTing User A's data across all personal tables", () => {
      for (const [tableName, policy] of Object.entries(RLS_POLICIES)) {
        expect(
          policy.canSelect(userB, rowUserA),
          `User B no debe poder leer datos de User A en ${tableName}`
        ).toBe(false)
      }
    })
  })

  describe("Invariante 3: Usuario B NO puede modificar datos de Usuario A", () => {
    it("denies User B from UPDATEing User A's data", () => {
      const updatedRow = { ...rowUserA, full_name: "Modificado por B", base_salary: 99999 }
      for (const [tableName, policy] of Object.entries(RLS_POLICIES)) {
        expect(
          policy.canUpdate(userB, rowUserA, updatedRow),
          `User B no debe poder actualizar datos de User A en ${tableName}`
        ).toBe(false)
      }
    })

    it("denies User B from DELETEing User A's data", () => {
      for (const [tableName, policy] of Object.entries(RLS_POLICIES)) {
        expect(
          policy.canDelete(userB, rowUserA),
          `User B no debe poder eliminar datos de User A en ${tableName}`
        ).toBe(false)
      }
    })
  })

  describe("Invariante 4: Usuario B NO puede suplantar la identidad de Usuario A en INSERT", () => {
    it("denies User B from inserting records assigned to User A", () => {
      const spoofedRow = {
        id: userA.uid,
        user_id: userA.uid,
        title: "Registro falso atribuido a A",
        role: "user",
      }
      for (const [tableName, policy] of Object.entries(RLS_POLICIES)) {
        expect(
          policy.canInsert(userB, spoofedRow),
          `User B no debe poder insertar registros asignados a User A en ${tableName}`
        ).toBe(false)
      }
    })
  })

  describe("Invariante 5: Usuario A puede acceder y gestionar legítimamente sus propios datos", () => {
    it("allows User A to SELECT their own data", () => {
      expect(RLS_POLICIES.profiles.canSelect(userA, rowUserA)).toBe(true)
      expect(RLS_POLICIES.payroll_contexts.canSelect(userA, rowUserA)).toBe(true)
      expect(RLS_POLICIES.worker_commitments.canSelect(userA, rowUserA)).toBe(true)
      expect(RLS_POLICIES.worker_active_context.canSelect(userA, rowUserA)).toBe(true)
      expect(RLS_POLICIES.push_devices.canSelect(userA, rowUserA)).toBe(true)
      expect(RLS_POLICIES.ai_chat_history.canSelect(userA, rowUserA)).toBe(true)
      expect(RLS_POLICIES.worker_preferences.canSelect(userA, rowUserA)).toBe(true)
    })

    it("allows User A to UPDATE their own mutable data without escalating role", () => {
      const updatedProfile = { ...rowUserA, full_name: "Usuario A Actualizado" }
      expect(RLS_POLICIES.profiles.canUpdate(userA, rowUserA, updatedProfile)).toBe(true)

      // Role escalation attempt must fail
      const escalatedProfile = { ...rowUserA, role: "admin" }
      expect(RLS_POLICIES.profiles.canUpdate(userA, rowUserA, escalatedProfile)).toBe(false)
    })
  })
})
