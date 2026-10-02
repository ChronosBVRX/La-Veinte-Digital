import { getWorkerContext } from "@/shared/server/worker-context"
import { VacationReturnCalculator } from "@/features/calculators/components/VacationReturnCalculator"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function RegresoVacacionesPage() {
  const context = await getWorkerContext()
  return <VacationReturnCalculator initialContext={context} />
}
