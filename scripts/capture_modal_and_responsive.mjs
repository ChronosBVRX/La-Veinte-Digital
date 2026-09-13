import { chromium } from "playwright";
import path from "node:path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const outDir = path.resolve("qa/desktop");

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  console.log("Navigating to Inicio...");
  await page.goto("http://localhost:1420/?screen=inicio", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  console.log("Opening episode d5f1fc16...");
  const episodeCard = page.locator("div.group").filter({ hasText: "Bienvenidas y bienvenidos" }).first();
  await episodeCard.click();

  // Wait for Visual tab, beats and structure
  console.log("Waiting for 129 scenes to load...");
  await page.waitForSelector(".col-structure span:has-text('00:00')", { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Click Hoja / Storyboard button
  console.log("Opening Storyboard Modal...");
  const hojaBtn = page.locator("button:has-text('Hoja')").first();
  await hojaBtn.click();
  await page.waitForSelector(".fixed.inset-0", { timeout: 10000 });
  await page.waitForSelector(".fixed.inset-0 div:has-text('129 escenas')", { timeout: 10000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(outDir, "09-storyboard-modal.png") });
  console.log("Saved 09-storyboard-modal.png with full grid!");

  // Close modal with Escape
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);

  // Responsive 1366x768
  console.log("Testing Responsive 1366x768...");
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "10-responsive-1366x768-visuales.png") });
  console.log("Saved 10-responsive-1366x768-visuales.png");

  const tabGuion = page.locator("button.tab-pill:has-text('Guion')");
  await tabGuion.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, "11-responsive-1366x768-guion.png") });
  console.log("Saved 11-responsive-1366x768-guion.png");

  await browser.close();
  console.log("Finished successfully!");
}

main().catch(console.error);
