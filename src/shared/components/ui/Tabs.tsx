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

  const isTwoTabs = tabs.length === 2

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: isTwoTabs ? "0.25rem" : "0.125rem",
          borderBottom: "1px solid var(--border)",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          overflowX: isTwoTabs ? "visible" : "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          ...style,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: isTwoTabs ? "0.5rem 0.5rem" : "0.625rem 0.875rem",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--primary)" : "var(--muted)",
                borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                marginBottom: "-1px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
                flex: isTwoTabs ? "1 1 0" : "0 0 auto",
                minWidth: 0,
                minHeight: 44,
                whiteSpace: isTwoTabs ? "normal" : "nowrap",
                wordBreak: "break-word",
                lineHeight: 1.25,
                textAlign: "center",
                transition: "color var(--transition), border-color var(--transition)",
                boxSizing: "border-box",
              }}
            >
              {tab.icon && <span style={{ display: "inline-flex", flexShrink: 0 }}>{tab.icon}</span>}
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{tab.label}</span>
              {tab.badge && <span style={{ display: "inline-flex", flexShrink: 0 }}>{tab.badge}</span>}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", paddingTop: "0.75rem" }}
      >
        {children?.(activeTab)}
      </div>
    </div>
  )
}
