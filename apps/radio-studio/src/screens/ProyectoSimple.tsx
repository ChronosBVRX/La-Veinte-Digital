/**
 * ProyectoSimple — flujo novato: TEMA → INVESTIGACIÓN → PROPUESTA → GUION → AUDIO.
 * Sin jerga técnica: "Fuentes encontradas", "Información verificada", "Voz", "Motor local".
 * El usuario solo escribe un tema y confirma en cada paso.
 */
import { useEffect, useMemo, useState } from "react";
import {
  getProject, projectResearch, projectProposal, projectApprove, projectScript,
  projectVerify, projectProduce, projectProposalUpdate, obtenerProgreso, obtenerLlmSalud,
  SIDECAR_URL_EXPORT, type LlmHealthInfo,
} from "../lib/studio-api";
import type { Project, Proposal, VerifyResult, Turn } from "@la-veinte/studio-contract";
import {
  FORMAT_LABELS, NIVEL_LABELS, EDITORIAL_FORMATS,
  PROFUNDIDAD_LABELS, PROFUNDIDAD_MIN, type Profundidad,
} from "@la-veinte/studio-contract";

const STEPS = [
  { id: "research", label: "Investigar", icon: "🔎" },
  { id: "proposal", label: "Propuesta", icon: "📋" },
  { id: "script", label: "Guion", icon: "📝" },
  { id: "audio", label: "Audio", icon: "▶" },
] as const;

function stateToStep(state: string): number {
  if (["RESEARCHING"].includes(state)) return 0;
  if (["RESEARCHED", "PROPOSAL_READY", "PROPOSAL_APPROVED"].includes(state)) return 1;
  if (["SCRIPT_GENERATING", "SCRIPT_READY", "SCRIPT_APPROVED", "NEEDS_REVIEW"].includes(state)) return 2;
  if (["PRODUCING", "NEEDS_REVIEW", "MASTERING", "DONE"].includes(state)) return 3;
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
  const [progress, setProgress] = useState<{ done: number; total: number; estado: string | null } | null>(null);
  const [llm, setLlm] = useState<LlmHealthInfo | null>(null);
  const [fuenteAbierta, setFuenteAbierta] = useState<string | null>(null);
  const [editandoPropuesta, setEditandoPropuesta] = useState(false);
  const [usarIA, setUsarIA] = useState(false);
  const [editFormato, setEditFormato] = useState<string>("");
  const [editProfundidad, setEditProfundidad] = useState<Profundidad>("estandar");
  const [editEnfoque, setEditEnfoque] = useState("");

  const refresh = async () => {
    const p = await getProject(projectId);
    if (p) setProject(p);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch asíncrono, no cascada
  useEffect(() => { void refresh(); }, [projectId]);
  useEffect(() => { void obtenerLlmSalud().then(setLlm); }, []);
  useEffect(() => {
    const t = setInterval(() => { void refresh(); void obtenerProgreso().then((r) => r && setProgress({ done: r.done, total: r.total, estado: r.estado ?? null })); }, 4000);
    return () => clearInterval(t);
  }, [projectId]);

  const stepIdx = stateToStep(project?.state ?? "DRAFT");
  const research = project?.research ?? null;
  const proposal = project?.proposal ?? null;
  const script = project?.script ?? null;
  const master = project?.master ?? null;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setError(null);
    try { await fn(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Algo salió mal"); }
    finally { setBusy(null); }
  };

  const runProduce = async () => {
    setBusy("Creando episodio"); setError(null);
    try {
      const r = await projectProduce(projectId);
      setProgress({ done: 0, total: r.started?.total ?? 0, estado: "RUNNING" });
    } catch (e) { setError(e instanceof Error ? e.message : "No pude iniciar la producción"); }
    finally { setBusy(null); }
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
          <h1>{project?.titulo ?? "Episodio"}</h1>
          <p className="muted">Investigamos nuestras bibliotecas, te contamos qué encontramos y qué no, y tú decides el siguiente paso.</p>
        </div>
        <div className={`ready-pill ${llm?.health.ok ? "ok" : "warn"}`}>
          {llm?.health.ok ? "Motor local listo" : "Motor local iniciando"}
        </div>
      </div>

      {/* Paso a paso */}
      <div className="step-strip" style={{ marginBottom: 18 }}>
        {STEPS.map((s, i) => (
          <section key={s.id} className={`step-card ${i === stepIdx ? "active" : i < stepIdx ? "done" : ""}`}>
            <span className="step-num">{i < stepIdx ? "✓" : i + 1}</span>
            <div>
              <h2>{s.icon} {s.label}</h2>
              <p className="muted small">{i < stepIdx ? "Listo" : i === stepIdx ? "En curso" : "Pendiente"}</p>
            </div>
          </section>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {/* ═══ INVESTIGACIÓN ═══ */}
      {stepIdx <= 1 && (
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
      {stepIdx >= 1 && stepIdx <= 2 && proposal && (
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
              <label className="check" style={{ marginBottom: 8 }}>
                <input type="checkbox" checked={usarIA} onChange={(e) => setUsarIA(e.target.checked)} />
                Mejorar el guion con IA local (más lento, puede tardar varios minutos)
              </label>
              <div className="row">
                <button className="btn-primary" disabled={!!busy} onClick={() => run("Escribiendo guion", () => projectScript(projectId, usarIA ? "ia" : "determinista").then((r) => { setVerify(r.verify); }))}>
                  {busy === "Escribiendo guion" ? (usarIA ? "Generando con IA (minutos)…" : "Escribiendo guion…") : "GENERAR GUION"}
                </button>
              </div>
              {usarIA && <div className="muted small" style={{ marginTop: 8 }}>La IA local tarda unos minutos; el guion aparecerá aquí al terminar. Si prefieres algo inmediato, deja esta opción desactivada.</div>}
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
      {stepIdx >= 2 && stepIdx <= 3 && script && (
        <section className="card">
          <div className="scene-title">Guion</div>
          <div className="muted small" style={{ marginBottom: 10 }}>
            {script.turns.length} intervenciones · ~{Math.round(script.estimacionDurSec / 60)} min · {script.turns.filter((t) => t.adSlot).length} bloques comerciales
          </div>
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
          {/* Documento limpio */}
          <div className="script-editor">
            {script.turns.map((t) => {
              const fuentes = turnoFuente(t);
              return (
                <div key={t.id} className={`script-line ${t.adSlot ? "ad" : ""}`}>
                  <div className="script-locutor">
                    <span className="locutor-tag" style={{ background: speakerColor(t.speaker) }}>{t.adSlot ? "Comercial" : nombreCorto(t.speaker)}</span>
                    {fuentes.length > 0 && <span className="meta-chip cita" onClick={() => setFuenteAbierta(fuenteAbierta === t.id ? null : t.id)} style={{ cursor: "pointer" }}>📚 {fuentes.length}</span>}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{t.displayText}</div>
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
            <button className="btn-primary" disabled={!!busy} onClick={() => void runProduce()}>
              {busy === "Creando episodio" ? "Creando…" : "CREAR EPISODIO"}
            </button>
          </div>
        </section>
      )}

      {/* ═══ AUDIO / PRODUCCIÓN ═══ */}
      {stepIdx >= 3 && (
        <section className="card">
          <div className="scene-title">Audio del episodio</div>
          {progress && progress.total > 0 && (
            <>
              <div className="bar" style={{ margin: "12px 0 6px" }}>
                <div className="bar-fill green" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <div className="muted small">{progress.done}/{progress.total} voces · {progress.estado}</div>
            </>
          )}
          {master ? (
            <div className="master-ok" style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>Audio final listo · {(master.bytes / 1024 / 1024).toFixed(1)} MB · {Math.round(master.duraccionMs / 1000)}s</div>
              {master.master && <audio controls src={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master)}`} />}
            </div>
          ) : (
            <p className="muted small" style={{ marginTop: 10 }}>
              {progress && progress.total > 0 ? "El estudio está generando las voces con el motor local…" : "Cuando des el OK, generaré las voces, montaré la conversación y mezclaré el audio final."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
