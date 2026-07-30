import { SegundaJulioCalculator } from "@/features/calculators/components/SegundaJulioCalculator"
import { getCurrentUserProfile } from "@/features/profile/services/profiles"

export default async function SegundaJulioPage() {
  const profile = await getCurrentUserProfile()
  return <SegundaJulioCalculator initialCategoria={profile?.categoria} initialAntiguedad={profile?.antiguedad} />
}
