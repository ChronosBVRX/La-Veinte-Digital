import { createClient } from "@/lib/supabase/server"

export interface CatalogoItem {
  nombre: string
}

export async function searchAdscripciones(searchTerm: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("search_catalogo", {
    catalogo_type: "adscripcion",
    search_term: searchTerm,
  })
  if (error) throw error
  return (data ?? []) as CatalogoItem[]
}

export async function getAllAdscripciones() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("catalogo_adscripciones")
    .select("nombre, id")
    .order("nombre", { ascending: true })
  return data ?? []
}
