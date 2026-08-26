import { NextResponse, type NextRequest } from "next/server"
import { execFile } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJsonError } from "@/shared/lib/api-response"
import { cleanTtsText, qwenRenderLine } from "@la-veinte/tts-core"

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

  const voces = body.voces ?? {}
  void voces

  const wavs: string[] = []
  let resolvedBlocks = 0
  const tmpCache = path.join(process.cwd(), "data", "tts", "cache")
  fs.mkdirSync(tmpCache, { recursive: true })

  try {
    for (const s of escenas) {
      const wav = await qwenRenderLine(cleanTtsText(s.linea), s.locutor, Math.abs(1 + s.linea.length * 13) % 100000)
      if (wav) {
        wavs.push(wav)
        resolvedBlocks++
      }
    }

    if (wavs.length === 0) {
      return privateJsonError(502, "Qwen no generó ningún fragmento de audio", crypto.randomUUID(), "tts_error")
    }

    const outMp3 = path.join(tmpCache, `episodio-${Date.now()}.mp3`)
    await concatWavsToMp3(wavs, outMp3)
    const mp3 = fs.readFileSync(outMp3)
    fs.rmSync(outMp3, { force: true })

    return new NextResponse(new Uint8Array(mp3), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="episodio-la-veinte.mp3"`,
        "Cache-Control": "private, no-store",
        "X-Audio-Engine": "qwen-base-clone",
        "X-Audio-Model": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "X-Audio-Device": "cuda",
        "X-Qwen-Blocks": String(resolvedBlocks),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return privateJsonError(
      502,
      `Qwen no pudo generar (${msg.slice(0, 160)}).`,
      crypto.randomUUID(),
      "qwen_error"
    )
  }
}
