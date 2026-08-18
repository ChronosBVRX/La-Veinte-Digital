export function Placeholder({ titulo, desc }: { titulo: string; desc: string }) {
  return (
    <div className="screen">
      <h1>{titulo}</h1>
      <div className="card">
        <p className="muted">{desc}</p>
        <p className="muted small">FASE 4 — esta sección se conecta al núcleo correspondiente (normative-core / radio-core) en la siguiente iteración.</p>
      </div>
    </div>
  );
}
