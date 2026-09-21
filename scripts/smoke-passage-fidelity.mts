import fs from "node:fs";
import path from "node:path";
import * as mupdf from "mupdf";
import { buildPassage026Pdf, buildPassage027Pdf } from "../src/features/representacion/services/passage-pdf";

async function runFidelitySmoke() {
  const artifactsDir = path.resolve("artifacts/pasajes");
  fs.mkdirSync(artifactsDir, { recursive: true });

  const t026Buf = fs.readFileSync("assets/templates/union/pasajes/formato-concepto-026.pdf");
  const t027Buf = fs.readFileSync("assets/templates/union/pasajes/formato-concepto-027.pdf");

  const sampleWorker = {
    paternalSurname: "BOLAÑOS",
    maternalSurname: "VÁZQUEZ",
    firstName: "EDUARDO PRUEBA",
    employeeNumber: "12345678",
    category: "TÉCNICO RADIÓLOGO",
    assignment: "HOSPITAL GENERAL REGIONAL No. 1",
  };

  const sampleAddressWorker = {
    street: "AV. FRANCISCO I. MADERO PONIENTE 1234 INT 5",
    neighborhood: "CENTRO HISTÓRICO",
    postalCode: "58000",
    municipality: "MORELIA",
    state: "MICHOACÁN",
  };

  const sampleAddressAssignment = {
    street: "CALZADA VENTURA PUENTE ESQ. CAMELINAS S/N",
    neighborhood: "COL. CUAUHTÉMOC",
    postalCode: "58020",
    municipality: "MORELIA",
    state: "MICHOACÁN",
  };

  console.log("1. Generando passaje-026-sample.pdf...");
  const pdf026 = await buildPassage026Pdf(
    {
      ooad: "MICHOACÁN",
      day: "21",
      month: "09",
      year: "2026",
      controlNumber: "12345678",
      worker: sampleWorker,
      extramuralFunctions: "FUNCIONES EXTRAMUROS DE PRUEBA EN DIVERSAS UNIDADES MÉDICAS DE LA ZONA",
      transferPeriod: "01/01/2026 AL 31/01/2026",
      folioLabel: "XXI-2026-PAS-000123",
    },
    t026Buf,
  );
  fs.writeFileSync(path.join(artifactsDir, "passaje-026-sample.pdf"), pdf026);

  console.log("2. Generando passaje-027-sample.pdf...");
  const pdf027 = await buildPassage027Pdf(
    {
      ooad: "MICHOACÁN",
      day: "21",
      month: "09",
      year: "2026",
      controlNumber: "12345678",
      worker: sampleWorker,
      discontinuousSchedule: "Si",
      workerAddress: sampleAddressWorker,
      assignmentAddress: sampleAddressAssignment,
      phone: "4431234567",
      folioLabel: "XXI-2026-PAS-000124",
    },
    t027Buf,
  );
  fs.writeFileSync(path.join(artifactsDir, "passaje-027-sample.pdf"), pdf027);

  console.log("3. Renderizando PNGs a 2x de resolución...");
  // Scale 2x for Carta: 612x792 -> 1224x1584
  const scale = 2;
  const matrix = mupdf.Matrix.scale(scale, scale);

  // 026
  const doc026 = mupdf.Document.openDocument(pdf026, "application/pdf");
  const pix026 = doc026.loadPage(0).toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
  fs.writeFileSync(path.join(artifactsDir, "passaje-026-sample-page1.png"), pix026.asPNG());

  // 027
  const doc027 = mupdf.Document.openDocument(pdf027, "application/pdf");
  const pix027_1 = doc027.loadPage(0).toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
  const pix027_2 = doc027.loadPage(1).toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
  fs.writeFileSync(path.join(artifactsDir, "passaje-027-sample-page1.png"), pix027_1.asPNG());
  fs.writeFileSync(path.join(artifactsDir, "passaje-027-sample-page2.png"), pix027_2.asPNG());

  // Originales
  const orig026Doc = mupdf.Document.openDocument(t026Buf, "application/pdf");
  const orig026Pix = orig026Doc.loadPage(0).toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
  fs.writeFileSync(path.join(artifactsDir, "original-026-page1.png"), orig026Pix.asPNG());

  const orig027Doc = mupdf.Document.openDocument(t027Buf, "application/pdf");
  const orig027Pix1 = orig027Doc.loadPage(0).toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
  const orig027Pix2 = orig027Doc.loadPage(1).toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
  fs.writeFileSync(path.join(artifactsDir, "original-027-page1.png"), orig027Pix1.asPNG());
  fs.writeFileSync(path.join(artifactsDir, "original-027-page2.png"), orig027Pix2.asPNG());

  console.log("4. Comparando fidelidad visual contra los originales...");

  function comparePixmaps(orig: mupdf.Pixmap, gen: mupdf.Pixmap, label: string) {
    const w = orig.getWidth();
    const h = orig.getHeight();
    const origPix = orig.getPixels();
    const genPix = gen.getPixels();
    const total = w * h;
    let diffCount = 0;
    // Difference is expected where variable text was drawn
    for (let i = 0; i < total * 3; i += 3) {
      const rDiff = Math.abs(origPix[i] - genPix[i]);
      const gDiff = Math.abs(origPix[i + 1] - genPix[i + 1]);
      const bDiff = Math.abs(origPix[i + 2] - genPix[i + 2]);
      if (rDiff > 20 || gDiff > 20 || bDiff > 20) {
        diffCount++;
      }
    }
    const matchPct = (((total - diffCount) / total) * 100).toFixed(2);
    const diffPct = ((diffCount / total) * 100).toFixed(2);
    console.log(`  [${label}] Coincidencia de píxeles estáticos: ${matchPct}% (diferencia por datos insertados: ${diffPct}%)`);
    return { matchPct, diffPct };
  }

  comparePixmaps(orig026Pix, pix026, "026 Original vs Generado");
  comparePixmaps(orig027Pix1, pix027_1, "027 Pág 1 Original vs Generado");
  comparePixmaps(orig027Pix2, pix027_2, "027 Pág 2 Original vs Generado (Aviso de Privacidad)");

  console.log("\n✓ Smoke de fidelidad ejecutado exitosamente.");
}

runFidelitySmoke().catch((e) => {
  console.error("Error en smoke:", e);
  process.exit(1);
});
