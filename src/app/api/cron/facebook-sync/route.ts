import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { syncLatestFacebookPostsViaHttp } from "@/features/facebook/services/facebook-posts-service"

export const dynamic = "force-dynamic"

function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const adminKey = process.env.PUSH_ADMIN_KEY

  const authHeader = request.headers.get("authorization")
  const adminHeader = request.headers.get("x-push-admin-key") || request.headers.get("x-cron-key")

  if (cronSecret && safeCompare(authHeader, `Bearer ${cronSecret}`)) return true
  if (adminKey && safeCompare(adminHeader, adminKey)) return true
  if (!cronSecret && !adminKey && process.env.NODE_ENV !== "production") return true

  return false
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "No autorizado", code: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  try {
    const summary = await syncLatestFacebookPostsViaHttp(["seccionxx"])
    return NextResponse.json(
      {
        ok: true,
        ...summary,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
