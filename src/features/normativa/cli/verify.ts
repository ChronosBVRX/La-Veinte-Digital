import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DATA_ROOT } from "./shared";
import { NormativeDB } from "../services/db";

function sha256File(p: string): string {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

async function main() {
  const db = new NormativeDB(path.join(DATA_ROOT, "catalog.sqlite"));
  const docs = db.listDocuments();
  let ok = 0;
  let fail = 0;
  for (const doc of docs) {
    const versions = db.listVersions(doc.id);
    if (versions.length === 0) continue;
    for (const v of versions) {
      let file: string | null = null;
      for (const ext of ["pdf", "html"]) {
        const p = path.join(v.dir, `original.${ext}`);
        if (fs.existsSync(p)) {
          file = p;
          break;
        }
      }
      if (!file) {
        console.log(`✗ ${doc.id}@${v.label}: original faltante`);
        fail++;
        continue;
      }
      const actual = sha256File(file);
      const recorded = fs.existsSync(path.join(v.dir, "sha256.txt"))
        ? fs.readFileSync(path.join(v.dir, "sha256.txt"), "utf8").trim()
        : v.sha256;
      const extractedExists = fs.existsSync(path.join(v.dir, "extracted.txt"));
      if (actual !== recorded) {
        console.log(`✗ ${doc.id}@${v.label}: SHA-256 NO COINCIDE (${actual.slice(0, 12)}… vs ${recorded.slice(0, 12)}…)`);
        fail++;
      } else if (!extractedExists) {
        console.log(`✗ ${doc.id}@${v.label}: extracted.txt faltante`);
        fail++;
      } else {
        console.log(`✓ ${doc.id}@${v.label} (${actual.slice(0, 12)}…)`);
        ok++;
      }
    }
  }
  console.log(`\nOK=${ok} FAIL=${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main();
