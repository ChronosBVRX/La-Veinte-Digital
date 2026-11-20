import fs from "fs"
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env.local")
  } catch {}
}

import { createClient } from "@supabase/supabase-js"
import { buildExplainer } from "../src/features/tarjeton-guia/lib/explainer.ts"
import { dbRowToGuidePayslip } from "../src/features/tarjeton-guia/services/payslip-guide.ts"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log("Supabase URL:", supabaseUrl)
console.log("Anon key present:", !!anonKey)

const supabase = createClient(supabaseUrl, anonKey)

async function main() {
  const email = "Noirsysan@gmail.com"
  const password = "abe123321"

  console.log(`\nIniciando sesión con ${email}...`)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    console.error("Error al iniciar sesión:", authError.message)
    return
  }

  const user = authData.user
  console.log(`✅ Sesión iniciada con éxito. User ID: ${user.id}`)

  // 1. Consultar tarjetones importados
  const { data: payslips, error: pError } = await supabase
    .from("imported_payslips")
    .select("*")
    .eq("user_id", user.id)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .order("period_half", { ascending: false })

  if (pError) {
    console.error("Error al consultar imported_payslips:", pError.message)
    return
  }

  console.log(`\nTarjetones encontrados en base de datos: ${payslips.length}`)
  for (const p of payslips) {
    console.log(`\n========================================================================`)
    console.log(`TARJETÓN ID: ${p.id} | Periodo: ${p.period_raw} (Año ${p.period_year}, Mes ${p.period_month}, Q${p.period_half})`)
    console.log(`Total Percepciones: $${p.total_perceptions} | Deducciones: $${p.total_deductions} | Neto: $${p.net_amount}`)
    console.log(`========================================================================`)

    // Consultar líneas
    const { data: lines, error: lError } = await supabase
      .from("imported_payslip_lines")
      .select("*")
      .eq("payslip_id", p.id)
      .order("line_index", { ascending: true })

    // Consultar observaciones
    const { data: observations, error: oError } = await supabase
      .from("imported_payslip_observations")
      .select("*")
      .eq("payslip_id", p.id)
      .order("line_index", { ascending: true })

    console.log(`\n[Percepciones y Deducciones Relevantes]:`)
    for (const l of lines || []) {
      if (["001", "002", "008", "032", "033", "035", "037", "076", "172", "176"].includes(l.concept_code)) {
        console.log(`  - [${l.kind}] ${l.concept_code} (${l.description}): $${l.amount}`)
      }
    }

    console.log(`\n[Observaciones Relevantes]:`)
    for (const o of observations || []) {
      console.log(`  - Línea ${o.line_index}: Concepto ${o.concept_code} | Unidades: ${o.units} | Venc: ${o.due_period} | Ctrl: ${o.control_number} | Notas: "${o.notes}" | Monto: $${o.amount}`)
    }

    // Convertir a GuidePayslip y ejecutar buildExplainer
    const guidePayslip = dbRowToGuidePayslip(p, lines || [], observations || [])
    if (!guidePayslip) {
      console.log("  ⚠️ No se pudo convertir a GuidePayslip")
      continue
    }

    const steps = buildExplainer(guidePayslip)
    console.log(`\n[Pasos Explicativos de la UI]: Total = ${steps.length} pasos`)
    for (const s of steps) {
      console.log(`\n  👉 [${s.kind}] ${s.emoji} ${s.title}`)
      if (s.subtitle) console.log(`     Subtítulo: ${s.subtitle}`)
      console.log(`     Explicación: ${s.explanation}`)
      if (s.observationText) console.log(`     Observaciones: ${s.observationText}`)
      if (s.dateInfo) {
        console.log(`     📅 ¿Qué día?: ${s.dateInfo.incidenceText}`)
        console.log(`     💳 ¿En qué quincena?: ${s.dateInfo.paymentText}`)
        if (s.dateInfo.details) console.log(`     ℹ️ Detalles: ${s.dateInfo.details}`)
        if (s.dateInfo.timingStatus) console.log(`     ⏱️ Timing: ${s.dateInfo.timingStatus}`)
        if (s.dateInfo.actionAdvice) console.log(`     💡 Consejo: ${s.dateInfo.actionAdvice}`)
      }
    }
  }
}

main().catch(console.error)
