/**
 * ProyectoSimple — flujo novato: TEMA → INVESTIGACIÓN → PROPUESTA → GUION → AUDIO.
 * Sin jerga técnica: "Fuentes encontradas", "Información verificada", "Voz", "Motor local".
 * El usuario solo escribe un tema y confirma en cada paso.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getProject, projectResearch, projectProposal, projectApprove, projectScript,
  projectVerify, projectProduce, projectRenderVisual, projectProposalUpdate, obtenerProgreso, obtenerLlmSalud,
  SIDECAR_URL_EXPORT, type LlmHealthInfo,
} from "../lib/studio-api";
import { MiniPlayer } from "../components/MiniPlayer";
import type { Project, Proposal, VerifyResult, Turn, StepProgressState } from "@la-veinte/studio-contract";
import {
  FORMAT_LABELS, NIVEL_LABELS, EDITORIAL_FORMATS,
  PROFUNDIDAD_LABELS, PROFUNDIDAD_MIN, type Profundidad,
} from "@la-veinte/studio-contract";
import { deriveShortTitle, validateScriptIntegrity, type ScriptIntegrityReport } from "@la-veinte/radio-core";

const STEPS = [
  { id: "research", label: "Investigar", icon: "🔎" },
  { id: "proposal", label: "Propuesta", icon: "📋" },
  { id: "script", label: "Guion", icon: "📝" },
  { id: "audio", label: "Audio", icon: "▶" },
] as const;

function stateToStep(state: string): number {
  if (["RESEARCHING"].includes(state)) return 0;
  if (["RESEARCHED", "GENERATING_PROPOSALS", "PROPOSAL_READY", "PROPOSAL_APPROVED", "PROPOSAL_GENERATION_FAILED"].includes(state)) return 1;
  if (["SCRIPT_GENERATING", "SCRIPT_READY", "SCRIPT_APPROVED", "SCRIPT_GENERATION_FAILED", "SCRIPT_QUALITY_FAILED", "NEEDS_REVIEW"].includes(state)) return 2;
  if (["PRODUCING", "MASTERING", "DONE"].includes(state)) return 3;
  return 0;
}

function speakerColor(speaker: string): string {
  const s = speaker.toUpperCase();
  if (s.includes("VALERIA") || s.includes("COMERCIAL")) return "#f59e0b";
  if (s.includes("RODRIGO")) return "#10b981";
  if (s.includes("JAVIER") || s.includes("NARRADOR")) return "#64748b";
  if (s.includes("ANDREA")) return "#ec4899";
  return "#3b82f6";
}

function nombreCorto(speaker: string): string {
  if (/VALERIA|COMERCIAL/.test(speaker.toUpperCase())) return "Valeria";
  if (/RODRIGO/.test(speaker.toUpperCase())) return "Rodrigo";
  if (/JAVIER|NARRADOR/.test(speaker.toUpperCase())) return "Javier";
  if (/ANDREA/.test(speaker.toUpperCase())) return "Andrea";
  return "Eduardo";
}

export function ProyectoSimple({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; estado: string | null; etaMin: number | null; rtf: number | null; notas?: string[] } | null>(null);
  const [inicioProduce, setInicioProduce] = useState<number | null>(null);
  const [ahora, setAhora] = useState<number>(() => Date.now());
  const [llm, setLlm] = useState<LlmHealthInfo | null>(null);
  const [fuenteAbierta, setFuenteAbierta] = useState<string | null>(null);
  const [editandoPropuesta, setEditandoPropuesta] = useState(false);
  const [editFormato, setEditFormato] = useState<string>("");
  const [editProfundidad, setEditProfundidad] = useState<Profundidad>("estandar");
  const [editEnfoque, setEditEnfoque] = useState("");
  const [formatoVideo, setFormatoVideo] = useState<"16x9" | "9x16" | "preview">("16x9");

  const refresh = async () => {
    const p = await getProject(projectId);
    if (p) setProject(p);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch asíncrono, no cascada
  useEffect(() => { void refresh(); }, [projectId]);
  useEffect(() => { void obtenerLlmSalud().then(setLlm); }, []);
  useEffect(() => {
    const t = setInterval(() => {
      void refresh();
      void obtenerProgreso().then((r) => r && setProgress({ done: r.done, total: r.total, estado: r.estado ?? null, etaMin: r.etaMin ?? null, rtf: r.rtfReciente ?? null, notas: r.notas }));
      setAhora(Date.now());
    }, 4000);
    return () => clearInterval(t);
  }, [projectId]);

  const isImportedScript = useMemo(() => {
    if (!project) return false;
    return (
      project.script !== null &&
      (project.research === null || project.script?.promptVersion === "imported-v1")
    );
  }, [project]);

  const stepIdx = useMemo(() => {
    if (isImportedScript) return 2;
    return stateToStep(project?.state ?? "DRAFT");
  }, [isImportedScript, project?.state]);

  const research = project?.research ?? null;
  const proposal = project?.proposal ?? null;
  const script = project?.script ?? null;
  const master = project?.master ?? null;

  const integrity = useMemo<ScriptIntegrityReport | null>(() => {
    if (!script) return null;
    return validateScriptIntegrity(script);
  }, [script]);

  const getStepInfo = (stepId: string): { state: StepProgressState; label: string; badge: string } => {
    if (isImportedScript) {
      if (stepId === "research") return { state: "omitido", label: "Omitido", badge: "—" };
      if (stepId === "proposal") return { state: "omitido", label: "Omitido", badge: "—" };
      if (stepId === "script") return { state: "completado", label: "Importado", badge: "✓" };
      if (stepId === "audio") {
        if (busy === "Creando episodio" || project?.state === "PRODUCING" || project?.state === "MASTERING") {
          return { state: "en_curso", label: "En curso", badge: "●" };
        }
        if (project?.state === "DONE" || master !== null) {
          return { state: "completado", label: "Listo", badge: "✓" };
        }
        if (project?.state === "FAILED" || progress?.estado === "FAILED" || (error && busy === null)) {
          return { state: "error", label: "Error", badge: "⚠" };
        }
        return { state: "pendiente", label: "Listo para iniciar", badge: "4" };
      }
    }

    if (stepId === "research") {
      if (busy === "Investigando" || project?.state === "RESEARCHING") {
        return { state: "en_curso", label: "En curso", badge: "●" };
      }
      if (research) return { state: "completado", label: "Listo", badge: "✓" };
      if (error && !research) return { state: "error", label: "Error", badge: "⚠" };
      return { state: "pendiente", label: "Pendiente", badge: "1" };
    }

    if (stepId === "proposal") {
      if (busy === "Preparando propuesta" || busy === "Aprobando" || project?.state === "GENERATING_PROPOSALS") {
        return { state: "en_curso", label: "En curso", badge: "●" };
      }
      if (proposal) {
        return { state: "completado", label: project?.state === "PROPOSAL_APPROVED" ? "Aprobada" : "Lista", badge: "✓" };
      }
      if (project?.state === "PROPOSAL_GENERATION_FAILED" || (error && research && !proposal)) {
        return { state: "error", label: "Error", badge: "⚠" };
      }
      return { state: "pendiente", label: "Pendiente", badge: "2" };
    }

    if (stepId === "script") {
      if (busy === "Escribiendo guion" || project?.state === "SCRIPT_GENERATING") {
        return { state: "en_curso", label: "En curso", badge: "●" };
      }
      if (script) return { state: "completado", label: "Listo", badge: "✓" };
      if (
        project?.state === "SCRIPT_GENERATION_FAILED" ||
        project?.state === "SCRIPT_QUALITY_FAILED" ||
        (error && proposal && !script)
      ) {
        return { state: "error", label: "Error", badge: "⚠" };
      }
      return { state: "pendiente", label: "Pendiente", badge: "3" };
    }

    if (stepId === "audio") {
      if (busy === "Creando episodio" || project?.state === "PRODUCING" || project?.state === "MASTERING") {
        return { state: "en_curso", label: "En curso", badge: "●" };
      }
      if (project?.state === "DONE" || master !== null) {
        return { state: "completado", label: "Listo", badge: "✓" };
      }
      if (project?.state === "FAILED" || progress?.estado === "FAILED" || (error && script && busy === null)) {
        return { state: "error", label: "Error", badge: "⚠" };
      }
      return { state: "pendiente", label: script ? "Listo para iniciar" : "Pendiente", badge: "4" };
    }

    return { state: "pendiente", label: "Pendiente", badge: "?" };
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setError(null);
    try { await fn(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Algo salió mal"); }
    finally { setBusy(null); }
  };

  const audioRef = useRef<HTMLDivElement | null>(null);

  const runProduce = async () => {
    setBusy("Creando episodio"); setError(null);
    try {
      const r = await projectProduce(projectId);
      await refresh();
      setProgress({ done: 0, total: r.started?.total ?? 0, estado: "RUNNING", etaMin: null, rtf: null });
      setInicioProduce(Date.now());
      setTimeout(() => audioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (e) { setError(e instanceof Error ? e.message : "No pude iniciar la producción"); }
    finally { setBusy(null); }
  };

  const runRenderVisual = async () => {
    setBusy("Renderizando video");
    setError(null);
    try {
      await projectRenderVisual(projectId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude iniciar el render de video");
    } finally {
      setBusy(null);
    }
  };

  const claims = useMemo(() => research?.claims ?? [], [research]);
  const fuentes = useMemo(() => research?.documents ?? [], [research]);
  void fuentes;

  const turnoFuente = (t: Turn) => {
    const refs: Array<{ sourceId: string; document: string; excerpt: string }> = [];
    t.claimRefs.forEach((c) => {
      const cl = claims.find((x) => x.id === c);
      const e = cl?.evidence[0];
      if (e) refs.push({ sourceId: e.sourceId, document: e.sourceId, excerpt: e.excerpt });
    });
    return refs;
  };

  return (
    <div className="screen">
      <div className="home-hero" style={{ marginBottom: 8 }}>
        <div>
          <button className="chip" onClick={onBack} style={{ marginBottom: 8 }}>← Episodios</button>
          <h1>{deriveShortTitle(project?.titulo ?? project?.topic ?? "Episodio")}</h1>
          <p className="muted">
            {isImportedScript
              ? "Guion importado listo para revisión y producción de audio."
              : "Investigamos nuestras bibliotecas, te contamos qué encontramos y qué no, y tú decides el siguiente paso."}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div className={`ready-pill ${llm?.health.ok ? "ok" : "warn"}`}>
            {llm?.health.ok ? "Listo para trabajar" : "Conectando con el estudio"}
          </div>
        </div>
      </div>

      {/* Paso a paso */}
      <div className="step-strip" style={{ marginBottom: 18 }}>
        {STEPS.map((s) => {
          const info = getStepInfo(s.id);
          return (
            <section key={s.id} className={`step-card ${info.state}`}>
              <span className="step-num">{info.badge}</span>
              <div>
                <h2>{s.icon} {s.label}</h2>
                <p className="muted small">{info.label}</p>
              </div>
            </section>
          );
        })}
      </div>

      {master?.master && (
        <section
          className="card"
          style={{
            marginBottom: 18,
            padding: "16px 18px",
            background: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.35)",
            borderRadius: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ color: "#22c55e", fontWeight: 700, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
                <span>✓ Audio final del episodio disponible</span>
                <span className="chip-mini ok" style={{ fontSize: "0.75rem", background: "rgba(34, 197, 94, 0.2)", border: "1px solid rgba(34, 197, 94, 0.4)" }}>
                  LISTO
                </span>
              </div>
              <div className="muted small" style={{ marginTop: 3 }}>
                {(master.bytes / 1024 / 1024).toFixed(1)} MB · {Math.round(master.duraccionMs / 1000)}s (~{(master.duraccionMs / 60000).toFixed(1)} min) · MP3 192 kbps
              </div>
            </div>
            <a
              className="chip-mini ok"
              href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master.replace(/\\/g, "/"))}`}
              download={`episodio-${projectId}.mp3`}
              style={{
                textDecoration: "none",
                padding: "6px 14px",
                borderRadius: 8,
                background: "#22c55e",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.85rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ⬇ Descargar MP3
            </a>
          </div>
          <MiniPlayer
            src={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master.replace(/\\/g, "/"))}`}
            label={deriveShortTitle(project?.titulo ?? project?.topic ?? "Episodio")}
            accent="#22c55e"
          />
        </section>
      )}

      {error && (
        <div className="card" style={{ border: "1px solid #ef4444", background: "var(--panel-2)", marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 8px", color: "#ef4444" }}>No pudimos completar este paso</h3>
          <p style={{ margin: "0 0 6px", fontWeight: 500 }}>
            {error}
          </p>
          <p className="muted small" style={{ margin: "0 0 14px" }}>
            Tu trabajo y el estado del proyecto están guardados.
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button
              className="btn-primary"
              onClick={() => {
                setError(null);
                if (isImportedScript) {
                  void runProduce();
                } else if (
                  project?.state === "PROPOSAL_APPROVED" ||
                  project?.state === "SCRIPT_GENERATING" ||
                  project?.state === "SCRIPT_QUALITY_FAILED" ||
                  project?.state === "SCRIPT_GENERATION_FAILED"
                ) {
                  void run("Escribiendo guion", () => projectScript(projectId).then((r) => setVerify(r.verify)));
                } else if (
                  project?.state === "RESEARCHED" ||
                  project?.state === "GENERATING_PROPOSALS" ||
                  project?.state === "PROPOSAL_GENERATION_FAILED"
                ) {
                  void run("Preparando propuesta", () => projectProposal(projectId));
                } else {
                  void run("Investigando", () => projectResearch(projectId));
                }
              }}
            >
              VOLVER A INTENTAR
            </button>
            <button className="btn-secondary" onClick={() => setError(null)}>
              Cerrar aviso
            </button>
          </div>
        </div>
      )}

      {/* ═══ INVESTIGACIÓN ═══ */}
      {!isImportedScript && stepIdx <= 1 && (
        <section className="card">
          <div className="scene-title">Fuentes encontradas</div>
          {!research ? (
            <>
              <p className="muted small">Buscaré en la biblioteca normativa qué respalda tu tema y qué no se puede afirmar. No usamos internet.</p>
              <button className="btn-primary btn-main-action" disabled={!!busy} onClick={() => run("Investigando", () => projectResearch(projectId))}>
                {busy === "Investigando" ? "Investigando…" : "INVESTIGAR TEMA"}
              </button>
            </>
          ) : (
            <>
              {research.coverage.recommended && <div className="coverage ok" style={{ marginBottom: 10 }}><div className="coverage-head"><span>Fuentes listas: {research.coverage.percentage}%</span><span className="coverage-status ok">Verificado</span></div></div>}
              {!research.coverage.recommended && <div className="coverage warn" style={{ marginBottom: 10 }}><div className="coverage-head"><span>Cobertura: {research.coverage.percentage}%</span><span className="coverage-status pendiente">Parcial</span></div></div>}
              <div className="row" style={{ gap: 14 }}>
                <div className="stat-mini"><div className="big">{claims.length}</div><div className="muted small">afirmaciones verificadas</div></div>
                <div className="stat-mini"><div className="big">{research.queryExpansion.length}</div><div className="muted small">búsquedas</div></div>
                <div className="stat-mini"><div className="big">{fuentes.length}</div><div className="muted small">fuentes consultadas</div></div>
              </div>
              {research.coverage.known.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="muted small">Confirmado:</div>
                  {research.coverage.known.map((k) => <div key={k} className="coverage-item ok"><span className="coverage-badge ok">Listo</span>{k}</div>)}
                </div>
              )}
              {research.coverage.missing.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="muted small">Sin respaldo suficiente:</div>
                  {research.coverage.missing.map((m) => <div key={m} className="coverage-item faltante"><span className="coverage-badge faltante">Falta</span>{m}</div>)}
                </div>
              )}
              {research.coverage.warnings.map((w, i) => <div key={i} className="coverage-warn">⚠ {w}</div>)}
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn-primary" disabled={!!busy} onClick={() => run("Preparando propuesta", () => projectProposal(projectId))}>
                  {busy === "Preparando propuesta" ? "Preparando propuesta…" : "PREPARAR PROPUESTA"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ═══ PROPUESTA ═══ */}
      {!isImportedScript && stepIdx >= 1 && stepIdx <= 2 && proposal && (
        <section className="card">
          <div className="scene-title">Propuesta de episodio</div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div className="tag tag-fmt">FORMATO: {proposal.formato ? (FORMAT_LABELS[proposal.formato] ?? proposal.formato) : "—"}</div>
            <div className="tag">Duración: ~{proposal.duracionEstimadaMin} min</div>
            <div className="tag">Estilo: {NIVEL_LABELS[proposal.nivel] ?? proposal.nivel}</div>
          </div>
          <p style={{ marginTop: 10 }}>{proposal.enfoque}</p>
          <div style={{ marginTop: 12 }}>
            <div className="muted small">Participantes:</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {proposal.participantes.map((p) => (
                <span key={p.id} className="chip" style={{ borderColor: speakerColor(p.id) }}>{nombreCorto(p.id)} · {p.rol}</span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="muted small">Estructura:</div>
            <ol style={{ paddingLeft: 20, margin: "4px 0 0" }}>
              {proposal.estructura.map((e, i) => <li key={i} style={{ marginBottom: 4 }}><strong>{e.seccion}</strong> — {e.proposito}</li>)}
            </ol>
          </div>
          {proposal.huecos.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="muted small">Lo que NO podemos afirmar (para no inventar):</div>
              {proposal.huecos.map((h, i) => <div key={i} className="coverage-item faltante"><span className="coverage-badge faltante">No</span>{h}</div>)}
            </div>
          )}
          {proposal.fuentes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="muted small">Fuentes que sostienen el episodio:</div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {proposal.fuentes.map((f) => <span key={f} className="chip">{f}</span>)}
              </div>
            </div>
          )}
          {proposal.comerciales.length > 0 && <div className="muted small" style={{ marginTop: 10 }}>Con bloques comerciales.</div>}
          {project?.state === "PROPOSAL_APPROVED" && (
            <div style={{ marginTop: 16 }}>
              <div className="row">
                <button className="btn-primary" disabled={!!busy} onClick={() => run("Escribiendo guion", () => projectScript(projectId).then((r) => { setVerify(r.verify); }))}>
                  {busy === "Escribiendo guion" ? "Escribiendo guion…" : "GENERAR GUION"}
                </button>
              </div>
            </div>
          )}
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn-secondary" disabled={!!busy} onClick={() => {
              setEditandoPropuesta((v) => !v);
              if (!editandoPropuesta && proposal) {
                setEditFormato(proposal.formato);
                setEditProfundidad("estandar");
                setEditEnfoque(proposal.enfoque);
              }
            }}>
              {editandoPropuesta ? "CERRAR" : "MODIFICAR"}
            </button>
            <button className="btn-primary" disabled={!!busy || project?.state === "PROPOSAL_APPROVED" || project?.state === "SCRIPT_READY"} onClick={() => run("Aprobando", () => projectApprove(projectId))}>
              {busy === "Aprobando" ? "Guardando…" : "APROBAR PROPUESTA"}
            </button>
          </div>
          {editandoPropuesta && (
            <div className="card" style={{ marginTop: 12, background: "var(--panel-2)" }}>
              <div className="scene-title">Ajustar propuesta</div>
              <label className="field">
                <span>Formato</span>
                <select value={editFormato} onChange={(e) => setEditFormato(e.target.value)}>
                  {EDITORIAL_FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f] ?? f}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Profundidad (aproximada)</span>
                <select value={editProfundidad} onChange={(e) => setEditProfundidad(e.target.value as Profundidad)}>
                  {(["breve", "estandar", "profundo"] as Profundidad[]).map((d) => <option key={d} value={d}>{PROFUNDIDAD_LABELS[d]} · ~{PROFUNDIDAD_MIN[d]} min</option>)}
                </select>
              </label>
              <label className="field">
                <span>Enfoque</span>
                <textarea value={editEnfoque} rows={3} onChange={(e) => setEditEnfoque(e.target.value)} />
              </label>
              <button className="btn-primary" disabled={!!busy} onClick={() => run("Guardando", () => projectProposalUpdate(projectId, { formato: editFormato as Proposal["formato"], duracionEstimadaMin: PROFUNDIDAD_MIN[editProfundidad] ?? proposal.duracionEstimadaMin, enfoque: editEnfoque }))}>
                {busy === "Guardando" ? "Guardando…" : "GUARDAR CAMBIOS"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ═══ GUION ═══ */}
      {script && (isImportedScript || stepIdx >= 2) && (
        <section className="card">
          <div className="scene-title">Guion {isImportedScript ? "(Importado)" : ""}</div>

          {/* Resumen discreto de importación */}
          {integrity && (
            <div
              className="import-summary-card"
              style={{
                padding: "10px 14px",
                background: "var(--panel-2, rgba(15, 23, 42, 0.6))",
                borderRadius: 8,
                marginBottom: 12,
                border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "#3b82f6" }}>
                  📋 {isImportedScript ? "Guion importado" : "Estructura del episodio"} · {integrity.stats.totalTurns} intervenciones (~{Math.round(script.estimacionDurSec / 60)} min)
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontWeight: 600,
                    background: integrity.canProduceAudio ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: integrity.canProduceAudio ? "#22c55e" : "#ef4444",
                    border: `1px solid ${integrity.canProduceAudio ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                  }}
                >
                  {integrity.canProduceAudio ? "Estructura válida ✓" : "Requiere revisión ⚠"}
                </span>
              </div>
              <div className="muted small" style={{ display: "flex", gap: 14, flexWrap: "wrap", lineHeight: 1.4 }}>
                <span>
                  <strong>Locutores:</strong>{" "}
                  {Object.entries(integrity.stats.speakerCounts)
                    .map(([spk, count]) => `${nombreCorto(spk)}: ${count}`)
                    .join(" · ")}
                </span>
                <span><strong>Pausas:</strong> {integrity.stats.totalPauses}</span>
                <span><strong>Música:</strong> {integrity.stats.totalMusicEvents}</span>
                <span><strong>SFX:</strong> {integrity.stats.totalSfxEvents}</span>
              </div>
            </div>
          )}

          {/* Alerta de integridad si hay errores que bloquean la producción */}
          {integrity && !integrity.canProduceAudio && (
            <div
              className="card"
              style={{
                border: "1px solid #ef4444",
                background: "rgba(239, 68, 68, 0.08)",
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 14,
              }}
            >
              <h4 style={{ margin: "0 0 6px", color: "#ef4444", fontSize: "0.92rem" }}>
                ⚠ No pudimos interpretar completamente este guion
              </h4>
              <p className="muted small" style={{ margin: "0 0 8px" }}>
                Corrige los siguientes puntos para habilitar la generación de audio:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem", color: "#f87171" }}>
                {integrity.errors.map((err, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    {err.speaker ? `[${nombreCorto(err.speaker)}] ` : ""}{err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {verify && (
            <div className={`coverage ${verify.verified ? "ok" : "warn"}`} style={{ marginBottom: 12 }}>
              <div className="coverage-head">
                <span>Verificación: {verify.verified ? "Todo con respaldo" : `${verify.issues.length} afirmaciones necesitan revisión`}</span>
                <span className={`coverage-status ${verify.verified ? "ok" : "pendiente"}`}>{verify.verified ? "Verificado" : "Revisar"}</span>
              </div>
              {verify.issues.slice(0, 6).map((i, idx) => <div key={idx} className="coverage-item revisar">• {i.turnId}: {i.detail}</div>)}
              <div className="muted small" style={{ marginTop: 6 }}>{verify.verifiedClaims} afirmaciones respaldadas · {verify.sources.length} fuentes.</div>
            </div>
          )}

          {/* Vista limpia de intervenciones */}
          <div className="script-editor">
            {script.turns.map((t) => {
              const fuentes = turnoFuente(t);
              const cleanDialogue = (t.displayText || t.ttsText || "")
                .replace(/\[(?:PAUSA|PAUSE|SILENCIO)[\s\S]*?\]/gi, " ")
                .replace(/\[(?:MÚSICA|MUSICA|MUSIC|SFX|CORTE|AUDIO|TRANSICIÓN|TRANSICION)[\s\S]*?\]/gi, " ")
                .replace(/\s{2,}/g, " ")
                .trim();
              return (
                <div key={t.id} className={`script-line ${t.adSlot ? "ad" : ""}`}>
                  <div className="script-locutor" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span className="locutor-tag" style={{ background: speakerColor(t.speaker) }}>
                      {t.adSlot ? "Comercial" : nombreCorto(t.speaker)}
                    </span>
                    {t.delivery?.styles && t.delivery.styles.length > 0 && (
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        {t.delivery.styles.map((s, sIdx) => (
                          <span
                            key={sIdx}
                            style={{
                              fontSize: "0.72rem",
                              padding: "1px 7px",
                              borderRadius: 10,
                              background: "rgba(148, 163, 184, 0.15)",
                              color: "#94a3b8",
                              border: "1px solid rgba(148, 163, 184, 0.25)",
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {t.authorPause && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          padding: "1px 7px",
                          borderRadius: 10,
                          background: "rgba(234, 179, 8, 0.12)",
                          color: "#facc15",
                          border: "1px solid rgba(234, 179, 8, 0.25)",
                        }}
                      >
                        ⏱ pausa {t.pauseBeforeMs ?? 500} ms
                      </span>
                    )}
                    {t.transition && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          padding: "1px 7px",
                          borderRadius: 10,
                          background: "rgba(59, 130, 246, 0.12)",
                          color: "#93c5fd",
                          border: "1px solid rgba(59, 130, 246, 0.25)",
                        }}
                      >
                        ⚡ {t.transition}
                      </span>
                    )}
                    {fuentes.length > 0 && (
                      <span
                        className="meta-chip cita"
                        onClick={() => setFuenteAbierta(fuenteAbierta === t.id ? null : t.id)}
                        style={{ cursor: "pointer" }}
                      >
                        📚 {fuentes.length}
                      </span>
                    )}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: "var(--fg, #e2e8f0)" }}>
                    {cleanDialogue}
                  </div>
                  {fuenteAbierta === t.id && (
                    <div className="tag" style={{ marginTop: 6, whiteSpace: "normal", display: "block", background: "var(--panel-3)" }}>
                      {fuentes.map((f, i) => <div key={i} className="muted small" style={{ marginBottom: 4 }}>📄 {f.document}</div>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn-secondary" disabled={!!busy} onClick={() => run("Verificando", () => projectVerify(projectId).then(setVerify))}>
              {busy === "Verificando" ? "Verificando…" : "VERIFICAR GUION"}
            </button>
            <button
              className="btn-primary"
              disabled={!!busy || (integrity !== null && !integrity.canProduceAudio)}
              onClick={() => void runProduce()}
            >
              {busy === "Creando episodio" ? "Creando…" : "CREAR EPISODIO"}
            </button>
          </div>
        </section>
      )}

      {/* ═══ AUDIO / PRODUCCIÓN ═══ */}
      {(stepIdx >= 3 || (isImportedScript && (progress || master || busy === "Creando episodio"))) && (
        <section className="card" ref={audioRef}>
          <div className="scene-title">Audio del episodio</div>
          {progress && progress.total > 0 && (
            <>
              <div className="bar" style={{ margin: "12px 0 6px" }}>
                <div className="bar-fill green" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <div className="muted small" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>{progress.done}/{progress.total} voces</span>
                {inicioProduce && <span>Lleva ~{Math.round((ahora - inicioProduce) / 60000)} min</span>}
                {progress.etaMin != null && progress.etaMin > 0 && <span>· falta ~{progress.etaMin} min</span>}
                {progress.rtf != null && <span>· {progress.rtf.toFixed(2)}× velocidad</span>}
              </div>
            </>
          )}
          {master ? (
            <div className="master-ok" style={{ marginTop: 14, padding: "14px 16px", borderRadius: 10, background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <strong style={{ color: "#22c55e", fontSize: "0.95rem" }}>
                  ✓ Audio final listo · {(master.bytes / 1024 / 1024).toFixed(1)} MB · {Math.round(master.duraccionMs / 1000)}s (~{(master.duraccionMs / 60000).toFixed(1)} min)
                </strong>
                {master.master && (
                  <a
                    className="chip-mini ok"
                    href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master)}`}
                    download={`episodio-${projectId}.mp3`}
                    style={{ textDecoration: "none", padding: "4px 10px", borderRadius: 8, background: "#22c55e", color: "#ffffff", fontWeight: 600, fontSize: "0.8rem" }}
                  >
                    ⬇ Descargar MP3
                  </a>
                )}
              </div>
              {master.master && (
                <div style={{ marginTop: 10 }}>
                  <MiniPlayer
                    src={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master.replace(/\\/g, "/"))}`}
                    label={deriveShortTitle(project?.titulo ?? project?.topic ?? "Episodio")}
                    accent="#22c55e"
                  />
                </div>
              )}

              {/* ── MEDIOS VISUALES / VIDEO DEL EPISODIO ── */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(34, 197, 94, 0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1.1rem" }}>🎬</span>
                    <strong style={{ fontSize: "0.95rem", color: "var(--fg, #f8fafc)" }}>
                      Video del episodio
                    </strong>
                    {project?.visual?.status === "READY" && (
                      <span className="chip-mini ok" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                        ✓ Listo para publicación
                      </span>
                    )}
                  </div>

                  {(!project?.visual || project.visual.status === "IDLE") && (
                    <button
                      className="btn-primary"
                      disabled={!!busy}
                      onClick={() => void runRenderVisual()}
                      style={{ fontSize: "0.82rem", padding: "6px 14px" }}
                    >
                      {busy === "Renderizando video" ? "Iniciando render…" : "🎬 GENERAR VIDEO (16:9 y 9:16)"}
                    </button>
                  )}
                  {project?.visual?.status === "FAILED" && (
                    <button
                      className="btn-primary"
                      disabled={!!busy}
                      onClick={() => void runRenderVisual()}
                      style={{ fontSize: "0.82rem", padding: "6px 14px" }}
                    >
                      {busy === "Renderizando video" ? "Iniciando render…" : "🔄 Reintentar render"}
                    </button>
                  )}
                  {project?.visual?.status === "READY" && (
                    <button
                      className="btn-secondary"
                      disabled={!!busy}
                      onClick={() => void runRenderVisual()}
                      style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                    >
                      {busy === "Renderizando video" ? "Renderizando…" : "🔄 Re-renderizar video"}
                    </button>
                  )}
                </div>

                {project?.visual?.status === "RENDERING" && (
                  <div style={{ padding: "16px", borderRadius: 8, background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.3)", textAlign: "center" }}>
                    <div style={{ color: "#60a5fa", fontWeight: 600, fontSize: "0.92rem", marginBottom: 6 }}>
                      ⏳ Renderizando videos con aceleración por hardware (16:9, 9:16 y preview)…
                    </div>
                    <p className="muted small" style={{ margin: 0 }}>
                      El motor visual está dibujando los cuadros, aplicando la identidad por locutor y sincronizando el audio máster.
                    </p>
                  </div>
                )}

                {project?.visual?.status === "FAILED" && (
                  <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444" }}>
                    <div style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>
                      ⚠ Error al generar los videos del episodio
                    </div>
                    <p className="muted small" style={{ margin: 0 }}>
                      {project.visual.error ?? "No se pudo completar el renderizado del video."}
                    </p>
                  </div>
                )}

                {project?.visual?.status === "READY" && project.visual.files && (
                  <div>
                    {/* Selector de formato */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      <button
                        className={formatoVideo === "16x9" ? "btn-primary" : "btn-ghost"}
                        onClick={() => setFormatoVideo("16x9")}
                        style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                      >
                        📺 Horizontal 16:9 (YouTube)
                      </button>
                      <button
                        className={formatoVideo === "9x16" ? "btn-primary" : "btn-ghost"}
                        onClick={() => setFormatoVideo("9x16")}
                        style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                      >
                        📱 Vertical 9:16 (TikTok / Reels)
                      </button>
                      <button
                        className={formatoVideo === "preview" ? "btn-primary" : "btn-ghost"}
                        onClick={() => setFormatoVideo("preview")}
                        style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                      >
                        ⚡ Preview ligero
                      </button>
                    </div>

                    {/* Reproductor de video nativo */}
                    {(() => {
                      const activeRelFile =
                        formatoVideo === "16x9"
                          ? project.visual.files.video16x9
                          : formatoVideo === "9x16"
                          ? project.visual.files.video9x16
                          : project.visual.files.preview;
                      if (!activeRelFile) return null;
                      const videoUrl = `${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(activeRelFile.replace(/\\/g, "/"))}`;

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ background: "#090d16", borderRadius: 8, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center" }}>
                            <video
                              key={videoUrl}
                              src={videoUrl}
                              controls
                              playsInline
                              style={{
                                maxWidth: "100%",
                                maxHeight: formatoVideo === "9x16" ? 480 : 380,
                                borderRadius: 8,
                              }}
                            />
                          </div>

                          {/* Botones de descarga de medios */}
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            {project.visual.files.video16x9 && (
                              <a
                                className="btn-secondary"
                                href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(project.visual.files.video16x9.replace(/\\/g, "/"))}`}
                                download={`episodio-${projectId}-16x9.mp4`}
                                style={{ textDecoration: "none", fontSize: "0.8rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                              >
                                ⬇ Descargar Video 16:9
                              </a>
                            )}
                            {project.visual.files.video9x16 && (
                              <a
                                className="btn-secondary"
                                href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(project.visual.files.video9x16.replace(/\\/g, "/"))}`}
                                download={`episodio-${projectId}-9x16.mp4`}
                                style={{ textDecoration: "none", fontSize: "0.8rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                              >
                                ⬇ Descargar Video 9:16
                              </a>
                            )}
                            {project.visual.files.preview && (
                              <a
                                className="btn-ghost"
                                href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(project.visual.files.preview.replace(/\\/g, "/"))}`}
                                download={`episodio-${projectId}-preview.mp4`}
                                style={{ textDecoration: "none", fontSize: "0.8rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                              >
                                ⬇ Descargar Preview
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {(!project?.visual || project.visual.status === "IDLE") && (
                  <p className="muted small" style={{ margin: "4px 0 0" }}>
                    Genera las versiones en video horizontal (16:9) y vertical (9:16) con reactividad sonora y safe zones verificadas para redes sociales y plataformas de video.
                  </p>
                )}
              </div>
            </div>
          ) : progress?.estado === "FAILED" ? (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444" }}>
              <div style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>
                ⚠ No se pudo completar la síntesis de audio
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                {progress.notas && progress.notas.length > 0
                  ? progress.notas[progress.notas.length - 1]
                  : "Ocurrió un error al sintetizar las voces con Speechify."}
              </p>
            </div>
          ) : progress && progress.done >= progress.total && progress.total > 0 ? (
            <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8, background: "rgba(59, 130, 246, 0.08)", border: "1px solid #3b82f6" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ color: "#3b82f6", fontWeight: 600, fontSize: "0.9rem" }}>
                  ✨ Voces sintetizadas (100 %). Montando conversación y master final…
                </span>
                <button
                  className="btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                  onClick={() => void runProduce()}
                >
                  Finalizar mezcla
                </button>
              </div>
              <p className="muted small" style={{ margin: "6px 0 0" }}>
                SmartMixer está recortando dead-air, insertando pausas milimétricas y normalizando a EBU R128.
              </p>
            </div>
          ) : (
            <p className="muted small" style={{ marginTop: 10 }}>
              {progress && progress.total > 0
                ? "Sintetizando las voces del episodio con Speechify (simba-3.0)…"
                : "Cuando des el OK, generaré las voces con Speechify, montaré la conversación y mezclaré el audio final."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
