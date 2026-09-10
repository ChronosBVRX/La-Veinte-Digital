import { useEffect, useMemo, useState } from "react";
import { listProjects, deleteProject } from "../lib/studio-api";
import type { Project, Script } from "@la-veinte/studio-contract";
import { PROFUNDIDAD_LABELS, PROFUNDIDAD_MIN, type Profundidad } from "@la-veinte/studio-contract";
import { classifyInput, parseScript, deriveShortTitle } from "@la-veinte/radio-core";

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
  return deriveShortTitle(p.titulo || p.topic);
}

function fecha(p: Project): string {
  const d = new Date(p.updatedAt ?? p.createdAt);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export function Inicio({
  onCrear,
  onOpen,
}: {
  onCrear: (
    tema: string,
    comerciales: boolean,
    profundidad: Profundidad,
    options?: { script?: Script | null; forceTopic?: boolean }
  ) => void;
  onOpen: (id: string) => void;
}) {
  const [tema, setTema] = useState("");
  const [comerciales, setComerciales] = useState(false);
  const [profundidad, setProfundidad] = useState<Profundidad>("estandar");
  const [recent, setRecent] = useState<Project[]>([]);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sugerencias = [
    "¿Qué pasa si me cambian de horario?",
    "Cómo solicitar vacaciones",
    "Accidente de trabajo: ST-7",
    "Tiempo extraordinario en el IMSS",
  ];

  const recargar = () => void listProjects().then((ps) => setRecent(ps.slice(0, 6)));

  useEffect(() => {
    recargar();
  }, []);

  const classification = useMemo(() => {
    if (!tema.trim()) return null;
    return classifyInput(tema);
  }, [tema]);

  const parsedScript = useMemo(() => {
    if (!classification || classification.kind !== "script") return null;
    try {
      return parseScript(tema);
    } catch {
      return null;
    }
  }, [classification, tema]);

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
          <p className="muted">Escribe un tema laboral para investigar, o pega directamente un guion ya escrito con tus personajes.</p>
        </div>
        <div className="ready-pill ok">Listo para trabajar</div>
      </div>

      <section className="card start-card">
        <label className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span>Tema o guion del episodio</span>
            {classification && (
              <span
                className="chip"
                style={{
                  fontSize: "0.76rem",
                  padding: "2px 8px",
                  background:
                    classification.kind === "script"
                      ? "rgba(16, 185, 129, 0.15)"
                      : classification.kind === "ambiguous"
                        ? "rgba(245, 158, 11, 0.15)"
                        : "rgba(59, 130, 246, 0.15)",
                  color:
                    classification.kind === "script"
                      ? "#10b981"
                      : classification.kind === "ambiguous"
                        ? "#f59e0b"
                        : "#3b82f6",
                  border: `1px solid ${
                    classification.kind === "script"
                      ? "#10b981"
                      : classification.kind === "ambiguous"
                        ? "#f59e0b"
                        : "#3b82f6"
                  }`,
                }}
              >
                {classification.kind === "script"
                  ? `📝 Guion detectado (${classification.stats.detectedSpeakers.join(", ")} · ${classification.stats.speakerLineCount} intervenciones)`
                  : classification.kind === "ambiguous"
                    ? "🤔 Formato mixto o ambiguo"
                    : "🔎 Tema para investigar"}
              </span>
            )}
          </div>
          <textarea
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Ej. ¿Qué pasa si me cambian de horario sin avisarme?&#10;O pega un guion:&#10;EDUARDO: Bienvenidos a La Veinte Radio...&#10;ANDREA: Hoy revisaremos la Cláusula 22..."
            autoFocus
            rows={tema.includes("\n") || tema.length > 80 ? 6 : 2}
            style={{
              width: "100%",
              minHeight: 64,
              maxHeight: 280,
              resize: "vertical",
              fontFamily: "inherit",
              fontSize: "0.95rem",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm, 6px)",
              border: "1px solid var(--border, #334155)",
              background: "var(--panel-2, #1e293b)",
              color: "inherit",
              lineHeight: 1.45,
            }}
          />
        </label>

        {classification?.kind === "script" ? (
          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <button
              className="btn-primary btn-main-action"
              style={{ flex: 2 }}
              onClick={() =>
                onCrear(tema.trim(), comerciales, profundidad, {
                  script: parsedScript ?? undefined,
                })
              }
              disabled={!tema.trim()}
            >
              📝 IMPORTAR GUION Y PREPARAR AUDIO
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => onCrear(tema.trim(), comerciales, profundidad, { forceTopic: true })}
              disabled={!tema.trim()}
              title="Investigar como tema en la biblioteca"
            >
              Investigar como tema
            </button>
          </div>
        ) : classification?.kind === "ambiguous" ? (
          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <button
              className="btn-primary btn-main-action"
              style={{ flex: 1 }}
              onClick={() =>
                onCrear(tema.trim(), comerciales, profundidad, {
                  script: parsedScript ?? undefined,
                })
              }
              disabled={!tema.trim()}
            >
              📝 IMPORTAR COMO GUION
            </button>
            <button
              className="btn-secondary btn-main-action"
              style={{ flex: 1 }}
              onClick={() => onCrear(tema.trim(), comerciales, profundidad, { forceTopic: true })}
              disabled={!tema.trim()}
            >
              🔎 INVESTIGAR COMO TEMA
            </button>
          </div>
        ) : (
          <button
            className="btn-primary btn-main-action"
            onClick={() => onCrear(tema.trim(), comerciales, profundidad)}
            disabled={!tema.trim()}
          >
            INVESTIGAR Y PREPARAR EPISODIO
          </button>
        )}

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
