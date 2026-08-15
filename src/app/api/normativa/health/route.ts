import { requireUser } from "@/shared/server/auth/require-user"
import { privateJson } from "@/shared/lib/api-response"
import { NormativeCatalog } from "@/features/normativa/services/catalog"

export const runtime = "nodejs"

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const catalog = new NormativeCatalog(process.cwd())
  const health = catalog.health()
  return privateJson({ health })
}
