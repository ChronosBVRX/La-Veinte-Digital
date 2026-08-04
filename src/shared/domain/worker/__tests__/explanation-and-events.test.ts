import { describe, expect, it } from "vitest"
import {
  sanitizeExplanationForConsumer,
  canConsumerSeeInput,
  validateWorkerEventMetadata,
  EVENT_PRIORITY_BY_TYPE,
} from "../"
import type { CalculationExplanation, ExplanationInput } from "../"

const baseInputs: ExplanationInput[] = [
  {
    field: "categoria",
    source: "payslip_confirmed",
    displayValue: "Técnico Radiólogo",
    sensitivity: "labor",
    allowedConsumers: ["self", "assistant", "logs"],
  },
  {
    field: "matricula",
    source: "payslip_confirmed",
    displayValue: "12345678",
    sensitivity: "identifier",
    allowedConsumers: ["self", "assistant"],
  },
  {
    field: "workdayHours",
    source: "manual",
    displayValue: "8",
    sensitivity: "labor",
    allowedConsumers: ["self", "assistant", "logs"],
  },
]

function explanation(inputs: ExplanationInput[] = baseInputs): CalculationExplanation {
  return {
    resultLabel: "Prima vacacional",
    usedInputs: inputs,
    rulesApplied: [{ ruleId: "prima_vacacional_v1", version: "1" }],
    catalogRefs: [{ catalog: "cat_2026", version: "v2" }],
    estimatedFields: [],
    missingFields: [],
    confidence: 0.82,
  }
}

describe("sanitizeExplanationForConsumer", () => {
  it("para la UI propia conserva valores permitidos", () => {
    const sanitized = sanitizeExplanationForConsumer(explanation(), "self")
    const categoria = sanitized.usedInputs.find((i) => i.field === "categoria")
    expect(categoria?.displayValue).toBe("Técnico Radiólogo")
    const matricula = sanitized.usedInputs.find((i) => i.field === "matricula")
    expect(matricula?.displayValue).toBe("12345678")
  })

  it("para la IA redacta identificadores y datos financieros completos", () => {
    const sanitized = sanitizeExplanationForConsumer(explanation(), "assistant")
    const categoria = sanitized.usedInputs.find((i) => i.field === "categoria")
    expect(categoria?.displayValue).toBe("Técnico Radiólogo")
    const matricula = sanitized.usedInputs.find((i) => i.field === "matricula")
    expect(matricula?.displayValue).toBeUndefined()
  })

  it("para los logs elimina todos los valores", () => {
    const sanitized = sanitizeExplanationForConsumer(explanation(), "logs")
    for (const input of sanitized.usedInputs) {
      expect(input.displayValue).toBeUndefined()
    }
  })

  it("no muta la explicación original", () => {
    const original = explanation()
    sanitizeExplanationForConsumer(original, "logs")
    expect(original.usedInputs[0].displayValue).toBe("Técnico Radiólogo")
  })

  it("no expone inputs que no autorizan al consumidor", () => {
    const restricted = explanation([
      {
        field: "matricula",
        source: "payslip_confirmed",
        displayValue: "12345678",
        sensitivity: "identifier",
        allowedConsumers: ["self"],
      },
    ])
    const sanitized = sanitizeExplanationForConsumer(restricted, "assistant")
    expect(sanitized.usedInputs[0].displayValue).toBeUndefined()
  })
})

describe("canConsumerSeeInput", () => {
  it("respeta la lista de consumidores permitidos", () => {
    const input: ExplanationInput = {
      field: "matricula",
      source: "payslip_confirmed",
      sensitivity: "identifier",
      allowedConsumers: ["self"],
    }
    expect(canConsumerSeeInput(input, "self")).toBe(true)
    expect(canConsumerSeeInput(input, "assistant")).toBe(false)
    expect(canConsumerSeeInput(input, "logs")).toBe(false)
  })
})

describe("validateWorkerEventMetadata", () => {
  it("rechaza oldValue y newValue", () => {
    expect(validateWorkerEventMetadata({ oldValue: "x", newValue: "y" })).toBe(false)
  })

  it("rechaza salary", () => {
    expect(validateWorkerEventMetadata({ salary: 1000 })).toBe(false)
  })

  it("rechaza matricula, adscripcion y categoria", () => {
    expect(validateWorkerEventMetadata({ matricula: "123" })).toBe(false)
    expect(validateWorkerEventMetadata({ adscripcion: "A" })).toBe(false)
    expect(validateWorkerEventMetadata({ categoria: "Técnico" })).toBe(false)
    expect(validateWorkerEventMetadata({ category: "Técnico" })).toBe(false)
  })

  it("rechaza claves no permitidas", () => {
    expect(validateWorkerEventMetadata({ random: true })).toBe(false)
    expect(validateWorkerEventMetadata({ full_name: "X" })).toBe(false)
    expect(validateWorkerEventMetadata({ phone: "555" })).toBe(false)
  })

  it("acepta metadata técnica válida", () => {
    expect(
      validateWorkerEventMetadata({
        modeFrom: "manual",
        modeTo: "payslip",
        consentVersion: "1.1",
        extractionMethod: "native_text",
        confidence: 0.9,
        period: "Q1 2026",
      }),
    ).toBe(true)
  })

  it("acepta metadata vacío", () => {
    expect(validateWorkerEventMetadata({})).toBe(true)
  })
})

describe("EVENT_PRIORITY_BY_TYPE", () => {
  it("clasifica correctamente los eventos", () => {
    expect(EVENT_PRIORITY_BY_TYPE.data_deleted).toBe("critical")
    expect(EVENT_PRIORITY_BY_TYPE.tarjeton_imported).toBe("important")
    expect(EVENT_PRIORITY_BY_TYPE.consent_granted).toBe("important")
    expect(EVENT_PRIORITY_BY_TYPE.mode_changed).toBe("info")
    expect(EVENT_PRIORITY_BY_TYPE.field_updated).toBe("info")
  })
})
