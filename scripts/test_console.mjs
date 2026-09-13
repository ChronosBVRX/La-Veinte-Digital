import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
  await page.goto('http://localhost:1420/?screen=proyecto&projectId=d5f1fc16', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await browser.close();
}
main().catch(console.error);
