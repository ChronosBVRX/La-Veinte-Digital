import { requireUser } from "@/shared/server/auth/require-user"
import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"
import { startPasswordRecovery } from "@/features/admin-users/services/admin-users-service"
import { adminJson, handleAdminError, parseUuidParam } from "@/features/admin-users/services/admin-route-support"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const admin = await requirePlatformAdmin(auth.user)
  if (admin.response) return admin.response

  const { id } = await context.params

  try {
    const targetId = parseUuidParam(id)
    const result = await startPasswordRecovery(admin.user.id, targetId)
    return adminJson(result)
  } catch (error) {
    return handleAdminError(error, {
      actorId: admin.user.id,
      targetId: id ?? "",
      attemptedAction: "user.password_recovery",
    })
  }
}
