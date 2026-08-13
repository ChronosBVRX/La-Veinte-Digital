"use client"

import { useCallback, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Check, Copy } from "@phosphor-icons/react"

interface TransferQrProps {
  value: string
  caption?: string
}

export function TransferQr({ value, caption }: TransferQrProps) {
  const [copied, setCopied] = useState(false)

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [value])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        padding: "1rem",
        background: "var(--accent)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          padding: "0.75rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
        }}
      >
        <QRCodeSVG value={value} size={208} level="M" />
      </div>
      {caption && (
        <p
          style={{
            margin: 0,
            fontSize: "0.8125rem",
            color: "var(--muted)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {caption}
        </p>
      )}
      <button
        onClick={copyLink}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--primary)",
          fontSize: "0.8125rem",
          fontWeight: 600,
          fontFamily: "inherit",
          padding: 0,
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Enlace copiado" : "Copiar enlace"}
      </button>
    </div>
  )
}
