import { test, expect } from "@playwright/test";
import path from "node:path";
import ExcelJS from "exceljs";

const ADMIN_AUTH = path.join(__dirname, ".auth", "union-admin.json");
const REGULAR_AUTH = path.join(__dirname, ".auth", "regular-user.json");

// Helper to generate a 100% synthetic test workbook in memory
async function createSyntheticWorkerExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Hoja1");

  // Canonical SIAP headers
  worksheet.addRow([
    "TC", "Matricula", "Nombre", "Plaza", "AR", "Fech Ocu", "Lim Ocu", "MO",
    "Tipo de Plaza", "Turno", "C A", "Puesto", "Descripcion 1", "Departamento",
    "Descripcion 2", "Horario", "Descripcion 3", "Antigüedad", "RFC", "CURP.",
    "Número de Seguridad Social", "Fecha Ingreso", "Fec. Reingreso", "Status",
    "Cve Baja", "Fecha de Baja", "Micro y grupo"
  ]);

  // Synthetic test workers (100% fictitious data for testing)
  worksheet.addRow([
    "2", "99000001", "PRUEBA SINTETICA JUAN CARLOS", "96001", "001", "2020-01-01", "2050-01-01", "0",
    "11", "0", "1000", "41500301", "AUXILIAR DE ENFERMERIA GENERAL", "2114010001",
    "HOSPITAL GENERAL REGIONAL NO 1", "0102", "08:00 A 16:00 HRS.", "05 Años 00 Quincenas 00 Dias",
    "XAXX010101000", "XAXX010101HDFRXX00", "01234567890", "2020-01-01", "", "1", "", "", "0"
  ]);

  worksheet.addRow([
    "2", "99000002", "EJEMPLO TEST MARIA ELENA", "96002", "001", "2018-05-16", "2050-01-01", "0",
    "11", "1", "100", "41500401", "ENFERMERA GENERAL", "2114010001",
    "HOSPITAL GENERAL REGIONAL NO 1", "0202", "14:00 A 21:30 HRS.", "07 Años 08 Quincenas 12 Dias",
    "XAXX020202000", "XAXX020202MDFRXX00", "01234567891", "2018-05-16", "", "1", "", "", "0"
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

test.describe("Importación de trabajadores SIAP — Seguridad y Autorización", () => {
  test.use({ storageState: REGULAR_AUTH });

  test("usuario sin rol union_admin es redirigido a acceso denegado", async ({ page }) => {
    await page.goto("/representacion/administracion/importar-trabajadores");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("No tienes autorización para acceder a Representación Sindical.")).toBeVisible();
  });
});

test.describe("Importación de trabajadores SIAP — Flujo Completo union_admin", () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("pantalla de administración muestra acceso a importar trabajadores", async ({ page }) => {
    await page.goto("/representacion/administracion");
    await expect(page.getByText("Plantilla de Personal IMSS (SIAP)")).toBeVisible({ timeout: 10_000 });
    const importLink = page.getByRole("link", { name: /Importar plantilla Excel/i });
    await expect(importLink).toBeVisible();
    await importLink.click();
    await expect(page).toHaveURL(/\/representacion\/administracion\/importar-trabajadores/);
  });

  test("flujo de dos fases: carga de archivo -> previsualización -> confirmación", async ({ page }) => {
    await page.goto("/representacion/administracion/importar-trabajadores");

    // Verificar título y aislamiento
    await expect(page.getByRole("heading", { name: "Importar Plantilla de Personal IMSS", exact: true })).toBeVisible({ timeout: 10_000 });
    expect(await page.locator(".mobile-bottom-nav").count()).toBe(0);
    expect(await page.locator("#global-audio-player").count()).toBe(0);

    // Generar archivo sintético en memoria
    const excelBuffer = await createSyntheticWorkerExcel();

    // Subir archivo al input de archivo
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Arrastra tu archivo de plantilla Excel aquí o haz clic para examinar").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "plantilla_sintetica_test.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: excelBuffer,
    });

    // Verificar que aparece el nombre del archivo y el botón de previsualizar
    await expect(page.getByText("plantilla_sintetica_test.xlsx")).toBeVisible();
    const previewButton = page.getByRole("button", { name: "Analizar y previsualizar cambios" });
    await expect(previewButton).toBeVisible();
    await previewButton.click();

    // Esperar a que cargue el dashboard de previsualización
    await expect(page.getByText("Resumen previo a la importación")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Total leídos")).toBeVisible();
    await expect(page.getByText("Nuevos registros")).toBeVisible();

    // Verificar que la tabla de diferencias enmascara la PII
    await expect(page.getByText("99000001")).toBeVisible();
    await expect(page.getByText("99000002")).toBeVisible();
    await expect(page.getByText("PRUEBA SINTETICA JUAN CARLOS")).toBeVisible();
    // RFC debe estar enmascarado
    await expect(page.getByText("XAXX****000").first()).toBeVisible();

    // Abrir modal de confirmación
    const confirmButton = page.getByRole("button", { name: "Confirmar importación al padrón" });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Modal de confirmación
    await expect(page.getByText("Confirmar importación de trabajadores")).toBeVisible();
    await expect(page.getByText("Nuevos trabajadores a registrar:")).toBeVisible();

    const applyButton = page.getByRole("button", { name: /Confirmar y aplicar/i });
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    // Mensaje de éxito
    await expect(page.getByText("¡Importación confirmada con éxito!")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Se aplicaron correctamente los cambios al padrón sindical oficial.")).toBeVisible();

    // Verificar pestaña de historial
    await page.getByRole("button", { name: "Historial de importaciones" }).click();
    await expect(page.getByText("Historial de lotes importados")).toBeVisible();
    await expect(page.getByText("plantilla_sintetica_test.xlsx")).toBeVisible();
    await expect(page.getByText("Confirmado").first()).toBeVisible();
  });
});
