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

describe("DesktopSidebar Admin Link", () => {
  it("does not render Administración when canAccessAdmin is false", () => {
    render(<DesktopSidebar open={true} onClose={() => {}} canAccessAdmin={false} />)
    const links = screen.queryAllByRole("link", { name: /Administración/i })
    expect(links.length).toBe(0)
  })

  it("renders Administración link when canAccessAdmin is true", () => {
    render(<DesktopSidebar open={true} onClose={() => {}} canAccessAdmin={true} />)
    const links = screen.getAllByRole("link", { name: /Administración/i })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].getAttribute("href")).toBe("/admin")
  })

  it("does not render Caja de Ahorro when canAccessAdmin is false and isCajaPublic is false", () => {
    render(<DesktopSidebar open={true} onClose={() => {}} canAccessAdmin={false} isCajaPublic={false} />)
    const links = screen.queryAllByRole("link", { name: /Caja de Ahorro/i })
    expect(links.length).toBe(0)
  })

  it("renders Caja de Ahorro link when canAccessAdmin is true", () => {
    render(<DesktopSidebar open={true} onClose={() => {}} canAccessAdmin={true} isCajaPublic={false} />)
    const links = screen.getAllByRole("link", { name: /Caja de Ahorro/i })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].getAttribute("href")).toBe("/caja")
  })

  it("renders Caja de Ahorro link when isCajaPublic is true even if canAccessAdmin is false", () => {
    render(<DesktopSidebar open={true} onClose={() => {}} canAccessAdmin={false} isCajaPublic={true} />)
    const links = screen.getAllByRole("link", { name: /Caja de Ahorro/i })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].getAttribute("href")).toBe("/caja")
  })
})
