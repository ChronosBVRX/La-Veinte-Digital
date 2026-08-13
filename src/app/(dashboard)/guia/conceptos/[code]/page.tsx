import { ConceptFichaPage } from "@/features/tarjeton-guia/components/ConceptFichaPage"

export default async function ConceptoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <ConceptFichaPage code={code} />
}
