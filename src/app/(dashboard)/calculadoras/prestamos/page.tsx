import { PrestamosCategoriaCalculator } from "@/features/calculators/components/PrestamosCategoriaCalculator"
import { getCurrentUserProfile } from "@/features/profile/services/profiles"

export default async function PrestamosPage() {
  const profile = await getCurrentUserProfile()
  return <PrestamosCategoriaCalculator initialCategoria={profile?.categoria} initialAntiguedad={profile?.antiguedad} />
}
