import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"
import { getAdminAuditPage } from "@/features/admin-users/services/admin-users-service"
import { adminJson, handleAdminError } from "@/features/admin-users/services/admin-route-support"
import { ADMIN_USERS_DEFAULT_PAGE_SIZE } from "@/shared/contracts/admin-users"

export const dynamic = "force-dynamic"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function optionalUuid(value: string | null): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined
}

function optionalDate(value: string | null): string | undefined {
  return value && DATE_PATTERN.test(value) ? value : undefined
}

function boundedInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const admin = await requirePlatformAdmin(auth.user)
  if (admin.response) return admin.response

  try {
    const params = request.nextUrl.searchParams
    const page = await getAdminAuditPage({
      action: params.get("action")?.slice(0, 60) || undefined,
      targetId: optionalUuid(params.get("target")),
      actorId: optionalUuid(params.get("actor")),
      from: optionalDate(params.get("from")),
      to: optionalDate(params.get("to")),
      page: boundedInt(params.get("page"), 1, 10_000),
      pageSize: boundedInt(params.get("pageSize"), ADMIN_USERS_DEFAULT_PAGE_SIZE, 100),
    })
    return adminJson(page)
  } catch (error) {
    return handleAdminError(error)
  }
}
