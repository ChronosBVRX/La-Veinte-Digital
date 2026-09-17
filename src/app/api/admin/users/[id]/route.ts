import { requireUser } from "@/shared/server/auth/require-user"
import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"
import { getAdminUserDetail } from "@/features/admin-users/services/admin-users-service"
import { adminJson, handleAdminError, parseUuidParam } from "@/features/admin-users/services/admin-route-support"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const admin = await requirePlatformAdmin(auth.user)
  if (admin.response) return admin.response

  try {
    const { id } = await context.params
    const targetId = parseUuidParam(id)
    const detail = await getAdminUserDetail(targetId)

    if (!detail) {
      return adminJson({ error: "La cuenta no existe", code: "not_found" }, 404)
    }

    return adminJson(detail)
  } catch (error) {
    return handleAdminError(error)
  }
}
