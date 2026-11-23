import tesseract from "tesseract.js";
import path from "path";

const imgDir = "C:\\Users\\Axel Rosete\\.gemini\\antigravity\\brain\\a9fbbfa1-cf08-4bc5-9611-e65c4473b3ba\\.user_uploaded";
const files = [
  "media_1792775005969_8d522f1d.jpg",
  "media_1792775006175_5b2fc142.jpg",
  "media_1792775006209_20d82904.jpg",
  "media_1792775006268_f40d213e.jpg",
  "media_1792775006311_52048719.jpg",
];

async function run() {
  for (const f of files) {
    const fullPath = path.join(imgDir, f);
    console.log(`\n=== OCR for ${f} ===`);
    try {
      const res = await tesseract.recognize(fullPath, "spa");
      console.log(res.data.text.trim());
    } catch (e) {
      console.error("Error recognizing", f, e.message);
    }
  }
}

run();
