import { TiempoExtraCalculator } from "@/features/calculators/components/TiempoExtraCalculator"
import { getCurrentUserProfile } from "@/features/profile/services/profiles"

export default async function TiempoExtraPage() {
  const profile = await getCurrentUserProfile()
  return <TiempoExtraCalculator initialCategoria={profile?.categoria} initialAntiguedad={profile?.antiguedad} />
}
