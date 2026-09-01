import { test, expect } from "../fixtures/test"

test.describe("Generador de Escritos V2 (Recorridos IA y Manual)", () => {
  test("Recorrido IA: redacción asistida con IA, desarrollo formal, visor compacto, propuestas y descarga", async ({
    page,
  }) => {
    let lastRevisionRequest: Record<string, unknown> | null = null

    // 1. Simular la respuesta del endpoint de generación y revisión para determinismo en CI
    await page.route("**/api/escritos/generar", async (route) => {
      const postData = route.request().postDataJSON()
      if (postData?.mode === "revise") {
        lastRevisionRequest = postData
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            cuerpo: `${postData.cuerpoActual}\n\n[Texto ajustado formalmente conforme a la normativa vigente]`,
            fuentes: [],
            advertencias: [],
            generationMode: "ai_without_sources",
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cuerpo:
            "Por medio de la presente, me dirijo a usted con el debido respeto para exponer los antecedentes relativos a mi solicitud de pase de salida.\n\n" +
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
    await page.getByRole("button", { name: /Solicitud/i }).click()

    // Seleccionar destinatario oficial desde el directorio
    const destSelect = page.getByLabel(/¿A quién va dirigido el escrito\?/i)
    await destSelect.selectOption({ label: "Dr. Simbad Solorio Vargas — Secretario General" })

    // Comprobar visor compacto
    await expect(page.getByText("Dr. Simbad Solorio Vargas").first()).toBeVisible()

    // Lugar y Fecha
    await page.getByLabel(/¿Dónde te encuentras\?/i).fill("Morelia, Mich.")
    await page.getByLabel(/¿En qué fecha se emite\?/i).fill("2026-09-01")

    // Hechos con redacción informal y Petición
    await page.getByLabel(/Cuéntanos con tus palabras qué pasó/i).fill("mi jefe no me kiere dar mis vacaciones y no responde")
    await page.getByLabel(/¿Qué necesitas que te respondan o resuelvan\?/i).fill("que me den mis 3 dias de pase de salida")

    // Adjuntar imagen válida (1x1 PNG transparente)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: "evidencia_asistencia.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      ),
    })
    await expect(page.getByText("evidencia_asistencia")).toBeVisible()

    // 4. Generar borrador con IA
    await page.getByRole("button", { name: /Ayúdame a redactarlo con IA/i }).click()

    // 5. Etapa 2: Editor interactivo
    await expect(page.getByRole("heading", { name: /Revisa y personaliza tu escrito/i })).toBeVisible()
    await expect(page.getByText(/Redactado con IA y fuentes verificadas/i)).toBeVisible()
    await expect(page.getByText("Dr. Simbad Solorio Vargas").first()).toBeVisible()

    const textarea = page.locator("textarea")
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveValue(/Por medio de la presente/)

    // Modificar manualmente
    await textarea.fill(
      "Por medio de la presente, me dirijo a usted respetuosamente.\n\nPárrafo añadido manualmente por el trabajador."
    )
    await expect(textarea).toHaveValue(/Párrafo añadido manualmente/)

    // Deshacer (Undo) con ↩ Deshacer
    await page.getByRole("button", { name: "↩ Deshacer" }).click()
    await expect(textarea).toHaveValue(/Por medio de la presente/)

    // Rehacer (Redo) con ↪ Rehacer
    await page.getByRole("button", { name: "↪ Rehacer" }).click()
    await expect(textarea).toHaveValue(/Párrafo añadido manualmente/)

    // Probar herramienta de IA con propuesta no destructiva (Descartar y Aceptar)
    await page.getByRole("button", { name: "👔 Tono más formal" }).click()
    await expect(page.getByRole("heading", { name: "Hacer más formal" })).toBeVisible()
    expect(lastRevisionRequest).not.toBeNull()
    const revReq = lastRevisionRequest as { mode?: string; cuerpoActual?: string } | null
    expect(revReq?.mode).toBe("revise")
    expect(revReq?.cuerpoActual).toContain("Párrafo añadido manualmente")

    // Descartar propuesta
    await page.getByRole("button", { name: "Descartar cambios" }).click()
    await expect(page.getByRole("heading", { name: "Hacer más formal" })).not.toBeVisible()

    // Volver a solicitar y Aceptar propuesta
    await page.getByRole("button", { name: "👔 Tono más formal" }).click()
    await expect(page.getByRole("heading", { name: "Hacer más formal" })).toBeVisible()
    await page.getByRole("button", { name: "Aplicar propuesta" }).click()
    await expect(textarea).toHaveValue(/\[Texto ajustado formalmente conforme a la normativa vigente\]/)

    // 6. Guardar borrador
    await page.getByRole("button", { name: "💾 Guardar borrador" }).click()
    await expect(page.getByText(/Borrador guardado correctamente/i)).toBeVisible()

    // 7. Avanzar a Vista y Firma
    await page.getByRole("button", { name: /Ver vista previa y firmar/i }).click()
    await expect(page.getByText("A T E N T A M E N T E")).toBeVisible()

    // 8. Firmar en canvas y reemplazar firma
    await page.getByRole("button", { name: /firma digital/i }).click()
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
    await expect(page.getByRole("button", { name: /Cambiar firma/i })).toBeVisible()

    // 9. Descargar PDF
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Descargar PDF/i }).first().click(),
    ])

    expect(download.suggestedFilename()).toContain(".pdf")

    // 10. Recargar documento, duplicar y eliminar el original
    await page.goto("/escritos")
    await expect(page.getByRole("heading", { name: "Generador de Escritos" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Duplicar/i })).toBeVisible()

    // Duplicar
    await page.getByRole("button", { name: /Duplicar/i }).first().click()
    await expect(page.getByText(/Copia de/i)).toBeVisible()
  })

  test("Recorrido Manual: redacción manual directa sin llamadas a API, visor compacto y persistencia", async ({
    page,
  }) => {
    let apiCallCount = 0

    // Escuchar llamadas al endpoint para verificar que no se invoca
    await page.route("**/api/escritos/generar", async (route) => {
      apiCallCount++
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cuerpo: "No debería llamarse",
          fuentes: [],
          advertencias: [],
          generationMode: "basic_fallback",
        }),
      })
    })

    await page.goto("/escritos")
    await expect(page.getByRole("heading", { name: "Generador de Escritos" })).toBeVisible()

    // 1. Seleccionar tipo Aclaración
    await page.getByRole("button", { name: /Aclaración/i }).click()

    // 2. Destinatario manual
    const destSelect = page.getByLabel(/¿A quién va dirigido el escrito\?/i)
    await destSelect.selectOption("__MANUAL__")

    await expect(page.getByRole("heading", { name: /Seleccionar Destinatario/i })).toBeVisible()
    await page.getByLabel(/Cargo o puesto del destinatario/i).fill("Director HGZ No. 1")
    await page.getByLabel(/Nombre del destinatario/i).fill("Dr. Roberto Gómez")
    await page.getByRole("button", { name: "Aplicar destinatario" }).click()

    // Comprobar visor compacto
    await expect(page.getByText("Dr. Roberto Gómez")).toBeVisible()
    await expect(page.getByText(/Destinatario manual/i)).toBeVisible()

    // 3. Escribir hechos y petición iniciales
    await page.getByLabel(/Cuéntanos con tus palabras qué pasó/i).fill("Aclaración de pago quincenal concepto 054.")
    await page.getByLabel(/¿Qué necesitas que te respondan o resuelvan\?/i).fill("Solicito reintegro del importe descontado.")

    // 4. Entrar directamente en modo manual
    await page.getByRole("button", { name: /Quiero escribirlo manualmente/i }).click()

    // Verificar que NO se llamó al endpoint de generación
    expect(apiCallCount).toBe(0)

    // 5. Verificar etapa de editor en Modo Manual
    await expect(page.getByRole("heading", { name: /Revisa y personaliza tu escrito/i })).toBeVisible()
    await expect(page.getByText(/Modo manual/i)).toBeVisible()
    await expect(page.getByText("Dr. Roberto Gómez")).toBeVisible()

    const textarea = page.locator("textarea")
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveValue(/Aclaración de pago quincenal/)

    // Redactar contenido libremente
    await textarea.fill(
      "Por medio de este escrito redactado manualmente, solicito la aclaración formal del concepto 054."
    )

    // Guardar borrador manual
    await page.getByRole("button", { name: "💾 Guardar borrador" }).click()
    await expect(page.getByText(/Borrador guardado correctamente/i)).toBeVisible()

    // 6. Vista previa y comprobación de formato
    await page.getByRole("button", { name: /Ver vista previa y firmar/i }).click()
    await expect(page.getByText(/solicito la aclaración formal del concepto 054/i)).toBeVisible()
    await expect(page.getByText("Dr. Roberto Gómez")).toBeVisible()
  })
})
