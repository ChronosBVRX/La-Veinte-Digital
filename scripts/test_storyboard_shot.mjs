import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("http://localhost:1420/?screen=proyecto&projectId=d5f1fc16", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const btn = page.locator("button:has-text('Storyboard')");
  console.log("Storyboard count:", await btn.count());
  if (await btn.count() > 0) {
    await btn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "qa/desktop/09-storyboard-modal.png" });
    console.log("Saved 09-storyboard-modal.png successfully!");
  }
  await browser.close();
}

run().catch(console.error);
