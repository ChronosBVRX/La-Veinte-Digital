import type { ReactNode } from "react"
import "./globals.css"

export const metadata = {
  title: "La Veinte Digital",
  description: "Plataforma digital de la comunidad",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
