#!/usr/bin/env node

/**
 * sync-normativa-storage.mjs
 * Sincroniza los documentos normativos originales verificados a Supabase Storage
 * (bucket público 'normativa') para que el visor oficial funcione en producción
 * con alta velocidad y sin depender de ráfagas al WAF Incapsula.
 */

import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.la20.com.mx"
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceKey) {
  console.error("ERROR: Falta SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)
const BUCKET = "normativa"

async function main() {
  console.log(`[Normativa Sync] Conectando a ${supabaseUrl}...`)
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    console.log(`[Normativa Sync] Creando bucket ${BUCKET}...`)
    await supabase.storage.createBucket(BUCKET, { public: true })
  }

  const dir = path.join(process.cwd(), "data", "normativa", "originales")
  if (!fs.existsSync(dir)) {
    console.log(`[Normativa Sync] Directorio ${dir} no existe.`)
    return
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".pdf") || f.endsWith(".html"))
  console.log(`[Normativa Sync] Encontrados ${files.length} archivos en ${dir}.`)

  // Listar archivos ya existentes en el bucket para no resubir innecesariamente
  const { data: remoteFiles } = await supabase.storage.from(BUCKET).list("", { limit: 1000 })
  const existingSet = new Set(remoteFiles?.map((f) => f.name) ?? [])

  let uploadedCount = 0
  let skippedCount = 0

  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stats = fs.statSync(fullPath)

    if (existingSet.has(file)) {
      skippedCount++
      continue
    }

    console.log(`[Normativa Sync] Subiendo ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`)
    const buf = fs.readFileSync(fullPath)
    const { error } = await supabase.storage.from(BUCKET).upload(file, buf, {
      contentType: file.endsWith(".pdf") ? "application/pdf" : "text/html; charset=utf-8",
      upsert: true,
    })

    if (error) {
      console.error(`[Normativa Sync] Error subiendo ${file}:`, error.message)
    } else {
      uploadedCount++
    }
  }

  console.log(`[Normativa Sync] Terminado. Subidos: ${uploadedCount}, Ya existentes: ${skippedCount}.`)
}

main().catch(console.error)
