import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveMediaSafe, resolveRoots } from "../media-security";

let base: string;

beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), "lv-media-")); });
afterEach(() => { fs.rmSync(base, { recursive: true, force: true }); });

describe("media security", () => {
  it("sirve un archivo dentro de una raíz autorizada", () => {
    const root = path.join(base, "tts");
    fs.mkdirSync(path.join(root, "cache"), { recursive: true });
    const wav = path.join(root, "cache", "t001.wav");
    fs.writeFileSync(wav, Buffer.from("RIFF")); // archivo
    const resolved = resolveMediaSafe(wav, [root]);
    expect(resolved).toBe(fs.realpathSync(wav));
  });

  it("bloquea traversal hacia /etc/passwd", () => {
    const root = path.join(base, "tts");
    fs.mkdirSync(root, { recursive: true });
    const evil = "../../../../etc/passwd";
    expect(resolveMediaSafe(evil, [root])).toBeNull();
  });

  it("bloquea una ruta absoluta fuera de la raíz", () => {
    const root = path.join(base, "tts");
    fs.mkdirSync(root, { recursive: true });
    const outsideFile = path.join(base, "fuera.txt");
    fs.writeFileSync(outsideFile, "secreto");
    expect(resolveMediaSafe(outsideFile, [root])).toBeNull();
  });

  it("bloquea un symlink que apunta fuera de la raíz", () => {
    const root = path.join(base, "tts");
    fs.mkdirSync(root, { recursive: true });
    const outsideFile = path.join(base, "fuera.txt");
    fs.writeFileSync(outsideFile, "secreto");
    const link = path.join(root, "link.txt");
    fs.symlinkSync(outsideFile, link);
    // realpath del symlink apunta fuera → rechazado
    expect(resolveMediaSafe(link, [root])).toBeNull();
  });

  it("rechaza rutas inexistentes", () => {
    const root = path.join(base, "tts");
    fs.mkdirSync(root, { recursive: true });
    expect(resolveMediaSafe(path.join(root, "no-existe.wav"), [root])).toBeNull();
    expect(resolveMediaSafe("", [root])).toBeNull();
  });

  it("resuelve raíces autorizadas a realpath", () => {
    const root = path.join(base, "tts");
    fs.mkdirSync(root, { recursive: true });
    const roots = resolveRoots([root]);
    expect(roots[0]).toBe(fs.realpathSync(root));
  });
});
