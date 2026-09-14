/**
 * Utilidades de almacenamiento local con ámbito por usuario autenticado.
 *
 * Multiusuario: en un navegador compartido, las claves globales antiguas
 * (`nomina_profile`, `nomina_payslips`, etc.) permitían que una cuenta leyera
 * o sobrescribiera datos de otra. Toda lectura/escritura autenticada usa ahora
 * un namespace derivado EXCLUSIVAMENTE del `user.id` (UUID de Supabase Auth).
 *
 * Reglas:
 * - Sin `userId` no hay operación: se lanza error (nunca se cae a una clave
 *   compartida en silencio).
 * - Las claves antiguas sin namespace quedan en cuarentena lógica: no se
 *   leen, no se borran y no se adjudican a ningún usuario.
 */

export const AUTHENTICATED_USER_REQUIRED = "Authenticated userId is required"

/** Construye la clave de almacenamiento versionada y separada por usuario. */
export function scopedStorageKey(baseKey: string, userId: string): string {
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new Error(AUTHENTICATED_USER_REQUIRED)
  }
  return `${baseKey}:v2:${userId}`
}
