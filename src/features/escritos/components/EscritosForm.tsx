"use client"

import { useState } from "react"
import { Select, Input, Textarea } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { COMITE_SECCIONAL, VALOR_DESTINO_MANUAL } from "@/features/escritos/data/comite-seccional"
import type { ChangeEvent } from "react"

interface ProfileData {
  full_name: string
  matricula: string
  categoria: string
  adscripcion: string
}

interface EscritosFormProps {
  profile: ProfileData | null
  destino: string
  fecha: string
  ciudad: string
  detalle: string
  textoGenerado: string
  atencion: string
  copia: string
  fotos: string[]
  loading: boolean
  mostrarAvanzado: boolean
  onChange: (field: string, value: string) => void
  onGenerate: () => void
  onPreview: () => void
  onToggleAvanzado: () => void
  onFotosChange: (e: ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}

export function EscritosForm({
  profile, destino, fecha, ciudad, detalle, textoGenerado,
  atencion, copia, fotos, loading, mostrarAvanzado,
  onChange, onGenerate, onPreview, onToggleAvanzado, onFotosChange, onClear,
}: EscritosFormProps) {
  const [modoManual, setModoManual] = useState(false)
  const [cargoManual, setCargoManual] = useState("")
  const [nombreManual, setNombreManual] = useState("")

  const destinoOptions = COMITE_SECCIONAL.map((g) => (
    <optgroup key={g.group} label={g.group}>
      {g.items.map((i) => (
        <option key={i.value} value={i.value}>{i.label}</option>
      ))}
    </optgroup>
  ))

  const handleDestinoChange = (value: string) => {
    if (value === VALOR_DESTINO_MANUAL) {
      setModoManual(true)
      onChange("destino", "")
      return
    }
    setModoManual(false)
    onChange("destino", value)
  }

  const updateManualDestino = (campo: "cargo" | "nombre", value: string) => {
    const cargo = campo === "cargo" ? value : cargoManual
    const nombre = campo === "nombre" ? value : nombreManual
    if (campo === "cargo") setCargoManual(value)
    else setNombreManual(value)
    onChange("destino", cargo.trim() && nombre.trim() ? `${cargo.trim()}|${nombre.trim()}` : "")
  }

  return (
    <div>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.75rem",
        padding: "1.25rem", marginBottom: "1rem",
      }}>
        {/* Perfil compacto */}
        <div style={{
          display: "flex", gap: "0.75rem", alignItems: "flex-start",
          padding: "0.875rem 1rem", background: "var(--accent)", borderRadius: "0.5rem",
          border: "1px solid var(--border)", marginBottom: "1.25rem",
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, var(--brand-navy), var(--brand-blue))",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: "1rem",
          }}>
            👤
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere" }}>{profile?.full_name ?? "—"}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem", lineHeight: 1.4, overflowWrap: "anywhere" }}>
              {profile?.matricula ? `Mat. ${profile.matricula}` : ""}{profile?.matricula && profile?.categoria ? " · " : ""}{profile?.categoria ?? ""}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4, overflowWrap: "anywhere" }}>{profile?.adscripcion ?? ""}</div>
          </div>
          <a
            href="/profile"
            style={{
              fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)", textDecoration: "none",
              border: "1px solid var(--border)", borderRadius: "999px", padding: "0.3rem 0.625rem",
              background: "var(--card)", flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            Editar
          </a>
        </div>

        {/* Paso 1: Destinatario */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "0.5rem" }}>1 · Destinatario</div>

          <Select label="¿A quién va dirigido?" value={modoManual ? VALOR_DESTINO_MANUAL : destino} onChange={(e) => handleDestinoChange(e.target.value)}>
            <option value="">— Selecciona —</option>
            {destinoOptions}
            <option value={VALOR_DESTINO_MANUAL}>— Otra persona (fuera del Comité Seccional) —</option>
          </Select>
        </div>

        {!modoManual ? (
          <button
            type="button"
            onClick={() => { setModoManual(true); onChange("destino", "") }}
            style={{
              background: "none", border: "none", color: "var(--primary)",
              fontSize: "0.8125rem", cursor: "pointer", padding: 0, marginBottom: "1rem",
              fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "2px",
            }}
          >
            ¿Destinatario fuera del Comité Seccional? Llenar manualmente →
          </button>
        ) : (
          <div style={{ marginBottom: "1rem" }}>
            <div
              style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem",
                padding: "1rem", background: "var(--accent)",
                borderRadius: "0.375rem", border: "1px solid var(--border)",
              }}
            >
              <div style={{ gridColumn: "1 / -1", fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Llenado manual — destinatario fuera del Comité
              </div>
              <Input
                label="Cargo (ej. Presidente del Comité Delegacional)"
                value={cargoManual}
                onChange={(e) => updateManualDestino("cargo", e.target.value)}
                placeholder="Ej. Comité Delegacional de Morelia"
              />
              <Input
                label="Nombre del destinatario"
                value={nombreManual}
                onChange={(e) => updateManualDestino("nombre", e.target.value)}
                placeholder="Ej. Lic. Juan Pérez López"
              />
            </div>
            <button
              type="button"
              onClick={() => { setModoManual(false); setCargoManual(""); setNombreManual(""); onChange("destino", "") }}
              style={{
                background: "none", border: "none", color: "var(--muted)",
                fontSize: "0.8125rem", cursor: "pointer", padding: 0, marginTop: "0.5rem",
                fontWeight: 500,
              }}
            >
              ← Volver a lista del Comité Seccional
            </button>
          </div>
        )}

        {(() => {
          const visor = (() => {
            if (modoManual) {
              if (!cargoManual.trim() || !nombreManual.trim()) return null
              return { cargo: cargoManual.trim(), nombre: nombreManual.trim(), manual: true }
            }
            if (!destino || !destino.includes("|")) return null
            const [cargo, nombre] = destino.split("|")
            if (!cargo || !nombre) return null
            return { cargo, nombre, manual: false }
          })()
          if (!visor) return null
          return (
            <div style={{
              marginBottom: "1rem", padding: "0.75rem 1rem",
              background: "var(--card)", border: "1px solid var(--border)",
              borderLeft: "3px solid var(--primary)", borderRadius: "0.375rem",
              display: "flex", gap: "0.75rem", alignItems: "center",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.1rem",
              }}>
                ✉
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {visor.manual ? "Dirigido a (manual)" : "Dirigido a"}
                </div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{visor.nombre}</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{visor.cargo}</div>
              </div>
            </div>
          )
        })()}

        {/* Paso 2: Datos del escrito */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "0.5rem" }}>2 · Datos del escrito</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Input label="Fecha del escrito" type="date" value={fecha} onChange={(e) => onChange("fecha", e.target.value)} />
            <Input label="Lugar (Municipio)" value={ciudad} onChange={(e) => onChange("ciudad", e.target.value)} placeholder="Ej. Morelia" />
          </div>
        </div>

        {/* Paso 3: Situación */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "0.5rem" }}>3 · Situación / hechos</div>
          <Textarea
            label="Descripción de los hechos"
            value={detalle}
            onChange={(e) => onChange("detalle", e.target.value)}
            placeholder="Explica tu trámite o problema de forma clara..."
            rows={5}
          />
        </div>

        <button
          type="button"
          onClick={onToggleAvanzado}
          style={{
            background: "none", border: "none", color: "var(--muted)", fontSize: "0.8125rem",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem",
            margin: "1rem auto", padding: "0.5rem", borderRadius: "0.375rem", width: "100%",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "1rem" }}>⚙</span>
          {mostrarAvanzado ? "Ocultar" : "Mostrar"} Opciones Avanzadas (Copias, Evidencia)
        </button>

        {mostrarAvanzado && (
          <div style={{ paddingTop: "1rem", marginTop: "1rem", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <Select label="Con atención a" value={atencion} onChange={(e) => onChange("atencion", e.target.value)}>
                <option value="">Ninguno</option>
                {destinoOptions}
              </Select>
              <Select label="Con copia para (c.c.p.)" value={copia} onChange={(e) => onChange("copia", e.target.value)}>
                <option value="">Ninguno</option>
                {destinoOptions}
              </Select>
            </div>
            <div>
              <Input label="Anexar fotografías de evidencia" type="file" multiple accept="image/*" onChange={onFotosChange} />
              {fotos.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                  {fotos.map((f, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={i} src={f} alt={`Evidencia ${i + 1}`}
                      style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "0.375rem", border: "2px solid var(--primary)" }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
          <Button onClick={onGenerate} disabled={loading || !destino || !detalle.trim()} loading={loading} style={{ flex: 1, minWidth: 160 }}>
            {loading ? "Redactando con IA..." : "✦ Generar borrador"}
          </Button>
          <Button variant="secondary" onClick={onClear} disabled={loading}>
            Limpiar
          </Button>
        </div>
      </div>

      {textoGenerado && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem",
          padding: "1.5rem", marginBottom: "1.5rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Texto generado</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Puedes editarlo antes de previsualizar</span>
          </div>
          <textarea
            value={textoGenerado}
            onChange={(e) => onChange("textoGenerado", e.target.value)}
            style={{
              width: "100%", minHeight: 180, padding: "1rem", borderRadius: "0.375rem",
              border: "1px solid var(--border)", background: "var(--bg)", color: "var(--fg)",
              fontSize: "0.875rem", fontFamily: "'Georgia', 'Times New Roman', serif", lineHeight: 1.6,
              resize: "vertical", outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <Button onClick={onPreview}>
              Previsualizar Documento
            </Button>
            <Button variant="secondary" onClick={onGenerate} loading={loading}>
              Regenerar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
