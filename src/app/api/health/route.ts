export function GET() {
  const commitSha =
    process.env.APP_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
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
