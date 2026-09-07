import { redirect } from "next/navigation"

/** La proyección de nómina y cálculos viven en /calculadoras. */
export default function NominaProyeccionPage() {
  redirect("/calculadoras")
}
