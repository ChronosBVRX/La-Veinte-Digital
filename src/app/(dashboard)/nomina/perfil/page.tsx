import { redirect } from "next/navigation"

/**
 * El perfil laboral se configura en /profile/mi-informacion-laboral
 * (captura manual o importación de tarjetón). Esta ruta quedaba huérfana:
 * su wizard nunca persistía datos.
 */
export default function NominaPerfilPage() {
  redirect("/profile/mi-informacion-laboral")
}
