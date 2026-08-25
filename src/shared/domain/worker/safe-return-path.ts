/**
 * Validación de rutas internas de retorno (returnTo).
 *
 * Solo se aceptan rutas internas de la aplicación. Se rechazan URLs
 * externas (http/https), protocol-relative (//host), javascript:, y
 * cualquier otra que no esté en la lista blanca.
 */
/** Lista blanca de rutas internas a las que se puede volver. */
export const ALLOWED_INTERNAL_RETURN_PATHS: readonly string[] = [
  "/",
  "/profile",
  "/profile/mi-informacion-laboral",
  "/nomina",
  "/simulador-nomina",
  "/calculadoras",
  "/calculadoras/aguinaldo",
  "/calculadoras/clausula-97",
  "/calculadoras/prestamos",
  "/calculadoras/segunda-julio",
  "/calculadoras/segunda-julio-proporcional",
  "/calculadoras/tiempo-extra",
  "/vacaciones",
  "/escritos",
  "/tarjeton",
  "/simulador",
  "/asistente",
]

/** Separa el pathname de un query/hash para comparar contra la lista blanca. */
export function stripQueryAndHash(path: string): string {
  const queryIndex = path.indexOf("?")
  const hashIndex = path.indexOf("#")
  const end =
    queryIndex === -1
      ? hashIndex === -1
        ? path.length
        : hashIndex
      : hashIndex === -1
        ? queryIndex
        : Math.min(queryIndex, hashIndex)
  return path.slice(0, end)
}

/**
 * Determina si un path es un returnTo interno seguro.
 *
 * Reglas:
 * - Debe empezar con "/".
 * - No debe empezar con "//" (protocol-relative).
 * - No debe contener "://" (http, https, javascript, etc.).
 * - No debe empezar con "javascript:".
 * - El pathname (sin query/hash) debe estar en la lista blanca.
 */
export function isSafeInternalReturnPath(
  rawPath: string | null | undefined,
  allowedPaths: readonly string[] = ALLOWED_INTERNAL_RETURN_PATHS,
): boolean {
  if (typeof rawPath !== "string" || rawPath.trim() === "") return false
  const path = rawPath.trim()

  if (!path.startsWith("/")) return false
  if (path.startsWith("//")) return false
  if (path.includes("://")) return false
  if (path.toLowerCase().startsWith("javascript:")) return false

  const pathname = stripQueryAndHash(path)
  return allowedPaths.includes(pathname)
}
