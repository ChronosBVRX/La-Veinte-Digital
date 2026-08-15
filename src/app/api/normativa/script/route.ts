import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"
import { classifyClaimType } from "@/features/normativa/services/evidence"
import { availableProviders, buildScriptFromEvidence, resolveProvider } from "@/features/normativa/services/llm-provider"
import type { EpisodeEvidencePack } from "@/features/normativa/core/types"

export const runtime = "nodejs"

const GUIONISTA_SYSTEM = `Eres el GUIONISTA de un programa de radio para trabajadores del IMSS. No eres el investigador.

Recibes un PAQUETE DE EVIDENCIA documental ya verificado. No puedes:
- cambiar el significado jurídico de la evidencia;
- añadir derechos, requisitos, cantidades o plazos que no estén sustentados;
- inventar cláusulas, artículos, páginas, fechas, conceptos o procedimientos.

Puedes:
- hacer natural la conversación entre dos locutores (EDUARDO y MARIANA);
- añadir preguntas, transiciones, ejemplos hipotéticos claramente identificados ("por ejemplo, imaginemos que…");
- explicar con palabras sencillas.

Distinguir siempre texto documental de explicación o ejemplo. Para cada afirmación normativa importante, indica la cita (documento, cláusula/artículo, página) usando SOLO los índices de citas del paquete de evidencia.

Devuelve ÚNICAMENTE JSON válido con esta estructura:
{
  "titulo": "...",
  "escenas": [
    {
      "locutor": "EDUARDO" | "MARIANA",
      "linea": "texto natural para radio",
      "citas": ["C1", "C3"]
    }
  ]
}`

interface ScriptLine {
  locutor: string
  linea: string
  citas: string[]
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: { topic?: string; evidencePack?: EpisodeEvidencePack; provider?: string }
  try {
    body = await req.json()
  } catch {
    return privateJsonError(400, "Cuerpo JSON inválido", crypto.randomUUID(), "bad_request")
  }
  const topic = typeof body.topic === "string" ? body.topic.trim() : ""
  if (!topic || !body.evidencePack) {
    return privateJsonError(400, "Se requiere topic y evidencePack", crypto.randomUUID(), "bad_request")
  }

  const pack = body.evidencePack
  const citationIndex: Record<string, { text: string; documentId: string; pdfPage: number | null; clause: string | null; article: string | null }> = {}
  const evidenceLines: string[] = []
  pack.claims.forEach((c, i) => {
    const id = `C${i + 1}`
    const e = c.evidence[0]
    citationIndex[id] = {
      text: c.text.slice(0, 500),
      documentId: e?.documentId ?? "?",
      pdfPage: e?.pdfPage ?? null,
      clause: e?.clause ?? null,
      article: e?.article ?? null,
    }
    evidenceLines.push(
      `${id} | ${e?.documentId ?? "?"}${e?.clause ? ` Cláusula ${e.clause}` : ""}${e?.article ? ` Artículo ${e.article}` : ""}${e?.pdfPage != null ? ` pág.${e.pdfPage}` : ""} | ${c.text.slice(0, 500)}`
    )
  })

  let script: { titulo: string; escenas: ScriptLine[] }
  let providerName: string | null = null

  const provider = resolveProvider(body.provider)
  if (provider) {
    providerName = provider.name
    const userContent = `TEMA DEL EPISODIO: ${topic}

DOCUMENTOS UTILIZADOS (versiones congeladas):
${pack.documents.map((d) => `- ${d.id} | ${d.title} | versión ${d.versionLabel} | reforma ${d.lastReformDate ?? "n/a"}`).join("\n")}

CITAS DISPONIBLES (única fuente autorizada para afirmaciones):
${evidenceLines.map((l) => `- ${l}`).join("\n")}

Instrucciones: escribe un guion de radio de 4 a 7 escenas con dos locutores. Cada línea que afirme una regla, derecho, requisito o cantidad debe listar sus citas (ids C1, C2...). Las líneas narrativas llevan citas vacías.`

    try {
      const raw = await provider.complete({
        system: GUIONISTA_SYSTEM,
        user: userContent,
        json: true,
        temperature: 0.7,
      })
      script = JSON.parse(raw) as typeof script
      if (!Array.isArray(script.escenas)) throw new Error("formato inválido del LLM")
    } catch (err) {
      return privateJsonError(
        502,
        `El generador de guion falló: ${err instanceof Error ? err.message : String(err)}`,
        crypto.randomUUID(),
        "llm_error"
      )
    }
  } else {
    script = buildScriptFromEvidence(topic, pack)
  }

  const catalog = new NormativeCatalog(process.cwd())
  const verification = script.escenas.map((s) => {
    const type = classifyClaimType(s.linea)
    if (type === "NARRATIVE" || type === "TRANSITION" || type === "OPINION") {
      return { locutor: s.locutor, linea: s.linea, type, semaforo: "none" as const }
    }
    if (s.citas.length === 0) {
      const check = catalog.verifyClaim(s.linea)
      return check.hits.length > 0
        ? { locutor: s.locutor, linea: s.linea, type, semaforo: "yellow" as const, note: "Sin cita explícita; existe soporte parcial en el corpus" }
        : { locutor: s.locutor, linea: s.linea, type, semaforo: "red" as const, note: "Afirmación sin sustento en el corpus — NO VERIFICADO" }
    }
    const refs = s.citas.map((cid) => citationIndex[cid]).filter(Boolean)
    return {
      locutor: s.locutor,
      linea: s.linea,
      type,
      semaforo: refs.length > 0 ? ("green" as const) : ("red" as const),
      note: refs.length > 0 ? undefined : "Cita inexistente",
    }
  })

  const reds = verification.filter((v) => v.semaforo === "red").length
  const yellows = verification.filter((v) => v.semaforo === "yellow").length

  return privateJson({
    script,
    citationIndex,
    verification,
    semaforo: { green: verification.length - reds - yellows, yellow: yellows, red: reds },
    bloqueado: reds > 0,
    provider: providerName,
    providersDisponibles: availableProviders(),
    fichaFuentes: {
      cutoff: pack.cutoff,
      documents: pack.documents,
      generatedAt: new Date().toISOString(),
    },
  })
}
