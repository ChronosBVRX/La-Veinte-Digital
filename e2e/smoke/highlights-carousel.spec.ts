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

    // Pulsar el dot de vacaciones (slide inicial tras retiro del anuncio de aumento)
    const vacationTab = tabs.nth(0)
    await vacationTab.click()
    await expect(page.getByText("Ya están disponibles los roles vacacionales 2027")).toBeVisible()

    // Avanzar con la flecha al siguiente slide (copias)
    await nextBtn.click()
    await expect(page.getByText("Sacar copias")).toBeVisible()

    // Retroceder con la flecha
    await prevBtn.click()
    await expect(page.getByText("Ya están disponibles los roles vacacionales 2027")).toBeVisible()
  })

  test("el anuncio de aumento salarial está retirado del carrusel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/")

    const carousel = page.locator('[data-testid="home-highlights-carousel"]')
    await expect(carousel).toBeVisible()

    // El slide y modal de aumento salarial no están presentes
    const aumentoSlide = page.locator('[data-testid="highlight-salary-increase"]')
    await expect(aumentoSlide).toHaveCount(0)

    const detailBtn = page.getByRole("button", { name: "Ver detalle" })
    await expect(detailBtn).toHaveCount(0)
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
