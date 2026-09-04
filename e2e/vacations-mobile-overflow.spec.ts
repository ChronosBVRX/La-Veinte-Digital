import { test, expect } from "./fixtures/test"

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`Simulador Vacacional Móvil — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test(`cero desbordamiento horizontal en todo el wizard en ${vp.name}`, async ({ page, errors }) => {
      errors.allowConsole(/eval\(\)/, /406/, /vacation_calendars/)
      errors.allowNetwork(/406/, /vacation_calendars/)
      await page.goto("/vacaciones")
      await page.waitForLoadState("domcontentloaded")

      // Función auxiliar para detectar cualquier elemento que desborde el ancho disponible
      const checkZeroOverflow = async (stepName: string) => {
        const overflow = await page.evaluate((viewWidth) => {
          const docScroll = document.documentElement.scrollWidth
          const bodyScroll = document.body.scrollWidth

          // Excluir contenedores deliberados con scroll horizontal (tablist, pre, table)
          const isScrollable = (target: Element): boolean => {
            const style = window.getComputedStyle(target)
            if (style.overflowX === "auto" || style.overflowX === "scroll") return true
            if (target.getAttribute("role") === "tablist") return true
            if (target.tagName.toLowerCase() === "pre" || target.tagName.toLowerCase() === "table") return true
            return target.parentElement ? isScrollable(target.parentElement) : false
          }

          const offenders: Array<{ tag: string; id: string; className: string; right: number; width: number }> = []
          const allEls = document.querySelectorAll("main *, header *, footer *")

          for (const el of Array.from(allEls)) {
            const rect = el.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) continue
            if (!isScrollable(el) && rect.right > viewWidth + 1.5) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || "",
                className: typeof el.className === "string" ? el.className.slice(0, 40) : "",
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              })
              if (offenders.length >= 5) break
            }
          }

          return {
            docScroll,
            bodyScroll,
            viewWidth,
            hasWindowOverflow: docScroll > viewWidth + 1,
            offenders,
          }
        }, vp.width)

        expect(
          overflow.hasWindowOverflow,
          `Desbordamiento de ventana en ${stepName} (${vp.name}): docScroll=${overflow.docScroll}, viewWidth=${overflow.viewWidth}`
        ).toBe(false)

        expect(
          overflow.offenders.length,
          `Elementos desbordados en ${stepName} (${vp.name}): ${JSON.stringify(overflow.offenders)}`
        ).toBe(0)
      }

      // Paso 1: Verificación de pantalla inicial
      await checkZeroOverflow("Paso 1")

      // Si hay botón "Continuar al asesor", avanzamos
      const continueBtn = page.getByRole("button", { name: /Continuar al asesor|Comenzar/i })
      if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await continueBtn.click()
        await page.waitForTimeout(300)
        await checkZeroOverflow("Paso 2")
      }

      // Paso de prioridades / tipo de trabajador si está presente
      const nextBtn = page.getByRole("button", { name: /Siguiente|Continuar/i })
      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(300)
        await checkZeroOverflow("Paso 3")
      }

      // Ir a la programación
      const progBtn = page.getByRole("button", { name: /Continuar a programación|Ir a programación/i })
      if (await progBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await progBtn.click()
        await page.waitForTimeout(300)
      }

      // Verificamos Paso 4 (Programación de periodos) si llegamos a él
      const progHeading = page.getByText(/Programa tu (primer|segundo|tercer) periodo/i)
      if (await progHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
        await checkZeroOverflow("Paso 4 - Programación")

        // Verificar título adaptable clamp
        await expect(progHeading).toBeVisible()

        // Verificar acordeón de marcas no permitidas si existe
        const accordionSummary = page.getByText(/Ver marcas que no puedes utilizar ahora/i)
        if (await accordionSummary.isVisible().catch(() => false)) {
          // Desplegar el acordeón y verificar que no desborde desplegado
          await accordionSummary.click()
          await page.waitForTimeout(200)
          await checkZeroOverflow("Paso 4 - Acordeón desplegado")
        }
      }
    })
  })
}
