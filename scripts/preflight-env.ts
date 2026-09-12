/**
 * Preflight Environment Validator — La Veinte Digital
 *
 * Valida de forma exhaustiva las variables de entorno para despliegues productivos:
 * - Existencia y no vaciedad de variables requeridas.
 * - Detección y bloqueo de placeholders ('placeholder', 'example', 'your-key-here', etc.).
 * - Validación de protocolo HTTPS en URLs de Supabase.
 * - Validación de formato JWT en claves de Supabase.
 * - Diferenciación estricta entre anon_key y service_role_key.
 * - Validación de formato de clave de OpenAI.
 * - Validación estructural de JSON de cuentas de servicio (Firebase).
 */

export interface EnvValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const PLACEHOLDER_PATTERNS = [
  /^placeholder/i,
  /^your[-_]/i,
  /example/i,
  /^dummy/i,
  /^changeme/i,
  /^todo/i,
  /^xxx+/i,
  /<insert[-_]/i,
  /replace[-_]me/i,
]

export function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true
  const trimmed = value.trim()
  if (!trimmed) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function isValidJwtStructure(token: string): boolean {
  const parts = token.split(".")
  return parts.length === 3 && parts.every((p) => p.length > 0)
}

export function validateProductionEnv(env: Record<string, string | undefined>): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. NEXT_PUBLIC_SUPABASE_URL
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!supabaseUrl) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL es obligatoria y está ausente o vacía.")
  } else if (isPlaceholder(supabaseUrl)) {
    errors.push(`NEXT_PUBLIC_SUPABASE_URL contiene un valor placeholder: '${supabaseUrl}'`)
  } else {
    try {
      const parsed = new URL(supabaseUrl)
      if (parsed.protocol !== "https:") {
        errors.push(`NEXT_PUBLIC_SUPABASE_URL debe usar HTTPS en producción (actual: ${parsed.protocol})`)
      }
      if (parsed.hostname === "example.supabase.co" || parsed.hostname.includes("example.com")) {
        errors.push(`NEXT_PUBLIC_SUPABASE_URL no puede apuntar a un host de ejemplo: ${parsed.hostname}`)
      }
    } catch {
      errors.push(`NEXT_PUBLIC_SUPABASE_URL no es una URL válida: '${supabaseUrl}'`)
    }
  }

  // 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!anonKey) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY es obligatoria y está ausente o vacía.")
  } else if (isPlaceholder(anonKey) || anonKey.length < 20) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY contiene un valor dummy o longitud insuficiente (< 20 caracteres).")
  } else if (!isValidJwtStructure(anonKey)) {
    warnings.push("NEXT_PUBLIC_SUPABASE_ANON_KEY no presenta la estructura típica JWT (header.payload.signature).")
  }

  // 3. SUPABASE_SERVICE_ROLE_KEY
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRoleKey) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY es obligatoria en producción y está ausente o vacía.")
  } else if (isPlaceholder(serviceRoleKey) || serviceRoleKey.length < 20) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY contiene un valor dummy o longitud insuficiente (< 20 caracteres).")
  } else if (!isValidJwtStructure(serviceRoleKey)) {
    warnings.push("SUPABASE_SERVICE_ROLE_KEY no presenta la estructura típica JWT (header.payload.signature).")
  } else if (serviceRoleKey === anonKey) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY no puede ser idéntica a NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  }

  // 4. OPENAI_API_KEY
  const openaiKey = env.OPENAI_API_KEY?.trim()
  if (!openaiKey) {
    errors.push("OPENAI_API_KEY es obligatoria y está ausente o vacía.")
  } else if (isPlaceholder(openaiKey) || openaiKey.length < 20) {
    errors.push("OPENAI_API_KEY contiene un valor placeholder o longitud insuficiente.")
  } else if (!openaiKey.startsWith("sk-")) {
    warnings.push("OPENAI_API_KEY no comienza con el prefijo estándar 'sk-'.")
  }

  // 5. CRON_SECRET (Recomendado en producción para rutas /api/cron/*)
  const cronSecret = env.CRON_SECRET?.trim()
  if (!cronSecret) {
    warnings.push("CRON_SECRET no está definida; las rutas cron de agenda y campañas no estarán protegidas.")
  } else if (isPlaceholder(cronSecret) || cronSecret.length < 16) {
    errors.push("CRON_SECRET contiene un valor dummy o inseguro (debe tener al menos 16 caracteres).")
  }

  // 6. FIREBASE_SERVICE_ACCOUNT_JSON (Opcional si no se usan push, pero validado si se define)
  const fcmJson = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (fcmJson) {
    try {
      const parsed = JSON.parse(fcmJson)
      if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
        errors.push("FIREBASE_SERVICE_ACCOUNT_JSON debe ser un JSON válido con project_id, private_key y client_email.")
      }
    } catch {
      errors.push("FIREBASE_SERVICE_ACCOUNT_JSON contiene JSON malformado.")
    }
  }

  // 7. BOT_API_URL y BOT_API_SHARED_SECRET
  const botUrl = env.BOT_API_URL?.trim()
  const botSecret = env.BOT_API_SHARED_SECRET?.trim()
  if (botUrl) {
    try {
      new URL(botUrl)
    } catch {
      errors.push(`BOT_API_URL no es una URL válida: '${botUrl}'`)
    }
    if (!botSecret || isPlaceholder(botSecret)) {
      errors.push("BOT_API_SHARED_SECRET es requerida cuando BOT_API_URL está configurada y no debe ser placeholder.")
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

if (process.argv[1]?.endsWith("preflight-env.ts")) {
  console.log("================================================================")
  console.log(" 🔍 PREFLIGHT DE CONFIGURACIÓN DE ENTORNO — LA VEINTE DIGITAL")
  console.log("================================================================\n")

  const isStrict = process.argv.includes("--strict") || process.env.NODE_ENV === "production"
  const result = validateProductionEnv(process.env)

  if (result.warnings.length > 0) {
    console.log("⚠️ ADVERTENCIAS DE CONFIGURACIÓN:")
    for (const w of result.warnings) {
      console.log(`   - ${w}`)
    }
    console.log("")
  }

  if (!result.valid) {
    console.error("❌ ERRORES DE VALIDACIÓN DE ENTORNO ENCONTRADOS:")
    for (const e of result.errors) {
      console.error(`   - [FAIL] ${e}`)
    }
    console.error("\n💥 PREFLIGHT FALLIDO. Corrige las variables de entorno antes de continuar.")
    if (isStrict) {
      process.exit(1)
    } else {
      console.log("(Modo permisivo de desarrollo: no se aborta el proceso)")
      process.exit(0)
    }
  }

  console.log("✅ Configuración de variables de entorno validada exitosamente para producción.\n")
  process.exit(0)
}
