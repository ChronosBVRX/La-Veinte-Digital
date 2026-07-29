export function CalculatorDisclaimer() {
  return (
    <div style={{
      background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)",
      borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.8125rem",
      color: "var(--fg)",
    }}>
      <strong style={{ color: "var(--warning)" }}>Aviso:</strong> Calculo informativo. El resultado puede diferir
      por impuestos, incidencias o criterios institucionales. Consulte con nomina.
    </div>
  )
}
