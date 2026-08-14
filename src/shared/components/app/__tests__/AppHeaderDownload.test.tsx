// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { NATIVE_READY_GRACE_MS } from "@/shared/hooks/useAppEnvironment"
import { AppHeader } from "../AppHeader"

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const imgProps: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(props)) {
      if (key !== "priority") imgProps[key] = value
    }
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...imgProps} />
  },
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string | { pathname: string }; [key: string]: unknown }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}))

const ANDROID_BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

function bridge(platform: "android" | "ios"): LaVeinteNativeApp {
  return { isNativeApp: () => true, appPlatform: () => platform } as unknown as LaVeinteNativeApp
}

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: ua })
}

function renderHeader() {
  return render(<AppHeader fullName="Test User" onMenuToggle={vi.fn()} />)
}

const downloadLink = () => screen.queryByTitle("Descargar app Android")

describe("AppHeader — botón Descargar app", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setUserAgent(DESKTOP_UA)
    window.LaVeinteApp = undefined
  })

  afterEach(() => {
    window.LaVeinteApp = undefined
    vi.useRealTimers()
  })

  it("navegador Android → botón visible tras resolver (sin parpadeo antes)", () => {
    setUserAgent(ANDROID_BROWSER_UA)
    renderHeader()
    expect(downloadLink()).toBeNull()
    act(() => vi.advanceTimersByTime(NATIVE_READY_GRACE_MS))
    const link = downloadLink() as HTMLAnchorElement | null
    expect(link).not.toBeNull()
    expect(link?.getAttribute("href")).toBe("/LaVeinteDigital.apk")
  })

  it("app Android (bridge) → el botón NUNCA se renderiza", () => {
    window.LaVeinteApp = bridge("android")
    setUserAgent(ANDROID_BROWSER_UA)
    renderHeader()
    expect(downloadLink()).toBeNull()
    act(() => vi.advanceTimersByTime(NATIVE_READY_GRACE_MS))
    expect(downloadLink()).toBeNull()
  })

  it("app iOS (bridge) → el botón nunca se renderiza", () => {
    window.LaVeinteApp = bridge("ios")
    setUserAgent(ANDROID_BROWSER_UA)
    renderHeader()
    act(() => vi.advanceTimersByTime(NATIVE_READY_GRACE_MS))
    expect(downloadLink()).toBeNull()
  })

  it("desktop → sin botón (comportamiento actual)", () => {
    renderHeader()
    act(() => vi.advanceTimersByTime(NATIVE_READY_GRACE_MS))
    expect(downloadLink()).toBeNull()
  })
})
