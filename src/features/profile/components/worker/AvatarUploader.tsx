"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Camera, Trash, CircleNotch, User } from "@phosphor-icons/react"
import { Avatar } from "@/shared/components/ui/Avatar"
import { uploadUserAvatar, deleteUserAvatar } from "../../services/avatar-storage"

export interface AvatarUploaderProps {
  initialAvatarUrl?: string | null
  fullName?: string | null
  onAvatarChange?: (newUrl: string | null) => void
}

export function AvatarUploader({
  initialAvatarUrl,
  fullName,
  onAvatarChange,
}: AvatarUploaderProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setErrorMessage(null)
    setStatusMessage("Optimizando y subiendo...")

    try {
      const result = await uploadUserAvatar(file)
      if (result.success && result.avatarUrl) {
        setAvatarUrl(result.avatarUrl)
        onAvatarChange?.(result.avatarUrl)
        setStatusMessage("Foto actualizada")
        setTimeout(() => setStatusMessage(null), 3000)
        router.refresh()
      } else {
        setErrorMessage(result.error || "No se pudo actualizar la foto de perfil.")
        setTimeout(() => setErrorMessage(null), 4000)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado.")
      setTimeout(() => setErrorMessage(null), 4000)
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDelete = async () => {
    if (!avatarUrl || loading) return
    const confirmed = window.confirm("¿Deseas quitar tu foto de perfil?")
    if (!confirmed) return

    setLoading(true)
    setErrorMessage(null)
    setStatusMessage("Eliminando foto...")

    try {
      const result = await deleteUserAvatar()
      if (result.success) {
        setAvatarUrl(null)
        onAvatarChange?.(null)
        setStatusMessage("Foto eliminada")
        setTimeout(() => setStatusMessage(null), 3000)
        router.refresh()
      } else {
        setErrorMessage(result.error || "No se pudo quitar la foto.")
        setTimeout(() => setErrorMessage(null), 4000)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado.")
      setTimeout(() => setErrorMessage(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
        <Avatar
          src={avatarUrl}
          alt={fullName || "Foto de perfil"}
          size={56}
          gradient="linear-gradient(135deg, var(--primary), #6366f1)"
          icon={<User size={28} weight="bold" color="white" />}
          style={{
            border: "2px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        />

        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              zIndex: 2,
            }}
          >
            <CircleNotch size={22} className="animate-spin" />
          </div>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          aria-label="Cambiar foto de perfil"
          title="Cambiar foto de perfil"
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--primary)",
            color: "var(--primary-fg)",
            border: "2px solid var(--card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            padding: 0,
            zIndex: 3,
            transition: "transform 0.15s ease",
          }}
        >
          <Camera size={13} weight="fill" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          style={{ display: "none" }}
          aria-hidden="true"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--primary)",
              cursor: loading ? "not-allowed" : "pointer",
              textDecoration: "underline",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            {avatarUrl ? "Cambiar foto" : "Subir foto"}
          </button>

          {avatarUrl && (
            <>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>•</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#dc2626",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Trash size={12} />
                Quitar foto
              </button>
            </>
          )}
        </div>

        {statusMessage && (
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>
            {statusMessage}
          </span>
        )}
        {errorMessage && (
          <span style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 500 }}>
            {errorMessage}
          </span>
        )}
      </div>
    </div>
  )
}
