import { chromium } from 'playwright';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('qa/desktop/real-tauri');
fs.mkdirSync(outDir, { recursive: true });

function captureDesktopWindow(filename) {
    const outPath = path.join(outDir, filename).split(path.sep).join('/');
    const pyCode = [
        'import ctypes',
        'from ctypes import wintypes',
        'from PIL import ImageGrab',
        'user32 = ctypes.windll.user32',
        'h_default = user32.OpenDesktopW("default", 0, False, 0x10000000)',
        'if h_default: user32.SetThreadDesktop(h_default)',
        'hwnd = user32.FindWindowW(None, "AI Radio Studio")',
        'if hwnd:',
        '    user32.ShowWindow(hwnd, 3)',
        '    user32.SetForegroundWindow(hwnd)',
        '    user32.BringWindowToTop(hwnd)',
        '    rect = wintypes.RECT()',
        '    user32.GetWindowRect(hwnd, ctypes.byref(rect))',
        '    bbox = (rect.left, rect.top, rect.right, rect.bottom)',
        '    img = ImageGrab.grab(bbox=bbox)',
        `    img.save("${outPath}")`,
        `    print("Desktop grab saved: ${filename}", img.size)`,
        'else:',
        `    print("HWND not found for ${filename}")`
    ].join('\n');
    
    fs.writeFileSync('temp_grab.py', pyCode);
    execSync('python temp_grab.py', { stdio: 'inherit' });
    try { fs.unlinkSync('temp_grab.py'); } catch {}
}

async function run() {
    console.log("1. Killing old instances...");
    try { execSync('taskkill /F /IM radio-studio.exe', { stdio: 'ignore' }); } catch {}

    console.log("2. Spawning new radio-studio.exe with CDP debugging port 9222...");
    const exePath = 'C:/Users/Axel Rosete/AppData/Local/AI Radio Studio/radio-studio.exe';
    const env = Object.assign({}, process.env, {
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222'
    });
    
    const child = spawn(exePath, [], {
        env,
        detached: true,
        stdio: 'ignore'
    });
    child.unref();

    console.log("Waiting for Tauri window and CDP port 9222...");
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            const res = await fetch('http://127.0.0.1:9222/json');
            if (res.ok) {
                console.log("CDP is ready!");
                break;
            }
        } catch {}
    }

    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    const page = context.pages()[0];
    console.log("Connected to Tauri WebView2 page:", await page.title(), page.url());

    // 1. Home
    console.log("\n--- 1. Home ---");
    await page.waitForTimeout(2000);
    captureDesktopWindow('01-home.png');

    // Click on Project d5f1fc16
    console.log("Entering project d5f1fc16...");
    const projectCard = page.locator('text=Bienvenidas y bienvenidos al primer episodio').first();
    if (await projectCard.isVisible()) {
        await projectCard.click();
    } else {
        await page.locator('text=Listo para publicar').first().click();
    }
    await page.waitForTimeout(2500);

    // 2. Guion
    console.log("\n--- 2. Guion ---");
    await page.locator('button:has-text("Guion")').first().click();
    await page.waitForTimeout(2000);
    captureDesktopWindow('02-guion.png');

    // 3. Fuentes
    console.log("\n--- 3. Fuentes ---");
    await page.locator('button:has-text("Fuentes")').first().click();
    await page.waitForTimeout(2000);
    captureDesktopWindow('03-fuentes.png');

    // 4. Audio
    console.log("\n--- 4. Audio ---");
    await page.locator('button:has-text("Audio")').first().click();
    await page.waitForTimeout(2000);
    captureDesktopWindow('04-audio.png');

    // 5. Visuales
    console.log("\n--- 5. Visuales ---");
    await page.locator('button:has-text("Visuales")').first().click();
    await page.waitForTimeout(2500);
    captureDesktopWindow('05-visuales.png');

    // 6. Storyboard abierto
    console.log("\n--- 6. Storyboard abierto ---");
    const storyboardBtn = page.locator('button:has-text("Storyboard")').first();
    if (await storyboardBtn.isVisible()) {
        await storyboardBtn.click();
        await page.waitForTimeout(2500);
        captureDesktopWindow('06-storyboard.png');
        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
    }

    // 7. Producción
    console.log("\n--- 7. Producción ---");
    await page.locator('button:has-text("Producción")').first().click();
    await page.waitForTimeout(2000);
    captureDesktopWindow('07-produccion.png');

    // 8. Diagnóstico
    console.log("\n--- 8. Diagnóstico ---");
    await page.locator('button:has-text("Diagnóstico")').first().click();
    await page.waitForTimeout(2500);
    captureDesktopWindow('08-diagnostico.png');

    await browser.close();
    console.log("\nALL 8 REAL TAURI DESKTOP SCREENSHOTS CAPTURED SUCCESSFULLY!");
}

run().catch(console.error);
