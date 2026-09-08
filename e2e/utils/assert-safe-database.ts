/**
 * Permanent Guardrail: Prevents destructive/mutating E2E tests from ever running
 * against the production Supabase database or live production domains.
 */
const FORBIDDEN_PRODUCTION_PATTERNS = [
  "ragktminwduiggvaoeix",
  "la20.com.mx",
  "laveinte.com",
  "laveinte.mx",
]

/**
 * Throws an explicit, uncatchable error if the target Supabase URL or base URL
 * matches known production instances.
 */
export function assertSafeDatabase(targetUrl?: string | null): void {
  const urlToCheck = (
    targetUrl ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.E2E_BASE_URL ||
    ""
  ).toLowerCase()

  for (const pattern of FORBIDDEN_PRODUCTION_PATTERNS) {
    if (urlToCheck.includes(pattern.toLowerCase())) {
      throw new Error(
        `[SECURITY GUARDRAIL FATAL]: Refusing to execute mutating/destructive E2E tests against production! Target URL contains forbidden pattern '${pattern}': "${urlToCheck}". Use local Supabase (http://127.0.0.1:54321) or an isolated staging instance.`
      )
    }
  }
}
