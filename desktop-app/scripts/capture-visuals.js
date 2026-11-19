const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, '../../e2e-screenshots/desktop');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Ensure clean test state by cleaning any test vault in memory if needed
const testDataDir = path.join(__dirname, '../Datos/Seguridad');
if (fs.existsSync(path.join(testDataDir, 'boveda.dat'))) {
  try {
    fs.unlinkSync(path.join(testDataDir, 'boveda.dat'));
  } catch (e) {}
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../dist/preload/index.js'),
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const rendererPath = path.join(__dirname, '../dist/renderer/index.html');
  await win.loadFile(rendererPath);

  // Helper function to sleep
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  await sleep(1500);

  // 1. Capture Lock Screen (First-time setup mode)
  console.log('Capturing screen 1: Lock Screen (Setup Mode)...');
  let image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, '01_pantalla_bloqueo_setup.png'), image.toPNG());

  // Set up PIN programmatically or via UI simulation
  console.log('Setting up PIN and unlocking...');
  await win.webContents.executeJavaScript(`
    (async function() {
      const pinInput = document.getElementById('pin-input');
      const pinConfirmInput = document.getElementById('pin-confirm-input');
      const btnSubmit = document.getElementById('btn-submit-pin');
      pinInput.value = '2026';
      pinConfirmInput.value = '2026';
      btnSubmit.click();
    })();
  `);

  await sleep(1000);

  // 2. Capture Plataforma Tab
  console.log('Capturing screen 2: Plataforma...');
  image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, '02_plataforma_principal.png'), image.toPNG());

  // 3. Switch to Tarjetón Tab & capture
  console.log('Capturing screen 3: Tarjetón IMSS...');
  await win.webContents.executeJavaScript(`
    document.querySelector('.tab-btn[data-tab="tarjeton"]').click();
  `);
  await sleep(600);
  image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, '03_tarjeton_imss.png'), image.toPNG());

  // 4. Switch to Checadas Biométricas Tab & capture
  console.log('Capturing screen 4: Checadas Biométricas...');
  await win.webContents.executeJavaScript(`
    document.querySelector('.tab-btn[data-tab="biometricos"]').click();
  `);
  await sleep(600);
  image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, '04_checadas_biometricas.png'), image.toPNG());

  // 5. Switch to Documentos en USB Tab & capture
  console.log('Capturing screen 5: Documentos en USB...');
  await win.webContents.executeJavaScript(`
    document.querySelector('.tab-btn[data-tab="documentos"]').click();
  `);
  await sleep(600);
  image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outputDir, '05_documentos_usb.png'), image.toPNG());

  console.log('All screenshots captured successfully in:', outputDir);
  app.quit();
});
