// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { getProfile, saveProfile } from "@/shared/services/local-storage"
import type { EmployeePayrollProfile } from "@/features/nomina/lib/types"

const USER_A = "session-user-a"
const USER_B = "session-user-b"

function makeProfile(userId: string, categoryName: string): EmployeePayrollProfile {
  return {
    id: `profile_${userId}`,
    userId,
    consentGiven: true,
    employmentType: "base",
    occupationalConditions: [],
    siapConceptMarks: [],
    categoryName,
    workdayHours: 8,
    facts: [],
    recurringConcepts: [],
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  }
}

/**
 * Arnés que simula una vista autenticada: solo lee el namespace del userId
 * vigente. Con `userId = null` (logout / sesión aún no resuelta) NO debe mostrar
 * datos de la sesión anterior.
 */
function SessionView({ userId }: { userId: string | null }) {
  if (!userId) return <p data-testid="view">sin sesión</p>
  const profile = getProfile(userId)
  return <p data-testid="view">{profile?.categoryName ?? "sin perfil"}</p>
}

beforeEach(() => {
  localStorage.clear()
})

describe("Transición de sesión: sin exposición de datos de la cuenta anterior", () => {
  it("A → logout → B no renderiza datos de A", () => {
    saveProfile(USER_A, makeProfile(USER_A, "PERFIL DE A"))
    saveProfile(USER_B, makeProfile(USER_B, "PERFIL DE B"))

    const { rerender } = render(<SessionView userId={USER_A} />)
    expect(screen.getByTestId("view").textContent).toBe("PERFIL DE A")

    // Logout: la sesión se resuelve a null.
    act(() => rerender(<SessionView userId={null} />))
    expect(screen.getByTestId("view").textContent).toBe("sin sesión")

    // Login como B.
    act(() => rerender(<SessionView userId={USER_B} />))
    expect(screen.getByTestId("view").textContent).toBe("PERFIL DE B")
    expect(screen.getByTestId("view").textContent).not.toContain("A")
  })

  it("B no ve datos de A aunque A siga persistido (sin reutilizar el UUID anterior)", () => {
    saveProfile(USER_A, makeProfile(USER_A, "PERFIL DE A"))

    render(<SessionView userId={USER_B} />)
    expect(screen.getByTestId("view").textContent).toBe("sin perfil")
    expect(screen.getByTestId("view").textContent).not.toContain("A")
  })

  it("los namespaces de A y B no se borran al cambiar de sesión", () => {
    saveProfile(USER_A, makeProfile(USER_A, "PERFIL DE A"))
    saveProfile(USER_B, makeProfile(USER_B, "PERFIL DE B"))

    const { rerender } = render(<SessionView userId={USER_A} />)
    act(() => rerender(<SessionView userId={null} />))
    act(() => rerender(<SessionView userId={USER_B} />))
    act(() => rerender(<SessionView userId={null} />))
    act(() => rerender(<SessionView userId={USER_A} />))

    expect(getProfile(USER_A)?.categoryName).toBe("PERFIL DE A")
    expect(getProfile(USER_B)?.categoryName).toBe("PERFIL DE B")
  })
})
