import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256Hex(data: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256File(path: string): string {
  const buf = readFileSync(path);
  return sha256Hex(buf);
}

export function isPdfBuffer(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  const head = buf.subarray(0, Math.min(buf.length, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

export function looksLikeHtml(buf: Buffer): boolean {
  const head = buf.subarray(0, 1024).toString("latin1").trimStart().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.includes("<head");
}

export function isChallengePage(buf: Buffer): boolean {
  const s = buf.subarray(0, 4096).toString("latin1");
  return s.includes("_Incapsula_Resource") || s.includes("incapsula");
}

export function stableId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateIso: string, from?: Date): number {
  const target = new Date(`${dateIso}T00:00:00`);
  const base = from ?? new Date();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  return Math.round((targetDay - baseDay) / 86400000);
}
