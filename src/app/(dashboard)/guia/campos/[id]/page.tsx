import { FieldFichaPage } from "@/features/tarjeton-guia/components/FieldFichaPage"

export default async function CampoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FieldFichaPage id={id} />
}
