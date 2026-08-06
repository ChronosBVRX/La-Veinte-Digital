import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { POST } from "../route"
import { withAbortTimeout } from "@/features/asistente/lib/assistant-policy"
import type { User } from "@supabase/supabase-js"

const MOCK_USER = {
  id: "user-123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
} as User

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/consulta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response
}

vi.mock("@/shared/server/auth/require-user", () => ({
  requireUser: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/features/asistente/lib/rag", () => ({
  retrieveTopChunks: vi.fn(() => ["fragmento de prueba"]),
  MIN_COSINE_SIMILARITY: 0.25,
  MAX_RETRIEVED_CHUNKS: 8,
}))

const mockEmbeddingsCreate = vi.fn()
const mockChatCompletionsCreate = vi.fn()

vi.mock("openai", () => ({
  default: vi.fn(function () {
    return {
      embeddings: { create: mockEmbeddingsCreate },
      chat: { completions: { create: mockChatCompletionsCreate } },
    }
  }),
}))

import { requireUser } from "@/shared/server/auth/require-user"
import { createClient } from "@/lib/supabase/server"

describe("POST /api/consulta", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" })
    process.env.OPENAI_API_KEY = "sk-test"
    delete process.env.BOT_API_URL
    delete process.env.BOT_API_SHARED_SECRET

    vi.mocked(requireUser).mockReset()
    vi.mocked(createClient).mockReset()
    mockEmbeddingsCreate.mockReset()
    mockChatCompletionsCreate.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("rechaza petición inválida sin consumir cuota", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    const res = await POST(jsonRequest({ history: [] }))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rechaza pregunta demasiado larga sin consumir cuota", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "x".repeat(2001) }] }))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("consume cuota solo después de validar", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    } as never)
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Respuesta directa" } }],
    } as never)

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "hola" }] }))
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("envía question explícita al bot Python y hace fallback si falla", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    process.env.BOT_API_URL = "https://bot.example.com"
    process.env.BOT_API_SHARED_SECRET = "secret"

    vi.mocked(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse(503, { error: "busy" }))

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    } as never)
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Respuesta fallback" } }],
    } as never)

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "¿Qué dice la cláusula 47?" }] }))
    expect(res.status).toBe(200)

    const pythonCall = vi.mocked(fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(pythonCall[1]?.body as string)
    expect(body.question).toBe("¿Qué dice la cláusula 47?")
    expect(body.history).toHaveLength(1)
  })

  it("devuelve respuesta del bot Python cuando responde", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    process.env.BOT_API_URL = "https://bot.example.com"
    process.env.BOT_API_SHARED_SECRET = "secret"

    vi.mocked(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(200, { respuesta: "Respuesta Python" }),
    )

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "hola" }] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.respuesta).toBe("Respuesta Python")
  })

  it("aplica Cache-Control private, no-store a respuestas exitosas", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    process.env.BOT_API_URL = "https://bot.example.com"
    process.env.BOT_API_SHARED_SECRET = "secret"
    vi.mocked(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(200, { respuesta: "ok" }),
    )

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "hola" }] }))
    expect(res.headers.get("Cache-Control")).toContain("no-store")
  })

  it("usa timeouts independientes para embeddings y chat", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null })
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)

    let embeddingSignal: AbortSignal | undefined
    let chatSignal: AbortSignal | undefined

    mockEmbeddingsCreate.mockImplementation(async (_params, options) => {
      embeddingSignal = options?.signal
      return { data: [{ embedding: new Array(1536).fill(0.01) }] } as never
    })

    mockChatCompletionsCreate.mockImplementation(async (_params, options) => {
      chatSignal = options?.signal
      return { choices: [{ message: { content: "ok" } }] } as never
    })

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "hola" }] }))
    expect(res.status).toBe(200)
    expect(embeddingSignal).toBeDefined()
    expect(chatSignal).toBeDefined()
    expect(embeddingSignal).not.toBe(chatSignal)
  })
})

describe("withAbortTimeout", () => {
  it("resuelve cuando la operación termina antes del timeout", async () => {
    const result = await withAbortTimeout(1000, async () => "ok")
    expect(result).toBe("ok")
  })

  it("aborta la señal cuando se excede el timeout", async () => {
    await expect(
      withAbortTimeout(10, async (signal) => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return signal.aborted ? Promise.reject(new Error("aborted")) : "ok"
      }),
    ).rejects.toThrow("aborted")
  })

  it("limpia el timer si la operación termina rápido", async () => {
    const start = Date.now()
    await withAbortTimeout(10_000, async () => "ok")
    expect(Date.now() - start).toBeLessThan(100)
  })
})
