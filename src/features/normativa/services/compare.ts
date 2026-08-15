import type { NormativeDB } from "./db";
import { stripAccents } from "../core/normalize";

export interface ClauseCompare {
  clause: string;
  textA: string;
  textB: string;
  numbersA: number[];
  numbersB: number[];
  changedNumbers: Array<{ before: number | null; after: number | null }>;
  diffScore: number;
}

export interface CctCompareReport {
  fromId: string;
  toId: string;
  fromLabel: string;
  toLabel: string;
  clausesA: number;
  clausesB: number;
  added: string[];
  removed: string[];
  modified: ClauseCompare[];
  unchanged: string[];
  blocksAdded: string[];
  blocksRemoved: string[];
}

function normKey(text: string): string {
  return stripAccents(text.toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
}

function extractNumbers(text: string): number[] {
  const nums = text.match(/\d+(?:\.\d+)?/g) ?? [];
  const out: number[] = [];
  for (const n of nums) {
    const v = parseFloat(n);
    if (Number.isFinite(v) && v >= 0 && v < 100000) out.push(v);
  }
  return out.slice(0, 40);
}

function clauseNumber(label: string): number {
  const m = label.match(/Cl[áa]usula\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

export function compareDocuments(db: NormativeDB, fromId: string, toId: string): CctCompareReport | null {
  const fromDoc = db.getDocument(fromId);
  const toDoc = db.getDocument(toId);
  if (!fromDoc?.currentVersion || !toDoc?.currentVersion) return null;
  const fromVer = db.getVersion(fromDoc.currentVersion);
  const toVer = db.getVersion(toDoc.currentVersion);
  if (!fromVer || !toVer) return null;

  const fromSections = db.db
    .prepare(`SELECT * FROM sections WHERE version_id = ? AND kind = 'clausula' ORDER BY ord`)
    .all(fromVer.id) as Array<Record<string, unknown>>;
  const toSections = db.db
    .prepare(`SELECT * FROM sections WHERE version_id = ? AND kind = 'clausula' ORDER BY ord`)
    .all(toVer.id) as Array<Record<string, unknown>>;

  const aMap = new Map<string, string>();
  const bMap = new Map<string, string>();
  for (const s of fromSections) aMap.set((s.label as string).trim(), s.id as string);
  for (const s of toSections) bMap.set((s.label as string).trim(), s.id as string);

  const added = [...bMap.keys()].filter((l) => !aMap.has(l));
  const removed = [...aMap.keys()].filter((l) => !bMap.has(l));
  const common = [...aMap.keys()].filter((l) => bMap.has(l));

  const textFor = (versionId: string, sectionId: string): string => {
    const rows = db.db
      .prepare(`SELECT text FROM chunks WHERE version_id = ? AND section_id = ? ORDER BY ord`)
      .all(versionId, sectionId) as Array<{ text: string }>;
    return rows.map((r) => r.text).join("\n");
  };

  const modified: ClauseCompare[] = [];
  const unchanged: string[] = [];

  for (const label of common) {
    const textA = textFor(fromVer.id, aMap.get(label)!);
    const textB = textFor(toVer.id, bMap.get(label)!);
    const keyA = normKey(textA);
    const keyB = normKey(textB);
    if (keyA === keyB) {
      unchanged.push(label);
      continue;
    }
    const numbersA = extractNumbers(textA);
    const numbersB = extractNumbers(textB);
    const changedNumbers: Array<{ before: number | null; after: number | null }> = [];
    if (numbersA.join(",") !== numbersB.join(",")) {
      const maxLen = Math.max(numbersA.length, numbersB.length);
      for (let i = 0; i < maxLen; i++) {
        const before = i < numbersA.length ? numbersA[i] : null;
        const after = i < numbersB.length ? numbersB[i] : null;
        if (before !== after) changedNumbers.push({ before, after });
      }
    }
    const diffScore = Math.abs(keyA.length - keyB.length);
    modified.push({ clause: label, textA: textA.slice(0, 600), textB: textB.slice(0, 600), numbersA, numbersB, changedNumbers: changedNumbers.slice(0, 20), diffScore });
  }

  const blocksOf = (versionId: string): string[] =>
    (db.db
      .prepare(`SELECT label FROM sections WHERE version_id = ? AND kind = 'bloque'`)
      .all(versionId) as Array<{ label: string }>).map((r) => r.label);
  const blocksA = new Set(blocksOf(fromVer.id).map(normKey));
  const blocksB = new Set(blocksOf(toVer.id).map(normKey));
  const blocksAdded = [...blocksB].filter((b) => !blocksA.has(b));
  const blocksRemoved = [...blocksA].filter((b) => !blocksB.has(b));

  return {
    fromId,
    toId,
    fromLabel: fromVer.label,
    toLabel: toVer.label,
    clausesA: fromSections.length,
    clausesB: toSections.length,
    added: added.sort((x, y) => clauseNumber(x) - clauseNumber(y)),
    removed: removed.sort((x, y) => clauseNumber(x) - clauseNumber(y)),
    modified: modified.sort((x, y) => clauseNumber(x.clause) - clauseNumber(y.clause)),
    unchanged,
    blocksAdded,
    blocksRemoved,
  };
}
