import { createClient } from "@/lib/supabase/server"
import { CatalogSearch } from "./catalog-search"

export default async function CatalogPage() {
  const supabase = await createClient()

  const { data: categorias } = await supabase
    .from("catalogo_categorias")
    .select("nombre, id")
    .order("nombre", { ascending: true })

  const { data: adscripciones } = await supabase
    .from("catalogo_adscripciones")
    .select("nombre, id")
    .order("nombre", { ascending: true })

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Catálogo</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Busca categorías y adscripciones del sistema
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Categorías ({categorias?.length ?? 0})
          </h2>
          <CatalogSearch type="categoria" />
          <div style={{ marginTop: "0.75rem", maxHeight: "400px", overflow: "auto" }}>
            {categorias?.map((cat) => (
              <div key={cat.id} style={{ padding: "0.375rem 0", fontSize: "0.875rem", borderBottom: "1px solid var(--border)" }}>
                {cat.nombre}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Adscripciones ({adscripciones?.length ?? 0})
          </h2>
          <CatalogSearch type="adscripcion" />
          <div style={{ marginTop: "0.75rem", maxHeight: "400px", overflow: "auto" }}>
            {adscripciones?.map((ad) => (
              <div key={ad.id} style={{ padding: "0.375rem 0", fontSize: "0.875rem", borderBottom: "1px solid var(--border)" }}>
                {ad.nombre}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
