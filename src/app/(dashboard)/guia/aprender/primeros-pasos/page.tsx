import { PrimerosPasosPage } from "@/features/tarjeton-guia/components/PrimerosPasosPage"

export default async function PrimerosPasosPageRoute({ searchParams }: { searchParams: Promise<{ leccion?: string }> }) {
  const { leccion } = await searchParams
  return <PrimerosPasosPage leccion={leccion} />
}
