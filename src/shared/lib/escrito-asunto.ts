/**
 * Utilidades para detección, validación e inferencia de asuntos en escritos formales.
 * Asegura que el asunto esté siempre vinculado al problema o trámite real
 * y nunca a etiquetas genéricas de interfaz (ej. "Redacción Libre: Solicitud formal").
 *
 * La Veinte Digital
 */

import { TIPOS_ESCRITO, type TipoEscritoKey } from "@/shared/contracts/escrito-draft"

/**
 * Determina si un asunto es genérico, vacío o un placeholder de interfaz que debe ser reemplazado.
 */
export function isGenericAsunto(asunto: string | undefined | null): boolean {
  if (!asunto) return true
  const norm = asunto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

  if (norm.length < 4) return true

  const genericPatterns = [
    /^redaccion\s*libre(?::\s*solicitud\s*formal)?$/i,
    /^(?:solicitud|aclaracion|queja(?:\s*\/\s*inconformidad)?|inconformidad|seguimiento)(?::\s*solicitud\s*formal)?$/i,
    /^solicitud\s*formal$/i,
    /^nuevo\s*escrito$/i,
    /^asunto(?:\s*del\s*escrito)?$/i,
    /^sin\s*asunto$/i,
    /^oficio\s*formal$/i,
  ]

  return genericPatterns.some((p) => p.test(norm))
}

/**
 * Infiere un asunto formal directamente relacionado con el problema expuesto
 * a partir de la petición, los hechos y el tipo de trámite.
 */
export function inferAsuntoFromProblem(
  tipo: string = "solicitud",
  hechos: string = "",
  peticion: string = "",
  currentAsunto?: string
): string {
  if (currentAsunto && !isGenericAsunto(currentAsunto)) {
    return currentAsunto.trim()
  }

  const combined = `${peticion} ${hechos}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  // Detección temática por palabras clave del ámbito laboral IMSS / SNTSS
  if (
    combined.includes("descuento") ||
    combined.includes("054") ||
    combined.includes("nomina") ||
    combined.includes("pago indebido")
  ) {
    return "Aclaración sobre descuento en nómina y solicitud de reintegro"
  }
  if (
    combined.includes("vacaci") ||
    combined.includes("rol vacacional") ||
    combined.includes("periodo vacacional")
  ) {
    return "Solicitud de programación y disfrute de periodo vacacional"
  }
  if (
    combined.includes("licencia") ||
    combined.includes("permiso contractual") ||
    combined.includes("incapacidad")
  ) {
    return "Solicitud de licencia y justificación de ausencia laboral"
  }
  if (
    combined.includes("cambio de adscripci") ||
    combined.includes("adscripcion") ||
    combined.includes("reubicaci") ||
    combined.includes("cambio de servicio")
  ) {
    return "Solicitud de cambio de adscripción y reubicación laboral"
  }
  if (
    combined.includes("cambio de turno") ||
    combined.includes("rol de servicio") ||
    combined.includes("rol de guardia") ||
    combined.includes("asignacion de rol") ||
    combined.includes("regularizacion de turno") ||
    combined.includes("ajuste de jornada") ||
    combined.includes("cambio de horario")
  ) {
    return "Solicitud de regularización de turno y asignación de rol de servicio"
  }
  if (
    combined.includes("uniforme") ||
    combined.includes("calzado") ||
    combined.includes("ropa de trabajo") ||
    combined.includes("equipo de protecci")
  ) {
    return "Solicitud de dotación de uniformes y equipo de trabajo"
  }
  if (
    combined.includes("hostigamiento") ||
    combined.includes("acoso") ||
    combined.includes("maltrato") ||
    combined.includes("trato indigno") ||
    combined.includes("violencia")
  ) {
    return "Inconformidad por trato indebido y afectación a las condiciones de trabajo"
  }
  if (
    combined.includes("escalafon") ||
    combined.includes("plaza") ||
    combined.includes("propuesta sindical") ||
    combined.includes("antiguedad")
  ) {
    return "Solicitud de intervención para trámite escalafonario y reconocimiento de derechos"
  }
  if (
    combined.includes("guarderia") ||
    combined.includes("lactancia") ||
    combined.includes("maternidad")
  ) {
    return "Solicitud de facilidades laborales por derecho de lactancia y maternidad"
  }
  if (
    combined.includes("prestamo") ||
    combined.includes("caja de ahorro") ||
    combined.includes("credito")
  ) {
    return "Solicitud y seguimiento de trámite de préstamo institucional"
  }

  // Extracción inteligente a partir de la petición o hechos
  const sourceText = peticion.trim().length >= 8 ? peticion.trim() : hechos.trim()
  if (sourceText.length >= 8) {
    // Limpiar introducciones comunes y artículos iniciales
    const clean = sourceText
      .replace(
        /^(?:por medio de la presente\s*(?:solicito|me dirijo|expongo)?|solicito\s*(?:atentamente|de la manera m[aá]s atenta)?|se solicita\s*(?:de la manera m[aá]s atenta)?|aclaro que|expongo que|solicitud formal de|pido que|vengo a manifestar que)\s*(?:el|la|los|las|un|una)?\s*/i,
        ""
      )
      .trim()

    // Tomar primera frase u oración
    const firstPart = clean.split(/[.\n;]/)[0]?.trim() || clean
    if (firstPart.length >= 8) {
      let formatted = firstPart.charAt(0).toUpperCase() + firstPart.slice(1)
      if (formatted.length > 90) {
        formatted = `${formatted.slice(0, 87)}...`
      }

      if (tipo === "aclaracion" && !formatted.toLowerCase().startsWith("aclaraci")) {
        return `Aclaración sobre ${formatted.charAt(0).toLowerCase() + formatted.slice(1)}`
      }
      if (
        tipo === "queja" &&
        !formatted.toLowerCase().startsWith("inconformidad") &&
        !formatted.toLowerCase().startsWith("queja")
      ) {
        return `Inconformidad por ${formatted.charAt(0).toLowerCase() + formatted.slice(1)}`
      }
      if (tipo === "seguimiento" && !formatted.toLowerCase().startsWith("seguimiento")) {
        return `Seguimiento a trámite de ${formatted.charAt(0).toLowerCase() + formatted.slice(1)}`
      }
      if (tipo === "solicitud" && !formatted.toLowerCase().startsWith("solicitud")) {
        return `Solicitud de ${formatted.charAt(0).toLowerCase() + formatted.slice(1)}`
      }
      return formatted
    }
  }

  const tipoDef = TIPOS_ESCRITO[tipo as TipoEscritoKey]
  const tipoTitulo = tipoDef?.titulo || "Oficio"
  return `${tipoTitulo} relativo a condiciones y prestaciones laborales`
}
