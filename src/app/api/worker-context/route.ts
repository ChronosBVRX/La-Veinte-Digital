import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { getWorkerContext, WorkerContextQueryError } from "@/shared/server/worker-context"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const requestId = crypto.randomUUID()
  const auth = await requireUser()
  if (auth.response) {
    auth.response.headers.set("X-Request-Id", requestId)
    return auth.response
  }

  try {
    const context = await getWorkerContext(auth.user, null, requestId)
    return NextResponse.json(context, {
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Request-Id": requestId,
      },
    })
  } catch (error) {
    const code = error instanceof WorkerContextQueryError ? error.code : "worker_context_query_failed"
    console.error(`[api/worker-context][${requestId}] Error al resolver contexto laboral:`, error)
    return NextResponse.json(
      {
        error: "No pudimos confirmar tu información laboral por ahora. Intenta de nuevo más tarde.",
        code,
        requestId,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Request-Id": requestId,
        },
      },
    )
  }
}
