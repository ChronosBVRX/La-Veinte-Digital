import { describe, expect, it } from "vitest"
import { sentenceAwareChunk, blockCacheKey, BlockCache } from "@la-veinte/tts-core"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

describe("SentenceAwareChunker", () => {
  it("no corta texto corto", () => {
    expect(sentenceAwareChunk("Frase corta.", 120, 220)).toEqual(["Frase corta."])
  })

  it("divide en límites de oración dentro del rango", () => {
    const text =
      "Primera oración completa con algo de contenido adicional para extender el texto. Segunda oración también con más palabras para llegar al límite establecido. Tercera oración que agrega todavía más contenido. Cuarta y última oración del bloque para terminar bien."
    const chunks = sentenceAwareChunk(text, 120, 220)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(230)
      expect(c).not.toMatch(/\s$/)
    }
    expect(chunks.join(" ").replace(/\s+/g, " ").trim()).toBe(text.replace(/\s+/g, " ").trim())
  })

  it("prioriza punto y coma y coma si no hay punto", () => {
    const text = Array(10).fill("segmento uno, segmento dos; segmento tres").join(" ")
    const chunks = sentenceAwareChunk(text, 120, 220)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(230)
    }
  })

  it("no corta palabras cuando no hay puntuación", () => {
    const text = Array(40).fill("palabralarga").join(" ")
    const chunks = sentenceAwareChunk(text, 120, 220)
    for (const c of chunks) {
      expect(c).toMatch(/(^| )palabralarga( |$)/)
    }
  })
})

describe("BlockCache", () => {
  it("clave estable y dependiente de todos los parámetros", async () => {
    const a = await blockCacheKey({ provider: "chatterbox-local", model: "m", device: "cuda", voice: "A", text: "hola" })
    const b = await blockCacheKey({ provider: "chatterbox-local", model: "m", device: "cuda", voice: "A", text: "hola" })
    const c = await blockCacheKey({ provider: "chatterbox-local", model: "m", device: "cuda", voice: "B", text: "hola" })
    const d = await blockCacheKey({ provider: "chatterbox-local", model: "m", device: "cuda", voice: "A", text: "hola " })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe(d)
  })

  it("put/get con persistencia", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lv-cache-"))
    const cache = new BlockCache(dir)
    const key = await blockCacheKey({ provider: "p", model: "m", device: "cuda", voice: "A", text: "x" })
    const wav = path.join(dir, "x.wav")
    fs.writeFileSync(wav, "fake")
    cache.put(key, { provider: "p", model: "m", device: "cuda", voice: "A", text: "x", wavPath: wav, createdAt: new Date().toISOString() })
    const got = cache.get(key)
    expect(got?.wavPath).toBe(wav)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
