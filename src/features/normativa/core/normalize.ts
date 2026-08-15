const PAIRS: Array<[string, string]> = [
  ["Ã©", "é"], ["Ã¡", "á"], ["Ã³", "ó"], ["Ã±", "ñ"], ["Ãº", "ú"],
  ["Ã¼", "ü"], ["Ã‰", "É"], ["Ã", "Á"],
  ["Â¡", "¡"], ["Â¿", "¿"], ["Â·", "·"],
  ["Ì", "í"], ["Û", "ó"], ["È", "é"], ["Ù", "ú"], ["‰", "É"],
  ["¢", "ó"], ["¥", "ñ"], ["¬", "í"],
];

const SINGLE_MAP = new Map<string, string>();
const MULTI_SORTED: Array<[string, string]> = [];

for (const [from, to] of PAIRS) {
  if (from.length === 1) SINGLE_MAP.set(from, to);
  else MULTI_SORTED.push([from, to]);
}
MULTI_SORTED.sort((a, b) => b[0].length - a[0].length);

export function fixMojibake(text: string): string {
  let out = text;
  for (const [from, to] of MULTI_SORTED) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  let replaced = false;
  let chars = "";
  for (const ch of out) {
    const mapped = SINGLE_MAP.get(ch);
    if (mapped !== undefined) {
      chars += mapped;
      replaced = true;
    } else {
      chars += ch;
    }
  }
  return replaced ? chars : out;
}

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const NBSP = /\u00a0/g;
const MULTI_SPACE = /[ \t]{2,}/g;

export function normalizeWhitespace(text: string): string {
  return text
    .replace(NBSP, " ")
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(MULTI_SPACE, " ")
    .trim();
}

export function normalizeText(text: string): string {
  return normalizeWhitespace(fixMojibake(text));
}

export function normalizeKey(input: string): string {
  return input
    .trim()
    .replace(/[\s.\-–—]+/g, "-")
    .replace(/[^\wñÑáéíóúÁÉÍÓÚüÜ-]/g, "")
    .replace(/^-+|-+$/g, "");
}

export function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
