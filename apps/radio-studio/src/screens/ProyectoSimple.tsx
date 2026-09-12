/**
 * ProyectoSimple — AI Radio Studio: Resumen, Guion, Fuentes, Audio, Visuales y Producción.
 * Control 100% desde la interfaz: edición de beats, referencias reales, preview y render multiformato.
 */
import { useEffect, useMemo, useState } from "react";
import {
  getProject,
  projectResearch,
  projectApprove,
  projectVerify,
  projectProduce,
  obtenerProgreso,
  obtenerLlmSalud,
  getProjectVisualPlan,
  updateProjectVisualBeat,
  getProjectReferences,
  renderProjectVisual,
  listAssets,
  SIDECAR_URL_EXPORT,
  type LlmHealthInfo,
  type VisualPlan,
  type VisualBeat,
  type AssetItem,
  type ReferenceItem,
} from "../lib/studio-api";
import { MiniPlayer } from "../components/MiniPlayer";
import type { Project, VerifyResult, Turn } from "@la-veinte/studio-contract";
import { deriveShortTitle, validateScriptIntegrity, type ScriptIntegrityReport } from "@la-veinte/radio-core";

export type StudioTab = "resumen" | "guion" | "fuentes" | "audio" | "visuales" | "produccion";

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

function formatTimeSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ProyectoSimple({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>(() => {
    const t = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("tab") as StudioTab) : null;
    return t && ["resumen", "guion", "fuentes", "audio", "visuales", "produccion"].includes(t) ? t : "resumen";
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    estado: string | null;
    etaMin: number | null;
    rtf: number | null;
    notas?: string[];
  } | null>(null);
  const [inicioProduce, setInicioProduce] = useState<number | null>(null);
  const [ahora, setAhora] = useState<number>(() => Date.now());
  const [llm, setLlm] = useState<LlmHealthInfo | null>(null);

  // Visual Plan & References
  const [visualPlan, setVisualPlan] = useState<VisualPlan | null>(null);
  const [references, setReferences] = useState<Record<string, ReferenceItem> | null>(null);
  const [catalogAssets, setCatalogAssets] = useState<AssetItem[]>([]);
  const [selectedBeatForEdit, setSelectedBeatForEdit] = useState<VisualBeat | null>(null);
  const [editingBeatReason, setEditingBeatReason] = useState("");
  const [formatoVideo, setFormatoVideo] = useState<"16x9" | "9x16" | "preview">("16x9");

  const refreshProject = async () => {
    const p = await getProject(projectId);
    if (p) setProject(p);
  };

  const refreshVisualData = async () => {
    try {
      const [plan, refs, assets] = await Promise.all([
        getProjectVisualPlan(projectId),
        getProjectReferences(projectId),
        listAssets(),
      ]);
      if (plan) setVisualPlan(plan);
      if (refs) setReferences(refs);
      if (assets) setCatalogAssets(assets);
    } catch {
      // visual data aún no generada
    }
  };

  useEffect(() => {
    let mounted = true;
    void getProject(projectId).then((p) => {
      if (mounted && p) setProject(p);
    });
    void Promise.all([
      getProjectVisualPlan(projectId),
      getProjectReferences(projectId),
      listAssets(),
    ]).then(([plan, refs, assets]) => {
      if (mounted) {
        if (plan) setVisualPlan(plan);
        if (refs) setReferences(refs);
        if (assets) setCatalogAssets(assets);
      }
    }).catch(() => {});
    void obtenerLlmSalud().then((l) => {
      if (mounted) setLlm(l);
    });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    const t = setInterval(() => {
      void refreshProject();
      void refreshVisualData();
      void obtenerProgreso().then((r) => {
        if (r) {
          setProgress({
            done: r.done,
            total: r.total,
            estado: r.estado ?? null,
            etaMin: r.etaMin ?? null,
            rtf: r.rtfReciente ?? null,
            notas: r.notas,
          });
        }
      });
      setAhora(Date.now());
    }, 3000);
    return () => clearInterval(t);
  }, [projectId]);

  const research = project?.research ?? null;
  const proposal = project?.proposal ?? null;
  const script = project?.script ?? null;
  const master = project?.master ?? null;
  const visual = project?.visual ?? null;

  const integrity = useMemo<ScriptIntegrityReport | null>(() => {
    if (!script) return null;
    return validateScriptIntegrity(script);
  }, [script]);

  const run = async <T,>(actionLabel: string, fn: () => Promise<T>): Promise<T | null> => {
    setBusy(actionLabel);
    setError(null);
    try {
      const res = await fn();
      await refreshProject();
      await refreshVisualData();
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado";
      setError(msg);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const runProduce = async () => {
    if (integrity && !integrity.canProduceAudio) {
      setError("El guion requiere revisión de citas antes de producir.");
      return;
    }
    setInicioProduce(Date.now());
    await run("Creando audio", () => projectProduce(projectId));
  };

  const runRenderVisual = async (formats?: string[]) => {
    await run("Renderizando video", () => renderProjectVisual(projectId, { formats }));
  };

  const handleApplyBeatAsset = async (asset: AssetItem) => {
    if (!selectedBeatForEdit) return;
    try {
      const patch: Partial<VisualBeat> = {
        scene_type: asset.type === "official" ? "document" : "graphic",
        resolved_asset: asset,
        editorial_reason: editingBeatReason || selectedBeatForEdit.editorial_reason || `Asignado: ${asset.entity}`,
      };
      const res = await updateProjectVisualBeat(projectId, selectedBeatForEdit.beat_id, patch);
      if (res?.plan) setVisualPlan(res.plan);
      setSelectedBeatForEdit(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el beat visual");
    }
  };

  const handleRevertBeatToSpeaker = async () => {
    if (!selectedBeatForEdit) return;
    try {
      const patch: Partial<VisualBeat> = {
        scene_type: "speaker",
        resolved_asset: null,
        editorial_reason: "Plano principal de locutor",
      };
      const res = await updateProjectVisualBeat(projectId, selectedBeatForEdit.beat_id, patch);
      if (res?.plan) setVisualPlan(res.plan);
      setSelectedBeatForEdit(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo revertir el beat");
    }
  };

  const beats = visualPlan?.beats || [];
  const durationSec = visualPlan?.duration_s || (master?.duraccionMs ? master.duraccionMs / 1000 : 0);

  return (
    <div className="screen max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Volver a Inicio"
          >
            ← Volver
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-100">
                {deriveShortTitle(project?.titulo ?? project?.topic ?? "Episodio")}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                {project?.state ?? "DRAFT"}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5" style={{ maxWidth: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project?.topic}</p>
          </div>
        </div>

        {/* Action Buttons Top Bar */}
        <div className="flex items-center gap-2">
          {master?.master && (
            <a
              href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master.replace(/\\/g, "/"))}`}
              download={`episodio-${projectId}.mp3`}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>⬇️</span>
              <span>Audio MP3</span>
            </a>
          )}
          {visual?.files?.video16x9 && (
            <a
              href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(visual.files.video16x9.replace(/\\/g, "/"))}`}
              download={`episodio-${projectId}-16x9.mp4`}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>🎬</span>
              <span>Video 16:9</span>
            </a>
          )}
          {visual?.files?.video9x16 && (
            <a
              href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(visual.files.video9x16.replace(/\\/g, "/"))}`}
              download={`episodio-${projectId}-9x16.mp4`}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>📱</span>
              <span>Video 9:16</span>
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* 6 Studio Tabs */}
      <div className="flex border-b border-zinc-800 gap-2 overflow-x-auto text-sm">
        {[
          { id: "resumen", label: "Resumen", icon: "📋" },
          { id: "guion", label: "Guion", icon: "📝", count: script?.turns?.length },
          { id: "fuentes", label: "Fuentes & Referencias", icon: "📚", count: research?.evidence?.length },
          { id: "audio", label: "Audio & SmartMixer", icon: "🎙️", ready: Boolean(master) },
          { id: "visuales", label: "Plan Visual Interactivo", icon: "🎨", count: beats.length },
          { id: "produccion", label: "Producción & Render", icon: "🎬", ready: visual?.status === "READY" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as StudioTab)}
            className={`py-3 px-4 border-b-2 font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count != null && tab.count > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                {tab.count}
              </span>
            )}
            {tab.ready && <span className="text-emerald-400 text-xs">✓</span>}
          </button>
        ))}
      </div>

      {/* TAB 1: RESUMEN */}
      {activeTab === "resumen" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-2">
              <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Estado del Episodio</div>
              <div className="text-lg font-bold text-zinc-100">{project?.state}</div>
              <p className="text-xs text-zinc-400">
                {master ? "Audio mezclado y normalizado EBU R128." : "Flujo editorial en progreso."}
              </p>
            </div>

            <div className="card p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-2">
              <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Audio Master</div>
              <div className="text-lg font-bold text-zinc-100">
                {master ? `${(master.bytes / 1024 / 1024).toFixed(1)} MB · ${Math.round(master.duraccionMs / 1000)}s` : "Pendiente"}
              </div>
              <p className="text-xs text-zinc-400">PCM 24kHz Lineal broadcast + MP3 192kbps</p>
            </div>

            <div className="card p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-2">
              <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Entregables de Video</div>
              <div className="text-lg font-bold text-zinc-100">
                {visual?.status === "READY" ? "16:9 y 9:16 Listos" : visual?.status === "RENDERING" ? "Renderizando…" : "Listos para generar"}
              </div>
              <p className="text-xs text-zinc-400">
                {visual?.status === "READY" ? "Safe zones verificadas sin colisiones" : "Aceleración por hardware NVENC"}
              </p>
            </div>
          </div>

          {/* Proposal / Approve Section */}
          {proposal && (
            <div className="card p-5 bg-zinc-900/40 border border-zinc-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <h3 className="font-bold text-base text-zinc-100">{project?.titulo || proposal.enfoque}</h3>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">
                  ~{proposal.duracionEstimadaMin} min · {proposal.formato}
                </span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{proposal.enfoque}</p>

              {project?.state === "PROPOSAL_READY" && (
                <div className="pt-2 flex gap-3">
                  <button
                    className="btn-primary py-2.5 px-6 text-sm font-bold shadow-lg shadow-blue-600/30"
                    disabled={!!busy}
                    onClick={() => run("Aprobando propuesta", () => projectApprove(projectId))}
                  >
                    {busy === "Aprobando propuesta" ? "Aprobando…" : "✓ APROBAR PROPUESTA Y ESCRIBIR GUION"}
                  </button>
                </div>
              )}
            </div>
          )}

          {!research && !script && (
            <div className="p-8 text-center bg-zinc-900/30 rounded-2xl border border-zinc-800/80 space-y-4">
              <p className="text-sm text-zinc-300">Este episodio está en borrador. Inicia la investigación documental para comenzar.</p>
              <button
                className="btn-primary py-3 px-8 text-sm font-bold"
                disabled={!!busy}
                onClick={() => run("Investigando", () => projectResearch(projectId))}
              >
                {busy === "Investigando" ? "Investigando…" : "🔍 INICIAR INVESTIGACIÓN NORMATIVA"}
              </button>
            </div>
          )}

          {llm && (
            <div className="text-[11px] text-zinc-500 flex items-center gap-2 pt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Motor editorial: {llm.provider.toUpperCase()} ({llm.model})</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GUION */}
      {activeTab === "guion" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="font-bold text-base text-zinc-100">Guion del Episodio</h3>
              <p className="text-xs text-zinc-400">{script?.turns?.length ?? 0} intervenciones con locutores asignados</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary text-xs py-2 px-3"
                disabled={!!busy}
                onClick={() => run("Verificando", () => projectVerify(projectId).then(setVerify))}
              >
                {busy === "Verificando" ? "Verificando…" : "VERIFICAR CITA Y NORMAS"}
              </button>
              {(!master || script) && (
                <button
                  className="btn-primary text-xs py-2 px-4 font-bold"
                  disabled={!!busy}
                  onClick={() => void runProduce()}
                >
                  {busy === "Creando audio" ? "Creando…" : "🎙️ GENERAR VOCES Y AUDIO"}
                </button>
              )}
            </div>
          </div>

          {verify && (
            <div className={`p-3.5 rounded-xl border text-xs ${verify.verified ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" : "bg-amber-950/20 border-amber-500/30 text-amber-300"}`}>
              <div className="font-bold">{verify.verified ? "✓ Verificación normativa aprobada" : "⚠ Observaciones en verificación"}</div>
              <div className="text-[11px] mt-1">
                {verify.verifiedClaims} de {verify.totalClaims} afirmaciones con sustento documental verificado.
                {verify.issues.length > 0 && ` (${verify.issues.length} notas)`}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {script?.turns?.map((t: Turn, idx: number) => (
              <div
                key={t.id ?? idx}
                className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-2 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold px-2 py-0.5 rounded text-[11px] text-white"
                      style={{ backgroundColor: speakerColor(t.speaker) }}
                    >
                      {nombreCorto(t.speaker)}
                    </span>
                    <span className="text-zinc-500 font-mono text-[10px]">#{idx + 1}</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed">{t.displayText}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FUENTES & REFERENCIAS REALES */}
      {activeTab === "fuentes" && (
        <div className="space-y-6">
          {/* Referencias Reales Investigadas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                  <span>🏛️</span>
                  <span>Referencias Visuales Reales Investigadas</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Gobernanza editorial: logos institucionales, arquitectura hospitalaria y tipografías normativas exactas.
                </p>
              </div>
            </div>

            {references && Object.keys(references).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(references).map(([entity, ref]) => {
                  const char = (ref.verified_characteristics || {}) as Record<string, unknown>;
                  const colors = Array.isArray(char.colors) ? char.colors : Array.isArray(char.primary_colors) ? char.primary_colors : [];
                  return (
                    <div key={entity} className="card p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-zinc-100">{entity}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 uppercase">
                          {ref.status ?? "VERIFICADO"}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-300 space-y-1">
                        {colors.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-500">Colores:</span>
                            {colors.map((c: string, i: number) => (
                              <span
                                key={i}
                                className="w-4 h-4 rounded border border-zinc-700 inline-block"
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                          </div>
                        )}
                        {Boolean(char.architecture) && (
                          <div>
                            <span className="text-zinc-500">Arquitectura:</span> {String(char.architecture)}
                          </div>
                        )}
                        {Boolean(char.notes) && (
                          <div className="text-zinc-400 italic text-[11px] mt-1">{String(char.notes)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center bg-zinc-900/30 rounded-xl border border-zinc-800 text-xs text-zinc-400">
                Aún no se han compilado referencias específicas para este episodio.
              </div>
            )}
          </div>

          {/* Fuentes Normativas Escritas */}
          <div>
            <h3 className="font-bold text-base text-zinc-100 mb-3 flex items-center gap-2">
              <span>📄</span>
              <span>Fuentes Documentales del Corpus</span>
            </h3>
            {research?.evidence && research.evidence.length > 0 ? (
              <div className="space-y-2">
                {research.evidence.map((ev, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-zinc-200">{ev.document}</div>
                      <div className="text-zinc-500 text-[11px] mt-0.5">{ev.article || ev.section || ev.excerpt?.slice(0, 100)}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 text-blue-300 text-[10px]">
                      Vigente
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-zinc-900/30 rounded-xl border border-zinc-800 text-xs text-zinc-400">
                No hay fuentes documentales asociadas todavía.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIO & SMARTMIXER */}
      {activeTab === "audio" && (
        <div className="space-y-6">
          <div className="card p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-100">Master Final de Audio</h3>
                <p className="text-xs text-zinc-400">Mezclado con SmartMixer, música y normalización EBU R128 (-16 LUFS)</p>
              </div>
              {master?.master && (
                <a
                  href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master.replace(/\\/g, "/"))}`}
                  download={`episodio-${projectId}.mp3`}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2"
                >
                  ⬇ Descargar Master MP3
                </a>
              )}
            </div>

            {progress && progress.total > 0 && !master && (
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-blue-300">
                  <span>Sintetizando voces con Speechify (simba-3.0)…</span>
                  <span>{progress.done} / {progress.total} intervenciones</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                  <span>{inicioProduce ? `Transcurrido: ~${Math.round((ahora - inicioProduce) / 60000)} min` : ""}</span>
                  <span>{progress.etaMin ? `Falta: ~${progress.etaMin} min` : ""}</span>
                </div>
              </div>
            )}

            {master?.master ? (
              <div className="space-y-4">
                <MiniPlayer
                  src={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master.replace(/\\/g, "/"))}`}
                  label={deriveShortTitle(project?.titulo ?? project?.topic ?? "Audio Master")}
                  accent="#22c55e"
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-500 block">Duración</span>
                    <span className="font-bold text-zinc-200">{Math.round(master.duraccionMs / 1000)} s</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-500 block">Tamaño</span>
                    <span className="font-bold text-zinc-200">{(master.bytes / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-500 block">Frecuencia</span>
                    <span className="font-bold text-zinc-200">24 kHz Broadcast</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-500 block">Alignment</span>
                    <span className="font-bold text-emerald-400">✓ Canónico</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-4">
                <p className="text-sm text-zinc-400">El audio master aún no ha sido generado.</p>
                <button
                  className="btn-primary py-3 px-8 text-sm font-bold"
                  disabled={!!busy}
                  onClick={() => void runProduce()}
                >
                  {busy === "Creando audio" ? "Sintetizando y Mezclando…" : "🎙️ GENERAR AUDIO CON SPEECHIFY"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: VISUALES (PLAN VISUAL INTERACTIVO POR BEAT) */}
      {activeTab === "visuales" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                <span>🎨</span>
                <span>Plan Visual Editorial por Beat</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Haz clic en cualquier beat para cambiar su apoyo visual, sustituir por otro asset o volver al plano de locutor.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary text-xs py-2 px-3"
                disabled={!!busy}
                onClick={() => void runRenderVisual(["preview"])}
              >
                ⚡ Generar Preview Rápida
              </button>
              <button
                className="btn-primary text-xs py-2 px-4 font-bold"
                disabled={!!busy}
                onClick={() => void runRenderVisual(["preview", "16x9", "9x16"])}
              >
                🎬 RENDERIZAR TODOS (16:9 y 9:16)
              </button>
            </div>
          </div>

          {/* Timeline Bar Representativa */}
          {beats.length > 0 && durationSec > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                <span>00:00</span>
                <span>{formatTimeSec(durationSec)}</span>
              </div>
              <div className="h-6 w-full rounded-lg bg-zinc-900 border border-zinc-800 flex overflow-hidden">
                {beats.map((b) => {
                  const widthPct = Math.max(1, ((b.end_s - b.start_s) / durationSec) * 100);
                  const isGraphic = b.scene_type !== "speaker";
                  const color =
                    b.scene_type === "speaker"
                      ? speakerColor(b.speaker ?? "Eduardo")
                      : b.scene_type === "document"
                        ? "#10b981"
                        : b.scene_type === "quote"
                          ? "#8b5cf6"
                          : "#f59e0b";
                  return (
                    <div
                      key={b.beat_id}
                      onClick={() => setSelectedBeatForEdit(b)}
                      className="h-full border-r border-zinc-950/40 hover:brightness-125 cursor-pointer transition-all"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: color,
                        opacity: isGraphic ? 0.9 : 0.6,
                      }}
                      title={`${formatTimeSec(b.start_s)} - ${formatTimeSec(b.end_s)}: ${b.scene_type} (${b.speaker})`}
                    />
                  );
                })}
              </div>
              <div className="flex gap-4 text-[11px] text-zinc-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Locutor
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Documento / Logo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> Cita / Artículo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Cifra / Número
                </span>
              </div>
            </div>
          )}

          {/* Tarjetas de Beats */}
          {beats.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {beats.map((beat) => {
                const isGraphic = beat.scene_type !== "speaker";
                return (
                  <div
                    key={beat.beat_id}
                    onClick={() => setSelectedBeatForEdit(beat)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                      selectedBeatForEdit?.beat_id === beat.beat_id
                        ? "bg-blue-950/30 border-blue-500 shadow-lg shadow-blue-500/10"
                        : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-zinc-400 font-semibold">
                        {formatTimeSec(beat.start_s)} – {formatTimeSec(beat.end_s)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isGraphic
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {beat.scene_type.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: speakerColor(beat.speaker ?? "") }}
                      />
                      <span className="font-bold text-xs text-zinc-200">{beat.speaker}</span>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 italic">
                      {`"${beat.editorial_reason || beat.display_text}"`}
                    </p>

                    <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-800/60">
                      <span>{beat.resolved_asset ? "Asset vinculado" : "Plano estándar"}</span>
                      <span className="text-blue-400 font-semibold">Editar ✎</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-zinc-900/30 rounded-xl border border-zinc-800 space-y-3">
              <p className="text-sm text-zinc-400">
                El plan visual se genera automáticamente al iniciar el renderizado o puedes generarlo con una preview rápida.
              </p>
              <button
                className="btn-primary py-2 px-6 text-xs font-bold"
                disabled={!master || !!busy}
                onClick={() => void runRenderVisual(["preview"])}
              >
                ⚡ GENERAR PLAN VISUAL Y PREVIEW
              </button>
            </div>
          )}

          {/* Modal / Panel de Edición de Beat */}
          {selectedBeatForEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <h4 className="font-bold text-base text-zinc-100">
                      Editar Beat Visual ({formatTimeSec(selectedBeatForEdit.start_s)} – {formatTimeSec(selectedBeatForEdit.end_s)})
                    </h4>
                    <p className="text-xs text-zinc-400">Locutor activo: {selectedBeatForEdit.speaker}</p>
                  </div>
                  <button
                    onClick={() => setSelectedBeatForEdit(null)}
                    className="text-zinc-400 hover:text-zinc-100"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Razón editorial de la escena:</label>
                    <input
                      type="text"
                      defaultValue={selectedBeatForEdit.editorial_reason ?? ""}
                      onChange={(e) => setEditingBeatReason(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
                      placeholder="Ej. Cita de la Cláusula 22 del CCT"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-2">Seleccionar asset del catálogo:</label>
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {catalogAssets.map((asset) => (
                        <div
                          key={asset.id}
                          onClick={() => void handleApplyBeatAsset(asset)}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:border-blue-500 cursor-pointer text-xs"
                        >
                          <div>
                            <div className="font-semibold text-zinc-200">{asset.entity}</div>
                            <div className="text-[10px] text-zinc-500 capitalize">{asset.category} · {asset.type}</div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                            Usar
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
                  <button
                    type="button"
                    onClick={() => void handleRevertBeatToSpeaker()}
                    className="text-xs text-amber-400 hover:underline"
                  >
                    Revertir a plano de locutor
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBeatForEdit(null)}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: PRODUCCIÓN & RENDER */}
      {activeTab === "produccion" && (
        <div className="space-y-6">
          <div className="card p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-zinc-100">Monitor de Renderizado y Entregables</h3>
                <p className="text-xs text-zinc-400">
                  Renderiza preview ultra-rápida o videos finales completos (16:9 y 9:16) con cero llamadas a Speechify.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary text-xs py-2 px-3"
                  disabled={!master || !!busy}
                  onClick={() => void runRenderVisual(["preview"])}
                >
                  ⚡ Preview Rápida
                </button>
                <button
                  className="btn-primary text-xs py-2 px-4 font-bold shadow-lg shadow-blue-600/20"
                  disabled={!master || !!busy}
                  onClick={() => void runRenderVisual(["preview", "16x9", "9x16"])}
                >
                  🎬 GENERAR VIDEOS FINALES (16:9 + 9:16)
                </button>
              </div>
            </div>

            {/* Progreso en tiempo real de frames */}
            {visual?.status === "RENDERING" && (
              <div className="p-5 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    Renderizando video {visual.progress?.format ? `[${visual.progress.format}]` : ""}…
                  </span>
                  <span className="font-mono text-blue-200 font-bold">
                    {visual.progress ? `${visual.progress.percent}%` : "Iniciando motor…"}
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                    style={{ width: `${visual.progress?.percent ?? 5}%` }}
                  />
                </div>

                {visual.progress && (
                  <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                    <span>Cuadro {visual.progress.frame} de {visual.progress.totalFrames}</span>
                    <span>Transcurrido: {visual.progress.elapsedSec.toFixed(1)}s</span>
                  </div>
                )}
              </div>
            )}

            {/* Reproductor de Video y Formatos */}
            {visual?.files && Object.keys(visual.files).length > 0 && (
              <div className="space-y-4 pt-2">
                {/* Selector de formato */}
                <div className="flex gap-2 border-b border-zinc-800 pb-3">
                  {visual.files.video16x9 && (
                    <button
                      onClick={() => setFormatoVideo("16x9")}
                      className={`text-xs py-1.5 px-3 rounded-lg font-semibold transition-colors ${
                        formatoVideo === "16x9"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      📺 Horizontal 16:9
                    </button>
                  )}
                  {visual.files.video9x16 && (
                    <button
                      onClick={() => setFormatoVideo("9x16")}
                      className={`text-xs py-1.5 px-3 rounded-lg font-semibold transition-colors ${
                        formatoVideo === "9x16"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      📱 Vertical 9:16
                    </button>
                  )}
                  {visual.files.preview && (
                    <button
                      onClick={() => setFormatoVideo("preview")}
                      className={`text-xs py-1.5 px-3 rounded-lg font-semibold transition-colors ${
                        formatoVideo === "preview"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      ⚡ Preview 480p
                    </button>
                  )}
                </div>

                {/* Video Player */}
                {(() => {
                  const targetRel =
                    formatoVideo === "16x9"
                      ? visual.files.video16x9
                      : formatoVideo === "9x16"
                        ? visual.files.video9x16
                        : visual.files.preview;
                  if (!targetRel) return null;
                  const videoUrl = `${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(targetRel.replace(/\\/g, "/"))}`;

                  return (
                    <div className="space-y-4">
                      <div className="bg-black/90 rounded-xl overflow-hidden flex items-center justify-center border border-zinc-800 p-2">
                        <video
                          key={videoUrl}
                          src={videoUrl}
                          controls
                          playsInline
                          className={`rounded-lg max-h-[480px] ${
                            formatoVideo === "9x16" ? "max-w-[270px]" : "w-full max-w-2xl"
                          }`}
                        />
                      </div>

                      {/* Botón de Aprobación en Preview */}
                      {formatoVideo === "preview" && (!visual.files.video16x9 || !visual.files.video9x16) && (
                        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-sm text-emerald-300">Preview lista para revisión</div>
                            <div className="text-xs text-zinc-400">Si el montaje visual es correcto, genera las versiones finales en 1080p.</div>
                          </div>
                          <button
                            className="btn-primary py-2.5 px-5 text-xs font-bold"
                            disabled={!!busy}
                            onClick={() => void runRenderVisual(["16x9", "9x16"])}
                          >
                            ✓ APROBAR Y GENERAR 16:9 + 9:16
                          </button>
                        </div>
                      )}

                      {/* Tarjetas de Descarga */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2">
                        {visual.files.video16x9 && (
                          <a
                            href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(visual.files.video16x9.replace(/\\/g, "/"))}`}
                            download={`episodio-${projectId}-16x9.mp4`}
                            className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between transition-colors text-zinc-200"
                          >
                            <div>
                              <div className="font-bold">Video 16:9 Full HD</div>
                              <div className="text-[11px] text-zinc-400">1920x1080 · MP4 H.264</div>
                            </div>
                            <span className="text-base">⬇️</span>
                          </a>
                        )}

                        {visual.files.video9x16 && (
                          <a
                            href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(visual.files.video9x16.replace(/\\/g, "/"))}`}
                            download={`episodio-${projectId}-9x16.mp4`}
                            className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between transition-colors text-zinc-200"
                          >
                            <div>
                              <div className="font-bold">Video 9:16 Vertical</div>
                              <div className="text-[11px] text-zinc-400">1080x1920 · TikTok/Reels</div>
                            </div>
                            <span className="text-base">⬇️</span>
                          </a>
                        )}

                        {visual.files.preview && (
                          <a
                            href={`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(visual.files.preview.replace(/\\/g, "/"))}`}
                            download={`episodio-${projectId}-preview.mp4`}
                            className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between transition-colors text-zinc-200"
                          >
                            <div>
                              <div className="font-bold">Preview Rápida</div>
                              <div className="text-[11px] text-zinc-400">854x480 · Ligera</div>
                            </div>
                            <span className="text-base">⬇️</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
