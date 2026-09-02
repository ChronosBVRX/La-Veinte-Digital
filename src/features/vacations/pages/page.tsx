import { VacationWizard } from "../components/VacationWizard"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

export interface VacationsPageProps {
  initialContext?: WorkerContext | null
}

export default function VacationsPage({ initialContext }: VacationsPageProps) {
  return <VacationWizard initialContext={initialContext} />
}
