/**
 * Production Dependency Security Audit Runner — La Veinte Digital
 *
 * Ejecuta `npm audit --omit=dev --audit-level=high --json` y valida
 * que no existan vulnerabilidades de severidad alta o crítica sin mitigar
 * ni documentar en docs/production-dependencies-audit.md.
 *
 * Política fail-closed: Cualquier vulnerabilidad alta o crítica nueva o
 * no mitigada aborta con código 1, bloqueando CI y compuertas de release.
 */

import { execSync } from "node:child_process"

export interface MitigatedVulnerability {
  package: string
  advisories: string[]
  severity: "high" | "critical"
  justification: string
}

/**
 * Registro explícito de mitigaciones técnicas aprobadas.
 * Cada entrada debe corresponder con docs/production-dependencies-audit.md.
 */
export const APPROVED_MITIGATIONS: MitigatedVulnerability[] = [
  {
    package: "next",
    advisories: ["GHSA-p293-qw3h-jr36", "GHSA-2xp9-vwfh-vxw4"],
    severity: "critical",
    justification:
      "GHSA-p293-qw3h-jr36 solo afecta servidores Windows; producción corre en contenedores Linux/POSIX. GHSA-2xp9-vwfh-vxw4 requiere procesamiento de archivos AVIF no confiables en _next/image; la app no procesa AVIF de usuarios.",
  },
]

export interface AuditVulnerabilityItem {
  name: string
  severity: string
  title: string
  url: string
}

export interface AuditResult {
  passed: boolean
  unmitigatedVulnerabilities: AuditVulnerabilityItem[]
  mitigatedVulnerabilities: Array<{
    name: string
    severity: string
    advisory: string
  }>
}

interface NpmAuditViaItem {
  source?: number
  name?: string
  dependency?: string
  title?: string
  url?: string
  severity?: string
}

interface NpmAuditPackageData {
  name?: string
  severity?: string
  via?: Array<string | NpmAuditViaItem>
}

interface NpmAuditJson {
  vulnerabilities?: Record<string, NpmAuditPackageData>
}

export function evaluateAuditOutput(auditJson: NpmAuditJson): AuditResult {
  const vulnerabilities = auditJson.vulnerabilities || {}
  const unmitigated: AuditResult["unmitigatedVulnerabilities"] = []
  const mitigated: AuditResult["mitigatedVulnerabilities"] = []

  for (const [pkgName, pkgData] of Object.entries(vulnerabilities)) {
    const severity = pkgData.severity
    if (severity !== "high" && severity !== "critical") {
      continue
    }

    const viaList = Array.isArray(pkgData.via) ? pkgData.via : []
    const advisoriesInPkg = viaList.filter(
      (v): v is NpmAuditViaItem => typeof v === "object" && v !== null && Boolean(v.url)
    )

    if (advisoriesInPkg.length === 0) {
      // Dependencia transitiva que deriva de un paquete vulnerable
      const approved = APPROVED_MITIGATIONS.find((m) => m.package === pkgName)
      if (approved) {
        mitigated.push({
          name: pkgName,
          severity: severity || "unknown",
          advisory: "transitive-mitigated",
        })
      } else {
        unmitigated.push({
          name: pkgName,
          severity: severity || "unknown",
          title: "Vulnerabilidad transitiva sin mitigación documentada",
          url: "",
        })
      }
      continue
    }

    for (const adv of advisoriesInPkg) {
      const advId = adv.url ? adv.url.split("/").pop() || "" : ""
      const approved = APPROVED_MITIGATIONS.find(
        (m) => m.package === pkgName && m.advisories.includes(advId)
      )

      if (approved) {
        mitigated.push({
          name: pkgName,
          severity: severity || "unknown",
          advisory: advId,
        })
      } else {
        unmitigated.push({
          name: pkgName,
          severity: severity || "unknown",
          title: adv.title || "Sin título",
          url: adv.url || "",
        })
      }
    }
  }

  return {
    passed: unmitigated.length === 0,
    unmitigatedVulnerabilities: unmitigated,
    mitigatedVulnerabilities: mitigated,
  }
}

export function runProductionAudit(): AuditResult {
  let auditOutput = ""
  try {
    auditOutput = execSync("npm audit --omit=dev --audit-level=high --json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch (err: unknown) {
    const execErr = err as { stdout?: string }
    auditOutput = execErr.stdout || "{}"
  }

  let auditJson: NpmAuditJson = {}
  try {
    auditJson = JSON.parse(auditOutput)
  } catch (e) {
    console.error("❌ Error al parsear salida JSON de npm audit:", e)
    return {
      passed: false,
      unmitigatedVulnerabilities: [
        {
          name: "npm-audit-parse-error",
          severity: "critical",
          title: "Fallo al interpretar el reporte de auditoría",
          url: "",
        },
      ],
      mitigatedVulnerabilities: [],
    }
  }

  return evaluateAuditOutput(auditJson)
}

if (process.argv[1]?.endsWith("audit-production-dependencies.ts")) {
  console.log("================================================================")
  console.log(" 🛡️ AUDITORÍA DE DEPENDENCIAS DE PRODUCCIÓN — LA VEINTE DIGITAL")
  console.log("================================================================\n")

  const result = runProductionAudit()

  if (result.mitigatedVulnerabilities.length > 0) {
    console.log("📋 Vulnerabilidades de severidad alta/crítica mitigadas con justificación técnica:")
    for (const m of result.mitigatedVulnerabilities) {
      console.log(`   - [MITIGADA] ${m.name} (${m.severity}) -> ${m.advisory}`)
    }
    console.log("")
  }

  if (!result.passed) {
    console.error("❌ SE ENCONTRARON VULNERABILIDADES NUEVAS O NO MITIGADAS (HIGH / CRITICAL):")
    for (const u of result.unmitigatedVulnerabilities) {
      console.error(`   - [BLOQUEADO] ${u.name} (${u.severity}): ${u.title}`)
      if (u.url) console.error(`     Advisory: ${u.url}`)
    }
    console.error("\n💥 LA COMPUERTA DE PRODUCCIÓN HA RECHAZADO EL BUILD.")
    process.exit(1)
  }

  console.log("✅ Cero vulnerabilidades altas o críticas no mitigadas. Auditoría aprobada.\n")
  process.exit(0)
}
