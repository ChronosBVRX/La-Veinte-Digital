import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { POST } from "../route"
import { withAbortTimeout } from "@/features/asistente/lib/assistant-policy"
import type { User } from "@supabase/supabase-js"
import type { RetrievedSource } from "@/features/asistente/lib/retrieval-sources"

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

vi.mock("@/shared/server/auth/require-user", () => ({ requireUser: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

// Mock completo del motor: la ruta NO debe tocar Supabase ni OpenAI SDK en tests.
vi.mock("@/features/asistente/lib/motor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/asistente/lib/motor")>()
  return {
    ...actual,
    embedQueryLru: vi.fn(),
    retrieveHybrid: vi.fn(),
    buildCompactEvidence: vi.fn((s) => s.map((x: RetrievedSource) => `[${x.id}] ${x.documento}`).join("\n")),
    buildPrompt: vi.fn((i, c, p) => `PROMPT(${i})\n${c}${p ? `\n${p}` : ""}`),
    buildMessages: vi.fn((sys, hist) => [{ role: "system", content: sys }, ...hist]),
  }
})

const SOURCE_FIXTURE = {
  id: "S1",
  chunkId: "CCT-IMSS-SNTSS-2025-2027@V1:10",
  documentId: "CCT-IMSS-SNTSS-2025-2027",
  documento: "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
  version: "CCT-IMSS-SNTSS-2025-2027@V1",
  tipo: "clausula",
  numero: "63 Bis",
  paginaInicio: 44,
  paginaFin: 44,
  fragmento: "fragmento de prueba [S1]",
  sourceUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
  validity: "CURRENT",
  pendingReview: false,
  score: 1000,
}

function streamOf(text: string) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: text } }] }
    },
  }
}

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
import { embedQueryLru, retrieveHybrid, NO_EVIDENCE_RESPONSE } from "@/features/asistente/lib/motor"

describe("POST /api/consulta", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" })
    process.env.OPENAI_API_KEY = "sk-test"
    process.env.OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
    delete process.env.LLM_PROVIDER
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_MODEL
    delete process.env.BOT_API_URL
    delete process.env.BOT_API_SHARED_SECRET

    vi.mocked(requireUser).mockReset()
    vi.mocked(createClient).mockReset()
    vi.mocked(embedQueryLru).mockReset()
    vi.mocked(retrieveHybrid).mockReset()
    mockEmbeddingsCreate.mockReset()
    mockChatCompletionsCreate.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  function standardSetup() {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null } as never)
    vi.mocked(createClient).mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: true, error: null }) } as never)
    vi.mocked(embedQueryLru).mockResolvedValue({ embedding: new Array(1536).fill(0.01), skipped: false, cacheHit: false, ms: 10 })
    vi.mocked(retrieveHybrid).mockResolvedValue({ sources: [{ ...SOURCE_FIXTURE, fragmento: "texto [S1]" }], rpcMs: 20, rpcCalls: 1 })
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0.01) }] } as never)
    mockChatCompletionsCreate.mockResolvedValue(streamOf("Respuesta pgvector [S1]"))
  }

  it("rechaza petición inválida sin consumir cuota", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null } as never)
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)
    const res = await POST(jsonRequest({ history: [] }))
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("ESTRUCTURA: EXACT_LOOKUP → 0 embeddings, 0 LLM (fast path)", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null } as never)
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)
    // EXACT_LOOKUP: no se llama embedding ni LLM, solo retrieveHybrid
    vi.mocked(retrieveHybrid).mockResolvedValue({ sources: [{ ...SOURCE_FIXTURE }], rpcMs: 20, rpcCalls: 1 })

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "Muéstrame la cláusula 63 Bis" }] }))
    expect(res.status).toBe(200)
    expect(embedQueryLru).not.toHaveBeenCalled()
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled()
    expect(retrieveHybrid).toHaveBeenCalledTimes(1)
    const data = await res.json()
    expect(data.respuesta).toContain("63 Bis")
  })

  it("ESTRUCTURA: sin evidencia → 0 LLM (fail closed)", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null } as never)
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)
    vi.mocked(embedQueryLru).mockResolvedValue({ embedding: new Array(1536).fill(0.01), skipped: false, cacheHit: false, ms: 10 })
    vi.mocked(retrieveHybrid).mockResolvedValue({ sources: [], rpcMs: 20, rpcCalls: 1 })

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "cosas raras" }] }))
    expect(res.status).toBe(200)
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled()
    const data = await res.json()
    expect(data.fuentes).toEqual([])
    expect(data.respuesta).toBe(NO_EVIDENCE_RESPONSE)
  })

  it("ESTRUCTURA: evidencia irrelevante (score bajo) → 0 LLM (fail closed por umbral)", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null } as never)
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)
    vi.mocked(embedQueryLru).mockResolvedValue({ embedding: new Array(1536).fill(0.01), skipped: false, cacheHit: false, ms: 10 })
    // score=30 < umbral 140 → no-evidence
    vi.mocked(retrieveHybrid).mockResolvedValue({ sources: [{ ...SOURCE_FIXTURE, score: 30 }], rpcMs: 20, rpcCalls: 1 })

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "pregunta sin respaldo" }] }))
    expect(res.status).toBe(200)
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled()
    const data = await res.json()
    expect(data.fuentes).toEqual([])
    expect(data.respuesta).toBe(NO_EVIDENCE_RESPONSE)
  })

  it("ESTRUCTURA: SPECIFIC_TOPIC → ≤1 embedding, ≤1 LLM, híbrido 1 RPC", async () => {
    standardSetup()
    const res = await POST(jsonRequest({ history: [{ role: "user", content: "¿Cuántos días de vacaciones tengo?" }] }))
    expect(res.status).toBe(200)
    expect(embedQueryLru).toHaveBeenCalledTimes(1)
    expect(retrieveHybrid).toHaveBeenCalledTimes(1)
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1)
  })

  it("ESTRUCTURA: INTENT determinista sin LLM (route directa)", async () => {
    standardSetup()
    const res = await POST(jsonRequest({ history: [{ role: "user", content: "Mi jefe me amenaza" }] }))
    expect(res.status).toBe(200)
    // Sin segundo LLM: una sola llamada de chat.
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1)
  })

  it("ESTRUCTURA: CHIPS deterministas sin LLM extra", async () => {
    standardSetup()
    const res = await POST(jsonRequest({ history: [{ role: "user", content: "Mi jefe me amenaza" }] }))
    const data = await res.json()
    expect(Array.isArray(data.chips)).toBe(true)
    expect(data.chips.length).toBeGreaterThan(0)
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1)
  })

  it("ESTRUCTURA: la pregunta actual NO se duplica en messages", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null } as never)
    vi.mocked(createClient).mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: true, error: null }) } as never)
    vi.mocked(embedQueryLru).mockResolvedValue({ embedding: new Array(1536).fill(0.01), skipped: false, cacheHit: false, ms: 10 })
    vi.mocked(retrieveHybrid).mockResolvedValue({ sources: [{ ...SOURCE_FIXTURE }], rpcMs: 20, rpcCalls: 1 })

    let echoed: Array<{ role: string; content: string }> = []
    mockChatCompletionsCreate.mockImplementation(async (_p: { messages: Array<{ role: string; content: string }> }) => {
      echoed = _p.messages
      return streamOf("resp [S1]")
    })

    await POST(jsonRequest({ history: [{ role: "user", content: "Mi jefe me amenaza" }] }))
    // 'Mi jefe me amenaza' debe aparecer UNA sola vez como user.
    const userMsgs = (echoed ?? []).filter((m) => m.role === "user").map((m) => m.content)
    expect(userMsgs.filter((c: string) => c === "Mi jefe me amenaza").length).toBeLessThanOrEqual(1)
  })

  it("ESTRUCTURA: la cuota se incrementa una sola vez aunque exista retry interno", async () => {
    // El mock de createClient devuelve SIEMPRE el mismo objeto con el mismo rpc;
    // así contamos todas las llamadas RPC (cuota + hybrid) contra un solo spy.
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null } as never)
    vi.mocked(createClient).mockResolvedValue({ rpc } as never)
    vi.mocked(embedQueryLru).mockResolvedValue({ embedding: new Array(1536).fill(0.01), skipped: false, cacheHit: false, ms: 10 })
    vi.mocked(retrieveHybrid).mockResolvedValue({ sources: [{ ...SOURCE_FIXTURE }], rpcMs: 20, rpcCalls: 1 })
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0.01) }] } as never)
    mockChatCompletionsCreate.mockResolvedValue(streamOf("resp [S1]"))

    await POST(jsonRequest({ history: [{ role: "user", content: "vacaciones" }] }))
    // Cuota = exactamente UNA llamada a increment_api_usage, pese a que
    // retrieveHybrid también abre un cliente. Ningún retry interno vuelve a
    // incrementar la cuota (punto 19).
    const quotaCalls = rpc.mock.calls.filter((c) => c[0] === "increment_api_usage")
    expect(quotaCalls.length).toBe(1)
  })

  it("ESTRUCTURA: validación de citas no usa judge LLM separado", async () => {
    standardSetup()
    mockChatCompletionsCreate.mockResolvedValue(streamOf("inventado [S9] y válido [S1]"))
    const res = await POST(jsonRequest({ history: [{ role: "user", content: "vacaciones" }] }))
    const data = await res.json()
    expect(data.respuesta).not.toContain("[S9]")
    expect(data.respuesta).toContain("[S1]")
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1)
  })

  it("consume cuota solo una vez y devuelve fuentes", async () => {
    standardSetup()
    const res = await POST(jsonRequest({ history: [{ role: "user", content: "vacaciones" }] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.fuentes)).toBe(true)
    expect(data.fuentes[0].documento).toContain("IMSS-SNTSS")
  })

  it("aplica Cache-Control private, no-store", async () => {
    standardSetup()
    const res = await POST(jsonRequest({ history: [{ role: "user", content: "vacaciones" }] }))
    expect(res.headers.get("Cache-Control")).toContain("no-store")
  })

  it("recomienda herramientas nativas de la plataforma en los chips según el tema", async () => {
    standardSetup()
    const res = await POST(jsonRequest({ history: [{ role: "user", content: "¿Cómo calcular mis horas extras?" }] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.chips)).toBe(true)
    expect(data.chips.some((c: string) => c.includes("Horas Extra"))).toBe(true)
  })

  it("soporta LLM_PROVIDER=deepseek con DEEPSEEK_API_KEY aunque no exista OPENAI_API_KEY", async () => {
    standardSetup()
    delete process.env.OPENAI_API_KEY
    process.env.LLM_PROVIDER = "deepseek"
    process.env.DEEPSEEK_API_KEY = "ds-test-key"
    process.env.DEEPSEEK_MODEL = "deepseek-chat"

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "¿Cuántos días de vacaciones tengo?" }] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.respuesta).toContain("[S1]")
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "deepseek-chat" }),
      expect.anything(),
    )
  })

  it("prioriza DeepSeek como fuente de verdad aunque exista una OPENAI_API_KEY residual en el entorno", async () => {
    standardSetup()
    process.env.OPENAI_API_KEY = "sk-old-empty-credits"
    process.env.DEEPSEEK_API_KEY = "ds-test-key"
    process.env.DEEPSEEK_MODEL = "deepseek-chat"

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "¿Cuántos días de vacaciones tengo?" }] }))
    expect(res.status).toBe(200)
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "deepseek-chat" }),
      expect.anything(),
    )
  })

  it("responde definición de concepto (ej. concepto 022) aunque el trabajador aún no tenga tarjetón subido", async () => {
    standardSetup()
    const res = await POST(jsonRequest({ history: [{ role: "user", content: "¿Qué es el concepto 022 en mi tarjetón?" }] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.fuentes.some((f: { documento: string }) => f.documento.includes("Concepto 022"))).toBe(true)
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1)
  })

  it("conserva el contexto del turno previo en seguimientos anafóricos aunque sean SPECIFIC_TOPIC", async () => {
    standardSetup()
    await POST(
      jsonRequest({
        history: [
          { role: "user", content: "Soy técnico radiólogo 08 y llevo 6 meses" },
          { role: "assistant", content: "Con gusto te oriento [S1]." },
          { role: "user", content: "¿Y cuántos días de vacaciones me corresponden?" },
        ],
      }),
    )
    expect(retrieveHybrid).toHaveBeenCalledWith(
      expect.stringContaining("Soy técnico radiólogo 08"),
      expect.anything(),
      "SPECIFIC_TOPIC",
      expect.anything(),
      8,
      "¿Y cuántos días de vacaciones me corresponden?",
    )
  })

  it("NO permite que worker_tarjeton burle el fail-closed en preguntas fuera de tema", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null } as never)
    const fakeSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from: vi.fn((table: string) => {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () =>
            table === "profiles"
              ? { data: { full_name: "Ana Pérez", matricula: "123", categoria: "ENFERMERA", antiguedad: "5", adscripcion: "HGR" }, error: null }
              : table === "imported_payslips"
                ? { data: { id: "ps-1", period_raw: "1A-OCT-2026", employee_number: "123", total_earnings: 12000, total_deductions: 2000, net_pay: 10000 }, error: null }
                : { data: null, error: null },
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
        }
        return chain
      }),
    }
    vi.mocked(createClient).mockResolvedValue(fakeSupabase as never)
    vi.mocked(embedQueryLru).mockResolvedValue({ embedding: new Array(1536).fill(0.01), skipped: false, cacheHit: false, ms: 10 })
    vi.mocked(retrieveHybrid).mockResolvedValue({ sources: [], rpcMs: 15, rpcCalls: 1 })

    const res = await POST(jsonRequest({ history: [{ role: "user", content: "¿Cuál es la capital de Francia?" }] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.respuesta).toBe(NO_EVIDENCE_RESPONSE)
    expect(data.fuentes).toEqual([])
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled()
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
})
