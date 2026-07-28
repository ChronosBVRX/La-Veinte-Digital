"use client"

import { useState } from "react"
import type { ReactNode, CSSProperties } from "react"

interface Tab {
  id: string
  label: string
  icon?: ReactNode
  badge?: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (tabId: string) => void
  style?: CSSProperties
  children?: (activeTab: string) => ReactNode
}

export function Tabs({ tabs, defaultTab, onChange, style, children }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "")

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    onChange?.(tabId)
  }

  return (
    <div>
      <div style={{
        display: "flex", gap: "0.125rem",
        borderBottom: "1px solid var(--border)", ...style,
      }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "0.625rem 1rem",
                fontSize: "0.875rem", fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--primary)" : "var(--muted)",
                borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                marginBottom: "-1px",
                display: "flex", alignItems: "center", gap: "0.375rem",
                whiteSpace: "nowrap",
                transition: "color var(--transition), border-color var(--transition)",
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.badge}
            </button>
          )
        })}
      </div>
      {children?.(activeTab)}
    </div>
  )
}
