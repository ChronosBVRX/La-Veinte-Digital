"use client"

import { Select, Input, Textarea } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
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

const DESTINOS = [
  { group: "Secretarías", items: [
    { value: "Secretaría General|Dr. Juan Gerardo García González", label: "Secretaría General" },
    { value: "Secretaría de Interior y Propaganda|M.N.F. Amin Uriel Morales Sánchez", label: "Secretaría de Interior y Propaganda" },
    { value: "Secretaría de Conflictos|J.G.E. Arturo Ochoa Huacuz", label: "Secretaría de Conflictos" },
    { value: "Secretaría de Trabajo|E.G. Cándido Mora Alcauter", label: "Secretaría de Trabajo" },
    { value: "Secretaría del Exterior|M.N.F. Ignacio Agustín Orozco Pérez", label: "Secretaría del Exterior" },
    { value: "Tesorería|EST. Azucena Herrera Martínez", label: "Tesorería" },
    { value: "Secretaría de Previsión Social|A.M. Fabiola Farías Ambriz", label: "Secretaría de Previsión Social" },
    { value: "Secretaría de Igualdad Sustantiva|M.F. Gabriela Durán Negrete", label: "Secretaría de Igualdad Sustantiva" },
    { value: "Secretaría de Asuntos Técnicos|M.N.F. Horacio Peña Alfaro", label: "Secretaría de Asuntos Técnicos" },
    { value: "Secretaría de Actas y Acuerdos|M.G. César Augusto Contreras Flores", label: "Secretaría de Actas y Acuerdos" },
    { value: "Secretaría de Prensa|A.M. Yolanda Morelos Palomares", label: "Secretaría de Prensa" },
    { value: "Secretaría de Puestos Periféricos|M.N.F. Alejandra Johnson Aguirre", label: "Secretaría de Puestos Periféricos" },
    { value: "Secretaría de Admisión y Cambios|C.C. Uriel Tapia Pérez", label: "Secretaría de Admisión y Cambios" },
    { value: "Secretaría de Capacitación y Adiestramiento|O.P. América Hilda Reyes Reyes", label: "Secretaría de Capacitación y Adiestramiento" },
    { value: "Secretaría de Calidad y Modernización|Q.C. Gerardo Ordaz Salazar", label: "Secretaría de Calidad y Modernización" },
    { value: "Secretaría de Acción Social|E.E. Claudia Denisse Torres Rangel", label: "Secretaría de Acción Social" },
  ]},
  { group: "Comisiones", items: [
    { value: "Comisión de Honor y Justicia — Presidencia|J.G.S.T. José Francisco Ruiz Domínguez", label: "Honor y Justicia" },
    { value: "Comisión de Vigilancia — Presidencia|T.R. Eduardo Bolaños Vázquez", label: "Vigilancia" },
    { value: "Comisión de Fomento a la Seguridad Social — Presidencia|M.N.F. Carlos Mojica Rodríguez", label: "Fomento a la Seg. Social" },
    { value: "Comisión de Hacienda — Presidencia|A.L. Ángeles Alejandra Ledesma Torres", label: "Hacienda" },
    { value: "Comisión de Deportes — Presidencia|J.G.P. Roberto Carlos Reyes Ortiz", label: "Deportes" },
    { value: "Comisión de Acción Política — Presidencia|M.N.F. Verónica Diosdado Minguela", label: "Acción Política" },
  ]},
  { group: "Subcomisiones Mixtas", items: [
    { value: "Subcomisión Mixta de Becas — Representación Comunitaria|M.F. Jorge Héctor Zaragoza Palacios", label: "Becas" },
    { value: "Bolsa de Trabajo|C.C. M. Guadalupe Calderón Ayala", label: "Bolsa de Trabajo" },
    { value: "Subcomisión Mixta de Puestos de Confianza 'B' — Representación Comunitaria|M.F. Jorge Hugo Ruiz Saenz", label: "Puestos de Confianza 'B'" },
    { value: "Subcomisión Mixta de Capacitación y Adiestramiento — Representación Comunitaria|A.E.G. Juan Onofre Baez", label: "Capacitación y Adiestramiento" },
    { value: "Subcomisión Mixta de Seguridad e Higiene — Representación Comunitaria|A.U.O Betsabe Hernández Flores", label: "Seguridad e Higiene" },
    { value: "Subcomisión Mixta Disciplinaria — Representación Comunitaria|Cont. Juan Carlos Servín Juárez", label: "Disciplinaria" },
    { value: "Subcomisión Mixta de Escalafón — Representación Comunitaria|E.G. Hilda Ontiveros Cuellar", label: "Escalafón" },
    { value: "Subcomisión Mixta Paritaria de Protección al Salario — Representación Comunitaria|E.E. Dinorah Alduenda Guiza", label: "Protección al Salario" },
    { value: "Subcomisión Mixta de Pasajes — Representación Comunitaria|O.A. José Antonio Carrillo Bejarano", label: "Pasajes" },
    { value: "Subcomisión Mixta de Ropa de Trabajo y Uniformes — Representación Comunitaria|A.A. Julio Cesar García Salgado", label: "Ropa de Trabajo y Uniformes" },
    { value: "Subcomisión Mixta de Selec. Recursos Humanos para Cambios de Rama — Representación Comunitaria|C.C. Alicia Martínez Correa", label: "Cambios de Rama" },
    { value: "Subcomisión Mixta de Tiendas — Representación Comunitaria|P.E.F.B. Humberto Guerrero Linares", label: "Tiendas" },
    { value: "Subcomisión Mixta de Jubilaciones y Pensiones — Representación Comunitaria|E.G.C. Maricela Navarrete Mora", label: "Jubilaciones y Pensiones" },
    { value: "Subcomisión Mixta de Revisión de Plantillas — Representación Comunitaria|E.G. Luis Fernando García Cervantes", label: "Revisión de Plantillas" },
  ]},
]

export function EscritosForm({
  profile, destino, fecha, ciudad, detalle, textoGenerado,
  atencion, copia, fotos, loading, mostrarAvanzado,
  onChange, onGenerate, onPreview, onToggleAvanzado, onFotosChange, onClear,
}: EscritosFormProps) {
  const destinoOptions = DESTINOS.map((g) => (
    <optgroup key={g.group} label={g.group}>
      {g.items.map((i) => (
        <option key={i.value} value={i.value}>{i.label}</option>
      ))}
    </optgroup>
  ))

  return (
    <div>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem",
        padding: "1.5rem", marginBottom: "1.5rem",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem", marginBottom: "1.5rem",
          padding: "1rem", background: "var(--accent)", borderRadius: "0.375rem",
        }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <Input label="Nombre del trabajador" value={profile?.full_name ?? ""} readOnly />
          </div>
          <Input label="Matrícula" value={profile?.matricula ?? ""} readOnly />
          <Input label="Categoría" value={profile?.categoria ?? ""} readOnly />
          <div style={{ gridColumn: "1 / -1" }}>
            <Input label="Adscripción" value={profile?.adscripcion ?? ""} readOnly />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <Select label="¿A quién va dirigido?" value={destino} onChange={(e) => onChange("destino", e.target.value)}>
            <option value="">— Selecciona —</option>
            {destinoOptions}
          </Select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <Input label="Fecha del escrito" type="date" value={fecha} onChange={(e) => onChange("fecha", e.target.value)} />
          <Input label="Lugar (Municipio)" value={ciudad} onChange={(e) => onChange("ciudad", e.target.value)} placeholder="Ej. Morelia" />
        </div>

        <div style={{ marginBottom: "1rem" }}>
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
                    <img key={i} src={f} alt={`Evidencia ${i + 1}`}
                      style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "0.375rem", border: "2px solid var(--primary)" }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
          <Button onClick={onGenerate} disabled={loading || !destino || !detalle.trim()} loading={loading}>
            {loading ? "Redactando con IA..." : "Redactar con IA"}
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
