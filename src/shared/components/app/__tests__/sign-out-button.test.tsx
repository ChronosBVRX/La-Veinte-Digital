// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SignOutButton } from "../SignOutButton"

const signOutAction = vi.fn(async () => undefined)

vi.mock("@/app/(auth)/actions", () => ({
  get signOutAction() {
    return signOutAction
  },
}))

describe("SignOutButton", () => {
  it("muestra Cerrar sesión y llama al server action existente", async () => {
    const onDone = vi.fn()
    const { container } = render(<SignOutButton onDone={onDone} />)

    const button = screen.getByRole("button", { name: /cerrar sesión/i })
    expect(button).toBeTruthy()

    fireEvent.submit(container.querySelector("form")!)
    await vi.waitFor(() => {
      expect(signOutAction).toHaveBeenCalled()
    })
  })
})
