interface FormulaExplanationProps {
  steps: string[]
}

export function FormulaExplanation({ steps }: FormulaExplanationProps) {
  return (
    <div style={{
      background: "var(--accent)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "1rem", fontSize: "0.8125rem",
    }}>
      <p style={{ fontWeight: 600, margin: "0 0 0.5rem", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Formula
      </p>
      <ol style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {steps.map((step, i) => (
          <li key={i} style={{ lineHeight: 1.5 }}>{step}</li>
        ))}
      </ol>
    </div>
  )
}
