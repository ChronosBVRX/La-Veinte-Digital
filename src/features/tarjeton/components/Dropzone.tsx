"use client"

import { useCallback, useRef, useState, type DragEvent } from "react"
import { Button } from "@/shared/components/ui/Button"

interface DropzoneProps {
  onFile: (file: File) => void
  disabled?: boolean
}

export function Dropzone({ onFile, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback((files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    onFile(file)
  }, [onFile])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div
      role="button"
      aria-label="Seleccionar tarjetón PDF"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        background: dragging ? "var(--accent)" : "var(--card)",
        padding: "2.5rem 1.5rem",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all var(--transition)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled}
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div style={{ fontSize: "2rem", lineHeight: 1 }}>📄</div>
      <div style={{ fontWeight: 700, color: "var(--fg)", fontSize: "0.9375rem" }}>
        Arrastra tu tarjetón aquí o haz clic para elegirlo
      </div>
      <div style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
        PDF de hasta 10 MB y 4 páginas · el archivo se lee en tu dispositivo, nunca se sube
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        style={{ marginTop: "0.5rem" }}
        onClick={(e) => {
          e.stopPropagation()
          inputRef.current?.click()
        }}
      >
        Elegir archivo
      </Button>
    </div>
  )
}
