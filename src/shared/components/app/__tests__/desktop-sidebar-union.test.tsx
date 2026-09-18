// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { DesktopSidebar } from "../DesktopSidebar"
import type { ReactNode } from "react"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode
    href: string | { pathname: string }
    [key: string]: unknown
  }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("@/shared/hooks/useIsNativeApp", () => ({
  useIsNativeApp: () => false,
  useNativePlatform: () => "web",
}))

describe("DesktopSidebar Union Link", () => {
  it("no muestra Representación Sindical ni Administración sin permisos (usuario normal)", () => {
    render(<DesktopSidebar open={true} onClose={() => {}} canAccessAdmin={false} canAccessUnion={false} />)

    expect(screen.queryAllByRole("link", { name: /Representación Sindical/i }).length).toBe(0)
    expect(screen.queryAllByRole("link", { name: /Administración/i }).length).toBe(0)
  })

  it("un union_rep ve Representación Sindical pero no Administración", () => {
    render(<DesktopSidebar open={true} onClose={() => {}} canAccessAdmin={false} canAccessUnion={true} />)

    const unionLinks = screen.getAllByRole("link", { name: /Representación Sindical/i })
    expect(unionLinks.length).toBeGreaterThan(0)
    expect(unionLinks[0].getAttribute("href")).toBe("/representacion")
    expect(screen.queryAllByRole("link", { name: /Administración/i }).length).toBe(0)
  })

  it("un administrador de plataforma ve Administración (y Representación solo con membresía)", () => {
    render(<DesktopSidebar open={true} onClose={() => {}} canAccessAdmin={true} canAccessUnion={false} />)

    const adminLinks = screen.getAllByRole("link", { name: /Administración/i })
    expect(adminLinks.length).toBeGreaterThan(0)
    expect(adminLinks[0].getAttribute("href")).toBe("/admin")
    expect(screen.queryAllByRole("link", { name: /Representación Sindical/i }).length).toBe(0)
  })

  it("doble rol (admin + membresía) muestra ambos accesos", () => {
    render(<DesktopSidebar open={true} onClose={() => {}} canAccessAdmin={true} canAccessUnion={true} />)

    expect(screen.getAllByRole("link", { name: /Administración/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("link", { name: /Representación Sindical/i }).length).toBeGreaterThan(0)
  })
})
