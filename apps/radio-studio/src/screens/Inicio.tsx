import { useEffect, useState } from "react";
import { listProjects, deleteProject } from "../lib/studio-api";
import type { Project, Script, ProductionPreferences, Profundidad } from "@la-veinte/studio-contract";
import { deriveShortTitle } from "@la-veinte/radio-core";
import {
  Sparkles,
  Video,
  Headphones,
  Sliders,
  Trash2,
  ChevronRight,
  Radio,
  Compass,
} from "../components/ui/Icons";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

const STATE_HUMAN_LABELS: Record<string, { label: string; variant: "ready" | "pending" | "rendering" | "error" | "neutral" }> = {
  DRAFT: { label: "Borrador", variant: "neutral" },
  RESEARCHING: { label: "Investigando…", variant: "rendering" },
  RESEARCHED: { label: "Fuentes listas", variant: "ready" },
  PROPOSAL_READY: { label: "Propuesta lista", variant: "ready" },
  PROPOSAL_APPROVED: { label: "Propuesta aprobada", variant: "ready" },
  SCRIPT_GENERATING: { label: "Escribiendo…", variant: "rendering" },
  SCRIPT_READY: { label: "Guion listo", variant: "ready" },
  SCRIPT_APPROVED: { label: "Guion aprobado", variant: "ready" },
  PRODUCING: { label: "Generando audio…", variant: "rendering" },
  NEEDS_REVIEW: { label: "Por revisar", variant: "pending" },
  MASTERING: { label: "Mezclando…", variant: "rendering" },
  DONE: { label: "Listo para publicar", variant: "ready" },
  FAILED: { label: "Requiere atención", variant: "error" },
};

function formatDuration(ms?: number): string {
  if (!ms) return "";
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")} min`;
}

function formatDate(isoDate?: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
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
    options?: { script?: Script | null; forceTopic?: boolean; productionPreferences?: ProductionPreferences }
  ) => void;
  onOpen: (id: string) => void;
}) {
  const [tema, setTema] = useState("");
  const [modoProduccion, setModoProduccion] = useState<"audio_video" | "audio">("audio_video");
  const [profundidad, setProfundidad] = useState<Profundidad>("estandar");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [includeAds, setIncludeAds] = useState(false);
  const [recent, setRecent] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    listProjects()
      .then((projs) => {
        if (mounted) {
          setRecent(projs);
          setLoadingProjects(false);
        }
      })
      .catch(() => {
        if (mounted) setLoadingProjects(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const sugerencias = [
    "¿Qué pasa si me cambian de horario de trabajo sin avisarme?",
    "Cómo se calcula el Concepto 02 y Concepto 11 en mi tarjetón",
    "Jubilaciones CCT Cláusula 157: Años de servicio y edad",
    "Reforma a la Ley Federal del Trabajo: Artículos 399 y 400",
  ];

  const handleCreate = async () => {
    if (!tema.trim() || creating) return;
    setCreating(true);
    try {
      onCrear(tema.trim(), includeAds, profundidad, {
        productionPreferences: {
          mode: modoProduccion,
          outputFormats: modoProduccion === "audio_video" ? ["preview", "16x9", "9x16"] : ["preview"],
          videoQuality: "produccion",
          visualStyle: "equilibrado",
          visualDirection: "documental",
          onScreenTextMode: "editorial",
        } as any,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Deseas eliminar este episodio?")) {
      await deleteProject(id);
      setRecent((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-4 animate-in fade-in duration-200">
      {/* Header institucional limpio */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide">
          <Radio size={13} />
          <span>LA VEINTE RADIO · AI RADIO STUDIO</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
          ¿Qué quieres crear hoy?
        </h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Escribe un tema para investigar con evidencia normativa o pega un guion para producir audio y video profesional.
        </p>
      </div>

      {/* Main Creation Card */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-blue-950/20 space-y-5">
        <div className="relative">
          <textarea
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Escribe el tema o pega un guion aquí..."
            className="w-full h-32 px-4 py-3.5 rounded-xl bg-slate-950/90 border border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-100 text-sm placeholder:text-slate-500 resize-none transition-all outline-none leading-relaxed"
          />
        </div>

        {/* Format Selector: Audio + Video vs Solo Audio */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 text-xs">
            <button
              type="button"
              onClick={() => setModoProduccion("audio_video")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                modoProduccion === "audio_video"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Video size={14} />
              <span>Audio + Video</span>
            </button>
            <button
              type="button"
              onClick={() => setModoProduccion("audio")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                modoProduccion === "audio"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Headphones size={14} />
              <span>Sólo Audio</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors px-2 py-1"
            >
              <Sliders size={13} />
              <span>{showAdvanced ? "Menos opciones" : "Opciones de profundidad"}</span>
            </button>
            <Button
              variant="primary"
              size="md"
              loading={creating}
              disabled={!tema.trim()}
              onClick={handleCreate}
              icon={<Sparkles size={15} />}
            >
              Crear episodio
            </Button>
          </div>
        </div>

        {/* Progressive Disclosure: Depth and options */}
        {showAdvanced && (
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Profundidad editorial:</span>
              <div className="flex gap-1.5">
                {(["express", "estandar", "profundo"] as Profundidad[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProfundidad(p)}
                    className={`px-3 py-1 rounded-md border text-xs font-medium transition-colors ${
                      profundidad === p
                        ? "bg-slate-800 border-blue-500/50 text-blue-300"
                        : "border-slate-800 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    {p === "breve" ? "Breve" : p === "estandar" ? "Equilibrado" : "Profundo"}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAds}
                onChange={(e) => setIncludeAds(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
              />
              <span>Incluir menciones y avisos</span>
            </label>
          </div>
        )}
      </div>

      {/* Sugerencias Rápidas */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Compass size={13} />
          <span>Empieza con una idea</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sugerencias.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setTema(sug)}
              className="text-xs text-slate-300 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 px-3 py-2 rounded-xl transition-all duration-150 text-left"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Proyectos Recientes */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200">Episodios y Proyectos Recientes</h2>
          <span className="text-xs text-slate-500">{recent.length} episodios guardados</span>
        </div>

        {loadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-28 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 text-slate-400 text-xs">
            No tienes episodios recientes. Escribe un tema arriba para comenzar tu primer episodio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recent.map((proj) => {
              const stateInfo = STATE_HUMAN_LABELS[proj.state] || { label: proj.state, variant: "neutral" };
              const title = deriveShortTitle(proj.titulo || proj.topic);
              const dur = proj.master?.duraccionMs ? formatDuration(proj.master.duraccionMs) : "";

              return (
                <div
                  key={proj.id}
                  onClick={() => onOpen(proj.id)}
                  className="group cursor-pointer p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 flex items-center justify-between gap-4 transition-all duration-150 hover:shadow-xl hover:shadow-blue-950/20"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={stateInfo.variant} size="sm">
                        {stateInfo.label}
                      </Badge>
                      <span className="text-[11px] text-slate-500">{formatDate(proj.updatedAt || proj.createdAt)}</span>
                      {dur && <span className="text-[11px] text-slate-500 font-mono">· {dur}</span>}
                    </div>
                    <h3 className="font-semibold text-sm text-slate-100 truncate group-hover:text-blue-300 transition-colors">
                      {title}
                    </h3>
                    <p className="text-xs text-slate-400 truncate max-w-sm">{proj.topic}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(proj.id, e)}
                      title="Eliminar episodio"
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={18} className="text-slate-500 group-hover:text-slate-200 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
