import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { getWorkerContext } from "@/shared/server/worker-context"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const context = await getWorkerContext()
  return NextResponse.json(context, {
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  })
}
