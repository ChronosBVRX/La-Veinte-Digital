/**
 * LLMProvider: abstracción multi-proveedor para el módulo normativo.
 * El corpus, la búsqueda y la verificación NUNCA dependen de un LLM.
 * El LLM solo transforma evidencia en prosa (guionista/investigador).
 */

export interface LLMCompleteOptions {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  name: string;
  complete(opts: LLMCompleteOptions): Promise<string>;
}

function envKeys(names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of names) {
    const v = process.env[n];
    if (v) out[n] = v;
  }
  return out;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function makeOpenAICompatible(name: string, baseUrl: string, apiKey: string, defaultModel: string): LLMProvider {
  return {
    name,
    async complete(opts) {
      const res = await postJson(
        `${baseUrl.replace(/\/$/, "")}/chat/completions`,
        { Authorization: `Bearer ${apiKey}` },
        {
          model: process.env[`${name.toUpperCase().replace(/[^A-Z]/g, "_")}_MODEL`] ?? defaultModel,
          temperature: opts.temperature ?? 0.6,
          max_tokens: opts.maxTokens ?? 2500,
          response_format: opts.json ? { type: "json_object" } : undefined,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
        }
      );
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}

function makeOllama(defaultModel: string): LLMProvider {
  const base = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
  return {
    name: "ollama",
    async complete(opts) {
      const res = await postJson(
        `${base}/api/chat`,
        {},
        {
          model: process.env.OLLAMA_MODEL ?? defaultModel,
          stream: false,
          format: opts.json ? "json" : undefined,
          options: { temperature: opts.temperature ?? 0.6 },
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
        }
      );
      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content ?? "";
    },
  };
}

function makeGemini(defaultModel: string): LLMProvider {
  return {
    name: "gemini",
    async complete(opts) {
      const apiKey = process.env.GEMINI_API_KEY!;
      const model = process.env.GEMINI_MODEL ?? defaultModel;
      const res = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {},
        {
          generationConfig: {
            temperature: opts.temperature ?? 0.6,
            maxOutputTokens: opts.maxTokens ?? 2500,
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
          },
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: "user", parts: [{ text: opts.user }] }],
        }
      );
      const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    },
  };
}

export function availableProviders(): string[] {
  const keys = envKeys(["OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"]);
  const out: string[] = [];
  if (keys.OPENAI_API_KEY) out.push("openai");
  if (keys.GEMINI_API_KEY) out.push("gemini");
  if (keys.ANTHROPIC_API_KEY) out.push("anthropic");
  if (keys.OPENROUTER_API_KEY) out.push("openrouter");
  if (process.env.OLLAMA_URL || process.env.OLLAMA_MODEL) out.push("ollama");
  return out;
}

export function resolveProvider(preferred?: string): LLMProvider | null {
  const name = preferred?.toLowerCase();
  const keys = envKeys(["OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"]);

  if ((!name || name === "openai") && keys.OPENAI_API_KEY) {
    return makeOpenAICompatible("openai", "https://api.openai.com/v1", keys.OPENAI_API_KEY, "gpt-4o-mini");
  }
  if ((!name || name === "gemini") && keys.GEMINI_API_KEY) {
    return makeGemini("gemini-2.0-flash");
  }
  if ((!name || name === "anthropic") && keys.ANTHROPIC_API_KEY) {
    return {
      name: "anthropic",
      async complete(opts) {
        const res = await postJson(
          "https://api.anthropic.com/v1/messages",
          { "x-api-key": keys.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          {
            model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest",
            max_tokens: opts.maxTokens ?? 2500,
            temperature: opts.temperature ?? 0.6,
            system: opts.system,
            messages: [{ role: "user", content: opts.user }],
          }
        );
        const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
        return data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
      },
    };
  }
  if ((!name || name === "openrouter") && keys.OPENROUTER_API_KEY) {
    return makeOpenAICompatible("openrouter", "https://openrouter.ai/api/v1", keys.OPENROUTER_API_KEY, "openai/gpt-4o-mini");
  }
  if ((!name || name === "ollama") && (process.env.OLLAMA_URL || process.env.OLLAMA_MODEL)) {
    return makeOllama("llama3.1");
  }
  return null;
}

export interface DeterministicScript {
  titulo: string;
  escenas: Array<{ locutor: string; linea: string; citas: string[] }>;
}

/**
 * Guionista determinista SIN LLM (modo "solo corpus"). Construye el guion
 * exclusivamente a partir del paquete de evidencia: nunca añade derechos,
 * cantidades o plazos que no estén sustentados.
 */
export function buildScriptFromEvidence(topic: string, pack: {
  claims: Array<{ text: string; evidence: Array<{ documentId: string }> }>;
}): DeterministicScript {
  const escenas: DeterministicScript["escenas"] = [];
  escenas.push({
    locutor: "EDUARDO",
    linea: `Bienvenidas y bienvenidos a La Veinte Radio. Hoy hablamos de un tema que genera muchas dudas entre compañeras y compañeros del Seguro Social: ${topic}.`,
    citas: [],
  });
  const cct = pack.claims.filter((c) => c.evidence[0]?.documentId.startsWith("CCT") && !c.evidence[0]?.documentId.includes("::"));
  const proc = pack.claims.filter((c) => c.evidence[0]?.documentId.startsWith("IMSS-"));
  const leyes = pack.claims.filter((c) => ["LFT", "LSS", "CPEUM"].includes(c.evidence[0]?.documentId ?? ""));

  if (cct.length > 0) {
    escenas.push({
      locutor: "MARIANA",
      linea: "Empecemos por lo que dice nuestro Contrato Colectivo de Trabajo, el documento que rige nuestra relación laboral.",
      citas: [],
    });
    for (const c of cct.slice(0, 3)) {
      escenas.push({
        locutor: "EDUARDO",
        linea: `El CCT establece lo siguiente: ${c.text.slice(0, 400)}`,
        citas: [`C${pack.claims.indexOf(c) + 1}`],
      });
    }
  }
  if (proc.length > 0) {
    escenas.push({
      locutor: "MARIANA",
      linea: "Pero la práctica institucional tiene su propio procedimiento, y conviene conocerlo.",
      citas: [],
    });
    for (const c of proc.slice(0, 2)) {
      escenas.push({
        locutor: "EDUARDO",
        linea: `En el procedimiento institucional se señala: ${c.text.slice(0, 400)}`,
        citas: [`C${pack.claims.indexOf(c) + 1}`],
      });
    }
  }
  if (leyes.length > 0) {
    escenas.push({
      locutor: "MARIANA",
      linea: "Además, la ley federal da el marco general.",
      citas: [],
    });
    for (const c of leyes.slice(0, 2)) {
      escenas.push({
        locutor: "EDUARDO",
        linea: `La ley señala: ${c.text.slice(0, 400)}`,
        citas: [`C${pack.claims.indexOf(c) + 1}`],
      });
    }
  }
  escenas.push({
    locutor: "MARIANA",
    linea: "Recuerda revisar tu tipo de contratación, categoría, jornada y antigüedad, porque cada caso puede ser distinto. Este contenido es informativo, elaborado a partir de las fuentes documentales que citamos.",
    citas: [],
  });
  return { titulo: topic, escenas };
}

/**
 * Respuesta documental determinista SIN LLM (modo "solo corpus").
 * Construye la respuesta estructurada a partir de los fragmentos recuperados,
 * agrupándolos por tipo de fuente. Nunca inventa contenido.
 */
export function buildDeterministicAnswer(opts: {
  question: string;
  hits: Array<{
    documentId: string;
    documentTitle: string;
    type?: string;
    snippet: string;
    text: string;
    pdfPageIndex: number | null;
    clause: string | null;
    article: string | null;
    validity?: string;
  }>;
}): string {
  const { question, hits } = opts;
  const byType = new Map<string, typeof hits>();

  for (const h of hits) {
    const key = h.type ?? "documento";
    const list = byType.get(key) ?? [];
    list.push(h);
    byType.set(key, list);
  }

  const lines: string[] = [];
  lines.push(`PREGUNTA: ${question}`);
  lines.push("");

  if (hits.length === 0) {
    lines.push("Respuesta breve: No puedo fundamentar esta consulta con el corpus documental (NO VERIFICADO).");
    lines.push("No se encontró evidencia en los documentos indexados. No se debe completar la respuesta con conocimiento general.");
    return lines.join("\n");
  }

  const cct = hits.filter((h) => h.documentId.startsWith("CCT") && !h.documentId.includes("::"));
  const procedimientos = hits.filter((h) => h.type === "procedure");
  const leyes = hits.filter((h) => ["federal_law", "federal_regulation"].includes(h.type ?? ""));
  const nom = hits.filter((h) => h.type === "NOM");
  const otros = hits.filter((h) => !cct.includes(h) && !procedimientos.includes(h) && !leyes.includes(h) && !nom.includes(h));

  lines.push("Respuesta breve: Existe fundamento documental para esta consulta; los detalles se agrupan por fuente a continuación.");

  if (cct.length > 0) {
    lines.push("");
    lines.push("QUÉ DICE EL CCT:");
    for (const h of cct.slice(0, 4)) {
      lines.push(`- ${h.documentTitle}${h.clause ? `, ${h.clause}` : ""}${h.pdfPageIndex != null ? ` (pág. ${h.pdfPageIndex})` : ""}: ${h.text.slice(0, 500)}`);
    }
  }
  if (procedimientos.length > 0) {
    lines.push("");
    lines.push("QUÉ ESTABLECE EL PROCEDIMIENTO INSTITUCIONAL:");
    for (const h of procedimientos.slice(0, 3)) {
      lines.push(`- ${h.documentTitle}${h.pdfPageIndex != null ? ` (pág. ${h.pdfPageIndex})` : ""}: ${h.text.slice(0, 500)}`);
    }
  }
  if (leyes.length > 0) {
    lines.push("");
    lines.push("QUÉ DICEN LAS LEYES:");
    for (const h of leyes.slice(0, 3)) {
      lines.push(`- ${h.documentTitle}${h.article ? `, Artículo ${h.article}` : ""}${h.pdfPageIndex != null ? ` (pág. ${h.pdfPageIndex})` : ""}: ${h.text.slice(0, 500)}`);
    }
  }
  if (nom.length > 0) {
    lines.push("");
    lines.push("NORMAS OFICIALES MEXICANAS RELACIONADAS:");
    for (const h of nom.slice(0, 2)) {
      lines.push(`- ${h.documentTitle}: ${h.text.slice(0, 400)}`);
    }
  }
  if (otros.length > 0) {
    lines.push("");
    lines.push("OTROS DOCUMENTOS:");
    for (const h of otros.slice(0, 3)) {
      lines.push(`- ${h.documentTitle}${h.pdfPageIndex != null ? ` (pág. ${h.pdfPageIndex})` : ""}: ${h.text.slice(0, 400)}`);
    }
  }

  lines.push("");
  lines.push("QUÉ DEBES REVISAR EN TU CASO:");
  lines.push("- Tu tipo de contratación (base, sustituto, temporal, confianza), categoría, jornada y antigüedad, porque la aplicabilidad puede variar.");
  lines.push("- La vigencia de los documentos citados (ver ficha de fuentes).");
  lines.push("- Si tu caso es individual, puede requerir revisión específica: esta respuesta es informativa, no asesoría jurídica.");

  return lines.join("\n");
}
