export function estimateBlockDurSec(texto: string): number {
  const palabras = texto.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.5, palabras / 2.6);
}

export function chunkTexto(texto: string, max = 220): string[] {
  const clean = texto.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean ? [clean] : [];
  const chunks: string[] = [];
  let rest = clean;
  while (rest.length > max) {
    const win = rest.slice(0, max + 1);
    const matches: number[] = [];
    const re = /([.!?…;:])(\s+|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(win)) !== null) matches.push(m.index + m[1].length + (m[2] ?? "").length);
    let cut = -1;
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i] >= 120) {
        cut = matches[i];
        break;
      }
    }
    if (cut <= 0) {
      const sp = rest.slice(120, max).lastIndexOf(" ");
      cut = sp === -1 ? max : 120 + sp;
    }
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
