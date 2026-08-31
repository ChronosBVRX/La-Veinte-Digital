import type { ReactNode } from "react"
import type { Viewport } from "next"
import { Inter } from "next/font/google"
import { MobileViewportProvider } from "@/shared/components/layout/MobileViewportProvider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], display: "swap" })

export const metadata = {
  title: "La Veinte Digital",
  description: "Plataforma digital de la comunidad SNTSS",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17324d",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.className}>
      <body>
        <MobileViewportProvider>
          {children}
        </MobileViewportProvider>
      </body>
    </html>
  )
}
