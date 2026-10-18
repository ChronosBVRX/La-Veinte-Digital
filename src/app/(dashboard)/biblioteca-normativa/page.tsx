import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { NormativeCatalog, type LibraryData } from "@/features/normativa/services/catalog"
import { BibliotecaNormativaPage } from "@/features/normativa/components/BibliotecaNormativaPage"

export const dynamic = "force-dynamic"

export default async function BibliotecaNormativaRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let data: LibraryData
  try {
    const catalog = new NormativeCatalog(process.cwd())
    data = catalog.libraryData()
  } catch (err) {
    console.error("[BibliotecaNormativa] Error cargando catálogo normativo:", err)
    data = {
      available: true,
      health: null,
      documents: [],
    }
  }

  return <BibliotecaNormativaPage data={data} />
}
