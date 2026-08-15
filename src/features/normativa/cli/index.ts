import path from "node:path";
import fs from "node:fs";
import { REPO_ROOT } from "./shared";
import { NormativeDB } from "../services/db";
import { extractPdfPages, htmlToText, ocrPdfPages } from "../services/extractor";
import { parseStructure } from "../services/structure";
import { registerVirtualSubdocuments } from "../services/bootstrap";
import { nowIso } from "../core/hashing";

async function main() {
  const root = path.join(REPO_ROOT, "data", "normativa");
  const db = new NormativeDB(path.join(root, "catalog.sqlite"));

  for (const doc of db.listDocuments()) {
    for (const ver of db.listVersions(doc.id)) {
      const pdf = path.join(ver.dir, "original.pdf");
      const html = path.join(ver.dir, "original.html");
      if (fs.existsSync(pdf)) {
        const ext = await extractPdfPages(new Uint8Array(fs.readFileSync(pdf)));
        let pages = ext.pages;
        let fullText = ext.normalizedText;
        if (ext.needsOcr) {
          console.log(`  🔍 ${doc.id}: PDF sin texto — OCR`);
          const ocr = await ocrPdfPages(pdf, { log: (m) => console.log(`    ${m}`) });
          pages = ocr.pages;
          fullText = ocr.fullText;
          fs.writeFileSync(path.join(ver.dir, "ocr.txt"), ocr.fullText + "\n");
          fs.writeFileSync(
            path.join(ver.dir, "ocr-confidence.json"),
            JSON.stringify({ meanConfidence: ocr.meanConfidence, perPage: ocr.confidences }, null, 2)
          );
        }
        fs.writeFileSync(path.join(ver.dir, "extracted.txt"), fullText + "\n");
        const parsed = parseStructure({
          docId: doc.id,
          versionId: `${doc.id}@${ver.label}`,
          type: doc.type,
          pages,
          expectedKey: doc.key ?? null,
        });
        fs.writeFileSync(path.join(ver.dir, "chunks.jsonl"), parsed.chunks.map((c) => JSON.stringify(c)).join("\n") + "\n");
        db.replaceSections(parsed.sections);
        db.replaceChunks(parsed.chunks);
        db.insertCitations(parsed.citations);
        db.setVersionExtracted(`${doc.id}@${ver.label}`, ext.numPages, nowIso());
        if (doc.id === "CCT-IMSS-SNTSS-2025-2027") {
          registerVirtualSubdocuments(db, doc.id, parsed.sections, { log: (m) => console.log(m) });
        }
        console.log(`${doc.id}@${ver.label}: reindexado (${parsed.chunks.length} chunks)`);
      } else if (fs.existsSync(html)) {
        const text = htmlToText(fs.readFileSync(html, "utf8"));
        fs.writeFileSync(path.join(ver.dir, "extracted.txt"), text + "\n");
        const parsed = parseStructure({
          docId: doc.id,
          versionId: `${doc.id}@${ver.label}`,
          type: doc.type,
          pages: [{ pageIndex: 1, printedPage: null, text }],
          expectedKey: doc.key ?? null,
        });
        db.replaceSections(parsed.sections);
        db.replaceChunks(parsed.chunks);
        db.insertCitations(parsed.citations);
        db.setVersionExtracted(`${doc.id}@${ver.label}`, 1, nowIso());
        console.log(`${doc.id}@${ver.label}: reindexado HTML (${parsed.chunks.length} chunks)`);
      }
    }
  }
  console.log("Reindexado completo.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
