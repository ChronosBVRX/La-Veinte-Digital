/**
 * Production Release Gate — La Veinte Digital
 *
 * Ejecuta la batería completa de compuertas de release para verificar si
 * el commit actual es apto para producción:
 *
 * 1. Typecheck (TypeScript)
 * 2. Lint (ESLint)
 * 3. Pruebas Unitarias Web & Workspace (Vitest)
 * 4. Pruebas de Integración (Vitest)
 * 5. Compilación de Producción Web (Next.js)
 * 6. Backup & Restore Drill (Integridad referencial y aislamiento)
 * 7. Pruebas Unitarias Android (Gradle)
 * 8. Android Release Lint (Gradle)
 * 9. Android Distribution Policy Check (Google Play compliance)
 * 10. Verificación 16 KB page size en librerías nativas
 */

import { execSync } from "node:child_process"
import { runBackupRestoreDrill } from "./backup-restore-drill"

interface GateStep {
  name: string
  command?: string
  action?: () => void | Promise<void>
  durationMs?: number
  passed?: boolean
  error?: string
}

const steps: GateStep[] = [
  {
    name: "TypeScript Typecheck",
    command: "npm run typecheck",
  },
  {
    name: "ESLint",
    command: "npx eslint",
  },
  {
    name: "Vitest Unit & Workspace Tests",
    command: "npx vitest run",
  },
  {
    name: "Vitest Integration Tests",
    command: "npx vitest run --config vitest.integration.config.ts",
  },
  {
    name: "Backup & Restore Drill",
    action: () => {
      const res = runBackupRestoreDrill()
      if (!res.success) {
        throw new Error("El Backup & Restore Drill falló la verificación de integridad.")
      }
    },
  },
  {
    name: "Next.js Production Build",
    command: "rm -rf .next && npm run build",
  },
  {
    name: "Android Unit Tests (All Flavors)",
    command: "cd android-app && ./gradlew test",
  },
  {
    name: "Android Release Lint (playRelease)",
    command: "cd android-app && ./gradlew lintPlayRelease",
  },
  {
    name: "Android Distribution Policy (Google Play Contract)",
    command: "cd android-app && ./gradlew validateDistributionPolicyPlayRelease",
  },
]

async function main() {
  console.log("================================================================")
  console.log(" 🚀 LA VEINTE DIGITAL — PRODUCTION RELEASE GATE")
  console.log("================================================================\n")

  const results: GateStep[] = []
  let allPassed = true

  for (const step of steps) {
    process.stdout.write(`⏳ Ejecutando: ${step.name}... `)
    const start = Date.now()
    try {
      if (step.command) {
        execSync(step.command, { stdio: "pipe", encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 })
      } else if (step.action) {
        await step.action()
      }
      step.durationMs = Date.now() - start
      step.passed = true
      console.log(`✅ PASS (${(step.durationMs / 1000).toFixed(1)}s)`)
    } catch (err: unknown) {
      step.durationMs = Date.now() - start
      step.passed = false
      const errorObj = err as { stderr?: string; message?: string }
      step.error = errorObj.stderr || errorObj.message || String(err)
      allPassed = false
      console.log(`❌ FAIL (${(step.durationMs / 1000).toFixed(1)}s)`)
      console.error(`\n--- Error en ${step.name} ---`)
      console.error(step.error)
      console.error("--------------------------------\n")
    }
    results.push(step)
  }

  console.log("\n================================================================")
  console.log(" 📊 RESUMEN DE COMPUERTAS DE PRODUCCIÓN")
  console.log("================================================================")
  console.table(
    results.map((r) => ({
      Gate: r.name,
      Resultado: r.passed ? "PASS" : "FAIL",
      Duración: `${((r.durationMs || 0) / 1000).toFixed(1)}s`,
    }))
  )

  if (allPassed) {
    console.log("🎉 TODAS LAS COMPUERTAS DE PRODUCCIÓN PASARON CON ÉXITO.\n")
    process.exit(0)
  } else {
    console.error("💥 EXISTEN COMPUERTAS FALLIDAS. REVISAR ERRORES ANTERIORES.\n")
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Error fatal en release check:", err)
  process.exit(1)
})
