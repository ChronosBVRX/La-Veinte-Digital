import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { detectHardware, configForProfile, type TtsPreset } from "@la-veinte/tts-core"
import { getChatterboxEngine } from "@la-veinte/tts-core"
import { sentenceAwareChunk } from "@la-veinte/tts-core"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function benchmarkSummary(repoRoot: string): Record<string, unknown> | null {
  const p = path.join(repoRoot, "data", "tts", "benchmark", "benchmark-report.json")
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const repo = process.cwd()
  const hw = await detectHardware()
  const config = configForProfile(hw, (process.env.TTS_PRESET as TtsPreset) ?? "BALANCED")
  const engine = getChatterboxEngine(repo)
  let engineStatus = null
  try {
    engineStatus = engine.isRunning ? await engine.status() : { loaded: false }
  } catch {
    engineStatus = { loaded: false, error: "sin respuesta del motor" }
  }

  return privateJson({
    hardware: hw,
    profile: hw.profile,
    config,
    benchmark: benchmarkSummary(repo),
    engine: {
      running: engine.isRunning,
      cache: { hits: engine.cacheHits, misses: engine.cacheMisses, entries: engine.cache.stats().entries },
      status: engineStatus,
      warningLowVram: hw.profile === "LAPTOP_LOW_VRAM_NVIDIA" ? "GPU de 4 GB — AI Radio Studio está utilizando un perfil optimizado para memoria reducida." : null,
      batteryWarning: hw.isBattery ? "⚠ Generación local de voz — Chatterbox puede consumir bastante energía. Para producción larga se recomienda conectar la laptop." : null,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { action?: string; text?: string; voice?: string; blocks?: Array<{ id: string; text: string; voice: string }> }
  try {
    body = await req.json()
  } catch {
    return privateJsonError(400, "Cuerpo JSON inválido", crypto.randomUUID(), "bad_request")
  }

  const repo = process.cwd()
  const engine = getChatterboxEngine(repo)

  if (body.action === "restart") {
    try {
      await engine.restart()
      return privateJson({ restarted: true, running: engine.isRunning })
    } catch (e) {
      return privateJsonError(500, e instanceof Error ? e.message : "reinicio fallido", crypto.randomUUID(), "engine_error")
    }
  }

  if (body.action === "start" || !engine.isRunning) {
    try {
      const guard = await engine.vramGuardSnapshot();
      const hw = await detectHardware();
      const freeMb = guard.free ?? (hw.gpu.vramFreeMb ?? 0);
      const gpuBusyWarning =
        hw.gpu.name && freeMb > 0 && freeMb < 3600
          ? "La GPU está siendo utilizada por otra aplicación. Cierra aplicaciones que utilicen aceleración gráfica o utiliza CPU."
          : null;
      await engine.start()
      const warmup = await engine.warmup()
      if (!warmup.ok) {
        return privateJson({ started: false, warmup, running: engine.isRunning, gpuBusyWarning })
      }
      return privateJson({ started: true, warmup, running: engine.isRunning, gpuBusyWarning })
    } catch (e) {
      return privateJsonError(500, e instanceof Error ? e.message : "no se pudo iniciar el motor", crypto.randomUUID(), "engine_error")
    }
  }

  if (Array.isArray(body.blocks) && body.blocks.length > 0) {
    const results = []
    for (const b of body.blocks) {
      const chunks = sentenceAwareChunk(b.text, 120, 220)
      for (const c of chunks) {
        const r = await engine.generate(c, b.voice === "MARIANA" ? "B" : "A")
        results.push({ blockId: b.id, chunk: c, ...r })
      }
    }
    return privateJson({ results, cache: { hits: engine.cacheHits, misses: engine.cacheMisses } })
  }

  if (typeof body.text === "string" && body.text.trim()) {
    const voice = body.voice === "MARIANA" ? "B" : "A"
    const r = await engine.generate(body.text.trim(), voice)
    return privateJson({ result: r })
  }

  return privateJsonError(400, "acción desconocida", crypto.randomUUID(), "bad_request")
}
