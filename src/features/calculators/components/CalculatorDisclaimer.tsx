export function CalculatorDisclaimer() {
  return (
    <div style={{
      background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)",
      borderRadius: "var(--radius-md)", padding: "0.875rem 1rem", fontSize: "var(--text-sm)",
      color: "var(--fg)", lineHeight: 1.4,
    }}>
      <strong style={{ color: "var(--warning)" }}>Aviso:</strong> Cálculo orientativo. El resultado puede variar por retenciones, incidencias o tabulador aplicable.
    </div>
  )
}
