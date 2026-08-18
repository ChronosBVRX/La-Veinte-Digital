import fs from "node:fs"
import path from "node:path"
import { NormativeCatalog } from "../services/catalog"
import { buildCoverage } from "../services/coverage"
import { buildScriptFromEvidence } from "../services/llm-provider"
import { classifyClaimType } from "../services/evidence"
import { synthesizeMp3 } from "@la-veinte/tts-core"

const PILOTOS = [
  "Tiempo extraordinario en el IMSS: qué es, cómo se autoriza y cómo se registra",
  "¿Me pueden cambiar el horario?",
  "Faltas, retardos, asistencia y biométrico",
  "Accidente de trabajo: ST-7",
  "Bolsa de Trabajo para sustitutos",
]

async function main() {
  const catalog = new NormativeCatalog(process.cwd())
  const outDir = path.join(process.cwd(), "data", "normativa", "pilotos")
  fs.mkdirSync(outDir, { recursive: true })

  const summary: Array<Record<string, string>> = []

  for (const topic of PILOTOS) {
    console.log(`\n══════════ PILOTO: ${topic}`)
    const pack = catalog.buildEvidencePack(topic, { limit: 25 })
    const coverage = buildCoverage(catalog, topic)
    const script = buildScriptFromEvidence(topic, pack)

    const verification = script.escenas.map((s) => {
      const type = classifyClaimType(s.linea)
      if (type === "NARRATIVE" || type === "TRANSITION" || type === "OPINION") {
        return { semaforo: "none" as const, type }
      }
      if (s.citas.length === 0) {
        const check = catalog.verifyClaim(s.linea)
        return check.hits.length > 0 ? { semaforo: "yellow" as const, type } : { semaforo: "red" as const, type }
      }
      return { semaforo: "green" as const, type }
    })
    const reds = verification.filter((v) => v.semaforo === "red").length
    const greens = verification.filter((v) => v.semaforo === "green").length

    console.log(`  cobertura: ${coverage.coverage}% (${coverage.available}/${coverage.total}) recomendado=${coverage.recommended}`)
    for (const w of coverage.warnings) console.log(`  ⚠ ${w}`)
    console.log(`  evidencia: ${pack.documents.length} docs, ${pack.relevantChunks.length} fragmentos, ${pack.claims.length} afirmaciones`)
    console.log(`  guion: ${script.escenas.length} escenas | 🟢${greens} 🟡${verification.filter((v) => v.semaforo === "yellow").length} 🔴${reds}`)

    const slug = topic
      .toLowerCase()
      .replace(/[¿?¡!.,:]/g, "")
      .slice(0, 48)
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")

    const ficha = {
      tema: topic,
      cutoff: pack.cutoff,
      generado: new Date().toISOString(),
      cobertura: {
        porcentaje: coverage.coverage,
        recomendado: coverage.recommended,
        items: coverage.items,
        advertencias: coverage.warnings,
      },
      documentos: pack.documents,
      matriz: pack.claims.map((c) => ({
        id: c.id,
        type: c.type,
        state: c.state,
        texto: c.text.slice(0, 300),
        fuente: c.evidence[0]
          ? {
              documento: c.evidence[0].documentId,
              clausula: c.evidence[0].clause,
              articulo: c.evidence[0].article,
              pagina: c.evidence[0].pdfPage,
            }
          : null,
      })),
      guion: script,
      verificacion: verification,
    }
    fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify(ficha, null, 2))

    const md = [
      `# ${topic}`,
      "",
      `Cobertura documental: **${coverage.coverage}%** (${coverage.recommended ? "recomendado" : "NO recomendado para publicación"})`,
      "",
      "| Fuente | Estado |",
      "|---|---|",
      ...coverage.items.map((i) => `| ${i.label} | ${i.status === "available" ? "🟢" : i.status === "review" ? "🟡" : "🔴"}`),
      "",
      "## Guion",
      "",
      ...script.escenas.map((s, i) => {
        const v = verification[i]
        const dot = v.semaforo === "red" ? "🔴" : v.semaforo === "yellow" ? "🟡" : v.semaforo === "green" ? "🟢" : "•"
        return `**${dot} ${s.locutor}** — “${s.linea}”${s.citas.length ? ` *(citas: ${s.citas.join(", ")})*` : ""}`
      }),
      "",
      "## Ficha de fuentes",
      "",
      `Fecha de corte: ${pack.cutoff}`,
      "",
      ...pack.documents.map((d, i) => `${i + 1}. ${d.title} — versión ${d.versionLabel} — SHA-256 ${d.sha256.slice(0, 16)}…`),
      "",
      "Contenido informativo elaborado a partir de las fuentes indicadas. La aplicación conserva la versión documental utilizada y la fecha de corte. Los casos individuales pueden requerir revisión específica.",
      "",
    ]
    fs.writeFileSync(path.join(outDir, `${slug}.md`), md.join("\n"))

    try {
      console.log(`  🎙 sintetizando audio…`)
      const audio = await synthesizeMp3(
        script.escenas.map((s) => ({ text: s.linea, voice: s.locutor.toUpperCase().includes("MARIANA") ? "es-MX-MarinaNeural" : "es-MX-JorgeNeural" })),
        { onProgress: (done, total) => console.log(`    audio ${done}/${total}`) }
      )
      fs.writeFileSync(path.join(outDir, `${slug}.mp3`), audio.mp3)
      console.log(`  ✅ MP3 generado (${Math.round(audio.mp3.length / 1024)} KB, motor ${audio.engine})`)
      summary.push({ tema: topic, cobertura: `${coverage.coverage}%`, publicable: coverage.recommended ? "SÍ" : "NO", escenas: String(script.escenas.length), rojos: String(reds), mp3: `${Math.round(audio.mp3.length / 1024)} KB` })
    } catch (err) {
      console.log(`  ✗ audio: ${err instanceof Error ? err.message : err}`)
      summary.push({ tema: topic, cobertura: `${coverage.coverage}%`, publicable: coverage.recommended ? "SÍ" : "NO", escenas: String(script.escenas.length), rojos: String(reds), mp3: "ERROR" })
    }
  }

  const csv = ["tema|cobertura|publicable|escenas|rojos|mp3", ...summary.map((s) => Object.values(s).join("|"))]
  fs.writeFileSync(path.join(outDir, "resumen-pilotos.csv"), csv.join("\n"))
  console.log("\n════════ RESUMEN PILOTOS ════════")
  for (const s of summary) console.log(`  ${s.cobertura} publicable=${s.publicable} rojos=${s.rojos} | ${s.tema.slice(0, 55)}`)
  console.log(`\nArtefactos en: ${outDir}`)
}

main().catch((e) => {
  console.error("FATAL:", e)
  process.exit(1)
})
