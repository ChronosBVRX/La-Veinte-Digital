"use client"

import { useSimulation, SCENARIOS } from "../hooks/useSimulation"
import { Disclaimer } from "./Disclaimer"
import { SimulationSetup } from "./SimulationSetup"
import { SimulationChat } from "./SimulationChat"
import { PerformanceReport } from "./PerformanceReport"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

export function SimuladorPage() {
  const sim = useSimulation()

  switch (sim.phase) {
    case "disclaimer":
      return <Disclaimer onAccept={() => sim.setPhase("setup")} />

    case "setup":
      return (
        <SimulationSetup
          scenarios={SCENARIOS}
          selectedScenario={sim.scenario}
          difficulty={sim.difficulty}
          onSelectScenario={sim.setScenario}
          onSelectDifficulty={sim.setDifficulty}
          onStart={() => sim.startSimulation(sim.scenario, sim.difficulty)}
        />
      )

    case "simulation":
      return (
        <SimulationChat
          messages={sim.messages}
          loading={sim.loading}
          error={sim.error}
          difficulty={sim.difficulty}
          onSend={sim.sendResponse}
          onFinish={sim.finishSimulation}
        />
      )

    case "report":
      if (sim.loading || !sim.analysis) {
        return <LoadingSpinner text="Analizando tu desempeño..." />
      }
      return (
        <PerformanceReport
          analysis={sim.analysis}
          messages={sim.messages}
          scenarioName={sim.scenario.nombre}
          difficulty={sim.difficulty}
          onReset={sim.reset}
        />
      )

    default:
      return <LoadingSpinner text="Cargando..." />
  }
}
