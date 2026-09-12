import { useEffect, useMemo, useState } from "react";
import { listProjects, deleteProject, SIDECAR_URL_EXPORT } from "../lib/studio-api";
import { MiniPlayer } from "../components/MiniPlayer";
import { AdvancedProductionDrawer } from "../components/AdvancedProductionDrawer";
import type { Project, Script, ProductionPreferences } from "@la-veinte/studio-contract";
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

function formatoMinSeg(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")} min`;
}

export function Inicio({
  onCrear,
  onOpen,
}: {
  onCrear: (
    tema: string,
    comerciales: boolean,
    profundidad: Profundidad,
    options?: { script?: Script | null; forceTopic?: boolean; productionPreferences?: ProductionPreferences }
  ) => void;
  onOpen: (id: string) => void;
}) {
  const [tema, setTema] = useState("");
  const [comerciales, setComerciales] = useState(false);
  const [profundidad, setProfundidad] = useState<Profundidad>("estandar");
  const [duracionMin, setDuracionMin] = useState(15);
  const [contextoExtra, setContextoExtra] = useState("");
  const [modoProduccion, setModoProduccion] = useState<"audio" | "audio_video">("audio_video");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<ProductionPreferences>({
    mode: "audio_video",
    outputFormats: ["preview", "16x9", "9x16"],
    videoQuality: "produccion",
    visualStyle: "equilibrado",
    visualElements: {
      realReferences: true,
      illustrations: true,
      buildings: true,
      documents: true,
      logos: true,
      charts: true,
      timelines: true,
      diagrams: true,
      keyStats: true,
    },
    researchReferences: true,
    visualFidelity: "referencias_reales",
    sourcesPriority: "oficiales",
    showSources: true,
    autoApproveVerified: true,
    participantsMode: "auto",
    selectedParticipants: ["EDUARDO", "ANDREA", "JAVIER RÍOS", "RODRIGO TORRES", "VALERIA SOTO"],
    customDocuments: [],
    customVisualReferences: [],
  });

  const [recent, setRecent] = useState<Project[]>([]);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sugerencias = [
    "¿Qué pasa si me cambian de horario sin avisarme?",
    "Cómo solicitar vacaciones y prima vacacional en el IMSS",
    "Accidente de trabajo y llenado del formato ST-7",
    "Tiempo extraordinario y descansos laborados en el IMSS",
  ];

  const recargar = () => void listProjects().then((ps) => setRecent(ps.slice(0, 8)));

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

  const handleModeChange = (mode: "audio" | "audio_video") => {
    setModoProduccion(mode);
    setPreferences((prev) => ({
      ...prev,
      mode,
      outputFormats: mode === "audio" ? [] : (prev.outputFormats && prev.outputFormats.length > 0 ? prev.outputFormats : ["preview", "16x9", "9x16"]),
    }));
  };

  const handleCrear = (forceTopic = false) => {
    if (!tema.trim()) return;
    const finalPrefs: ProductionPreferences = {
      ...preferences,
      mode: modoProduccion,
    };
    onCrear(tema.trim(), comerciales, profundidad, {
      script: !forceTopic && parsedScript ? parsedScript : undefined,
      forceTopic,
      productionPreferences: finalPrefs,
    });
  };

  const handleDuplicar = (p: Project) => {
    onCrear(p.topic, Boolean(p.config?.comerciales?.enabled), (p.config?.profundidad as Profundidad) || "estandar", {
      script: p.script ?? undefined,
      productionPreferences: p.config?.productionPreferences,
    });
  };

  const eliminar = async (p: Project) => {
    setEliminando(p.id);
    setError(null);
    try {
      await deleteProject(p.id);
      setRecent((prev) => prev.filter((x) => x.id !== p.id));
      setConfirmando(null);
      setMenuOpenId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el episodio");
    } finally {
      setEliminando(null);
    }
  };

  return (
    <div className="screen" onClick={() => setMenuOpenId(null)}>
      {/* Hero */}
      <div className="home-hero flex items-center justify-between">
        <div>
          <div className="brand-title" style={{ fontSize: 20, marginBottom: 2 }}>
            LA VEINTE RADIO
          </div>
          <h1>Estudio Integral de Producción Audiovisual</h1>
          <p className="muted">
            Genera episodios de radio y televisión laboral con investigación documental y referencias reales verificadas.
          </p>
        </div>
        <div className="ready-pill ok flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          SISTEMA LISTO
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6">
        {/* Left Column: Creator (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <section className="card start-card p-5 space-y-4">
            {/* Input Header & Area */}
            <label className="field block">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm text-zinc-200">Tema o guion del episodio</span>
                {classification && (
                  <span
                    className="chip text-xs px-2.5 py-0.5 rounded-full font-semibold"
                    style={{
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
                rows={tema.includes("\n") || tema.length > 80 ? 5 : 2}
                className="w-full text-sm p-3 rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all leading-relaxed"
              />
            </label>

            {/* Selector de Modo de Producción */}
            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Tipo de Producción Solicitada
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => handleModeChange("audio_video")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    modoProduccion === "audio_video"
                      ? "bg-blue-950/25 border-blue-500 text-zinc-100 shadow-md shadow-blue-500/10"
                      : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">🎬</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      Recomendado
                    </span>
                  </div>
                  <div className="font-bold text-sm text-zinc-100 mt-2">Audio + Video Completo</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Master WAV/MP3 + Video 16:9 y 9:16 con referencias reales
                  </div>
                </div>

                <div
                  onClick={() => handleModeChange("audio")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    modoProduccion === "audio"
                      ? "bg-blue-950/25 border-blue-500 text-zinc-100 shadow-md shadow-blue-500/10"
                      : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <div className="text-xl">🎙️</div>
                  <div className="font-bold text-sm text-zinc-100 mt-2">Solo Audio</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    WAV 24k broadcast + MP3 podcast sin generación de video
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de Creación y CTA Principal */}
            <div className="pt-2 space-y-3">
              {classification?.kind === "script" ? (
                <div className="flex gap-2">
                  <button
                    className="btn-primary btn-main-action flex-1 py-3 font-bold text-sm"
                    onClick={() => handleCrear(false)}
                    disabled={!tema.trim()}
                  >
                    📝 IMPORTAR GUION Y PRODUCIR {modoProduccion === "audio_video" ? "(AUDIO + VIDEO)" : "(SOLO AUDIO)"}
                  </button>
                  <button
                    className="btn-secondary px-4 text-xs font-semibold"
                    onClick={() => handleCrear(true)}
                    disabled={!tema.trim()}
                    title="Investigar como tema en la biblioteca"
                  >
                    Investigar como tema
                  </button>
                </div>
              ) : (
                <button
                  className="btn-primary btn-main-action w-full py-3 font-bold text-sm shadow-lg shadow-blue-600/20"
                  onClick={() => handleCrear(false)}
                  disabled={!tema.trim()}
                >
                  {modoProduccion === "audio_video"
                    ? "🚀 CREAR EPISODIO COMPLETO (AUDIO + VIDEO)"
                    : "🎙️ CREAR EPISODIO (SOLO AUDIO)"}
                </button>
              )}

              {/* Badges de Entregables Dinámicos */}
              <div className="flex flex-wrap gap-1.5 items-center justify-center pt-1 text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-500">Se generará:</span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">WAV Master 24k</span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">MP3 Podcast</span>
                {modoProduccion === "audio_video" && (
                  <>
                    <span className="px-2 py-0.5 rounded bg-blue-950/40 border border-blue-700/50 text-blue-300">
                      🎬 16:9 Full HD
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950/40 border border-purple-700/50 text-purple-300">
                      📱 9:16 Vertical
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-700/50 text-emerald-300">
                      🏛️ Ref. Reales
                    </span>
                  </>
                )}
              </div>

              {/* Botón de Controles Avanzados */}
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="flex items-center gap-2 text-xs text-zinc-400 hover:text-blue-400 transition-colors py-1 px-3 rounded-lg hover:bg-zinc-800/60"
                >
                  <span>⚙️</span>
                  <span className="font-semibold underline">CONTROLES AVANZADOS</span>
                  <span className="text-[10px] text-zinc-500">(calidad, apoyos visuales, locutores, fuentes)</span>
                </button>
              </div>
            </div>

            {/* Depth & Suggestions */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">Profundidad aproximada:</span>
                <div className="flex gap-2">
                  {(["breve", "estandar", "profundo"] as Profundidad[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`chip text-xs px-2.5 py-1 ${profundidad === d ? "chip-active font-bold" : ""}`}
                      onClick={() => {
                        setProfundidad(d);
                        setDuracionMin(PROFUNDIDAD_MIN[d] ?? 15);
                      }}
                    >
                      {PROFUNDIDAD_LABELS[d]} · ~{PROFUNDIDAD_MIN[d]} min
                    </button>
                  ))}
                </div>
              </div>

              <label className="check flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={comerciales}
                  onChange={(e) => setComerciales(e.target.checked)}
                  className="accent-blue-500 rounded"
                />
                <span>Incluir anuncios institucionales y comerciales autorizados</span>
              </label>

              <div className="pt-2">
                <span className="text-xs text-zinc-500 block mb-1.5">Sugerencias rápidas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {sugerencias.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chip text-[11px] hover:text-blue-300"
                      onClick={() => setTema(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Production Live Inspector (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card p-5 bg-zinc-900/60 border border-zinc-800/90 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <h3 className="font-bold text-sm text-zinc-200">Resumen de Producción</h3>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                Editar
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                <span className="text-zinc-400">Modo de Entrega</span>
                <span className="font-bold text-zinc-200">
                  {modoProduccion === "audio_video" ? "🎬 Audio + Video Completo" : "🎙️ Solo Audio"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                <span className="text-zinc-400">Duración Prevista</span>
                <span className="font-bold text-zinc-200">~{duracionMin} minutos</span>
              </div>

              {modoProduccion === "audio_video" && (
                <>
                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                    <span className="text-zinc-400">Estilo Visual</span>
                    <span className="font-bold text-blue-400 capitalize">
                      {preferences.visualStyle ?? "Equilibrado"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                    <span className="text-zinc-400">Calidad de Video</span>
                    <span className="font-bold text-zinc-200 capitalize">
                      {preferences.videoQuality === "produccion"
                        ? "1080p Estándar"
                        : preferences.videoQuality === "maxima"
                          ? "1080p Máxima"
                          : "480p Rápido"}
                    </span>
                  </div>

                  <div className="py-1 border-b border-zinc-800/50">
                    <div className="text-zinc-400 mb-1">Apoyos Visuales Habilitados:</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(preferences.visualElements ?? {})
                        .filter(([, v]) => v)
                        .slice(0, 5)
                        .map(([k]) => (
                          <span key={k} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300">
                            {k}
                          </span>
                        ))}
                      {Object.values(preferences.visualElements ?? {}).filter(Boolean).length > 5 && (
                        <span className="text-[10px] text-zinc-500">
                          +{Object.values(preferences.visualElements ?? {}).filter(Boolean).length - 5} más
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="py-1 border-b border-zinc-800/50">
                <div className="text-zinc-400 mb-1">Elenco Participante:</div>
                <div className="flex flex-wrap gap-1">
                  {(preferences.selectedParticipants ?? []).map((spk) => (
                    <span key={spk} className="px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-300 text-[10px] border border-blue-800/40 font-medium">
                      {spk}
                    </span>
                  ))}
                </div>
              </div>

              <div className="py-1 flex items-start gap-2 text-zinc-400">
                <span className="text-emerald-400">✓</span>
                <span>
                  Investigación visual real <strong>activa</strong>: busca logos oficiales y arquitectura de hospitales antes de renderizar.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-[11px] text-blue-300/80 leading-relaxed">
              💡 <strong>Cero costo de tokens:</strong> Cambiar el estilo visual, editar apoyos o re-renderizar video no vuelve a llamar a Speechify ni regenera las voces maestras.
            </div>
          </div>
        </div>
      </div>

      {/* Episodios Recientes con Menú Contextual */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div className="scene-title font-bold text-lg text-zinc-100">Episodios recientes</div>
          <span className="text-xs text-zinc-400">{recent.length} episodios en catálogo</span>
        </div>

        {error && <div className="error mb-3 p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs">{error}</div>}

        {recent.length === 0 ? (
          <div className="muted small p-8 text-center bg-zinc-900/30 rounded-xl border border-zinc-800/60">
            Todavía no tienes episodios. Escribe un tema arriba y presiona crear para iniciar.
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((p) => {
              const audioUrl = p.master?.master
                ? `${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(p.master.master.replace(/\\/g, "/"))}`
                : null;
              const tieneAudio = Boolean(audioUrl || p.state === "DONE");
              const tieneVideo = Boolean(p.visual?.status === "READY" && p.visual?.files);
              const video16x9Url = p.visual?.files?.video16x9
                ? `${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(p.visual.files.video16x9.replace(/\\/g, "/"))}`
                : null;
              const video9x16Url = p.visual?.files?.video9x16
                ? `${SIDECAR_URL_EXPORT}/media?file=${encodeURIComponent(p.visual.files.video9x16.replace(/\\/g, "/"))}`
                : null;

              const isMenuOpen = menuOpenId === p.id;

              return (
                <section key={p.id} className="card p-4 hover:border-zinc-700 transition-all relative">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-base text-zinc-100 flex items-center gap-2">
                        <span>{titleOf(p)}</span>
                        {tieneVideo && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            VIDEO
                          </span>
                        )}
                      </div>
                      <div className="muted small mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span style={{ color: tieneAudio ? "#22c55e" : undefined, fontWeight: tieneAudio ? 600 : undefined }}>
                          {tieneAudio
                            ? tieneVideo
                              ? "✓ Audio y Video listos"
                              : "✓ Audio listo"
                            : STATE_LABELS[p.state] ?? p.state}
                        </span>
                        <span>·</span>
                        <span>{fecha(p)}</span>
                        {p.master?.duraccionMs ? (
                          <>
                            <span>·</span>
                            <span>{formatoMinSeg(p.master.duraccionMs)}</span>
                          </>
                        ) : null}
                        {tieneVideo && (
                          <>
                            <span>·</span>
                            <span className="text-zinc-300">16:9 + 9:16</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="btn-primary py-2 px-4 text-xs font-bold"
                        onClick={() => onOpen(p.id)}
                      >
                        {tieneAudio || tieneVideo ? "ABRIR ESTUDIO" : "CONTINUAR"}
                      </button>

                      {/* Menú Contextual ⋯ */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setMenuOpenId(isMenuOpen ? null : p.id)}
                          className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors"
                          title="Opciones del episodio"
                        >
                          ⋯
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-40 text-xs">
                            {audioUrl && (
                              <a
                                href={audioUrl}
                                download={`episodio-${p.id}.mp3`}
                                className="flex items-center gap-2 px-3.5 py-2 text-zinc-200 hover:bg-zinc-800 transition-colors"
                              >
                                <span>⬇️</span>
                                <span>Descargar audio MP3</span>
                              </a>
                            )}
                            {video16x9Url && (
                              <a
                                href={video16x9Url}
                                download={`episodio-${p.id}-16x9.mp4`}
                                className="flex items-center gap-2 px-3.5 py-2 text-zinc-200 hover:bg-zinc-800 transition-colors"
                              >
                                <span>🎬</span>
                                <span>Descargar Video 16:9</span>
                              </a>
                            )}
                            {video9x16Url && (
                              <a
                                href={video9x16Url}
                                download={`episodio-${p.id}-9x16.mp4`}
                                className="flex items-center gap-2 px-3.5 py-2 text-zinc-200 hover:bg-zinc-800 transition-colors"
                              >
                                <span>📱</span>
                                <span>Descargar Video 9:16</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                handleDuplicar(p);
                                setMenuOpenId(null);
                              }}
                              className="flex items-center gap-2 w-full text-left px-3.5 py-2 text-zinc-200 hover:bg-zinc-800 transition-colors"
                            >
                              <span>📋</span>
                              <span>Duplicar configuración</span>
                            </button>
                            <div className="border-t border-zinc-800 my-1"></div>
                            {confirmando === p.id ? (
                              <div className="p-2 space-y-1">
                                <div className="text-[11px] text-red-400 font-semibold px-1">¿Eliminar episodio?</div>
                                <div className="flex gap-1">
                                  <button
                                    className="flex-1 py-1 px-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[11px]"
                                    disabled={eliminando === p.id}
                                    onClick={() => void eliminar(p)}
                                  >
                                    {eliminando === p.id ? "Borrando…" : "Sí, borrar"}
                                  </button>
                                  <button
                                    className="py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px]"
                                    onClick={() => setConfirmando(null)}
                                  >
                                    No
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmando(p.id)}
                                className="flex items-center gap-2 w-full text-left px-3.5 py-2 text-red-400 hover:bg-red-950/30 transition-colors"
                              >
                                <span>🗑️</span>
                                <span>Eliminar episodio</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {audioUrl && (
                    <div className="mt-3 pt-2.5 border-t border-zinc-800/60">
                      <MiniPlayer
                        src={audioUrl}
                        label={`Audio final: ${titleOf(p)}`}
                        accent="#22c55e"
                      />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>

      {/* Advanced Production Drawer */}
      <AdvancedProductionDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        preferences={preferences}
        onChange={setPreferences}
        duracionMin={duracionMin}
        onDuracionChange={setDuracionMin}
        profundidad={profundidad}
        onProfundidadChange={setProfundidad}
        contextoExtra={contextoExtra}
        onContextoChange={setContextoExtra}
      />
    </div>
  );
}
