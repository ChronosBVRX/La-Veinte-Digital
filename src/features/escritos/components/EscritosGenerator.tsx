"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { generarEscrito } from "@/features/escritos/services/generarEscrito"
import { institutionalToday } from "@/shared/lib/dates"
import { EscritosForm } from "./EscritosForm"
import { EscritosResult, type EscritoASalvar } from "./EscritosResult"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import {
  getEscritosGuardados, guardarEscrito, eliminarEscrito, nuevoIdEscrito,
  type EscritoGuardado,
} from "@/features/escritos/services/escritos-storage"
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
  const [formKey, setFormKey] = useState(0)

  const [escritos, setEscritos] = useState<EscritoGuardado[]>([])
  const [escritoEnVista, setEscritoEnVista] = useState<EscritoGuardado | null>(null)
  const [guardadoMsg, setGuardadoMsg] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación local desde localStorage (solo cliente)
    setEscritos(getEscritosGuardados())
  }, [])

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
        fecha: institutionalToday().toISOString().slice(0, 10),
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
    setForm({ destino: "", fecha: institutionalToday().toISOString().slice(0, 10), ciudad: "", detalle: "", atencion: "", copia: "" })
    setTextoGenerado("")
    setFotos([])
    setFormKey((k) => k + 1)
  }, [])

  const handleGuardar = useCallback(({ escritoId, escrito }: { escritoId?: string; escrito: EscritoASalvar }) => {
    const existente = escritoId ? escritos.find((e) => e.id === escritoId) : undefined
    const nuevo: EscritoGuardado = {
      ...escrito,
      id: escritoId ?? nuevoIdEscrito(),
      createdAt: existente?.createdAt ?? new Date().toISOString(),
    }
    setEscritos(guardarEscrito(nuevo))
    setGuardadoMsg("✓ Escrito guardado en este dispositivo")
    window.setTimeout(() => setGuardadoMsg(""), 3000)
  }, [escritos])

  const abrirEscrito = useCallback((escrito: EscritoGuardado) => {
    setEscritoEnVista(escrito)
  }, [])

  const eliminarEscritoGuardado = useCallback((id: string) => {
    setEscritos(eliminarEscrito(id))
    setEscritoEnVista((actual) => (actual?.id === id ? null : actual))
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
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
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
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "clamp(1.15rem, 4vw, 1.35rem)", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
          Generador de Escritos
        </h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.2rem 0 0", lineHeight: 1.4 }}>
          Redacta documentos formales con apoyo de IA, ed&iacute;talos y desc&aacute;rgalos en PDF
        </p>
      </div>

      <EscritosForm
        key={formKey}
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
          onGuardar={handleGuardar}
          onClose={() => setMostrarVistaPrevia(false)}
        />
      )}

      {escritoEnVista && (
        <EscritosResult
          key={escritoEnVista.id}
          cuerpo={escritoEnVista.cuerpo}
          destino={escritoEnVista.destino}
          ciudad={escritoEnVista.ciudad}
          fecha={escritoEnVista.fecha}
          nombre={escritoEnVista.nombre}
          matricula={escritoEnVista.matricula}
          categoria={escritoEnVista.categoria}
          adscripcion={escritoEnVista.adscripcion}
          atencion={escritoEnVista.atencion}
          copia={escritoEnVista.copia}
          fotos={escritoEnVista.fotos}
          firmaInicial={escritoEnVista.firmaUrl}
          escritoId={escritoEnVista.id}
          onGuardar={handleGuardar}
          onClose={() => setEscritoEnVista(null)}
        />
      )}

      {guardadoMsg && (
        <div style={{
          position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)",
          background: "#16a34a", color: "#fff", padding: "0.625rem 1.25rem",
          borderRadius: "999px", fontSize: "0.875rem", fontWeight: 600,
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)", zIndex: 1200,
        }}>
          {guardadoMsg}
        </div>
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
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={f} alt={`Evidencia ${i + 1}`}
                style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "0.375rem", border: "2px solid var(--primary)" }}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "0.5rem", padding: "1.25rem", marginTop: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
            📂 Mis escritos guardados
            <span style={{
              marginLeft: "0.5rem", fontSize: "0.75rem", fontWeight: 600,
              color: "var(--primary)", background: "var(--accent)",
              padding: "0.125rem 0.5rem", borderRadius: "999px",
            }}>
              {escritos.length}
            </span>
          </h2>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Guardados en este dispositivo
          </span>
        </div>

        {escritos.length === 0 ? (
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            Aún no tienes escritos guardados. Genera uno y usa el botón <strong>💾 Guardar</strong> en la previsualización para conservarlo aquí.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.625rem" }}>
            {escritos.map((e) => {
              const fechaDisplay = e.fecha
                ? new Date(e.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                : ""
              return (
                <div key={e.id} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.75rem 1rem", background: "var(--bg)",
                  border: "1px solid var(--border)", borderRadius: "0.5rem",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.titulo}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {fechaDisplay}
                      {e.matricula ? ` · Mat. ${e.matricula}` : ""}
                    </div>
                  </div>
                  <button onClick={() => abrirEscrito(e)}
                    style={{
                      padding: "0.375rem 0.875rem", borderRadius: "0.5rem",
                      background: "var(--primary)", border: "none",
                      color: "var(--primary-fg)", cursor: "pointer",
                      fontSize: "0.8125rem", fontWeight: 600, flexShrink: 0,
                    }}
                  >
                    🖨 Ver / Imprimir
                  </button>
                  <button onClick={() => eliminarEscritoGuardado(e.id)}
                    aria-label="Eliminar escrito"
                    style={{
                      padding: "0.375rem 0.625rem", borderRadius: "0.5rem",
                      border: "1px solid #ef4444", background: "transparent",
                      color: "#ef4444", cursor: "pointer", fontSize: "0.8125rem", flexShrink: 0,
                    }}
                  >
                    🗑
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
