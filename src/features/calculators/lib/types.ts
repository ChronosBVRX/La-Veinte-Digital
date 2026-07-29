export interface BaseConceptosInput {
  concepto002: number
  concepto011: number
}

export interface AguinaldoResult {
  base: number
  total: number
  anticipoEnero047: number
  anticipoAgosto043: number
  restoDiciembre049: number
}

export interface SegundaJulioProporcionalInput extends BaseConceptosInput {
  diasLaborados: number
}

export interface SegundaJulioProporcionalResult {
  base: number
  importeCompleto: number
  proporcion: number
  resultado: number
}

export type JornadaHoras = 6.5 | 8 | 12

export interface TiempoExtraInput {
  concepto002: number
  concepto011: number
  concepto020: number
  conceptoAdicional1: number
  conceptoAdicional2: number
  concepto050: number
  jornada: JornadaHoras
  horasExtra: number
}

export interface TiempoExtraResult {
  sumaConceptos: number
  horasOrdinariasPeriodo: number
  valorHora: number
  factor: number
  horasExtra: number
  pago: number
}

export interface Clausula97Result {
  baseQuincenal: number
  unMes: number
  dosMeses: number
  tresMeses: number
  cuatroMeses: number
}

export interface PrestamoCategoriaRecord {
  categoria: string
  descripcionTC?: string
  sueldoPlaza?: number
  sueldoQuincenal?: number
  concepto011?: number
  smtabMas011?: number
  smi?: number
  clausula97UnMes?: number
  clausula97DosMeses?: number
  clausula97TresMeses?: number
  concepto160?: number
  automovil?: number
  enganche?: number
  medianoPlazo?: number
  hipotecario?: number
}

export interface PrestamoCalculado {
  modalidad: string
  formula: string
  valor: number
  valorOriginal?: number
  diferencia?: number
}
