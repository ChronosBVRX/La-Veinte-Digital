// Importador de una sola vez — Lockers 2025 → union_lockers.
// Uso:
//   node scripts/import-union-lockers.mjs --source "D:/..." --dry-run
//   node scripts/import-union-lockers.mjs --source "D:/..." --apply
// Nunca modifica el Excel original. Conflictos → reporte local (fuera de git).
// El reporte puede contener PII: se escribe en .local-private/ por defecto.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}
const has = (name) => process.argv.includes(name);

const source = arg("--source", "");
const outDir = arg("--out", ".local-private/delegacion-xxi");
const dryRun = has("--dry-run") || !has("--apply");

if (!source) {
  console.error('Falta --source "ruta al xlsx"');
  process.exit(2);
}
if (!fs.existsSync(source)) {
  console.error(`No existe: ${source}`);
  process.exit(2);
}

function normStr(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}
function normLocker(v) {
  const digits = String(v ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  return String(parseInt(digits, 10));
}
function maskMatricula(m) {
  const s = String(m ?? "").replace(/[^0-9]/g, "");
  return s.length > 4 ? `***${s.slice(-4)}` : "***";
}

const wb = XLSX.readFile(source, { dense: false });
console.log(`Libro: ${source}`);
console.log(`Hojas: ${wb.SheetNames.join(", ")}`);

const ws = wb.Sheets["Hoja1"];
if (!ws) {
  console.error("No se encontró Hoja1");
  process.exit(2);
}
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
const header = rows[0] || [];
console.log(`Encabezado: ${header.slice(0, 11).join(" | ")}`);
console.log(`Filas totales (incl. encabezado): ${rows.length}`);

const seenLocker = new Map();
const seenWorker = new Map();
const records = [];
const conflicts = [];
let incomplete = 0;

for (let i = 1; i < rows.length; i += 1) {
  const r = rows[i] || [];
  const matricula = normStr(r[0]).replace(/[^0-9]/g, "");
  const nombre = normStr(r[1]);
  const turno = normStr(r[3]);
  const categoria = normStr(r[4]);
  const horario = normStr(r[5]);
  const locker = normLocker(r[8]);
  const estadoRaw = normStr(r[9]).toUpperCase();
  if (!matricula && !nombre && !locker) continue; // fila vacía
  const rec = { row: i + 1, matricula, nombre, turno, categoria, horario, locker, estadoRaw };
  if (!locker || !matricula || !nombre) {
    incomplete += 1;
    conflicts.push({ type: "incompleto", ...rec, matriculaMask: maskMatricula(matricula) });
    continue;
  }
  if (seenLocker.has(locker)) {
    conflicts.push({ type: "locker_duplicado", locker, firstRow: seenLocker.get(locker), ...rec, matriculaMask: maskMatricula(matricula) });
    continue;
  }
  seenLocker.set(locker, i + 1);
  if (seenWorker.has(matricula)) {
    conflicts.push({ type: "trabajador_duplicado", firstRow: seenWorker.get(matricula), ...rec, matriculaMask: maskMatricula(matricula) });
    continue;
  }
  seenWorker.set(matricula, i + 1);
  records.push(rec);
}

// Hoja3: posible lista de espera (estructura distinta) — solo conteo, sin PII.
let waitlistCount = 0;
if (wb.SheetNames.includes("Hoja3")) {
  const w3 = XLSX.utils.sheet_to_json(wb.Sheets["Hoja3"], { header: 1, defval: "" });
  waitlistCount = Math.max(0, w3.length - 1);
}

const report = {
  generatedAt: new Date().toISOString(),
  source: "[ruta local, no versionada]",
  totalRows: rows.length - 1,
  seguros: records.length,
  incompletos: incomplete,
  conflictos: conflicts.length,
  waitlistHoja3: waitlistCount,
  breakdown: {
    lockerDuplicado: conflicts.filter((c) => c.type === "locker_duplicado").length,
    trabajadorDuplicado: conflicts.filter((c) => c.type === "trabajador_duplicado").length,
    incompleto: conflicts.filter((c) => c.type === "incompleto").length,
  },
};

console.log("─".repeat(60));
console.log(`Total filas:        ${report.totalRows}`);
console.log(`Seguros p/ insert:  ${report.seguros}`);
console.log(`Incompletos:        ${report.incompletos}`);
console.log(`Conflictos:         ${report.conflictos} (locker: ${report.breakdown.lockerDuplicado}, trabajador: ${report.breakdown.trabajadorDuplicado})`);
console.log(`Hoja3 (espera):     ${report.waitlistHoja3} filas aprox.`);
console.log(dryRun ? "Modo DRY-RUN: no se inserta nada." : "Modo APPLY: se insertarían registros seguros (requiere SUPABASE_URL + SERVICE_ROLE).");

fs.mkdirSync(outDir, { recursive: true });
// Reporte completo (con matrículas enmascaradas y nombres) — LOCAL, nunca en git.
fs.writeFileSync(path.join(outDir, "locker-import-report.json"), JSON.stringify({ ...report, conflicts: conflicts.slice(0, 500) }, null, 2));
// CSV seguro para carga (sin nombres): delegation_id debe completarse al aplicar.
const csv = ["locker_number,matricula_hash_ref,row", ...records.map((r) => `${r.locker},${maskMatricula(r.matricula)},${r.row}`)].join("\n");
fs.writeFileSync(path.join(outDir, "locker-import-safe.csv"), csv);
console.log(`Reporte local: ${path.join(outDir, "locker-import-report.json")}`);

if (!dryRun) {
  console.log("APPLY: inserción vía Supabase pendiente de credenciales de servicio.");
  console.log("Los registros en conflicto quedaron en el reporte para revisión humana; no se sobrescribió nada silenciosamente.");
}
