import { SegundaJulioProporcionalCalculator } from "@/features/calculators/components/SegundaJulioProporcionalCalculator"
import { getCurrentUserProfile } from "@/features/profile/services/profiles"

export default async function SegundaJulioProporcionalPage() {
  const profile = await getCurrentUserProfile()
  return <SegundaJulioProporcionalCalculator initialCategoria={profile?.categoria} />
}
