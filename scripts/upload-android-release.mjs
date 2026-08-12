/**
 * Sube un APK a Supabase Storage y devuelve la URL pública.
 *
 * Uso:
 *   node scripts/upload-android-release.mjs <apk_path> <channel> <version>
 *
 * Requiere en .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY  (no NEXT_PUBLIC_, solo server)
 *   NEXT_PUBLIC_SUPABASE_URL   (ya existe)
 *
 * Ejemplo:
 *   node scripts/upload-android-release.mjs app-release.apk stable 1.0.0
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { basename } from "path"
import { createHash } from "crypto"

const apkPath = process.argv[2]
const channel = process.argv[3]
const version = process.argv[4]

if (!apkPath || !channel || !version) {
  console.error("Uso: node upload-android-release.mjs <apk_path> <channel> <version>")
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)
const BUCKET = "android-releases"

async function main() {
  const fileBuffer = readFileSync(apkPath)
  const fileName = `LaVeinteDigital-${version}.apk`
  const remotePath = `${channel}/${version}/${fileName}`

  // Calcular SHA-256
  const sha256 = createHash("sha256").update(fileBuffer).digest("hex")
  const sizeBytes = fileBuffer.length

  console.log(`Subiendo ${apkPath} → ${BUCKET}/${remotePath}`)
  console.log(`SHA-256: ${sha256}`)
  console.log(`Tamaño: ${(sizeBytes / 1_048_576).toFixed(1)} MB`)

  // Verificar que el bucket existe, si no, intentar crearlo
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" no existe. Creando...`)
    const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (createError) {
      console.error("Error creando bucket:", createError.message)
      process.exit(1)
    }
    console.log("Bucket creado.")
  }

  // Subir APK (overwrite si ya existe)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, fileBuffer, {
      contentType: "application/vnd.android.package-archive",
      cacheControl: "31536000", // 1 año — URLs inmutables
      upsert: true,
    })

  if (uploadError) {
    console.error("Error subiendo APK:", uploadError.message)
    process.exit(1)
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${remotePath}`
  console.log(`\nAPK disponible en: ${publicUrl}`)

  // Generar fragmento JSON para latest.json
  const latestSnippet = {
    url: publicUrl,
    sha256,
    size: sizeBytes,
  }
  console.log(`\nFragmento para latest.json:\n${JSON.stringify(latestSnippet, null, 2)}`)
}

main().catch(err => {
  console.error("Fallo:", err)
  process.exit(1)
})
