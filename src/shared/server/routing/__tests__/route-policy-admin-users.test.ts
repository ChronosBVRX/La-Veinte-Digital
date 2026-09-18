import { describe, expect, it } from "vitest"
import { API_ACCESS, classifyRequestPath, getApiAccessLevel } from "../route-policy"

const ADMIN_USER_ROUTES = [
  "/api/admin/users",
  "/api/admin/users/[id]",
  "/api/admin/users/[id]/role",
  "/api/admin/users/[id]/union-role",
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

const SAMPLE_UUID = "11111111-1111-4111-8111-111111111111"

const DYNAMIC_SEGMENT = /\[[a-z_][a-z0-9_]*\]/i

describe("route policy — Centro de Administración de Usuarios", () => {
  it("registra cada ruta administrativa como autenticada (sin prefijos)", () => {
    for (const route of ADMIN_USER_ROUTES) {
      expect(getApiAccessLevel(route)).toBe("authenticated")
      expect(API_ACCESS[route]).toBe("authenticated")
    }
  })

  it("clasifica las rutas administrativas dinámicas con UUID real (no 404 del proxy)", () => {
    // Regresión: el proxy debe reconocer las rutas con identificador real; un
    // match literal de "[id]" las mandaba a unknown-api (404 "No encontrado").
    const expected: Array<[string, "authenticated-api"]> = [
      [`/api/admin/users/${SAMPLE_UUID}`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/role`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/union-role`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/suspend`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/reactivate`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/trash`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/restore`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/sessions/revoke`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/resend-confirmation`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/password-recovery`, "authenticated-api"],
      [`/api/admin/users/${SAMPLE_UUID}/purge`, "authenticated-api"],
    ]

    for (const [pathname, expectedClass] of expected) {
      expect(classifyRequestPath(pathname), pathname).toBe(expectedClass)
      expect(getApiAccessLevel(pathname), pathname).toBe("authenticated")
    }
  })

  it("todo patrón dinámico del registro coincide con una URL real de ejemplo", () => {
    const dynamicKeys = Object.keys(API_ACCESS).filter((route) => DYNAMIC_SEGMENT.test(route))

    expect(dynamicKeys.length).toBeGreaterThan(0)

    for (const route of dynamicKeys) {
      const sample = route.replace(DYNAMIC_SEGMENT, SAMPLE_UUID)
      expect(getApiAccessLevel(route), `${route} (patrón literal)`).not.toBeNull()
      expect(getApiAccessLevel(sample), `${route} (URL real ${sample})`).toBe(API_ACCESS[route as keyof typeof API_ACCESS])
    }
  })

  it("mantiene bloqueadas las formas no registradas (sin prefijos ni segmentos extra)", () => {
    expect(classifyRequestPath(`/api/admin/users/${SAMPLE_UUID}/unknown`)).toBe("unknown-api")
    expect(classifyRequestPath(`/api/admin/users/${SAMPLE_UUID}/sessions`)).toBe("unknown-api")
    expect(classifyRequestPath(`/api/admin/users/${SAMPLE_UUID}/purge/extra`)).toBe("unknown-api")
    expect(classifyRequestPath(`/api/admin/users/${SAMPLE_UUID}/trash/extra`)).toBe("unknown-api")
    expect(classifyRequestPath("/api/admin/users/role")).toBe("authenticated-api")
    expect(classifyRequestPath("/api/admin/usuarios")).toBe("unknown-api")
    expect(classifyRequestPath("/api/admin")).toBe("unknown-api")
    expect(classifyRequestPath("/api/admin/audit-log/extra")).toBe("unknown-api")
    expect(classifyRequestPath("/api/admin/users/extra/segment")).toBe("unknown-api")
  })

  it("abre únicamente la página exacta del aviso de suspensión", () => {
    expect(classifyRequestPath("/cuenta-suspendida")).toBe("public-page")
    expect(classifyRequestPath("/cuenta-suspendida/detalle")).toBe("protected-page")
    expect(classifyRequestPath("/cuenta-suspendida-otra")).toBe("protected-page")
  })
})
