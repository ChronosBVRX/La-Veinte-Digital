import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { getEscritosStats } from "@/features/escritos/server/escritos-stats-service"

export async function GET() {
  const { user, response } = await requireUser()
  if (!user) {
    return response
  }

  const stats = await getEscritosStats()
  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": "private, no-cache",
    },
  })
}
