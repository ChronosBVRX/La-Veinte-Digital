import { test, expect } from "../fixtures/test"

test.describe("Calculadoras - Indice", () => {
  test("carga la pagina de calculadoras", async ({ page }) => {
    await page.goto("/calculadoras")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByRole("heading", { name: "Calculadoras Laborales" })
    ).toBeVisible({ timeout: 10_000 })

    await expect(page.getByRole("link", { name: "Aguinaldo" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Tiempo Extra" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Segunda de Julio" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Segunda de Julio Proporcional" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Clausula 97" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Prestamos por Categoria" })).toBeVisible()
  })
})

test.describe("Calculadoras - Aguinaldo", () => {
  test("carga la calculadora de aguinaldo", async ({ page }) => {
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")

    await expect(page.getByRole("heading", { name: "Aguinaldo" })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel("Concepto 002")).toBeVisible()
    await expect(page.getByLabel("Concepto 011")).toBeVisible()
    await expect(page.getByRole("button", { name: "Calcular" })).toBeVisible()
  })

  test("calcula aguinaldo con valores validos", async ({ page }) => {
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Concepto 002").fill("5000")
    await page.getByLabel("Concepto 011").fill("1500")
    await page.getByRole("button", { name: "Calcular" }).click()

    await expect(page.getByText("Aguinaldo total estimado")).toBeVisible({ timeout: 5000 })
  })

  test("rechaza valores de caracteres no numericos", async ({ page }) => {
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Concepto 002").fill("abc")
    await page.getByRole("button", { name: "Calcular" }).click()

    const errorText = page.getByText(/importe inválido|ingrese un importe/i)
    await expect(errorText.first()).toBeVisible({ timeout: 3000 })
  })

  test("calcula con valor cero correctamente", async ({ page }) => {
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Concepto 002").fill("5000")
    await page.getByLabel("Concepto 011").fill("0")
    await page.getByRole("button", { name: "Calcular" }).click()

    await expect(page.getByText("Aguinaldo total estimado")).toBeVisible({ timeout: 5000 })
  })

  test("boton limpiar resetea campos", async ({ page }) => {
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Concepto 002").fill("5000")
    await page.getByLabel("Concepto 011").fill("1500")
    await page.getByRole("button", { name: "Limpiar" }).click()

    await expect(page.getByLabel("Concepto 002")).toHaveValue("")
    await expect(page.getByLabel("Concepto 011")).toHaveValue("")
  })
})

test.describe("Calculadoras - Tiempo Extra", () => {
  test("carga la calculadora de tiempo extra", async ({ page }) => {
    await page.goto("/calculadoras/tiempo-extra")
    await page.waitForLoadState("networkidle")

    await expect(page.getByRole("heading", { name: "Tiempo Extra" })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel("Jornada")).toBeVisible()
    await expect(page.getByLabel("Horas extra")).toBeVisible()
    await expect(page.getByRole("button", { name: "Calcular" })).toBeVisible()
  })

  test("calcula tiempo extra con valores minimos", async ({ page }) => {
    await page.goto("/calculadoras/tiempo-extra")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Concepto 002").fill("3000")
    await page.getByLabel("Concepto 011").fill("800")
    await page.getByLabel("Concepto 020").fill("0")
    await page.getByLabel("Concepto 050").fill("0")
    await page.locator("#jornada").selectOption("8")
    await page.locator("#horasExtra").fill("5")
    await page.getByRole("button", { name: "Calcular" }).click()

    await expect(page.getByText("Pago estimado", { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test("validacion de horas extra requeridas", async ({ page }) => {
    await page.goto("/calculadoras/tiempo-extra")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Concepto 002").fill("3000")
    await page.locator("#jornada").selectOption("8")
    await page.getByRole("button", { name: "Calcular" }).click()

    const errorText = page.getByText(/ingrese las horas|horas extra/i)
    await expect(errorText.first()).toBeVisible({ timeout: 3000 })
  })

  test("recarga no altera otras calculadoras", async ({ page }) => {
    await page.goto("/calculadoras/tiempo-extra")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Concepto 002").fill("3000")
    await page.getByRole("button", { name: "Calcular" }).click()
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")

    await expect(page.getByRole("heading", { name: "Aguinaldo" })).toBeVisible()
  })
})

test.describe("Calculadoras - Segunda de Julio", () => {
  test("carga la calculadora de segunda de julio", async ({ page }) => {
    await page.goto("/calculadoras/segunda-julio")
    await page.waitForLoadState("networkidle")

    await expect(page.getByRole("heading", { name: "Segunda de Julio" })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("button", { name: "Calcular" })).toBeVisible()
  })
})

test.describe("Calculadoras - Clausula 97", () => {
  test("carga la calculadora de clausula 97", async ({ page }) => {
    await page.goto("/calculadoras/clausula-97")
    await page.waitForLoadState("networkidle")

    await expect(page.getByRole("heading", { name: "Clausula 97" })).toBeVisible({ timeout: 10_000 })
  })
})
