import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"
import { loadManifest } from "@/features/normativa/core/manifest"
import { isSourceBlocked } from "@/features/normativa/services/bootstrap"
import { availableSourcesForRetry, currentJob, startSyncJob } from "@/features/normativa/services/sync-runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MANIFEST_PATH = path.resolve(process.cwd(), "resources", "normativa", "bootstrap-sources.yaml")

function buildStatus() {
  const manifest = loadManifest(MANIFEST_PATH)
  const catalog = new NormativeCatalog(process.cwd())
  const now = new Date()

  const sources = manifest.sources.map((s) => {
    const doc = catalog.getDocument(s.id)
    const ver = doc?.currentVersion ? catalog.getVersion(doc.currentVersion) : null
    const st = catalog.db.getSourceState(s.id)
    const blocked = isSourceBlocked(st, now)
    return {
      id: s.id,
      title: s.title,
      category: s.category ?? "otros",
      priority: s.priority ?? "medium",
      type: s.type,
      hasUrl: !!(s.url || s.landingPage),
      discoveryRequired: s.discoveryRequired === true,
      state: st?.state ?? "AVAILABLE",
      blocked,
      retryAfter: st?.retryAfter ?? null,
      lastError: st?.lastError ?? null,
      attempts: st?.attempts ?? 0,
      hasVersion: !!ver,
      versionLabel: ver?.label ?? null,
      pages: ver?.pages ?? null,
      chunks: ver ? catalog.db.countChunks(ver.id) : 0,
      needsOcr: !!ver && (ver.pages ?? 0) > 0 && catalog.db.countChunks(ver.id) === 0 && !(ver.note ?? "").includes("OCR"),
    }
  })

  const hasVersion = sources.filter((s) => s.hasVersion).length
  const blocked = sources.filter((s) => s.blocked).length
  const needsDiscovery = sources.filter((s) => s.discoveryRequired || (!s.hasUrl && !s.hasVersion)).length
  const needsOcr = sources.filter((s) => s.needsOcr).length
  const errored = sources.filter((s) => s.state !== "AVAILABLE" && !s.blocked && !s.discoveryRequired).length
  const retryable = availableSourcesForRetry(manifest, catalog.db).map((s) => s.id)

  return {
    job: currentJob(process.cwd()),
    summary: {
      total: sources.length,
      hasVersion,
      blocked,
      needsDiscovery,
      needsOcr,
      errored,
      retryable,
    },
    sources,
  }
}

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  if (!fs.existsSync(MANIFEST_PATH)) {
    return privateJsonError(503, "Manifest no disponible en este entorno", crypto.randomUUID(), "unavailable")
  }
  return privateJson(buildStatus())
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  if (!fs.existsSync(MANIFEST_PATH)) {
    return privateJsonError(503, "La sincronización solo está disponible donde existe el corpus local", crypto.randomUUID(), "unavailable")
  }

  let body: { action?: string; ids?: string[]; force?: boolean }
  try {
    body = await req.json()
  } catch {
    return privateJsonError(400, "Cuerpo JSON inválido", crypto.randomUUID(), "bad_request")
  }

  const manifest = loadManifest(MANIFEST_PATH)
  const catalog = new NormativeCatalog(process.cwd())

  const input: { ids?: string[]; force?: boolean } = { force: body.force === true }
  if (body.action === "retry" || Array.isArray(body.ids)) {
    input.ids = Array.isArray(body.ids) && body.ids.length > 0
      ? body.ids
      : availableSourcesForRetry(manifest, catalog.db).map((s) => s.id)
    input.force = true
  }

  const result = await startSyncJob({
    repoRoot: process.cwd(),
    manifest,
    ids: input.ids,
    force: input.force,
  })

  if (!result.started) {
    return privateJsonError(409, result.reason ?? "No se pudo iniciar", crypto.randomUUID(), "job_busy")
  }
  return privateJson({ started: true, job: currentJob(process.cwd()) })
}
