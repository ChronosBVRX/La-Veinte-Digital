import { ConceptHub } from "@/features/tarjeton-guia/components/ConceptHub"

export default async function ConceptosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return <ConceptHub initialTab={tab} />
}
