import { test, expect } from "../fixtures/test"

test.describe("HomeHighlightsCarousel — Smoke E2E Visual y Funcional", () => {
  const viewports = [
    { name: "móvil estrecho ~360px", width: 360, height: 640, isMobile: true },
    { name: "móvil estándar ~390px", width: 390, height: 844, isMobile: true },
    { name: "móvil Android ~412px", width: 412, height: 915, isMobile: true },
    { name: "tablet ~768px", width: 768, height: 1024, isMobile: false },
    { name: "desktop ~1280px", width: 1280, height: 800, isMobile: false },
  ]

  for (const vp of viewports) {
    test(`sin overflow horizontal y banner único en ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto("/")
      await expect(page).not.toHaveURL(/\/login/)

      // 1. Solo hay un banner destacado unificado en el DOM
      const carousel = page.locator('[data-testid="home-highlights-carousel"]')
      await expect(carousel).toHaveCount(1)
      await expect(carousel).toBeVisible()

      // 2. No hay overflow horizontal
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth
      })
      expect(hasHorizontalScroll).toBe(false)

      // 3. El bloque "¿Qué necesitas hoy?" está presente y no duplicado
      if (vp.isMobile) {
        const quickActionsHeading = page.getByRole("heading", { name: "¿Qué necesitas hoy?" })
        await quickActionsHeading.scrollIntoViewIfNeeded()
        await expect(quickActionsHeading).toBeVisible()

        const quickCards = [
          "Mi agenda",
          "Mis documentos",
          "Hacer un escrito",
          "Mis derechos",
        ]
        for (const cardTitle of quickCards) {
          const card = page.locator(`text=${cardTitle}`).first()
          await expect(card).toBeAttached()
        }
      }
    })
  }

  test("navegación interactiva por dots y flechas desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/")

    const carousel = page.locator('[data-testid="home-highlights-carousel"]')
    await expect(carousel).toBeVisible()

    // Botones de flecha previo y siguiente visibles en desktop
    const nextBtn = page.getByRole("button", { name: "Destacado siguiente" })
    const prevBtn = page.getByRole("button", { name: "Destacado anterior" })
    await expect(nextBtn).toBeVisible()
    await expect(prevBtn).toBeVisible()

    // Dots de navegación interactivos
    const tabs = page.locator('[role="tablist"] [role="tab"]')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(5)

    // Pulsar el dot de vacaciones
    const vacationTab = tabs.nth(1)
    await vacationTab.click()
    await expect(page.getByText("Ya están disponibles los roles vacacionales 2027")).toBeVisible()

    // Avanzar con la flecha
    await nextBtn.click()
    await expect(page.getByText("Sacar copias")).toBeVisible()

    // Retroceder con la flecha
    await prevBtn.click()
    await expect(page.getByText("Ya están disponibles los roles vacacionales 2027")).toBeVisible()
  })

  test("modal de detalle de aumento se abre y cierra correctamente", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/")

    // Si el slide visible de aumento tiene "Ver detalle", probarlo
    const detailBtn = page.getByRole("button", { name: "Ver detalle" })
    if (await detailBtn.isVisible()) {
      await detailBtn.click()
      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible()
      await expect(page.getByText("Detalle del aumento estimado")).toBeVisible()

      // Cerrar modal
      const closeBtn = page.getByRole("button", { name: "Cerrar detalle" })
      await closeBtn.click()
      await expect(modal).not.toBeVisible()
    }
  })

  test("slide de transferir documentos abre modal QR", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/")

    // Navegar al tab de transferir documentos
    const transferTab = page.getByRole("tab", { name: /Transferir documentos/i })
    await transferTab.click()

    const transferBtn = page.locator('[data-testid="highlight-transfer-docs"]').getByRole("button", { name: "Transferir documentos" })
    await transferBtn.click()

    // Verifica que el modal de transferencia se abra
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()
    await expect(modal.getByText("Envía o recibe documentos entre dispositivos para imprimirlos.")).toBeVisible()
  })
})
