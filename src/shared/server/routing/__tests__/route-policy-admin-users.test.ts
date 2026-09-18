import { describe, expect, it } from "vitest"
import { API_ACCESS, classifyRequestPath, getApiAccessLevel } from "../route-policy"

const ADMIN_USER_ROUTES = [
  "/api/admin/users",
  "/api/admin/users/[id]",
  "/api/admin/users/[id]/role",
  "/api/admin/users/[id]/suspend",
  "/api/admin/users/[id]/reactivate",
  "/api/admin/users/[id]/trash",
  "/api/admin/users/[id]/restore",
  "/api/admin/users/[id]/sessions/revoke",
  "/api/admin/users/[id]/resend-confirmation",
  "/api/admin/users/[id]/password-recovery",
  "/api/admin/users/[id]/purge",
  "/api/admin/audit-log",
] as const

describe("route policy — Centro de Administración de Usuarios", () => {
  it("registra cada ruta administrativa como autenticada (sin prefijos)", () => {
    for (const route of ADMIN_USER_ROUTES) {
      expect(getApiAccessLevel(route)).toBe("authenticated")
      expect(API_ACCESS[route]).toBe("authenticated")
    }
  })

  it("mantiene bloqueadas las rutas administrativas no registradas", () => {
    expect(classifyRequestPath("/api/admin/users/123/unknown")).toBe("unknown-api")
    expect(classifyRequestPath("/api/admin/users/role")).toBe("unknown-api")
    expect(classifyRequestPath("/api/admin/usuarios")).toBe("unknown-api")
    expect(classifyRequestPath("/api/admin")).toBe("unknown-api")
    expect(classifyRequestPath("/api/admin/audit-log/extra")).toBe("unknown-api")
  })

  it("abre únicamente la página exacta del aviso de suspensión", () => {
    expect(classifyRequestPath("/cuenta-suspendida")).toBe("public-page")
    expect(classifyRequestPath("/cuenta-suspendida/detalle")).toBe("protected-page")
    expect(classifyRequestPath("/cuenta-suspendida-otra")).toBe("protected-page")
  })
})
