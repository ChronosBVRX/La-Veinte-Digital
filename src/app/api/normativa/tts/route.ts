import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { detectHardware, configForProfile, type TtsPreset } from "@la-veinte/tts-core"
import { QwenEngine } from "@la-veinte/tts-core"
import { sentenceAwareChunk, cleanTtsText } from "@la-veinte/tts-core"

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

function engineFor(repo: string): QwenEngine {
  return new QwenEngine(repo, "", path.join(repo, "data", "tts"))
}

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const repo = process.cwd()
  const hw = await detectHardware()
  const config = configForProfile(hw, (process.env.TTS_PRESET as TtsPreset) ?? "BALANCED")

  return privateJson({
    hardware: hw,
    profile: hw.profile,
    config,
    benchmark: benchmarkSummary(repo),
    engine: {
      running: true,
      provider: "qwen-base-clone",
      model: "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
      warningLowVram: hw.profile === "LAPTOP_LOW_VRAM_NVIDIA" ? "GPU de 4 GB — AI Radio Studio está utilizando un perfil optimizado para memoria reducida." : null,
      batteryWarning: hw.isBattery ? "⚠ Generación local de voz — Qwen puede consumir bastante energía. Para producción larga se recomienda conectar la laptop." : null,
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

  const engine = engineFor(process.cwd())

  if (body.action === "start" || body.action === "restart") {
    await engine.start()
    const warmup = await engine.warmup()
    return privateJson({ started: true, warmup, running: engine.isRunning })
  }

  if (body.action === "stop") {
    await engine.shutdown()
    return privateJson({ started: false, running: engine.isRunning })
  }

  if (Array.isArray(body.blocks) && body.blocks.length > 0) {
    const results = []
    for (const b of body.blocks) {
      const chunks = sentenceAwareChunk(cleanTtsText(b.text), 120, 220)
      for (const c of chunks) {
        const r = await engine.generate(c, b.voice === "MARIANA" ? "B" : "A", { seed: Math.abs(c.length * 17) % 100000 })
        results.push({ blockId: b.id, chunk: c, ...r })
      }
    }
    return privateJson({ results })
  }

  if (typeof body.text === "string" && body.text.trim()) {
    const voice = body.voice === "MARIANA" ? "B" : "A"
    const r = await engine.generate(cleanTtsText(body.text.trim()), voice, { seed: Math.abs(body.text.length * 13) % 100000 })
    return privateJson({ result: r })
  }

  return privateJsonError(400, "acción desconocida", crypto.randomUUID(), "bad_request")
}
