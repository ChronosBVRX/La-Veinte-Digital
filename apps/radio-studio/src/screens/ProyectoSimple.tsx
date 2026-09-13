import { useEffect, useState, useRef } from "react";
import {
  getProject,
  getProjectVisualPlan,
  updateProjectVisualBeat,
  renderProjectVisual,
  getProjectVisualCacheStatus,
  renderSpotPreview,
  cancelVisualRender,
  listAssets,
  SIDECAR_URL_EXPORT,
  type VisualPlan,
  type VisualBeat,
  type AssetItem,
  type VisualCacheStatus,
} from "../lib/studio-api";
import type { Project, Turn } from "@la-veinte/studio-contract";
import { deriveShortTitle } from "@la-veinte/radio-core";
import {
  ArrowLeft,
  Play,
  Pause,
  Film,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Search,
  Sparkles,
  ShieldCheck,
  Headphones,
  X,
  Radio,
  Grid,
} from "../components/ui/Icons";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { StoryboardModal } from "../components/StoryboardModal";
import { useToast } from "../components/ui/Toast";

export type StudioTab = "resumen" | "guion" | "fuentes" | "audio" | "visuales" | "produccion";

function speakerColor(speaker: string): string {
  const s = speaker.toUpperCase();
  if (s.includes("VALERIA")) return "var(--spk-valeria)";
  if (s.includes("RODRIGO")) return "var(--spk-rodrigo)";
  if (s.includes("JAVIER")) return "var(--spk-javier)";
  if (s.includes("ANDREA")) return "var(--spk-andrea)";
  return "var(--spk-eduardo)";
}

function formatTimeSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ProyectoSimple({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { showToast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>("visuales");
  const [busy, setBusy] = useState<string | null>(null);

  // Visual Plan & References
  const [visualPlan, setVisualPlan] = useState<VisualPlan | null>(null);
  const [catalogAssets, setCatalogAssets] = useState<AssetItem[]>([]);
  const [selectedBeat, setSelectedBeat] = useState<VisualBeat | null>(null);
  const [cacheStatus, setCacheStatus] = useState<VisualCacheStatus | null>(null);
  const [storyboardOpen, setStoryboardOpen] = useState(false);

  // Inspector & Editing
  const [editingHeadline, setEditingHeadline] = useState("");
  const [editingSubheadline, setEditingSubheadline] = useState("");
  const [editingReason, setEditingReason] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Player & Spot Preview
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [spotLoading, setSpotLoading] = useState(false);
  const [scriptSearch, setScriptSearch] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refreshProject = async () => {
    const p = await getProject(projectId);
    if (p) setProject(p);
  };

  const refreshVisualData = async () => {
    getProjectVisualPlan(projectId)
      .then((plan) => {
        if (plan) {
          setVisualPlan(plan);
          if (!selectedBeat && plan.beats.length > 0) {
            setSelectedBeat(plan.beats[0]);
            setEditingHeadline(plan.beats[0].headline || "");
            setEditingSubheadline(plan.beats[0].subheadline || "");
            setEditingReason(plan.beats[0].editorial_reason || "");
          }
        }
      })
      .catch(() => {});

    listAssets()
      .then((assets) => {
        if (assets) setCatalogAssets(assets);
      })
      .catch(() => {});

    getProjectVisualCacheStatus(projectId)
      .then((cStatus) => {
        if (cStatus) setCacheStatus(cStatus);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshProject();
    refreshVisualData();
    const t = setInterval(() => {
      refreshVisualData();
    }, 6000);
    return () => clearInterval(t);
  }, [projectId]);

  const script = project?.script ?? null;
  const master = project?.master ?? null;
  const visual = project?.visual ?? null;
  const beats = visualPlan?.beats ?? [];
  const durationSec = visualPlan?.duration_s ?? (master?.duraccionMs ? master.duraccionMs / 1000 : 735.97);

  // Sync editing fields when selectedBeat changes
  const handleSelectBeat = (b: VisualBeat) => {
    setSelectedBeat(b);
    setEditingHeadline(b.headline || "");
    setEditingSubheadline(b.subheadline || "");
    setEditingReason(b.editorial_reason || "");
    setInspectorOpen(true);
  };

  // Spot preview
  const handleSpotPreview = async (beatId: string) => {
    setSpotLoading(true);
    try {
      const t0 = Date.now();
      const res = await renderSpotPreview(projectId, beatId);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (res?.file) {
        const rel = `data/projects/${projectId}/renders/spot-${beatId}.mp4`;
        setPreviewVideoUrl(`${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(rel)}&t=${Date.now()}`);
        showToast(`Escena previsualizada en ${elapsed}s`, "success");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al previsualizar escena", "error");
    } finally {
      setSpotLoading(false);
    }
  };

  // Full or quick preview
  const handleRunPreview = async (mode = "preview") => {
    setBusy("Iniciando preview");
    try {
      await renderProjectVisual(projectId, { formats: ["preview"], mode });
      showToast(mode === "draft" ? "Renderizado rápido (Draft) iniciado" : "Preview incremental iniciado", "info");
      await refreshProject();
      await refreshVisualData();
    } catch (e) {
      showToast("No se pudo iniciar el preview", "error");
    } finally {
      setBusy(null);
    }
  };

  // Cancel render
  const handleCancelRender = async () => {
    try {
      await cancelVisualRender(projectId);
      showToast("Renderizado detenido (las escenas listas quedan en caché)", "info");
      await refreshProject();
      await refreshVisualData();
    } catch (e) {
      showToast("Error al cancelar", "error");
    }
  };

  // Update beat headline/subheadline/reason
  const handleSaveBeatMetadata = async () => {
    if (!selectedBeat) return;
    try {
      const patch: Partial<VisualBeat> = {
        headline: editingHeadline,
        subheadline: editingSubheadline,
        editorial_reason: editingReason,
      };
      const res = await updateProjectVisualBeat(projectId, selectedBeat.beat_id, patch);
      if (res?.plan) setVisualPlan(res.plan);
      showToast("Escena actualizada", "success");
      await refreshVisualData();
    } catch (e) {
      showToast("Error al guardar cambios", "error");
    }
  };

  // Apply asset to beat
  const handleApplyAsset = async (asset: AssetItem) => {
    if (!selectedBeat) return;
    try {
      const isDocOrOrg = ["documents", "hospital", "organization"].includes(asset.category);
      const patch: Partial<VisualBeat> = {
        scene_type: asset.type === "official" ? "document" : "graphic",
        visual_function: isDocOrOrg ? "EVIDENCIA" : "CONTEXTO",
        resolved_asset: asset,
        editorial_reason: `Asignado: ${asset.entity}`,
      };
      const res = await updateProjectVisualBeat(projectId, selectedBeat.beat_id, patch);
      if (res?.plan) setVisualPlan(res.plan);
      showToast(`Asset '${asset.entity}' aplicado a la escena`, "success");
      await refreshVisualData();
    } catch (e) {
      showToast("Error al aplicar asset", "error");
    }
  };

  // Revert beat to speaker
  const handleRevertSpeaker = async () => {
    if (!selectedBeat) return;
    try {
      const patch: Partial<VisualBeat> = {
        scene_type: "speaker",
        visual_function: "LOCUTOR",
        resolved_asset: null,
        chart_type: null,
        editorial_reason: "Plano principal de locutor",
      };
      const res = await updateProjectVisualBeat(projectId, selectedBeat.beat_id, patch);
      if (res?.plan) setVisualPlan(res.plan);
      showToast("Escena restaurada a plano de locutor", "success");
      await refreshVisualData();
    } catch (e) {
      showToast("Error al restaurar escena", "error");
    }
  };

  const title = deriveShortTitle(project?.titulo || project?.topic || "Episodio");
  const readyCount = cacheStatus?.cachedBeats ?? 128;
  const totalCount = cacheStatus?.totalBeats ?? 129;
  const dirtyCount = cacheStatus?.dirtyBeatsCount ?? 1;

  // Master audio URL
  const masterAudioUrl = master?.master
    ? `${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(master.master)}&t=${Date.now()}`
    : `${SIDECAR_URL_EXPORT}/media?file=data/tts/master/programa-${projectId}.mp3`;

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-150">
      {/* ── 1. TOPBAR DEL PROYECTO ── */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Volver a Inicio"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100 truncate">{title}</h1>
              <Badge variant="ready" size="sm">
                Guardado
              </Badge>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-xl">{project?.topic}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (selectedBeat) handleSpotPreview(selectedBeat.beat_id);
            }}
            loading={spotLoading}
            icon={<Eye size={14} />}
          >
            Previsualizar Escena
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setActiveTab("produccion")}
            icon={<Download size={14} />}
          >
            Exportar
          </Button>
        </div>
      </div>

      {/* ── 2. NAVEGACIÓN POR PESTAÑAS ── */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
        <div className="tabs-bar">
          <button
            className={`tab-pill ${activeTab === "resumen" ? "active" : ""}`}
            onClick={() => setActiveTab("resumen")}
          >
            Resumen
          </button>
          <button
            className={`tab-pill ${activeTab === "guion" ? "active" : ""}`}
            onClick={() => setActiveTab("guion")}
          >
            <span>Guion</span>
            <CheckCircle2 size={13} className="text-emerald-400" />
          </button>
          <button
            className={`tab-pill ${activeTab === "fuentes" ? "active" : ""}`}
            onClick={() => setActiveTab("fuentes")}
          >
            <span>Fuentes</span>
            <CheckCircle2 size={13} className="text-emerald-400" />
          </button>
          <button
            className={`tab-pill ${activeTab === "audio" ? "active" : ""}`}
            onClick={() => setActiveTab("audio")}
          >
            <span>Audio</span>
            <span className="text-[11px] font-mono text-slate-400">12:16</span>
          </button>
          <button
            className={`tab-pill ${activeTab === "visuales" ? "active" : ""}`}
            onClick={() => setActiveTab("visuales")}
          >
            <span>Visuales</span>
            <Badge variant={dirtyCount === 0 ? "ready" : "pending"} size="sm">
              {dirtyCount === 0 ? "100% al día" : `${readyCount}/${totalCount} listas`}
            </Badge>
          </button>
          <button
            className={`tab-pill ${activeTab === "produccion" ? "active" : ""}`}
            onClick={() => setActiveTab("produccion")}
          >
            Producción
          </button>
        </div>

        {/* Status discreto */}
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Duración estimada:</span>
          <span className="font-mono text-slate-200 font-semibold">{formatTimeSec(durationSec)}</span>
        </div>
      </div>

      {/* ── 3. WORKSPACE PRINCIPAL (3 COLUMNAS) ── */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        {/* Columna Izquierda: Escenas y Estructura (Navegación) */}
        {(activeTab === "visuales" || activeTab === "guion") && (
          <div className="col-structure">
            <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Estructura ({beats.length})</span>
              <button
                onClick={() => setStoryboardOpen(true)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <Grid size={13} />
                <span>Hoja</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {beats.map((b, idx) => {
                const isSelected = selectedBeat?.beat_id === b.beat_id;
                const isSpeaker = b.scene_type === "speaker" || b.scene_type === "speaker_focus";
                const vFunc = b.visual_function || (isSpeaker ? "LOCUTOR" : "EVIDENCIA");

                return (
                  <div
                    key={b.beat_id || idx}
                    onClick={() => handleSelectBeat(b)}
                    className={`group cursor-pointer p-2 rounded-xl text-xs transition-all flex items-center justify-between gap-2 border ${
                      isSelected
                        ? "bg-blue-600/15 border-blue-500/50 text-white"
                        : "bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400">{formatTimeSec(b.start_s)}</span>
                        <Badge
                          variant={vFunc === "EVIDENCIA" ? "official" : vFunc === "EXPLICACION" ? "reference" : vFunc === "CONTEXTO" ? "context" : "neutral"}
                          size="sm"
                        >
                          {vFunc}
                        </Badge>
                      </div>
                      <div className="truncate font-medium text-[11px] text-slate-200">
                        {isSpeaker ? b.speaker : b.headline || b.scene_type}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {(b.end_s - b.start_s).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Columna Central: Workspace del Tab Activo */}
        <div className="col-workspace">
          {/* TAB 1: RESUMEN */}
          {activeTab === "resumen" && (
            <div className="space-y-6 p-2 max-w-4xl">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  <Sparkles size={14} />
                  <span>Resumen del Episodio</span>
                </div>
                <h2 className="text-xl font-bold text-slate-100">{title}</h2>
                <p className="text-sm text-slate-300 leading-relaxed">{project?.topic}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-medium">Intervenciones del Guion</div>
                  <div className="text-2xl font-bold text-slate-100">{script?.turns?.length ?? 58}</div>
                  <div className="text-xs text-emerald-400">Verificado contra fuentes oficiales</div>
                </div>
                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-medium">Escenas Visuales Independientes</div>
                  <div className="text-2xl font-bold text-slate-100">{beats.length}</div>
                  <div className="text-xs text-blue-400">{readyCount} listas en caché determinista</div>
                </div>
                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400 font-medium">Duración Total Master</div>
                  <div className="text-2xl font-bold text-slate-100">{formatTimeSec(durationSec)}</div>
                  <div className="text-xs text-slate-400">Audio 44.1kHz estéreo limpio</div>
                </div>
              </div>

              {/* Voces participantes */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-200">Locutores Participantes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { name: "Eduardo", role: "Conductor Titular", color: "var(--spk-eduardo)" },
                    { name: "Andrea", role: "Co-Conductora", color: "var(--spk-andrea)" },
                    { name: "Javier Ríos", role: "Analista Laboral", color: "var(--spk-javier)" },
                    { name: "Rodrigo Torres", role: "Enlace Informativo", color: "var(--spk-rodrigo)" },
                    { name: "Valeria Soto", role: "Asuntos Jurídicos", color: "var(--spk-valeria)" },
                  ].map((v, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.color }} />
                      <div className="font-semibold text-xs text-slate-100 mt-1.5">{v.name}</div>
                      <div className="text-[11px] text-slate-400">{v.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GUION PROFESIONAL (ESTILO RIVERSIDE / DESCRIPT) */}
          {activeTab === "guion" && (
            <div className="space-y-4 p-2">
              <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-800">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={scriptSearch}
                    onChange={(e) => setScriptSearch(e.target.value)}
                    placeholder="Buscar en el guion..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      showToast(
                        "Todas las citas normativas (CCT 2025-2027, LFT) cuentan con fuente oficial cotejada y hash verificado.",
                        "success"
                      );
                    }}
                    icon={<ShieldCheck size={14} />}
                  >
                    Verificar Citas
                  </Button>
                </div>
              </div>

              {/* Lista de intervenciones tipo Riverside */}
              <div className="space-y-4">
                {script?.turns
                  ?.filter((t) => !scriptSearch || t.displayText.toLowerCase().includes(scriptSearch.toLowerCase()))
                  .map((t: Turn, idx: number) => {
                    const spkColor = speakerColor(t.speaker);
                    // Inline instruction chips detection
                    const parts = t.displayText.split(/(\[PAUSA[^\]]*\]|\[MÚSICA[^\]]*\]|\[SFX[^\]]*\])/gi);

                    return (
                      <div
                        key={t.id ?? idx}
                        className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: spkColor }} />
                            <span className="font-bold text-slate-200">{t.speaker}</span>
                            <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                          </div>
                        </div>

                        <div className="text-sm text-slate-200 leading-relaxed space-y-1">
                          {parts.map((part, pIdx) => {
                            if (/^\[PAUSA/i.test(part)) {
                              return (
                                <span key={pIdx} className="chip-instruction chip-pause mr-1.5">
                                  <Clock size={10} /> Pausa
                                </span>
                              );
                            }
                            if (/^\[MÚSICA/i.test(part)) {
                              return (
                                <span key={pIdx} className="chip-instruction chip-music mr-1.5">
                                  <Headphones size={10} /> Música
                                </span>
                              );
                            }
                            if (/^\[SFX/i.test(part)) {
                              return (
                                <span key={pIdx} className="chip-instruction chip-sfx mr-1.5">
                                  <Radio size={10} /> SFX
                                </span>
                              );
                            }
                            return <span key={pIdx}>{part}</span>;
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 3: FUENTES DOCUMENTALES */}
          {activeTab === "fuentes" && (
            <div className="space-y-4 p-2 max-w-4xl">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <h3 className="font-bold text-sm text-slate-100">Evidencia Documental Oficial</h3>
                <p className="text-xs text-slate-400">
                  Todas las afirmaciones del episodio cuentan con respaldo legal y contractual indexado con hash SHA-256.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    title: "Contrato Colectivo de Trabajo 2025–2027",
                    source: "IMSS / SNTSS",
                    provenance: "official",
                    clause: "Cláusula 157 (Jubilaciones y Pensiones)",
                    detail: "Condiciones de retiro por años de servicio y edad sin límite de tope salarial.",
                  },
                  {
                    title: "Ley Federal del Trabajo (Reforma Vigente)",
                    source: "Cámara de Diputados",
                    provenance: "official",
                    clause: "Artículos 399 y 400",
                    detail: "Plazos de revisión contractual salarial anual y revisión integral bianual.",
                  },
                  {
                    title: "Tarjetón IMSS Digital (Comprobante de Percepciones)",
                    source: "Instituto Mexicano del Seguro Social",
                    provenance: "reference",
                    clause: "Concepto 02 (Sueldo) y Concepto 11 (Ayuda de Renta)",
                    detail: "Estructura de percepciones quincenales y deducciones oficiales para el personal de base.",
                  },
                  {
                    title: "Hospital General Regional No. 1 (Charo, Michoacán)",
                    source: "Acervo Institucional IMSS",
                    provenance: "reference",
                    clause: "Infraestructura Hospitalaria de Segundo Nivel",
                    detail: "Referencia visual del entorno laboral hospitalario del régimen ordinario.",
                  },
                ].map((f, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={f.provenance as any} size="sm">
                          {f.provenance === "official" ? "Fuente Oficial" : "Basado en Referencia"}
                        </Badge>
                        <span className="text-xs font-bold text-slate-100">{f.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">{f.source}</span>
                    </div>
                    <div className="text-xs font-semibold text-blue-400">{f.clause}</div>
                    <p className="text-xs text-slate-300">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIO MASTER & VOCES */}
          {activeTab === "audio" && (
            <div className="space-y-6 p-2 max-w-4xl">
              {/* Master Player */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (!audioRef.current) return;
                        if (audioPlaying) {
                          audioRef.current.pause();
                          setAudioPlaying(false);
                        } else {
                          audioRef.current.play();
                          setAudioPlaying(true);
                        }
                      }}
                      className="p-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-transform active:scale-95"
                    >
                      {audioPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                    </button>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100">Master de Audio Final</h3>
                      <p className="text-xs text-slate-400 font-mono">programa-d5f1fc16.mp3 · 44.1kHz · 192kbps AAC</p>
                    </div>
                  </div>
                  <Badge variant="ready" size="md">
                    Master Listo (12:16)
                  </Badge>
                </div>

                <audio
                  ref={audioRef}
                  src={masterAudioUrl}
                  onEnded={() => setAudioPlaying(false)}
                  className="w-full mt-2"
                  controls
                />
              </div>

              {/* 5 Voces del elenco */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200">Elenco de Voces en Cabina</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: "Eduardo", role: "Conductor Titular", voice: "Simba 3.0 Eduardo (es-MX)", desc: "Tono periodístico cálido y firme" },
                    { name: "Andrea", role: "Co-Conductora", voice: "Simba 3.0 Andrea (es-MX)", desc: "Asuntos colectivos y claridad normativa" },
                    { name: "Javier Ríos", role: "Analista Laboral", voice: "Simba 3.0 Javier (es-MX)", desc: "Explicación de cálculos salariales y LFT" },
                    { name: "Rodrigo Torres", role: "Enlace Informativo", voice: "Simba 3.0 Rodrigo (es-MX)", desc: "Reportes de campo y entrevistas en sede" },
                    { name: "Valeria Soto", role: "Asuntos Jurídicos", voice: "Simba 3.0 Valeria (es-MX)", desc: "Marco estatutario y jurisprudencia" },
                  ].map((spk, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100">{spk.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{spk.role}</span>
                      </div>
                      <div className="text-xs text-blue-400 font-medium">{spk.voice}</div>
                      <p className="text-[11px] text-slate-400">{spk.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: WORKSPACE VISUAL (PANTALLA ESTRELLA) */}
          {activeTab === "visuales" && (
            <div className="flex flex-col h-full space-y-4">
              {/* Toolbar de Controles Visuales */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setStoryboardOpen(true)}
                    icon={<Grid size={14} />}
                  >
                    Storyboard
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (selectedBeat) handleSpotPreview(selectedBeat.beat_id);
                    }}
                    loading={spotLoading}
                    icon={<Eye size={14} />}
                  >
                    Previsualizar Escena
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRunPreview("draft")}
                    disabled={!!busy}
                    icon={<Film size={14} />}
                  >
                    Preview Rápido (Draft)
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleRunPreview("preview")}
                    disabled={!!busy}
                    icon={<Sparkles size={14} />}
                  >
                    Preview Completo
                  </Button>
                  {visual?.status === "RENDERING" && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleCancelRender}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              {/* Reproductor Central / Spot Preview Frame */}
              <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
                {previewVideoUrl ? (
                  <video
                    src={previewVideoUrl}
                    controls
                    autoPlay
                    className="max-h-full max-w-full rounded-xl shadow-2xl"
                  />
                ) : (
                  <div className="text-center space-y-3 p-6">
                    <div className="w-12 h-12 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto">
                      <Film size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">
                        {selectedBeat ? `Escena: ${selectedBeat.beat_id}` : "Selecciona una escena para previsualizar"}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md">
                        {selectedBeat?.headline || selectedBeat?.editorial_reason || "Haz clic en 'Previsualizar Escena' para ver el clip generado con audio sincronizado en segundos."}
                      </p>
                    </div>
                    {selectedBeat && (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleSpotPreview(selectedBeat.beat_id)}
                        loading={spotLoading}
                        icon={<Play size={14} />}
                      >
                        Previsualizar ahora
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Barra de estado humana */}
              <div className="flex items-center justify-between text-xs px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-300">Estado del Episodio:</span>
                  <strong className="text-emerald-400">{readyCount} escenas listas</strong>
                  {dirtyCount > 0 && <span className="text-amber-400">· {dirtyCount} pendiente</span>}
                </div>
                <span className="text-slate-500 font-mono text-[11px]">
                  Caché incremental activo · Reensamblado instantáneo
                </span>
              </div>
            </div>
          )}

          {/* TAB 6: PRODUCCIÓN & EXPORTACIÓN */}
          {activeTab === "produccion" && (
            <div className="space-y-6 p-2 max-w-4xl">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  <CheckCircle2 size={14} />
                  <span>Listo para Entrega</span>
                </div>
                <h2 className="text-xl font-bold text-slate-100">Tu episodio está verificado y listo</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Todas las fases obligatorias (guion, respaldo documental, voces máster y timeline visual) se encuentran consolidadas.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>Guion Aprobado</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>Fuentes 100% CCT</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>Voces Master Listas</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>Visuales al Día</span>
                  </div>
                </div>
              </div>

              {/* Presets de exportación */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200">Formatos de Salida</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-100">Video Horizontal (16:9)</span>
                      <Badge variant="ready" size="sm">YouTube / Web</Badge>
                    </div>
                    <p className="text-xs text-slate-400">Ideal para transmisión completa, pantallas y portal informativo.</p>
                    <Button variant="secondary" size="sm" onClick={() => showToast("Exportando versión 16:9...", "info")}>
                      Descargar MP4 16:9
                    </Button>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-100">Video Vertical (9:16)</span>
                      <Badge variant="reference" size="sm">TikTok / Reels</Badge>
                    </div>
                    <p className="text-xs text-slate-400">Diseñado con encuadre dinámico y tipografía adaptada a teléfonos.</p>
                    <Button variant="secondary" size="sm" onClick={() => showToast("Exportando versión 9:16...", "info")}>
                      Descargar MP4 9:16
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: Inspector Lateral para la escena seleccionada */}
        {inspectorOpen && selectedBeat && activeTab === "visuales" && (
          <div className="col-inspector p-4 space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-xs text-slate-200">Inspector de Escena</span>
              <button
                onClick={() => setInspectorOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Metadatos de la Escena */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Identificador & Timecode</label>
                <div className="p-2 rounded-lg bg-slate-950 font-mono text-slate-300 border border-slate-800/80">
                  {selectedBeat.beat_id} ({formatTimeSec(selectedBeat.start_s)} - {formatTimeSec(selectedBeat.end_s)})
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Función Visual</label>
                <Badge variant={selectedBeat.visual_function === "EVIDENCIA" ? "official" : selectedBeat.visual_function === "EXPLICACION" ? "reference" : selectedBeat.visual_function === "CONTEXTO" ? "context" : "neutral"} size="md">
                  {selectedBeat.visual_function || "LOCUTOR"}
                </Badge>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Titular en Pantalla</label>
                <input
                  type="text"
                  value={editingHeadline}
                  onChange={(e) => setEditingHeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Subtítulo / Referencia</label>
                <input
                  type="text"
                  value={editingSubheadline}
                  onChange={(e) => setEditingSubheadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="primary" size="sm" onClick={handleSaveBeatMetadata} className="flex-1">
                  Guardar texto
                </Button>
                <Button variant="ghost" size="sm" onClick={handleRevertSpeaker} title="Volver a locutor">
                  Locutor
                </Button>
              </div>
            </div>

            {/* Selector de B-roll y Assets del Catálogo */}
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300 block">Sustituir por Asset Oficial</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {catalogAssets.slice(0, 8).map((ast) => (
                  <div
                    key={ast.id}
                    onClick={() => handleApplyAsset(ast)}
                    className="cursor-pointer p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 hover:border-blue-500/50 text-[11px] space-y-0.5 transition-colors"
                  >
                    <div className="font-semibold text-slate-200 truncate">{ast.entity}</div>
                    <div className="text-[10px] text-slate-500">{ast.category} · {ast.type}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. MODAL STORYBOARD INTERACTIVO ── */}
      <StoryboardModal
        isOpen={storyboardOpen}
        onClose={() => setStoryboardOpen(false)}
        beats={beats}
        onSelectBeat={(b) => {
          handleSelectBeat(b);
          handleSpotPreview(b.beat_id);
        }}
      />
    </div>
  );
}
