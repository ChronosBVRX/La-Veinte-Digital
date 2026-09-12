// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { TurnstileWidget } from "@/app/(auth)/turnstile-widget"

describe("TurnstileWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as unknown as Record<string, unknown>).turnstile
  })

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).turnstile
  })

  it("no renderiza nada sin siteKey (flujo intacto hasta configurar)", () => {
    const { container } = render(<TurnstileWidget />)
    expect(container.innerHTML).toBe("")
  })

  it("renderiza el widget y entrega el token por input oculto", async () => {
    type RenderOpts = {
      sitekey: string
      callback?: (token: string) => void
    }
    let captured: RenderOpts | undefined
    ;(window as unknown as Record<string, unknown>).turnstile = {
      render: vi.fn((_el: unknown, opts: RenderOpts) => {
        captured = opts
        return "widget-1"
      }),
      remove: vi.fn(),
    }

    const { container } = render(<TurnstileWidget siteKey="test-site-key" />)

    await waitFor(() => {
      expect(captured?.sitekey).toBe("test-site-key")
    })

    await act(async () => {
      captured?.callback?.("token-xyz")
    })

    const input = container.querySelector('input[name="captcha_token"]') as HTMLInputElement
    expect(input?.value).toBe("token-xyz")
    expect(screen.queryByText(/captcha/i)).toBeNull()
  })
})
