import { AguinaldoCalculator } from "@/features/calculators/components/AguinaldoCalculator"
import { getCurrentUserProfile } from "@/features/profile/services/profiles"

export default async function AguinaldoPage() {
  const profile = await getCurrentUserProfile()
  return <AguinaldoCalculator initialCategoria={profile?.categoria} initialAntiguedad={profile?.antiguedad} />
}
