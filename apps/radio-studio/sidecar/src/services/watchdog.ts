/**
 * Watchdog externo Qwen — mata SOLO el process group de la generación.
 * El timeout es inyectable para poder probar con 1-3s (no 180s reales).
 * Nunca usa `pkill python`/`killall`; jamás toca procesos ajenos.
 */
import { spawn } from "node:child_process";

/** Envía una señal a todo el process group del pid (grupo propio = -- detached). */
export function killProcessGroup(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return false;
  }
}

export function processAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export interface WatchdogHandle {
  cancel: () => void;
  fired: () => boolean;
}

/**
 * Programa la muerte de `pid` (y su group) tras `timeoutMs`, con SIGTERM y luego
 * SIGKILL tras `graceMs`, si sigue vivo. Devuelve un handle para cancelar.
 */
export function armWatchdog(pid: number, timeoutMs: number, graceMs = 2000): WatchdogHandle {
  let fired = false;
  const killTimer = setTimeout(() => {
    fired = true;
    killProcessGroup(pid, "SIGTERM");
    const killTimer2 = setTimeout(() => {
      if (processAlive(pid)) killProcessGroup(pid, "SIGKILL");
    }, graceMs);
    // si el proceso muere antes del SIGKILL, cancelar el timer de gracia
    const checkAlive = setInterval(() => {
      if (!processAlive(pid)) { clearInterval(checkAlive); clearTimeout(killTimer2); }
    }, 100);
    killTimer2.unref?.();
  }, timeoutMs);
  return {
    cancel: () => { clearTimeout(killTimer); },
    fired: () => fired,
  };
}

/** Lanza una generación Qwen y la vigila desde fuera (el proceso no controla su propio timeout). */
export function spawnWatched(options: {
  cmd: string;
  args: string[];
  timeoutMs: number;
  graceMs?: number;
  env?: NodeJS.ProcessEnv;
}): { pid: number; handle: WatchdogHandle; proc: ReturnType<typeof spawn> } {
  const proc = spawn(options.cmd, options.args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: options.env ?? process.env,
  });
  proc.unref();
  const pid = proc.pid ?? 0;
  const handle = armWatchdog(pid, options.timeoutMs, options.graceMs);
  return { pid, handle, proc };
}
