"use client"

import { Sun, Moon, Clock } from "@phosphor-icons/react"

interface DashboardHeroProps {
  fullName: string | null
}

const DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
]

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

function getGreeting(): { text: string; Icon: typeof Sun } {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return { text: "Buenos días", Icon: Sun }
  if (hour >= 12 && hour < 19) return { text: "Buenas tardes", Icon: Clock }
  return { text: "Buenas noches", Icon: Moon }
}

export function DashboardHero({ fullName }: DashboardHeroProps) {
  const now = new Date()
  const dayName = DAY_NAMES[now.getDay()]
  const day = now.getDate()
  const month = MONTH_NAMES[now.getMonth()]
  const year = now.getFullYear()
  const firstName = fullName?.split(" ")[0] ?? ""
  const { text: greeting, Icon } = getGreeting()

  return (
    <div
      style={{
        marginBottom: "2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.25rem",
          }}
        >
          <Icon
            size={22}
            weight="duotone"
            color="var(--brand-cyan)"
          />
          <h1
            style={{
              fontSize: "1.375rem",
              fontWeight: 700,
              margin: 0,
              color: "var(--fg)",
              letterSpacing: "-0.02em",
            }}
          >
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.875rem",
            margin: 0,
            textTransform: "capitalize",
          }}
        >
          {dayName} {day} de {month} de {year}
        </p>
        <p
          style={{
            color: "var(--brand-cyan)",
            fontSize: "0.75rem",
            margin: "0.125rem 0 0",
            fontWeight: 500,
          }}
        >
          Tu espacio laboral y sindical
        </p>
      </div>
    </div>
  )
}
