"use client"

import dynamic from "next/dynamic"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

const SimuladorNominaIndex = dynamic(
  () =>
    import("@/features/simulador-nomina/components/SimuladorNominaIndex").then(
      (module) => module.SimuladorNominaIndex,
    ),
  {
    ssr: false,
    loading: () => <LoadingSpinner text="Cargando tu perfil..." />,
  },
)

export function SimuladorNominaPageClient() {
  return <SimuladorNominaIndex />
}
