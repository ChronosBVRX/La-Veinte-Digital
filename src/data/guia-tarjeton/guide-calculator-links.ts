// Enlaces entre conceptos de la Guía y los motores de cálculo VIGENTES de la app.
// Regla: solo se enlazan motores ya validados en La Veinte Digital
// (calculadoras, simulador de nómina, vacaciones). Nunca se crea una
// fórmula nueva dentro de la Guía: una sola fuente de verdad.

export interface GuideCalculatorLink {
  code: string
  route: string
  label: string
}

export const GUIDE_CALCULATOR_LINKS: GuideCalculatorLink[] = [
  { code: "002", route: "/simulador-nomina", label: "Simular mi nómina" },
  { code: "022", route: "/simulador-nomina", label: "Simular mi nómina con mi antigüedad" },
  { code: "032", route: "/simulador-nomina", label: "Simular mis estímulos" },
  { code: "033", route: "/simulador-nomina", label: "Simular mis estímulos" },
  { code: "037", route: "/calculadoras/tiempo-extra", label: "Calcular mi tiempo extra" },
  { code: "042", route: "/calculadoras/clausula-97", label: "Calcular anticipo cláusula 97" },
  { code: "043", route: "/calculadoras/aguinaldo", label: "Calcular mi aguinaldo" },
  { code: "047", route: "/calculadoras/aguinaldo", label: "Calcular mi aguinaldo" },
  { code: "049", route: "/calculadoras/aguinaldo", label: "Calcular mi aguinaldo" },
  { code: "029", route: "/vacaciones", label: "Simular mis vacaciones" },
  { code: "048", route: "/simulador-nomina", label: "Simular mi nómina" },
]

export const GUIDE_CALCULATOR_LINKS_BY_CODE: ReadonlyMap<string, GuideCalculatorLink> = new Map(
  GUIDE_CALCULATOR_LINKS.map((l) => [l.code, l])
)