import { describe, expect, it } from "vitest"
import { validateCasting, voiceIdentityCacheKey } from "@la-veinte/radio-core"

const BASE = {
  provider: "chatterbox-local",
  modelId: "Chatterbox-Multilingual-es-mx-latam",
  modelRevision: "t3_es_mx_latam",
  generationSettings: {},
}

describe("validateCasting (procedencia vocal)", () => {
  it("misma fuente con SHA distintos → CASTING_SOURCE_DUPLICATED", () => {
    const r = validateCasting([
      { id: "EDUARDO", displayName: "Eduardo", role: "conductor", referenceAudioSha256: "sha-rate-2", voiceSourceId: "sapi:Microsoft-Sabina-Desktop" },
      { id: "ANDREA", displayName: "Andrea", role: "co-conductor", referenceAudioSha256: "sha-rate-1", voiceSourceId: "sapi:Microsoft-Sabina-Desktop" },
    ])
    expect(r.ok).toBe(false)
    expect(r.estado).toBe("CASTING_SOURCE_DUPLICATED")
    expect(r.mensaje).toMatch(/misma voz de origen/)
  })

  it("fuentes distintas → PASS", () => {
    const r = validateCasting([
      { id: "EDUARDO", displayName: "Eduardo", role: "conductor", referenceAudioSha256: "a", voiceSourceId: "chatterbox:builtin-multilingual" },
      { id: "ANDREA", displayName: "Andrea", role: "co-conductor", referenceAudioSha256: "b", voiceSourceId: "sapi:Microsoft-Sabina-Desktop" },
    ])
    expect(r.ok).toBe(true)
    expect(r.estado).toBe("PASS")
  })

  it("narrador puede compartir fuente con co-conductora (mismo perfil)", () => {
    const r = validateCasting([
      { id: "ANDREA", displayName: "Andrea", role: "co-conductor", referenceAudioSha256: "b", voiceSourceId: "sapi:Microsoft-Sabina-Desktop" },
      { id: "NARRADOR", displayName: "Narrador", role: "narrador", referenceAudioSha256: "b", voiceSourceId: "sapi:Microsoft-Sabina-Desktop" },
    ])
    // El narrador y la co-conductora comparten fuente: se permite si el usuario lo define.
    expect(r.ok).toBe(true)
  })
})

describe("voiceIdentityCacheKey", () => {
  it("el mismo texto con voces de origen distintas genera claves distintas", async () => {
    const kA = await voiceIdentityCacheKey({ text: "Exactamente.", profile: { id: "EDUARDO", ...BASE, referenceAudioSha256: "b4bfa8e8" } })
    const kB = await voiceIdentityCacheKey({ text: "Exactamente.", profile: { id: "ANDREA", ...BASE, referenceAudioSha256: "ef75a924" } })
    expect(kA).not.toBe(kB)
  })

  it("misma voz y mismo texto → clave igual (reproducibilidad)", async () => {
    const a = await voiceIdentityCacheKey({ text: "Hola.", profile: { id: "EDUARDO", ...BASE, referenceAudioSha256: "x" } })
    const b = await voiceIdentityCacheKey({ text: "Hola.", profile: { id: "EDUARDO", ...BASE, referenceAudioSha256: "x" } })
    expect(a).toBe(b)
  })

  it("cambia la referencia (SHA) → cambia la clave aunque el texto sea igual", async () => {
    const a = await voiceIdentityCacheKey({ text: "Hola.", profile: { id: "EDUARDO", ...BASE, referenceAudioSha256: "x1" } })
    const b = await voiceIdentityCacheKey({ text: "Hola.", profile: { id: "EDUARDO", ...BASE, referenceAudioSha256: "x2" } })
    expect(a).not.toBe(b)
  })
})
