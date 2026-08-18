/**
 * sha256Hex — SHA-256 en hex, portable entre Node 18+ y browsers
 * usando Web Crypto (crypto.subtle). Evita depender de node:crypto,
 * que rompe el bundle del frontend (Vite/rollup).
 */

const enc = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("crypto.subtle no disponible en este entorno");
  const buf = await subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
