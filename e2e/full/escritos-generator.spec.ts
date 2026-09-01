import { test, expect } from "../fixtures/test"

test.describe("Generador de Escritos V2 (Flujo Completo)", () => {
  test("flujo completo de redacción, edición, guardado, firma y exportación", async ({
    page,
  }) => {
    // 1. Simular la respuesta del endpoint de generación para determinismo en CI
    await page.route("**/api/escritos/generar", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cuerpo:
            "Por medio de la presente, me dirijo a usted con el debido respeto para exponer los hechos relativos a mi solicitud de pase de salida.\n\n" +
            "Con fecha 15 de agosto de 2026 presenté mi petición formal ante la jefatura correspondiente, sin haber recibido respuesta a la fecha.\n\n" +
            "Por lo expuesto, solicito atentamente la autorización de 3 días de pase de salida con goce de sueldo.",
          fuentes: [
            {
              documento: "Contrato Colectivo de Trabajo 2025-2027",
              version: "2025-2027",
              numero: "Cláusula 142",
              fragmento: "Los trabajadores tendrán derecho a permisos económicos y pases de salida.",
            },
          ],
          advertencias: [],
          generationMode: "ai_with_sources",
        }),
      })
    })

    // 2. Navegar a /escritos
    await page.goto("/escritos")
    await expect(page.getByRole("heading", { name: "Generador de Escritos" })).toBeVisible()

    // 3. Llenar formulario (1. Formulario)
    // Tipo: Solicitud
    await page.getByRole("button", { name: /Solicitud/i }).click()

    // Destinatario
    const destSelect = page.getByLabel(/¿A quién va dirigido el escrito\?/i)
    await destSelect.selectOption("Jefe de Personal / Recursos Humanos")

    // Lugar y Fecha
    await page.getByLabel(/¿Dónde te encuentras\?/i).fill("Morelia, Mich.")
    await page.getByLabel(/¿En qué fecha se emite\?/i).fill("2026-08-31")

    // Hechos y Petición
    await page.getByLabel(/¿Qué ocurrió o cuáles son los antecedentes\?/i).fill("El pasado 15 de agosto solicité pase de salida formal.")
    await page.getByLabel(/¿Qué solicitas o qué necesitas que resuelvan\?/i).fill("Solicito autorización de 3 días de pase de salida.")

    // 4. Generar borrador
    await page.getByRole("button", { name: /Redactar borrador con IA/i }).click()

    // 5. Etapa 2: Editor interactivo
    await expect(page.getByRole("heading", { name: /Revisa y personaliza tu escrito/i })).toBeVisible()
    const textarea = page.locator("textarea")
    await expect(textarea).toBeVisible()
    await expect(textarea).toContainText("Por medio de la presente")

    // Modificar manualmente
    await textarea.fill(
      "Por medio de la presente, me dirijo a usted respetuosamente.\n\nPárrafo añadido manualmente por el trabajador."
    )

    // Deshacer (Undo)
    await page.getByRole("button", { name: "↶ Deshacer" }).click()
    await expect(textarea).toContainText("Por medio de la presente")

    // Rehacer (Redo)
    await page.getByRole("button", { name: "↷ Rehacer" }).click()
    await expect(textarea).toContainText("Párrafo añadido manualmente por el trabajador.")

    // 6. Guardar borrador
    await page.getByRole("button", { name: "💾 Guardar borrador" }).click()
    await expect(page.getByText(/Borrador guardado correctamente/i)).toBeVisible()

    // 7. Avanzar a Vista y Firma
    await page.getByRole("button", { name: /Ver vista previa y firmar/i }).click()
    await expect(page.getByText("A T E N T A M E N T E")).toBeVisible()

    // 8. Firmar
    await page.getByRole("button", { name: /✍️ Añadir firma digital/i }).click()
    await expect(page.getByRole("heading", { name: /Firma Digitalizada/i })).toBeVisible()

    // Simular trazo en el canvas
    const canvas = page.locator("canvas")
    const box = await canvas.boundingBox()
    if (box) {
      await page.mouse.move(box.x + 20, box.y + 20)
      await page.mouse.down()
      await page.mouse.move(box.x + 80, box.y + 60)
      await page.mouse.up()
    }
    await page.getByRole("button", { name: "Guardar firma" }).click()

    // Comprobar que la firma se integró
    await expect(page.getByRole("button", { name: /Cambiar firma/i })).toBeVisible()

    // 9. Descargar PDF
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "📥 Descargar PDF" }).click(),
    ])

    expect(download.suggestedFilename()).toContain(".pdf")

    // 10. Reabrir desde Documentos Personales
    await page.goto("/documentos-personales")
    await expect(page.getByRole("heading", { name: "Documentos Personales" })).toBeVisible()
    await expect(page.getByRole("link", { name: /Editar escrito/i })).toBeVisible()
  })
})
