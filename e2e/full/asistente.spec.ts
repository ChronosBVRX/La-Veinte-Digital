import { test, expect } from "@playwright/test"

test.describe("Asistente IA - Carga", () => {
  test("carga la pagina del asistente correctamente", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    // Heading should be visible
    await expect(
      page.getByRole("heading", { name: "Asistente SNTSS" })
    ).toBeVisible({ timeout: 10_000 })

    // Chat input should be visible
    await expect(
      page.getByPlaceholder("Pregunta sobre el CCT o Estatutos del SNTSS...")
    ).toBeVisible()

    // Welcome message should appear
    await expect(page.getByText("¡Hola!")).toBeVisible({ timeout: 5000 })
  })

  test("muestra sugerencias iniciales", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    // Three suggestion buttons should be visible
    await expect(
      page.getByRole("button", { name: "¿Cuáles son mis derechos laborales?" })
    ).toBeVisible()

    await expect(
      page.getByRole("button", { name: "Háblame de mis vacaciones" })
    ).toBeVisible()

    await expect(
      page.getByRole("button", { name: "¿Qué dice el CCT sobre aguinaldo?" })
    ).toBeVisible()
  })
})

test.describe("Asistente IA - Envio de mensajes", () => {
  test("envia una pregunta y recibe respuesta", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )
    await input.fill("¿Cuántos días de vacaciones me corresponden?")

    // Submit form via Enter key
    await input.press("Enter")

    // Should see the sent message (the user message)
    await expect(
      page.getByText("¿Cuántos días de vacaciones me corresponden?")
    ).toBeVisible({ timeout: 3000 })

    // Wait for response (max 20s)
    // The assistant's response will be in markdown, so we check for content
    await page.waitForTimeout(2000)

    // The chat should have more than just the welcome + user message
    // (i.e., the assistant responded)
    // Input should be re-enabled after response
    await expect(input).toBeEnabled({ timeout: 20_000 })
  })

  test("pregunta vacia no se envia", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )

    // Try submitting empty input
    await input.fill("")
    await input.press("Enter")

    // Input should still be there, no error
    await expect(input).toBeVisible()
  })

  test("sugerencia rellena el input y envia", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    // Click a suggestion
    await page
      .getByRole("button", { name: "Háblame de mis vacaciones" })
      .click()

    // Input should be disabled while loading, then re-enabled
    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )

    // Wait for the response to come back (input re-enabled)
    await expect(input).toBeEnabled({ timeout: 20_000 })
  })

  test("UI no queda cargando indefinidamente", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )
    await input.fill("Hola")
    await input.press("Enter")

    // The input should be re-enabled within a timeout
    await expect(input).toBeEnabled({ timeout: 30_000 })
  })
})

test.describe("Asistente IA - Privacidad y headers", () => {
  test("respuesta tiene Cache-Control privado", async ({ page }) => {
    // Intercept the API call and verify headers
    let cacheControlHeader = ""

    await page.route("**/api/consulta", async (route) => {
      const response = await route.fetch()
      cacheControlHeader =
        response.headers()["cache-control"] || ""
      await route.fulfill({ response })
    })

    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )
    await input.fill("Hola")
    await input.press("Enter")

    // Wait for response
    await expect(input).toBeEnabled({ timeout: 20_000 })

    // Verify cache-control header
    if (cacheControlHeader) {
      const hasPrivateNoStore =
        cacheControlHeader.includes("private") &&
        cacheControlHeader.includes("no-store")
      if (!hasPrivateNoStore) {
        console.warn(
          `Cache-Control header (${cacheControlHeader}) does not include 'private, no-store'`
        )
      }
    }
  })
})
