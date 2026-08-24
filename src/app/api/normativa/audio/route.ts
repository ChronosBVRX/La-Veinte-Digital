import { NextResponse, type NextRequest } from "next/server"
import { execFile } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJsonError } from "@/shared/lib/api-response"
import { synthesizeMp3, DEFAULT_VOICES, cleanTtsText, pythonBin } from "@la-veinte/tts-core"
import { getChatterboxEngine } from "@la-veinte/tts-core"
import { sentenceAwareChunk } from "@la-veinte/tts-core"

export const runtime = "nodejs"

const execFileAsync = promisify(execFile)

async function findFfmpeg(): Promise<string> {
  const candidates = ["ffmpeg", path.join(os.homedir(), "AppData", "Local", "ffmpeg", "ffmpeg-8.1.1-essentials_build", "bin", "ffmpeg.exe")]
  for (const c of candidates) {
    try {
      await execFileAsync(c, ["-version"], { timeout: 10000 })
      return c
    } catch { /* probar siguiente */ }
  }
  throw new Error("ffmpeg no disponible")
}

async function concatWavsToMp3(wavs: string[], outMp3: string): Promise<void> {
  const ffmpeg = await findFfmpeg()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lv-master-"))
  try {
    const list = path.join(tmp, "list.txt")
    fs.writeFileSync(list, wavs.map((w) => `file '${w.replace(/'/g, "'\\''")}'`).join("\n"))
    await execFileAsync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-codec:a", "libmp3lame", "-b:a", "128k", outMp3], { timeout: 600000 })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { escenas?: Array<{ locutor: string; linea: string }>; engine?: string; voces?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return privateJsonError(400, "Cuerpo JSON inválido", crypto.randomUUID(), "bad_request")
  }

  const escenas = Array.isArray(body.escenas) ? body.escenas : []
  if (escenas.length === 0) {
    return privateJsonError(400, "No hay escenas para sintetizar", crypto.randomUUID(), "bad_request")
  }

  const requestedEngine = body.engine ?? "auto"
  const voces = body.voces ?? {}
  const voiceFor = (locutor: string) => voces[locutor] ?? (locutor.toUpperCase().includes("MARIANA") ? DEFAULT_VOICES.MARIANA.id : DEFAULT_VOICES.EDUARDO.id)

  const useChatterbox =
    requestedEngine === "chatterbox" ||
    (requestedEngine === "auto" && fs.existsSync(pythonBin(path.join(process.cwd(), "data", "tts"))))

  if (useChatterbox) {
    const engine = getChatterboxEngine(process.cwd())
    const wavs: string[] = []
    let chatterboxBlocks = 0
    let fallbackBlocks = 0
    const fallbackLines: Array<{ text: string; voice: string }> = []

    try {
      if (!engine.isRunning) {
        await engine.start()
        const warmup = await engine.warmup()
        if (!warmup.ok) throw new Error(`warmup falló: ${warmup.error ?? "desconocido"}`)
      }

      for (const s of escenas) {
        const chunks = sentenceAwareChunk(cleanTtsText(s.linea), 120, 220)
        for (const c of chunks) {
          const r = await engine.generate(c, s.locutor.toUpperCase().includes("MARIANA") ? "B" : "A")
          if (r.ok && r.path) {
            wavs.push(r.path)
            chatterboxBlocks++
          } else {
            fallbackBlocks++
            fallbackLines.push({ text: c, voice: voiceFor(s.locutor) })
          }
        }
      }

      if (fallbackLines.length > 0) {
        const fb = await synthesizeMp3(fallbackLines.map((l) => ({ text: l.text, voice: l.voice })))
        const fbFile = path.join(process.cwd(), "data", "tts", "cache", `fallback-${Date.now()}.mp3`)
        fs.writeFileSync(fbFile, fb.mp3)
        wavs.push(fbFile)
      }

      const outMp3 = path.join(process.cwd(), "data", "tts", "cache", `episodio-${Date.now()}.mp3`)
      await concatWavsToMp3(wavs, outMp3)
      const mp3 = fs.readFileSync(outMp3)
      fs.rmSync(outMp3, { force: true })

      return new NextResponse(new Uint8Array(mp3), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Disposition": `inline; filename="episodio-la-veinte.mp3"`,
          "Cache-Control": "private, no-store",
          "X-Audio-Engine": fallbackBlocks > 0 ? "mixed" : "chatterbox-local",
          "X-Audio-Model": "ResembleAI/Chatterbox-Multilingual-es-mx-latam",
          "X-Audio-Device": "cuda",
          "X-Chatterbox-Blocks": String(chatterboxBlocks),
          "X-Fallback-Blocks": String(fallbackBlocks),
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return privateJsonError(
        502,
        `Chatterbox no pudo generar (${msg.slice(0, 160)}). Usa el motor fallback (edge/SAPI) o reintenta.`,
        crypto.randomUUID(),
        "chatterbox_error"
      )
    }
  }

  const lines = escenas.map((s) => ({ text: cleanTtsText(s.linea), voice: voiceFor(s.locutor) }))
  try {
    const result = await synthesizeMp3(lines)
    return new NextResponse(new Uint8Array(result.mp3), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="episodio-la-veinte.mp3"`,
        "Cache-Control": "private, no-store",
        "X-Audio-Engine": result.engine,
        "X-Audio-Device": "cpu/network",
        "X-Audio-Model": "edge-tts/sapi",
      },
    })
  } catch (err) {
    return privateJsonError(502, `Síntesis de voz falló: ${err instanceof Error ? err.message : String(err)}`, crypto.randomUUID(), "tts_error")
  }
}
