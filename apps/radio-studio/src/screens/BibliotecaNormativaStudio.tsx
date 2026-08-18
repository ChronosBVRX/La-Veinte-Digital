import { useEffect, useState } from "react";
import { buscarNormativa, listarDocumentos, type DocResumen } from "../lib/studio-api";

interface Props {
  onCrearEpisodio: (tema: string) => void;
}

interface Hit {
  documentId: string;
  documentTitle: string;
  clause: string | null;
  article: string | null;
  pdfPageIndex: number | null;
  snippet: string;
  validity: string;
}

export function BibliotecaNormativaStudio({ onCrearEpisodio }: Props) {
  const [docs, setDocs] = useState<DocResumen[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    let mounted = true;
    void listarDocumentos().then((r) => {
      if (mounted) setDocs(r);
    });
    return () => { mounted = false; };
  }, []);

  const buscar = async () => {
    if (!query.trim()) return;
    setBuscando(true);
    try {
      const r = await buscarNormativa(query.trim());
      setHits(r.hits as unknown as Hit[]);
    } finally {
      setBuscando(false);
    }
  };
  const listos = docs.filter((d) => d.versionLabel);
  const pendientes = docs.filter((d) => !d.versionLabel);
  const bloqueados = pendientes.filter((d) => d.sourceState === "HTTP_403" || d.sourceState === "WAF_BLOCK").length;

  return (
    <div className="screen">
      <h1>Biblioteca Normativa</h1>
      <div className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Buscar: tiempo extraordinario, concepto 37, cláusula 42…"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel-2)", color: "var(--fg)" }}
          />
          <button className="btn-primary" onClick={buscar} disabled={buscando}>{buscando ? "…" : "Buscar"}</button>
        </div>
        {hits && (
          <div style={{ marginTop: 12 }}>
            {hits.length === 0 && <div className="muted">Sin resultados. No puedo fundamentar esa consulta con el corpus.</div>}
            {hits.map((h, i) => (
              <div key={i} className="norm-hit">
                <div className="norm-hit-head">
                  <strong>{h.documentTitle}</strong>
                  <span className="chip">{h.validity}</span>
                  {h.clause && <span className="chip">Cláusula {h.clause}</span>}
                  {h.article && <span className="chip">Artículo {h.article}</span>}
                  {h.pdfPageIndex != null && <span className="chip">pág. {h.pdfPageIndex}</span>}
                  <button
                    className="chip action"
                    onClick={() => onCrearEpisodio(`${query.trim()}`)}
                  >
                    🎙 Crear episodio sobre esto
                  </button>
                </div>
                <div className="muted small">…{h.snippet}…</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <div className="scene-title">Documentos del corpus</div>
        <p className="muted small" style={{ marginTop: 4 }}>
          Listos para citar: {listos.length}/{docs.length}
          {bloqueados > 0 ? ` · Bloqueados por el portal oficial: ${bloqueados}` : ""}
          {pendientes.length > bloqueados ? ` · Por revisar: ${pendientes.length - bloqueados}` : ""}
        </p>
        <div className="doc-grid">
          {docs.slice(0, 60).map((d) => (
            <div key={d.id} className={`doc-row ${!d.versionLabel ? "disabled" : ""}`} onClick={() => d.versionLabel && onCrearEpisodio(d.title)} title={d.versionLabel ? "Crear episodio sobre este documento" : "Pendiente de fuente local verificable"}>
              <span className={`dot-validity ${d.validity === "CURRENT" ? "ok" : d.validity === "PENDING_REVIEW" ? "warn" : ""}`} />
              <span className="doc-title">{d.title.slice(0, 70)}</span>
              <span className="muted small">{d.pages ? `${d.pages} págs` : (d.sourceState === "HTTP_403" || d.sourceState === "WAF_BLOCK") ? "bloqueado" : "pendiente"}</span>
              {d.versionLabel && <button className="chip action">🎙</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
