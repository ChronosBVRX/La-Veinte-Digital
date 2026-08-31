/**
 * Production Gate Fail-Closed Aggregator Evaluator — La Veinte Digital
 *
 * Evalúa los estados de los jobs upstream de CI. Retorna éxito (0) únicamente
 * si TODOS los jobs requeridos tienen estado 'success'. Ante cualquier fallo,
 * cancelación, skip o timeout, aborta con código 1.
 */

export interface UpstreamJobStatus {
  validate: string
  "supabase-db": string
  python: string
  e2e: string
  android: string
}

export function evaluateProductionGate(statuses: UpstreamJobStatus): {
  passed: boolean
  failedJobs: string[]
  details: string[]
} {
  const failedJobs: string[] = []
  const details: string[] = []

  for (const [jobName, status] of Object.entries(statuses)) {
    if (status === "success") {
      details.push(`[PASS] ${jobName}: success`)
    } else {
      failedJobs.push(jobName)
      details.push(`[FAIL] ${jobName}: ${status} (expected 'success')`)
    }
  }

  const passed = failedJobs.length === 0
  return {
    passed,
    failedJobs,
    details,
  }
}

if (process.argv[1]?.endsWith("evaluate-production-gate.ts")) {
  const args = process.argv.slice(2)
  const [validate, supabaseDb, python, e2e, android] = args
  const result = evaluateProductionGate({
    validate: validate || "unknown",
    "supabase-db": supabaseDb || "unknown",
    python: python || "unknown",
    e2e: e2e || "unknown",
    android: android || "unknown",
  })

  console.log(result.details.join("\n"))
  if (!result.passed) {
    console.error(`\n❌ PRODUCTION GATE FAILED: ${result.failedJobs.join(", ")} did not succeed.`)
    process.exit(1)
  }
  console.log("\n✅ ALL UPSTREAM GATES PASSED SUCCESSFULLY.")
}
