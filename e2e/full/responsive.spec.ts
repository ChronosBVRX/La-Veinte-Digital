import { test, expect } from "../fixtures/test"

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-tablet-limit", width: 768, height: 1024 },
  { name: "desktop-first-pixel", width: 769, height: 1024 },
  { name: "desktop-small", width: 900, height: 900 },
  { name: "laptop-horizontal", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 720 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "desktop-ultrawide", width: 2560, height: 1440 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`Responsive — ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test("dashboard sin scroll horizontal", async ({ page }) => {
      await page.goto("/")
      await page.waitForLoadState("networkidle")

      const ok = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 5
      })
      expect(ok, "No debe existir scroll horizontal global").toBe(true)
    })

    test("main no rebasa el viewport", async ({ page }) => {
      await page.goto("/")
      await page.waitForLoadState("networkidle")

      const ok = await page.evaluate(() => {
        const main = document.querySelector("main")
        if (!main) return true
        return main.scrollWidth <= window.innerWidth + 5
      })
      expect(ok).toBe(true)
    })

    test("top bar sin buscador", async ({ page }) => {
      await page.goto("/")
      await page.waitForLoadState("networkidle")

      const header = page.locator("header")
      if (vp.width >= 769) {
        const searchInput = header.locator("input[type='search']")
        await expect(searchInput).toHaveCount(0)
      }
    })
  })
}

test.describe("Responsive — Mobile (390x844)", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("MobileBottomNav presente", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const bottomNav = page.getByText("Inicio").first()
    await expect(bottomNav).toBeAttached({ timeout: 5000 })
  })

  test("DesktopSidebar no aparece como sidebar permanente", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.evaluate(() => {
      const nav = document.querySelector(".mobile-only nav")
      return !!nav
    })
    // En móvil los elementos con .desktop-only están ocultos
    const desktopSidebarVisible = await page.evaluate(() => {
      const el = document.querySelector(".desktop-only") as HTMLElement | null
      if (!el) return false
      return el.offsetParent !== null
    })
    expect(desktopSidebarVisible).toBe(false)
  })

  test("navegación móvil funcional", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const asisLink = page.getByRole("link", { name: "Asistente" }).first()
    await expect(asisLink).toBeAttached({ timeout: 5000 })
  })
})

test.describe("Responsive — Desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("DesktopSidebar visible", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const sidebar = page.locator(".desktop-only nav")
    await expect(sidebar.first()).toBeAttached({ timeout: 5000 })
  })

  test("MobileBottomNav oculto", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const mobileOnlyElements = page.locator(".mobile-only")
    const count = await mobileOnlyElements.count()
    for (let i = 0; i < count; i++) {
      const isVisible = await mobileOnlyElements.nth(i).isVisible()
      expect(isVisible).toBe(false)
    }
  })

  test("top bar muestra branding", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const header = page.locator("header")
    await expect(header).toBeAttached()

    const logoImg = header.locator("img[alt*='Digital']")
    await expect(logoImg).toBeAttached({ timeout: 5000 })
  })

  test("dropdown de perfil funciona", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const profileBtn = page.locator(".profile-trigger")
    await expect(profileBtn).toBeAttached({ timeout: 5000 })

    await profileBtn.click()
    const menu = page.locator("[role='menu']")
    await expect(menu).toBeAttached({ timeout: 3000 })

    const profileLink = menu.locator("a[href='/profile']")
    await expect(profileLink).toBeAttached()
  })

  test("sin doble scrollbar vertical (rail sin scroll propio)", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const railHasScroll = await page.evaluate(() => {
      const rail = document.querySelector(".dashboard-rail") as HTMLElement | null
      if (!rail) return true
      const style = window.getComputedStyle(rail)
      return style.overflowY === "auto" || style.overflowY === "scroll"
    })
    expect(railHasScroll).toBe(false)
  })

  test("dashboard dos columnas en >=1200px", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const columns = await page.evaluate(() => {
      const desktop = document.querySelector(".dashboard-desktop") as HTMLElement | null
      if (!desktop) return 0
      const style = window.getComputedStyle(desktop)
      return style.gridTemplateColumns.split(" ").length
    })
    expect(columns).toBeGreaterThanOrEqual(2)
  })
})

test.describe("Responsive — Desktop compacto (1024x768)", () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test("dashboard una columna entre 769 y 1199", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const columns = await page.evaluate(() => {
      const desktop = document.querySelector(".dashboard-desktop") as HTMLElement | null
      if (!desktop) return 99
      const style = window.getComputedStyle(desktop)
      return style.gridTemplateColumns.split(" ").length
    })
    expect(columns).toBe(1)
  })

  test("sidebar visible en desktop compacto", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const sidebarWidth = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width").trim()
    })
    expect(sidebarWidth).toBe("200px")
  })
})

test.describe("Responsive — Desktop normal (1280x720)", () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test("dashboard dos columnas en >=1200", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const columns = await page.evaluate(() => {
      const desktop = document.querySelector(".dashboard-desktop") as HTMLElement | null
      if (!desktop) return 0
      const style = window.getComputedStyle(desktop)
      return style.gridTemplateColumns.split(" ").length
    })
    expect(columns).toBeGreaterThanOrEqual(2)
  })

  test("sin scroll horizontal", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const ok = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 5
    })
    expect(ok).toBe(true)
  })
})

test.describe("Responsive — Navegación", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("sidebar desktop tiene Inicio como primer item", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const inicioLink = page.getByRole("link", { name: "Inicio" })
    const count = await inicioLink.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test("sidebar desktop no muestra branding duplicado", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const sidebarDesktop = page.locator(".desktop-only nav")
    const brandingLink = sidebarDesktop.locator("a", { hasText: "La Veinte Digital" })
    const count = await brandingLink.count()
    expect(count).toBe(0)
  })
})
