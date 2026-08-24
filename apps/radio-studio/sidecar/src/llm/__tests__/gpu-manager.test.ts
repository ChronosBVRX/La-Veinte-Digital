import { describe, expect, it } from "vitest";
import { getGpuManager, withGpu } from "../gpu-manager";

describe("GpuResourceManager", () => {
  it("exclusión mutua: tts espera mientras llm activo", async () => {
    const mgr = getGpuManager();
    const orden: string[] = [];
    const t1 = withGpu("llm", async () => {
      orden.push("llm-start");
      await new Promise((r) => setTimeout(r, 50));
      orden.push("llm-end");
    });
    await new Promise((r) => setTimeout(r, 10));
    const t2 = withGpu("tts", async () => {
      orden.push("tts-start");
    });
    await Promise.all([t1, t2]);
    expect(orden.indexOf("llm-end")).toBeLessThan(orden.indexOf("tts-start"));
    expect(mgr.state).toBe("IDLE");
  });

  it("re-entrante para el mismo dueño", async () => {
    await withGpu("llm", async () => {
      await withGpu("llm", async () => { /* ok sin deadlock */ });
    });
  });

  it("timeout si el dueño no libera", async () => {
    // ocupar con lock interno directo para simular dueño colgado
    const mgr = getGpuManager();
    await mgr.acquire("llm");
    await expect(mgr.acquire("tts", 30)).rejects.toThrow("GPU_TIMEOUT");
    mgr.release("llm");
  });

  it("libera aunque la tarea falle", async () => {
    await expect(withGpu("tts", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(getGpuManager().current).toBeNull();
    expect(getGpuManager().state).toBe("IDLE");
  });
});
