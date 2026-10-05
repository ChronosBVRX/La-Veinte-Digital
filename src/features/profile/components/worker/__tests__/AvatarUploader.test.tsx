// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AvatarUploader } from "../AvatarUploader"
import * as avatarStorage from "../../../services/avatar-storage"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

describe("AvatarUploader Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renderiza botón para subir foto cuando no hay avatar inicial", () => {
    render(<AvatarUploader initialAvatarUrl={null} fullName="Carlos Sánchez" />)

    expect(screen.getByRole("button", { name: /subir foto/i })).toBeDefined()
    expect(screen.queryByRole("button", { name: /quitar foto/i })).toBeNull()
  })

  it("renderiza la imagen y el botón de quitar foto cuando existe avatar inicial", () => {
    render(
      <AvatarUploader
        initialAvatarUrl="https://example.com/storage/avatars/user/avatar.webp"
        fullName="Carlos Sánchez"
      />
    )

    const img = screen.getByRole("img")
    expect(img).toBeDefined()
    expect(img.getAttribute("src")).toBe("https://example.com/storage/avatars/user/avatar.webp")
    expect(screen.getAllByRole("button", { name: /cambiar foto/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole("button", { name: /quitar foto/i })).toBeDefined()
  })

  it("permite quitar la foto confirmando el diálogo", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const deleteSpy = vi.spyOn(avatarStorage, "deleteUserAvatar").mockResolvedValue({ success: true })
    const onAvatarChange = vi.fn()

    render(
      <AvatarUploader
        initialAvatarUrl="https://example.com/avatar.webp"
        fullName="Carlos Sánchez"
        onAvatarChange={onAvatarChange}
      />
    )

    const deleteBtn = screen.getByRole("button", { name: /quitar foto/i })
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalled()
      expect(onAvatarChange).toHaveBeenCalledWith(null)
    })
  })
})
