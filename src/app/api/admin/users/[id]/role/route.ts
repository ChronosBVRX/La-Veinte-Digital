import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"
import { changeUserRole } from "@/features/admin-users/services/admin-users-service"
import {
  adminJson,
  handleAdminError,
  parseUuidParam,
  readJsonBody,
  roleChangeSchema,
} from "@/features/admin-users/services/admin-route-support"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const admin = await requirePlatformAdmin(auth.user)
  if (admin.response) return admin.response

  const { id } = await context.params
  let reason: string | null = null

  try {
    const targetId = parseUuidParam(id)
    const parsed = roleChangeSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      return adminJson({ error: "Datos inválidos", code: "invalid_request" }, 400)
    }

    reason = parsed.data.reason
    const result = await changeUserRole(admin.user.id, targetId, parsed.data.role, parsed.data.reason)
    return adminJson(result)
  } catch (error) {
    return handleAdminError(error, {
      actorId: admin.user.id,
      targetId: id ?? "",
      attemptedAction: "user.role_change",
      reason,
    })
  }
}
