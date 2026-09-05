"use client"

import { SegundaJulioCalculator } from "./SegundaJulioCalculator"

interface Props {
  initialCategoria?: string | null
}

export function SegundaJulioProporcionalCalculator({ initialCategoria }: Props) {
  return (
    <SegundaJulioCalculator
      initialCategoria={initialCategoria}
      initialMode="proporcional"
    />
  )
}
