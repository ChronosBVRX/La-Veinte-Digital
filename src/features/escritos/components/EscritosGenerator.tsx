"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { generarEscrito } from "@/features/escritos/services/generarEscrito"
import { EscritosForm } from "./EscritosForm"
import { EscritosResult } from "./EscritosResult"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import type { ChangeEvent } from "react"

interface Profile {
  full_name: string
  matricula: string
  categoria: string
  adscripcion: string
}

interface FormState {
  destino: string
  fecha: string
  ciudad: string
  detalle: string
  atencion: string
  copia: string
}

export function EscritosGenerator() {
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [cargandoPerfil, setCargandoPerfil] = useState(true)
  const [perfilIncompleto, setPerfilIncompleto] = useState(false)

  const [form, setForm] = useState<FormState>({
    destino: "",
    fecha: "",
    ciudad: "",
    detalle: "",
    atencion: "",
    copia: "",
  })
  const [textoGenerado, setTextoGenerado] = useState("")
  const [loading, setLoading] = useState(false)
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false)
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false)
  const [fotos, setFotos] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = "/login"
        return
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, matricula, categoria, adscripcion")
        .eq("id", user.id)
        .maybeSingle()

      setCargandoPerfil(false)

      if (!prof || !prof.full_name || !prof.matricula || !prof.categoria || !prof.adscripcion) {
        setPerfilIncompleto(true)
        return
      }

      setProfile(prof as Profile)
      setForm((prev) => ({
        ...prev,
        fecha: new Date().toISOString().split("T")[0],
      }))
    })
  }, [supabase])

  const updateField = useCallback((field: string, value: string) => {
    if (field === "textoGenerado") {
      setTextoGenerado(value)
    } else {
      setForm((prev) => ({ ...prev, [field]: value }))
    }
  }, [])

  const handleFotosChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const nuevasFotos: string[] = []
    files.forEach((f) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        nuevasFotos.push(ev.target?.result as string)
        if (nuevasFotos.length === files.length) {
          setFotos(nuevasFotos)
        }
      }
      reader.readAsDataURL(f)
    })
  }, [])

  const generar = useCallback(async () => {
    if (!form.destino || !form.detalle.trim()) return

    setLoading(true)
    setTextoGenerado("")

    try {
      const respuesta = await generarEscrito(form.detalle)
      setTextoGenerado(respuesta)
    } catch {
      setTextoGenerado(
        "Por medio de la presente, expongo ante usted los siguientes hechos:\n\n" +
        form.detalle +
        "\n\nPor lo anteriormente expuesto, solicito atentamente se dé solución a mi petición conforme a derecho corresponda."
      )
    } finally {
      setLoading(false)
    }
  }, [form.destino, form.detalle])

  const limpiar = useCallback(() => {
    setForm({ destino: "", fecha: new Date().toISOString().split("T")[0], ciudad: "", detalle: "", atencion: "", copia: "" })
    setTextoGenerado("")
    setFotos([])
  }, [])

  if (cargandoPerfil) {
    return <LoadingSpinner text="Verificando credenciales..." />
  }

  if (perfilIncompleto) {
    return (
      <div style={{
        maxWidth: 500, margin: "2rem auto", textAlign: "center",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.5rem", padding: "2.5rem 1.5rem",
      }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔒</div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Perfil Incompleto</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Para generar documentos oficiales, necesitas completar tu información (Nombre, Matrícula, Categoría y Adscripción).
        </p>
        <a href="/profile"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            padding: "0.625rem 1.5rem", borderRadius: "2rem",
            background: "var(--primary)", color: "var(--primary-fg)",
            textDecoration: "none", fontWeight: 600, fontSize: "0.875rem",
          }}
        >
          Ir a Editar Perfil
        </a>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
          Generador de Escritos PDF
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
          Redacta documentos formales con apoyo de IA, ed&iacute;talos y desc&aacute;rgalos en PDF
        </p>
      </div>

      <EscritosForm
        profile={profile}
        destino={form.destino}
        fecha={form.fecha}
        ciudad={form.ciudad}
        detalle={form.detalle}
        textoGenerado={textoGenerado}
        atencion={form.atencion}
        copia={form.copia}
        fotos={fotos}
        loading={loading}
        mostrarAvanzado={mostrarAvanzado}
        onChange={updateField}
        onGenerate={generar}
        onPreview={() => setMostrarVistaPrevia(true)}
        onToggleAvanzado={() => setMostrarAvanzado((v) => !v)}
        onFotosChange={handleFotosChange}
        onClear={limpiar}
      />

      {mostrarVistaPrevia && textoGenerado && profile && (
        <EscritosResult
          cuerpo={textoGenerado}
          destino={form.destino}
          ciudad={form.ciudad}
          fecha={form.fecha}
          nombre={profile.full_name}
          matricula={profile.matricula}
          categoria={profile.categoria}
          adscripcion={profile.adscripcion}
          atencion={form.atencion}
          copia={form.copia}
          fotos={fotos}
          onClose={() => setMostrarVistaPrevia(false)}
        />
      )}

      {fotos.length > 0 && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "0.5rem", padding: "1rem", marginTop: "1rem",
        }}>
          <p style={{ fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            {fotos.length} foto(s) adjunta(s) como evidencia
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {fotos.map((f, i) => (
              <img key={i} src={f} alt={`Evidencia ${i + 1}`}
                style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "0.375rem", border: "2px solid var(--primary)" }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
