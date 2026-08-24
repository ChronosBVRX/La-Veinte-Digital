import path from "node:path";
import { ChatterboxEngine } from "./engine";
import { pythonBin } from "./platform";

const globalKey = Symbol.for("normativa.tts.engine");

type G = { engine: ChatterboxEngine | null };

export function getChatterboxEngine(repoRoot: string): ChatterboxEngine {
  const g = globalThis as unknown as Record<symbol, G | undefined>;
  if (!g[globalKey]?.engine) {
    const stateDir = path.join(repoRoot, "data", "tts");
    g[globalKey] = {
      engine: new ChatterboxEngine(
        pythonBin(stateDir),
        path.join(repoRoot, "packages", "tts-core", "engine", "chatterbox_engine.py"),
        stateDir,
        { devicePriority: "AUTO" }
      ),
    };
  }
  return g[globalKey]!.engine!;
}

export function isEngineReady(): boolean {
  const g = globalThis as unknown as Record<symbol, G | undefined>;
  return !!g[globalKey]?.engine?.isRunning;
}
