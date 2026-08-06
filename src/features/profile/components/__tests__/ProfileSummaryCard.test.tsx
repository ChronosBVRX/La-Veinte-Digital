// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProfileSummaryCard } from "../ProfileSummaryCard"

describe("ProfileSummaryCard", () => {
  it("exposes profile completion as an accessible progressbar", () => {
    render(
      <ProfileSummaryCard
        fullName="Eduardo"
        phone={null}
        email="correo@example.com"
        hasMatricula
        hasCategoria
        hasAdscripcion={false}
        hasAntiguedad={false}
      />
    )

    const progressbar = screen.getByRole("progressbar", { name: /perfil completado/i })
    expect(progressbar.getAttribute("aria-valuenow")).toBe("50")
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0")
    expect(progressbar.getAttribute("aria-valuemax")).toBe("100")
    expect(progressbar.getAttribute("aria-valuetext")).toBe("50% completo")
  })

  it("shows full name", () => {
    render(
      <ProfileSummaryCard
        fullName="Eduardo Bolaños"
        phone={null}
        email={null}
        hasMatricula={false}
        hasCategoria={false}
        hasAdscripcion={false}
        hasAntiguedad={false}
      />
    )
    expect(screen.getByText("Eduardo Bolaños")).toBeDefined()
  })

  it("shows registered fields with check icons", () => {
    render(
      <ProfileSummaryCard
        fullName="Eduardo"
        phone="5512345678"
        email="correo@example.com"
        hasMatricula
        hasCategoria={false}
        hasAdscripcion={false}
        hasAntiguedad
      />
    )
    expect(screen.getByText(/Matrícula registrada/)).toBeDefined()
    expect(screen.getByText(/Antigüedad registrada/)).toBeDefined()
  })
})
