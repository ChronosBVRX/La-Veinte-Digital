import { createClient } from "@/lib/supabase/server"
import { BookOpen } from "lucide-react"
import { CatalogSearch } from "@/features/catalogo/components/CatalogSearch"

export default async function CatalogPage() {
  const supabase = await createClient()

  const { data: adscripciones } = await supabase
    .from("catalogo_adscripciones")
    .select("nombre, id")
    .order("nombre", { ascending: true })

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "0.75rem",
          background: "linear-gradient(135deg, #059669, #10b981)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <BookOpen size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Catálogo</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0.125rem 0 0" }}>
            Adscripciones del sistema
          </p>
        </div>
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "1.25rem",
        }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Adscripciones <span style={{ color: "var(--muted)", fontWeight: 400 }}>({adscripciones?.length ?? 0})</span>
          </h2>
          <CatalogSearch />
          <div style={{ marginTop: "0.75rem", maxHeight: "400px", overflow: "auto" }}>
            {adscripciones?.map((ad) => (
              <div key={ad.id} style={{
                padding: "0.5rem 0.625rem", fontSize: "0.875rem",
                borderBottom: "1px solid var(--border)", color: "var(--fg)",
                transition: "background var(--transition)",
              }}>
                {ad.nombre}
              </div>
            ))}
            {(!adscripciones || adscripciones.length === 0) && (
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", textAlign: "center", padding: "2rem 0" }}>
                No hay adscripciones registradas
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
