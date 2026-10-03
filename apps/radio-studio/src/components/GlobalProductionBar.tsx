/**
 * GlobalProductionBar — barra de progreso global V1.1.
 * Visible en cualquier pantalla del estudio mientras el episodio activo
 * produce audio o video. Se alimenta del progreso canónico real
 * (/projects/:id/progress + eventos SSE), sin temporizadores falsos.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { type EpisodeProductionProgress } from "@la-veinte/studio-contract";
import {
  getProjectProgress,
  cancelEpisodeProduction,
  retryEpisodeProduction,
  openProjectFolder,
  connectSseEvents,
} from "../lib/studio-api";
import { useToast } from "./ui/Toast";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Folder,
  RotateCcw,
  Square,
  X,
} from "./ui/Icons";

const ACTIVE_STATES = [
  "investigando",
  "generando_guion",
  "generando_voces",
  "mezclando_audio",
  "planificando_visuales",
  "renderizando_video",
  "exportando",
];

const VISIBLE_STATES = [...ACTIVE_STATES, "error", "cancelado", "completado"];

function formatSeconds(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface GlobalProductionBarProps {
  projectId: string | null;
  onOpen: () => void;
  hidden?: boolean;
}

export function GlobalProductionBar({ projectId, onOpen, hidden }: GlobalProductionBarProps) {
  const { showToast } = useToast();
  const [progress, setProgress] = useState<EpisodeProductionProgress | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastSeenProjectId, setLastSeenProjectId] = useState(projectId);
  const lastRefreshRef = useRef(0);

  if (projectId !== lastSeenProjectId) {
    setLastSeenProjectId(projectId);
    setProgress(null);
    setDismissedKey(null);
  }

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const p = await getProjectProgress(projectId);
      if (p) setProgress(p);
    } catch {
      // Sidecar ocupado o fuera de línea: se conserva el último estado conocido
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const initialTimer = setTimeout(() => {
      void refresh();
    }, 0);
    const timer = setInterval(refresh, 2000);
    const disconnect = connectSseEvents((ev) => {
      if (!ev.projectId || ev.projectId === projectId) {
        // Coalescer: los eventos de progreso llegan seguidos; no disparar
        // una consulta por evento.
        const now = Date.now();
        if (now - lastRefreshRef.current >= 1500) {
          lastRefreshRef.current = now;
          void refresh();
        }
      }
    });
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
      disconnect();
    };
  }, [projectId, refresh]);

  if (hidden || !projectId || !progress) return null;
  if (!VISIBLE_STATES.includes(progress.state)) return null;

  const isActive = ACTIVE_STATES.includes(progress.state);
  const isCompleted = progress.state === "completado";
  const isError = progress.state === "error";
  const stateKey = `${projectId}:${progress.state}`;
  if (dismissedKey === stateKey) return null;

  const percent = Math.max(0, Math.min(100, progress.overallPercent));

  const handleCancel = async () => {
    setBusy("cancel");
    try {
      const res = await cancelEpisodeProduction(projectId);
      if (res.progress) setProgress(res.progress);
      showToast("Producción detenida limpiamente", "info");
    } catch {
      showToast("No se pudo detener la producción", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleRetry = async () => {
    setBusy("retry");
    try {
      const res = await retryEpisodeProduction(projectId);
      showToast(`Reanudando etapa: ${res.retriedStage}`, "success");
      await refresh();
    } catch {
      showToast("No se pudo reintentar la etapa", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const res = await openProjectFolder(projectId);
      showToast(`Carpeta abierta: ${res.path}`, "success");
    } catch {
      showToast("No se pudo abrir la carpeta", "error");
    }
  };

  return (
    <div className="shrink-0 border-b border-[#1e293b] bg-[#0d121d]/95 backdrop-blur px-6 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {isCompleted && <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />}
          {isError && <AlertTriangle size={15} className="text-rose-400 shrink-0" />}
          {isActive && <Activity size={15} className="text-cyan-400 animate-spin shrink-0" />}
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
            Producción global
          </span>
          <p className="text-xs text-slate-200 font-medium truncate">{progress.currentAction}</p>
          {progress.counts && (
            <span className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-800/80 text-cyan-200 rounded border border-slate-700 shrink-0">
              {progress.counts.current}/{progress.counts.total} {progress.counts.unit}
            </span>
          )}
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
            <Clock size={11} />
            {formatSeconds(progress.timings.elapsedSeconds)}
            {progress.timings.estimatedRemainingSeconds ? (
              <span className="text-cyan-300/80">
                · ≈{formatSeconds(progress.timings.estimatedRemainingSeconds)} restantes
              </span>
            ) : null}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-black tracking-tight text-white font-mono">{percent}%</span>

          {isActive && (
            <button
              onClick={handleCancel}
              disabled={busy === "cancel"}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-800/60 border border-amber-800/50 rounded transition-all disabled:opacity-50"
              title="Detener producción sin perder avance"
            >
              <Square size={11} />
              <span>{busy === "cancel" ? "Deteniendo..." : "Cancelar"}</span>
            </button>
          )}

          {isError && (
            <button
              onClick={handleRetry}
              disabled={busy === "retry"}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:text-white bg-rose-900/40 hover:bg-rose-800/60 border border-rose-700/50 rounded transition-all disabled:opacity-50"
              title="Reintentar etapa fallida"
            >
              <RotateCcw size={12} />
              <span>{busy === "retry" ? "Reintentando..." : "Reintentar"}</span>
            </button>
          )}

          <button
            onClick={onOpen}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-cyan-200 hover:text-white bg-cyan-950/40 hover:bg-cyan-800/60 border border-cyan-800/50 rounded transition-all"
            title="Abrir el episodio en producción"
          >
            <ExternalLink size={12} />
            <span>{isCompleted ? "Ver resultado final" : "Ver episodio"}</span>
          </button>

          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-all"
            title="Abrir carpeta de entregables en el explorador"
          >
            <Folder size={12} />
          </button>

          {!isActive && (
            <button
              onClick={() => setDismissedKey(stateKey)}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="Ocultar hasta el próximo cambio de estado"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-1.5 h-1.5 w-full bg-slate-800/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isError
              ? "bg-gradient-to-r from-rose-600 to-amber-500"
              : "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
