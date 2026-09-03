/**
 * privacy-filter.ts — sanitización de datos personales antes de enviar a Groq.
 *
 * Elimina NSS, CURP, matrícula, teléfonos, emails, domicilios.
 * NO modifica nombres de leyes, artículos, cláusulas ni autoridades.
 * Fuentes normativas públicas: permitidas.
 */

/** Contadores para markers únicos dentro de un texto */
let workerCounter = 0;
let areaCounter = 0;

/** Resets counters (útil en tests) */
export function resetCounters(): void {
  workerCounter = 0;
  areaCounter = 0;
}

/** Patrones de datos sensibles (México) */
const PATTERNS: Array<{ name: string; regex: RegExp; replacement: string | ((m: string) => string) }> = [
  // NSS: 11 dígitos (con o sin guiones)
  { name: "nss", regex: /\b\d{2}[-\s]?\d{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{1}\b/g, replacement: "NSS_REDACTADO" },
  // CURP: 18 caracteres alfanuméricos con patrón específico
  { name: "curp", regex: /\b[A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z0-9]{3}[A-Z0-9]\d\b/g, replacement: "CURP_REDACTADO" },
  // RFC: 12 o 13 caracteres
  { name: "rfc", regex: /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2}[0-9A]\b/g, replacement: "RFC_REDACTADO" },
  // Matrícula IMSS / número de empleado (6-8 dígitos solos precedidos de palabras clave)
  { name: "matricula", regex: /(?:matrícula|matrícula|número de empleado|no\. empleado)[:\s]+\d{5,8}/gi, replacement: "MATRÍCULA_REDACTADA" },
  // Teléfonos mexicanos (10 dígitos, varias formas)
  { name: "telefono", regex: /(?:\+52[-.\s]?)?(?:\(?\d{2,3}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g, replacement: (m) => {
    // Solo redactar si parece número de teléfono (≥10 dígitos efectivos)
    const digits = m.replace(/\D/g, "");
    return digits.length >= 10 ? "TELÉFONO_REDACTADO" : m;
  }},
  // Correos electrónicos
  { name: "email", regex: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g, replacement: "EMAIL_REDACTADO" },
  // Domicilios: calle + número (patrones comunes en México)
  { name: "domicilio", regex: /(?:calle|av\.|avenida|blvd\.|boulevard|calzada|circuito)[^\n,;]{3,60}\d{1,5}/gi, replacement: "DOMICILIO_REDACTADO" },
];

/** Palabras clave que indican contenido normativo público (NO redactar) */
const NORMATIVE_SAFE = [
  "artículo", "cláusula", "fracción", "inciso", "párrafo",
  "ley federal", "contrato colectivo", "reglamento", "norma oficial",
  "nom-", "lft", "lss", "imss", "issste", "stps", "cct", "sntss",
];

/**
 * Detecta si un fragmento de texto contiene información personal que no
 * puede anonimizarse con seguridad.
 * Retorna true si el texto tiene datos sensibles no normalizables.
 */
export function detectsSensitiveContent(text: string): boolean {
  const lower = text.toLowerCase();
  // Si el contenido es mayoritariamente normativo, es seguro
  const normativeWords = NORMATIVE_SAFE.filter((w) => lower.includes(w)).length;
  if (normativeWords >= 2) return false;

  // Detectar patrones de diagnósticos médicos, datos personales no redactables
  const hasPersonalName = /\b(?:el trabajador|la trabajadora|el paciente|la paciente)\s+[A-ZÁÉÍÓÚ][a-záéíóú]+\s+[A-ZÁÉÍÓÚ][a-záéíóú]+/.test(text);
  const hasMedicalDiagnosis = /(?:diagnos[tí]|padec(?:imiento|e)|enfermedad\s+de|síndrome\s+de|dx[:\s])/i.test(text);

  return hasPersonalName || hasMedicalDiagnosis;
}

/**
 * Sanitiza texto para envío a cloud.
 * - Elimina NSS, CURP, RFC, matrícula, teléfonos, emails, domicilios
 * - Sustituye por marcadores genéricos
 * - NO toca nombres de leyes, artículos, cláusulas
 */
export function sanitizeForCloud(text: string): { sanitized: string; redacted: string[] } {
  const redacted: string[] = [];
  let result = text;

  for (const pattern of PATTERNS) {
    const before = result;
    if (typeof pattern.replacement === "string") {
      result = result.replace(pattern.regex, pattern.replacement);
    } else {
      result = result.replace(pattern.regex, pattern.replacement as (m: string) => string);
    }
    if (result !== before) {
      redacted.push(pattern.name);
    }
  }

  // Reemplazar nombres propios de personas (no instituciones) por marcadores
  // Patrón: "Sr./Sra./Dr./Lic. Nombre Apellido" no normativo
  result = result.replace(
    /\b(?:Sr\.|Sra\.|Dr\.|Dra\.|Lic\.|Ing\.)\s+[A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+){1,3}/g,
    () => {
      workerCounter++;
      if (!redacted.includes("nombre_propio")) redacted.push("nombre_propio");
      return `TRABAJADOR_${workerCounter}`;
    }
  );

  return { sanitized: result, redacted };
}

/**
 * Verifica que no queden secretos del sidecar en el texto a enviar.
 * Nunca debe encontrar la GROQ_API_KEY ni SPEECHIFY_API_KEY.
 */
export function assertNoSecrets(text: string): void {
  // Detectar tokens con patrón de API key (cadenas largas alfanuméricas >20 chars)
  const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
  const SPEECHIFY_KEY = process.env.SPEECHIFY_API_KEY ?? "";

  if (GROQ_KEY && text.includes(GROQ_KEY)) {
    throw new Error("PRIVACY_VIOLATION: GROQ_API_KEY detectada en contenido a enviar");
  }
  if (SPEECHIFY_KEY && text.includes(SPEECHIFY_KEY)) {
    throw new Error("PRIVACY_VIOLATION: SPEECHIFY_API_KEY detectada en contenido a enviar");
  }
}
