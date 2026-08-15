import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { NormativeCatalog, type LibraryData } from "@/features/normativa/services/catalog"
import { BibliotecaNormativaPage } from "@/features/normativa/components/BibliotecaNormativaPage"

export const dynamic = "force-dynamic"

export default async function BibliotecaNormativaRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const catalog = new NormativeCatalog(process.cwd())
  const data: LibraryData = catalog.libraryData()

  return <BibliotecaNormativaPage data={data} />
}
