import { getWorkerContext } from "@/shared/server/worker-context"
import VacationsPage from "@/features/vacations/pages/page"

export default async function Vacaciones() {
  const context = await getWorkerContext()
  return <VacationsPage initialContext={context} />
}
