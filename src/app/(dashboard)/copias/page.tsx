import { redirect } from "next/navigation"

export const metadata = {
  title: "Sacar copias",
  description: "Usa tu celular como escáner y envía el documento a imprimir en una computadora con QR.",
}

export default function CopiasPage() {
  redirect("/")
}

