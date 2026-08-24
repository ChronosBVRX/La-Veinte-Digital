import path from "node:path";

/** Ruta del intérprete Python del venv de TTS según plataforma. */
export function pythonBin(stateDir: string): string {
  return process.platform === "win32"
    ? path.join(stateDir, "venv", "Scripts", "python.exe")
    : path.join(stateDir, "venv", "bin", "python");
}
