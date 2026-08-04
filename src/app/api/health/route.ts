export function GET() {
  return Response.json(
    { status: "ok", version: "0.002" },
    { headers: { "Cache-Control": "no-store" } },
  )
}
