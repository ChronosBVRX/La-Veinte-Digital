"use client"

import { Sun, Moon, Clock } from "@phosphor-icons/react"

interface DashboardHeroProps {
  fullName: string | null
  greeting: string
  dateLabel: string
}

export function DashboardHero({ fullName, greeting, dateLabel }: DashboardHeroProps) {
  const firstName = fullName?.split(" ")[0] ?? ""

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
          {greeting === "Buenos días" && <Sun size={22} weight="duotone" color="var(--brand-cyan)" />}
          {greeting === "Buenas tardes" && <Clock size={22} weight="duotone" color="var(--brand-cyan)" />}
          {greeting !== "Buenos días" && greeting !== "Buenas tardes" && <Moon size={22} weight="duotone" color="var(--brand-cyan)" />}
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
          {dateLabel}
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
