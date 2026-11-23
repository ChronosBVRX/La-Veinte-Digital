const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src/renderer');
const destDir = path.join(__dirname, '../dist/renderer');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const filesToCopy = ['index.html', 'styles.css'];

for (const file of filesToCopy) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[copy-assets] Copiado ${file} -> dist/renderer/`);
  }
}
