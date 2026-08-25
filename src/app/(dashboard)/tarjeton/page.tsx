import { redirect } from "next/navigation"

/**
 * La importación de tarjetones vive en Mi información laboral:
 * /profile/mi-informacion-laboral (sección "Subir tarjetón IMSS").
 * Esta ruta se mantiene como redirect para compatibilidad de enlaces.
 */
export default function TarjetonPage() {
  redirect("/profile/mi-informacion-laboral")
}
