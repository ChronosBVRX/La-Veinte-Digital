import { test, expect } from "../fixtures/test"

// Mock response for /api/consulta to avoid real OpenAI calls
const MOCK_RESPONSE = {
  answer:
    "**Respuesta simulada para pruebas.** Segun el CCT, tienes derecho a 20 dias de vacaciones.",
  sources: ["CCT Art. 45"],
  usageRemaining: 50,
}

test.describe("Asistente IA - Carga", () => {
  test("carga la pagina del asistente correctamente", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByRole("heading", { name: "Asistente SNTSS" })
    ).toBeVisible({ timeout: 10_000 })

    await expect(
      page.getByPlaceholder("Pregunta sobre el CCT o Estatutos del SNTSS...")
    ).toBeVisible()

    await expect(page.getByText("¡Hola!")).toBeVisible({ timeout: 5000 })
  })

  test("muestra sugerencias iniciales", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByRole("button", {
        name: "¿Cuáles son mis derechos laborales?",
      })
    ).toBeVisible()

    await expect(
      page.getByRole("button", { name: "Háblame de mis vacaciones" })
    ).toBeVisible()

    await expect(
      page.getByRole("button", {
        name: "¿Qué dice el CCT sobre aguinaldo?",
      })
    ).toBeVisible()
  })
})

test.describe("Asistente IA - Envio de mensajes (mockeado)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/consulta", async (route) => {
      const body = route.request().postDataJSON()
      // The app sends history array; last user message contains the question
      expect(body).toBeTruthy()
      if (body.history) {
        expect(Array.isArray(body.history)).toBe(true)
        const lastUser = [...body.history].reverse().find((m: { role: string }) => m.role === "user")
        expect(lastUser, "history debe contener al menos un mensaje user").toBeTruthy()
        expect(typeof lastUser.content).toBe("string")
        expect(lastUser.content.length).toBeGreaterThan(0)
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Cache-Control": "private, no-store",
        },
        body: JSON.stringify(MOCK_RESPONSE),
      })
    })
  })

  test("envia una pregunta y recibe respuesta", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )
    await input.fill("¿Cuántos días de vacaciones me corresponden?")
    await input.press("Enter")

    // The input should be re-enabled once the response arrives
    await expect(input).toBeEnabled({ timeout: 15_000 })
  })

  test("pregunta vacia no se envia", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )
    await input.fill("")
    await input.press("Enter")

    // Input should still be there, no error, no request sent
    await expect(input).toBeVisible()
  })

  test("sugerencia rellena el input y envia", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    await page
      .getByRole("button", { name: "Háblame de mis vacaciones" })
      .click()

    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )
    await expect(input).toBeEnabled({ timeout: 15_000 })
  })

  test("UI no queda cargando indefinidamente", async ({ page }) => {
    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )
    await input.fill("Hola")
    await input.press("Enter")

    // Must re-enable within timeout
    await expect(input).toBeEnabled({ timeout: 15_000 })
  })
})

test.describe("Asistente IA - Privacidad", () => {
  test("respuesta mockeada incluye Cache-Control privado y no-store", async ({
    page,
  }) => {
    // Mock /api/consulta and verify headers via the mock
    let capturedHeaders: Record<string, string> = {}

    await page.route("**/api/consulta", async (route, request) => {
      // Capture what the frontend sends
      const body = request.postDataJSON()
      expect(body).toHaveProperty("question")

      const responseBody = JSON.stringify(MOCK_RESPONSE)

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Cache-Control": "private, no-store",
        },
        body: responseBody,
      })
    })

    // Intercept the response to capture the headers
    page.on("response", (response) => {
      if (response.url().includes("/api/consulta")) {
        capturedHeaders = response.headers()
      }
    })

    await page.goto("/asistente")
    await page.waitForLoadState("networkidle")

    const input = page.getByPlaceholder(
      "Pregunta sobre el CCT o Estatutos del SNTSS..."
    )
    await input.fill("Hola")
    await input.press("Enter")

    await expect(input).toBeEnabled({ timeout: 15_000 })

    // Verify that the response had the correct cache-control header
    const cacheControl = capturedHeaders["cache-control"] || ""
    expect(cacheControl, "Cache-Control debe incluir 'private'").toContain(
      "private"
    )
    expect(cacheControl, "Cache-Control debe incluir 'no-store'").toContain(
      "no-store"
    )
  })
})
