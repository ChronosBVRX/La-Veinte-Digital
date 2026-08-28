import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { armWatchdog, killProcessGroup, processAlive } from "../watchdog";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isAlive(pid: number | undefined): boolean {
  return pid != null && processAlive(pid);
}

describe("watchdog Qwen (hang simulado, sin esperar hang real)", () => {
  it("mata SOLO su process group al agotarse (timeout inyectado a 1s) y no toca a otros procesos", async () => {
    // Trabajador falso que nunca termina → simula un Qwen colgado (propio group).
    const worker = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { detached: true, stdio: "ignore" });
    worker.unref();
    const workerPid = worker.pid;
    expect(isAlive(workerPid)).toBe(true);
    await sleep(150);

    // Testigo ajeno (otro proceso) que NO debe morir.
    const bystander = spawn(process.execPath, ["-e", "setTimeout(() => {}, 12000)"], { stdio: "ignore" });
    const bystanderPid = bystander.pid;
    expect(isAlive(bystanderPid)).toBe(true);

    // Watchdog con timeout 1s (inyectado, no 180s).
    const handle = armWatchdog(workerPid!, 1000, 1500);

    // El trabajador debe morir por el watchdog (~1.3s).
    const t0 = Date.now();
    while (Date.now() - t0 < 5000 && isAlive(workerPid)) await sleep(50);
    expect(handle.fired()).toBe(true);
    expect(isAlive(workerPid)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(5000);

    // El testigo sigue vivo → no se mataron procesos ajenos.
    expect(isAlive(bystanderPid)).toBe(true);

    // limpiar
    handle.cancel();
    try { killProcessGroup(bystanderPid!, "SIGTERM"); } catch { /* ya murió */ }
  });

  it("no dispara si el proceso termina a tiempo (cancel del watchdog)", async () => {
    const worker = spawn(process.execPath, ["-e", "setTimeout(() => {}, 400)"], { detached: true, stdio: "ignore" });
    worker.unref();
    const workerPid = worker.pid;
    const handle = armWatchdog(workerPid!, 2000, 1500);
    // el proceso termina solo antes del timeout
    while (Date.now() >= 0 && isAlive(workerPid)) await sleep(50); // espera a que termine
    await sleep(100);
    expect(handle.fired()).toBe(false);
    handle.cancel();
  });
});
