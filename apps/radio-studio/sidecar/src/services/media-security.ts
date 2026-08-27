/**
 * Seguridad /media: resolver una ruta solicitada contra raíces autorizadas.
 * El objetivo real (tras realpath) debe vivir dentro de una de las raíces.
 * Impide traversal (../../../etc/passwd) y symlinks que apunten fuera.
 */
import fs from "node:fs";
import path from "node:path";

/** Resuelve roots autorizados a su realpath (o el path tal cual si no existe). */
export function resolveRoots(roots: string[]): string[] {
  return roots.map((root) => {
    try { return fs.realpathSync(path.resolve(root)); } catch { return path.resolve(root); }
  });
}

/**
 * Devuelve la ruta REAL segura a servir, o null si está fuera de las raíces.
 * @param requested  la ruta tal como viene del cliente (puede ser absoluta o relativa)
 * @param allowedRoots  raíces autorizadas (irán a realpath)
 */
export function resolveMediaSafe(requested: string, allowedRoots: string[]): string | null {
  if (!requested) return null;
  let target: string;
  try {
    target = fs.realpathSync(path.resolve(requested));
  } catch {
    return null;
  }
  const roots = resolveRoots(allowedRoots);
  const within = roots.some((root) => target === root || target.startsWith(root + path.sep));
  if (!within) return null;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
  return target;
}
