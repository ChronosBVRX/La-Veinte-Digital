import { Clausula97Calculator } from "@/features/calculators/components/Clausula97Calculator"
import { getCurrentUserProfile } from "@/features/profile/services/profiles"

export default async function Clausula97Page() {
  const profile = await getCurrentUserProfile()
  return <Clausula97Calculator initialCategoria={profile?.categoria} />
}
