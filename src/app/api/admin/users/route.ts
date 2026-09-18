import type { NextRequest } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"
import { getAdminUsersPage } from "@/features/admin-users/services/admin-users-service"
import { adminJson, handleAdminError, parseUserListQuery } from "@/features/admin-users/services/admin-route-support"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const admin = await requirePlatformAdmin(auth.user)
  if (admin.response) return admin.response

  try {
    const query = parseUserListQuery(request.nextUrl.searchParams)
    const page = await getAdminUsersPage(query)
    return adminJson(page)
  } catch (error) {
    return handleAdminError(error)
  }
}
