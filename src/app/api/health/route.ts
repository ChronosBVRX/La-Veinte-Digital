export function GET() {
  const commitSha =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.APP_COMMIT_SHA ||
    "dev"

  return Response.json(
    {
      status: "ok",
      version: "0.002",
      commitSha,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "x-commit-sha": commitSha,
      },
    },
  )
}
