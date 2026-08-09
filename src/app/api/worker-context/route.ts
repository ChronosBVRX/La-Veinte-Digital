import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { getWorkerContext } from "@/shared/server/worker-context"

export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const context = await getWorkerContext()
  return NextResponse.json(context, {
    headers: { "Cache-Control": "private, no-store" },
  })
}
