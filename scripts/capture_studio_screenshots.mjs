import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const outDir = path.resolve("qa/desktop");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. 1920x1080 Viewport
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  console.log("1. Navigating to Inicio...");
  await page.goto("http://localhost:1420/?screen=inicio", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("textarea", { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, "01-inicio.png") });
  console.log("Saved 01-inicio.png");

  // 2. Click on the episode d5f1fc16 card
  console.log("2. Opening episode from Inicio list...");
  const episodeCard = page.locator("div.group").filter({ hasText: "Bienvenidas y bienvenidos" }).first();
  if (await episodeCard.count() > 0) {
    await episodeCard.click();
  } else {
    await page.goto("http://localhost:1420/?screen=proyecto&projectId=d5f1fc16", { waitUntil: "domcontentloaded" });
  }

  // Wait for project data & structure to load
  await page.waitForSelector(".tab-pill", { timeout: 15000 });
  await page.waitForSelector(".col-structure span:has-text('00:00')", { timeout: 15000 });
  await page.waitForTimeout(1200);

  // Tab Resumen
  console.log("Capturing Resumen...");
  const tabResumen = page.locator("button.tab-pill:has-text('Resumen')");
  await tabResumen.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "02-proyecto-resumen.png") });
  console.log("Saved 02-proyecto-resumen.png");

  // Tab Guion
  console.log("Capturing Guion...");
  const tabGuion = page.locator("button.tab-pill:has-text('Guion')");
  await tabGuion.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "03-proyecto-guion.png") });
  console.log("Saved 03-proyecto-guion.png");

  // Tab Fuentes
  console.log("Capturing Fuentes...");
  const tabFuentes = page.locator("button.tab-pill:has-text('Fuentes')");
  await tabFuentes.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "04-proyecto-fuentes.png") });
  console.log("Saved 04-proyecto-fuentes.png");

  // Tab Audio
  console.log("Capturing Audio...");
  const tabAudio = page.locator("button.tab-pill:has-text('Audio')");
  await tabAudio.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "05-proyecto-audio.png") });
  console.log("Saved 05-proyecto-audio.png");

  // Tab Visuales
  console.log("Capturing Visuales...");
  const tabVisuales = page.locator("button.tab-pill:has-text('Visuales')");
  await tabVisuales.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, "06-proyecto-visuales.png") });
  console.log("Saved 06-proyecto-visuales.png");

  // Storyboard Modal
  console.log("Capturing Storyboard Modal...");
  const hojaBtn = page.locator("button:has-text('Hoja')");
  if (await hojaBtn.count() > 0) {
    await hojaBtn.click();
    await page.waitForSelector("div:has-text('129 escenas visuales')", { timeout: 8000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, "09-storyboard-modal.png") });
    console.log("Saved 09-storyboard-modal.png");
    // Close modal
    const closeBtn = page.locator("button:has-text('Cerrar')").or(page.locator("div.fixed button").last());
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
      await page.waitForTimeout(500);
    }
  }

  // Tab Produccion
  console.log("Capturing Produccion...");
  const tabProd = page.locator("button.tab-pill:has-text('Producción')");
  await tabProd.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "07-proyecto-produccion.png") });
  console.log("Saved 07-proyecto-produccion.png");

  // Diagnostico
  console.log("Capturing Diagnostico...");
  const diagNav = page.locator("button:has-text('Diagnóstico')");
  await diagNav.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "08-diagnostico.png") });
  console.log("Saved 08-diagnostico.png");

  // 3. Responsive 1366x768 Viewport
  console.log("Testing Responsive 1366x768...");
  await page.setViewportSize({ width: 1366, height: 768 });
  const epNav = page.locator("button:has-text('Episodio Actual')");
  await epNav.click();
  await page.waitForTimeout(1000);
  await tabVisuales.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, "10-responsive-1366x768-visuales.png") });
  console.log("Saved 10-responsive-1366x768-visuales.png");

  await tabGuion.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, "11-responsive-1366x768-guion.png") });
  console.log("Saved 11-responsive-1366x768-guion.png");

  await browser.close();
  console.log("All interactive screenshots captured successfully in qa/desktop!");
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
