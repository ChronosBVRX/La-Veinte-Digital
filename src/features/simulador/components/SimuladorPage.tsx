"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useSimulation, SCENARIOS } from "../hooks/useSimulation"
import { Disclaimer } from "./Disclaimer"
import { SimulationSetup } from "./SimulationSetup"
import { SimulationChat } from "./SimulationChat"
import { PerformanceReport } from "./PerformanceReport"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

export function SimuladorPage() {
  const sim = useSimulation()

  return (
    <AnimatePresence mode="wait">
      {sim.phase === "disclaimer" && (
        <motion.div key="disclaimer" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}>
          <Disclaimer onAccept={() => sim.setPhase("setup")} />
        </motion.div>
      )}

      {sim.phase === "setup" && (
        <motion.div key="setup" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}>
          <SimulationSetup
            scenarios={SCENARIOS}
            selectedScenario={sim.scenario}
            difficulty={sim.difficulty}
            onSelectScenario={sim.setScenario}
            onSelectDifficulty={sim.setDifficulty}
            onStart={() => sim.startSimulation(sim.scenario, sim.difficulty)}
          />
        </motion.div>
      )}

      {sim.phase === "simulation" && (
        <motion.div key="simulation" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}>
          <SimulationChat
            messages={sim.messages}
            loading={sim.loading}
            error={sim.error}
            difficulty={sim.difficulty}
            onSend={sim.sendResponse}
            onFinish={sim.finishSimulation}
          />
        </motion.div>
      )}

      {sim.phase === "report" && (
        <motion.div key="report" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}>
          {sim.loading || !sim.analysis ? (
            <LoadingSpinner text="Analizando tu desempeño..." />
          ) : (
            <PerformanceReport
              analysis={sim.analysis}
              messages={sim.messages}
              scenarioName={sim.scenario.nombre}
              difficulty={sim.difficulty}
              onReset={sim.reset}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
