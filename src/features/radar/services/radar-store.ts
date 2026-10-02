import fs from "node:fs"
import path from "node:path"
import type { RadarTopic, RadarStatus } from "../types"

const DATA_DIR = path.join(process.cwd(), "data", "radar")
const TOPICS_FILE = path.join(DATA_DIR, "topics.json")

function ensureDirectoryExists(filePath: string) {
  const dirname = path.dirname(filePath)
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true })
  }
}

const INITIAL_SEED_TOPICS: RadarTopic[] = [
  {
    id: "top_seed_cct_revision_tabulador",
    title: "Revisión contractual del tabulador y aumento salarial en el IMSS 2026",
    url: "https://www.gob.mx/stps/prensa/acuerdos-laborales-imss-sntss",
    source: "Diario Oficial / STPS",
    sourceType: "COMUNICADO_OFICIAL",
    snippet: "Concluyen mesas de trabajo entre el SNTSS y autoridades del IMSS para la aplicación del incremento salarial al tabulador base y prestaciones complementarias.",
    publishedAt: "2026-10-01T12:00:00.000Z",
    detectedAt: "2026-10-01T14:30:00.000Z",
    category: "NOMINA",
    relevanceScore: 98,
    isRealInterest: true,
    keyTopic: "Acuerdo de incremento salarial al tabulador base del IMSS.",
    justification: "Impacta directamente los sueldos y prestaciones de toda la base trabajadora del IMSS.",
    relatedClause: "Cláusula 49 y Tabulador Salarial",
    status: "APPROVED",
  },
  {
    id: "top_seed_concepto_050_ajuste",
    title: "Dudas recurrentes sobre la aplicación del Concepto 050 (Puntualidad y Asistencia)",
    url: "https://www.reddit.com/r/lacamiseta/comments/imss_concepto050",
    source: "Reddit r/lacamiseta",
    sourceType: "REDDIT",
    snippet: "Varios compañeros auxiliares de enfermería reportan que por un retraso de 3 minutos se les descontó el Concepto 050 completo en la quincena pasada.",
    publishedAt: "2026-10-02T09:15:00.000Z",
    detectedAt: "2026-10-02T10:00:00.000Z",
    category: "NOMINA",
    relevanceScore: 94,
    isRealInterest: true,
    keyTopic: "Descuento del estímulo Concepto 050 por tolerancia de checador.",
    justification: "Afectación directa en el ingreso quincenal del trabajador por criterios de checada.",
    relatedClause: "Cláusula 91 (Estímulos de Asistencia y Puntualidad)",
    status: "PENDING",
  },
  {
    id: "top_seed_bolsa_cambio_rama",
    title: "Convocatoria extraordinaria para cambio de rama a puestos de enfermería y técnica médica",
    url: "https://sntss.org.mx/convocatorias/cambio-de-rama-2026",
    source: "Portal Sindical SNTSS",
    sourceType: "COMUNICADO_OFICIAL",
    snippet: "La Comisión Mixta de Escalafón abre recepción de documentos para trabajadores en activo que aspiran a plazas de cambio de rama técnica.",
    publishedAt: "2026-09-28T16:00:00.000Z",
    detectedAt: "2026-09-29T08:00:00.000Z",
    category: "ESCALAFON",
    relevanceScore: 91,
    isRealInterest: true,
    keyTopic: "Apertura de examen y registro para cambio de rama sindical.",
    justification: "Oportunidad de ascenso y mejora de categoría para trabajadores de base.",
    relatedClause: "Reglamento de Escalafón y Cambio de Rama",
    status: "APPROVED",
  },
  {
    id: "top_seed_queja_fila_derechohabiente",
    title: "Fila de espera de derechohabientes afuera de la clínica 25 por turnos matutinos",
    url: "https://noticiaslocales.com/imss-filas-clinica25",
    source: "Google News",
    sourceType: "GOOGLE_NEWS",
    snippet: "Pacientes y familiares reportan fila desde las 5 am para obtener ficha de laboratorio en unidad de medicina familiar.",
    publishedAt: "2026-10-01T07:30:00.000Z",
    detectedAt: "2026-10-01T08:15:00.000Z",
    category: "CLIMA_LABORAL",
    relevanceScore: 35,
    isRealInterest: false,
    keyTopic: "Queja de derechohabientes por tiempos de espera de laboratorio.",
    justification: "Noticia de atención al público en general; no atañe a derechos ni nómina de los trabajadores.",
    status: "REJECTED",
  },
]

/**
 * Lee todos los temas almacenados. Si el archivo no existe, lo inicializa con los seed topics.
 */
export async function getAllTopics(): Promise<RadarTopic[]> {
  try {
    if (!fs.existsSync(TOPICS_FILE)) {
      ensureDirectoryExists(TOPICS_FILE)
      fs.writeFileSync(TOPICS_FILE, JSON.stringify(INITIAL_SEED_TOPICS, null, 2), "utf-8")
      return INITIAL_SEED_TOPICS
    }

    const content = fs.readFileSync(TOPICS_FILE, "utf-8")
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }

    return INITIAL_SEED_TOPICS
  } catch (err) {
    console.error("[radar-store] Error reading topics file:", err)
    return INITIAL_SEED_TOPICS
  }
}

/**
 * Filtra temas según su estado.
 */
export async function getTopicsByStatus(status: RadarStatus | "ALL" = "ALL"): Promise<RadarTopic[]> {
  const all = await getAllTopics()
  if (status === "ALL") return all
  return all.filter((t) => t.status === status)
}

/**
 * Guarda o fusiona temas nuevos en la base local.
 */
export async function saveTopics(newTopics: RadarTopic[]): Promise<{ added: number; total: number }> {
  const existing = await getAllTopics()
  const map = new Map<string, RadarTopic>()

  for (const t of existing) {
    map.set(t.id, t)
  }

  let added = 0
  for (const t of newTopics) {
    if (!map.has(t.id)) {
      map.set(t.id, t)
      added++
    }
  }

  const combined = Array.from(map.values())
  // Ordenar por detectedAt desc
  combined.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())

  ensureDirectoryExists(TOPICS_FILE)
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(combined, null, 2), "utf-8")

  return { added, total: combined.length }
}

/**
 * Actualiza el estado de un tema (Aprobar / Descartar).
 */
export async function updateTopicStatus(
  id: string,
  status: RadarStatus,
  reviewedBy?: string
): Promise<RadarTopic | null> {
  const topics = await getAllTopics()
  const topic = topics.find((t) => t.id === id)

  if (!topic) return null

  topic.status = status
  topic.reviewedAt = new Date().toISOString()
  if (reviewedBy) topic.reviewedBy = reviewedBy

  ensureDirectoryExists(TOPICS_FILE)
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2), "utf-8")

  return topic
}

/**
 * Obtiene un tema por ID.
 */
export async function getTopicById(id: string): Promise<RadarTopic | null> {
  const topics = await getAllTopics()
  return topics.find((t) => t.id === id) || null
}
