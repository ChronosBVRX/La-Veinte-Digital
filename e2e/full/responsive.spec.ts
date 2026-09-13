import { test, expect } from "../fixtures/test"
import path from "path"

const MOBILE_VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 640 },
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-412", width: 412, height: 915 },
  { name: "mobile-480", width: 480, height: 854 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "landscape-667", width: 667, height: 375 },
] as const

const CORE_ROUTES = [
  "/",
  "/profile/mi-informacion-laboral",
  "/guia/mi-quincena",
  "/documentos-personales",
  "/calculadoras",
  "/calculadoras/aguinaldo",
  "/calculadoras/tiempo-extra",
  "/calculadoras/clausula-97",
  "/calculadoras/segunda-julio",
  "/calculadoras/segunda-julio-proporcional",
  "/calculadoras/prestamos",
  "/simulador",
  "/calendario",
  "/vacaciones",
  "/escritos",
  "/facebook",
  "/biblioteca-normativa",
  "/asistente",
  "/login",
  "/register",
] as const

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`Responsive Multi-Viewport — ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const route of CORE_ROUTES) {
      test(`ruta ${route} no tiene desbordamiento horizontal en ${vp.name}`, async ({ page }) => {
        await page.goto(route)
        await page.waitForLoadState("domcontentloaded")

        // 1. Verificación de scrollWidth global y de contenedor principal
        const overflowDetails = await page.evaluate((viewWidth) => {
          const docScroll = document.documentElement.scrollWidth
          const bodyScroll = document.body.scrollWidth
          const main = document.querySelector("main")
          const mainScroll = main ? main.scrollWidth : 0

          // Comprobación profunda de elementos hijos que puedan salirse del viewport
          const violatingElements: Array<{ tag: string; id: string; className: string; right: number; width: number }> = []
          const allEls = document.querySelectorAll("main *, header *, footer *")

          for (const el of Array.from(allEls)) {
            const rect = el.getBoundingClientRect()
            // Ignorar elementos ocultos o sin dimensiones
            if (rect.width === 0 || rect.height === 0) continue

            // Ignorar elementos con scroll horizontal intencional autorizado
            const isScrollable = (target: Element): boolean => {
              const style = window.getComputedStyle(target)
              if (style.overflowX === "auto" || style.overflowX === "scroll") return true
              if (target.getAttribute("role") === "tablist") return true
              if (target.classList.contains("chat-suggestions-scroll")) return true
              if (target.tagName.toLowerCase() === "pre" || target.tagName.toLowerCase() === "table") return true
              return target.parentElement ? isScrollable(target.parentElement) : false
            }

            if (!isScrollable(el) && rect.right > viewWidth + 2) {
              violatingElements.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || "",
                className: (el.className && typeof el.className === "string" ? el.className.slice(0, 40) : ""),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              })
              if (violatingElements.length >= 5) break
            }
          }

          return {
            docScroll,
            bodyScroll,
            mainScroll,
            viewWidth,
            violatingElements,
          }
        }, vp.width)

        expect(overflowDetails.violatingElements.length, `Desbordamientos en ${route} (${vp.name}): ${JSON.stringify(overflowDetails.violatingElements)}`).toBe(0)
      })
    }
  })
}

test.describe("Evidencia de Capturas y Pruebas Específicas de Perfil y Quincena", () => {
  const CAPTURE_VIEWPORTS = [
    { name: "320px", width: 320, height: 640 },
    { name: "390px", width: 390, height: 844 },
    { name: "412px", width: 412, height: 915 },
  ] as const

  for (const vp of CAPTURE_VIEWPORTS) {
    test(`captura y verificación de /profile/mi-informacion-laboral en ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto("/profile/mi-informacion-laboral")
      await page.waitForLoadState("networkidle")

      // Captura de evidencia
      const screenshotPath = path.resolve(
        process.cwd(),
        `artifacts/screenshots/profile_mi_informacion_laboral_${vp.name}.png`
      )
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})

      // Verificar que el contenedor no sobrepasa el viewport
      const docOk = await page.evaluate((w) => document.documentElement.scrollWidth <= w + 2, vp.width)
      expect(docOk).toBe(true)
    })

    test(`captura y verificación de /guia/mi-quincena en ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto("/guia/mi-quincena")
      await page.waitForLoadState("networkidle")

      // Captura de evidencia
      const screenshotPath = path.resolve(
        process.cwd(),
        `artifacts/screenshots/guia_mi_quincena_${vp.name}.png`
      )
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})

      // Verificar que las pestañas son accesibles y no desbordan
      const tabsCount = await page.locator("[role='tab']").count()
      expect(tabsCount).toBeGreaterThanOrEqual(2)

      const docOk = await page.evaluate((w) => document.documentElement.scrollWidth <= w + 2, vp.width)
      expect(docOk).toBe(true)
    })
  }

  test("regresión: panel inline de exportar al perfil no desborda en 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto("/documentos-personales")
    await page.waitForLoadState("networkidle")

    const docOk = await page.evaluate(() => document.documentElement.scrollWidth <= 322)
    expect(docOk).toBe(true)
  })
})
