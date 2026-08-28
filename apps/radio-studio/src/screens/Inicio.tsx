import { useEffect, useState } from "react";
import { listProjects, deleteProject } from "../lib/studio-api";
import type { Project } from "@la-veinte/studio-contract";
import { PROFUNDIDAD_LABELS, PROFUNDIDAD_MIN, type Profundidad } from "@la-veinte/studio-contract";

const STATE_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  RESEARCHING: "Investigando…",
  RESEARCHED: "Fuentes listas",
  PROPOSAL_READY: "Propuesta lista",
  PROPOSAL_APPROVED: "Propuesta aprobada",
  SCRIPT_GENERATING: "Escribiendo guion…",
  SCRIPT_READY: "Guion listo",
  SCRIPT_APPROVED: "Guion aprobado",
  PRODUCING: "Generando audio…",
  NEEDS_REVIEW: "Guion por revisar",
  MASTERING: "Mezclando…",
  DONE: "Listo",
  FAILED: "No disponible",
};

function titleOf(p: Project): string {
  return p.titulo || p.topic;
}

function fecha(p: Project): string {
  const d = new Date(p.updatedAt ?? p.createdAt);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export function Inicio({ onCrear, onOpen }: { onCrear: (tema: string, comerciales: boolean, profundidad: Profundidad) => void; onOpen: (id: string) => void }) {
  const [tema, setTema] = useState("");
  const [comerciales, setComerciales] = useState(false);
  const [profundidad, setProfundidad] = useState<Profundidad>("estandar");
  const [recent, setRecent] = useState<Project[]>([]);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sugerencias = ["¿Qué pasa si me cambian de horario?", "Cómo solicitar vacaciones", "Accidente de trabajo: ST-7", "Tiempo extraordinario en el IMSS"];

  const recargar = () => void listProjects().then((ps) => setRecent(ps.slice(0, 6)));

  useEffect(() => {
    recargar();
  }, []);

  // Confirmación IN-UI (en el webview de Tauri window.confirm no funciona).
  const eliminar = async (p: Project) => {
    setEliminando(p.id);
    setError(null);
    try {
      await deleteProject(p.id);
      setRecent((prev) => prev.filter((x) => x.id !== p.id));
      setConfirmando(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el episodio");
    } finally {
      setEliminando(null);
    }
  };

  return (
    <div className="screen">
      <div className="home-hero">
        <div>
          <div className="brand-title" style={{ fontSize: 20, marginBottom: 2 }}>LA VEINTE RADIO</div>
          <h1>¿Qué episodio quieres crear?</h1>
          <p className="muted">Escribe un tema laboral. Yo investigo nuestras bibliotecas, te digo qué puedo demostrar y qué no, y preparo el programa.</p>
        </div>
        <div className="ready-pill ok">Listo para trabajar</div>
      </div>

      <section className="card start-card">
        <label className="field">
          <span>Tema del episodio</span>
          <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej. ¿Qué pasa si me cambian de horario sin avisarme?" autoFocus />
        </label>
        <button className="btn-primary btn-main-action" onClick={() => onCrear(tema.trim(), comerciales, profundidad)} disabled={!tema.trim()}>
          INVESTIGAR Y PREPARAR EPISODIO
        </button>
        <div className="depth-row" style={{ marginTop: 12 }}>
          <span className="muted small">Profundidad (aproximada):</span>
          <div className="quick-topics" style={{ marginTop: 8 }}>
            {(["breve", "estandar", "profundo"] as Profundidad[]).map((d) => (
              <button key={d} className={`chip ${profundidad === d ? "chip-active" : ""}`} onClick={() => setProfundidad(d)}>
                {PROFUNDIDAD_LABELS[d]} · ~{PROFUNDIDAD_MIN[d]} min
              </button>
            ))}
          </div>
          <div className="muted small">La duración se estima según el tema; estas opciones solo guían qué tan a fondo ir.</div>
        </div>
        <label className="check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={comerciales} onChange={(e) => setComerciales(e.target.checked)} />
          Incluir anuncios opcionales (los elige el director entre los autorizados)
        </label>
        <div className="quick-topics">
          <span className="muted">O prueba:</span>
          {sugerencias.map((s) => <button key={s} className="chip" onClick={() => onCrear(s, comerciales, profundidad)}>{s}</button>)}
        </div>
      </section>

      <section>
        <div className="scene-title" style={{ margin: "18px 0 10px" }}>Episodios recientes</div>
        {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
        {recent.length === 0 ? (
          <div className="muted small">Todavía no tienes episodios. Escribe un tema arriba y comienza.</div>
        ) : (
          <div className="step-strip" style={{ flexDirection: "column", gap: 10 }}>
            {recent.map((p) => (
              <section key={p.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: "space-between", width: "100%", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{titleOf(p)}</div>
                    <div className="muted small">{STATE_LABELS[p.state] ?? p.state} · {fecha(p)}</div>
                    {p.proposal && <div className="muted small">~{p.proposal.duracionEstimadaMin} min</div>}
                  </div>
                  <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                    <button className="btn-secondary" onClick={() => onOpen(p.id)}>CONTINUAR</button>
                    {confirmando === p.id ? (
                      <>
                        <button className="btn-danger" disabled={eliminando === p.id} onClick={() => void eliminar(p)}>
                          {eliminando === p.id ? "Borrando…" : "SÍ, BORRAR"}
                        </button>
                        <button className="btn-secondary" disabled={eliminando === p.id} onClick={() => setConfirmando(null)}>NO</button>
                      </>
                    ) : (
                      <button
                        className="btn-danger"
                        disabled={eliminando === p.id}
                        title="Eliminar este episodio"
                        onClick={() => setConfirmando(p.id)}
                      >
                        ELIMINAR
                      </button>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
