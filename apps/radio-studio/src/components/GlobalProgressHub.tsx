import React from "react";
import { type EpisodeProductionProgress } from "@la-veinte/studio-contract";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Folder,
  RotateCcw,
  Clock,
  Square,
} from "./ui/Icons";

interface GlobalProgressHubProps {
  progress: EpisodeProductionProgress | null;
  onCancel?: () => void;
  onRetry?: () => void;
  onOpenFolder?: () => void;
  cancelling?: boolean;
}

function formatSeconds(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const GlobalProgressHub: React.FC<GlobalProgressHubProps> = ({
  progress,
  onCancel,
  onRetry,
  onOpenFolder,
  cancelling,
}) => {
  if (!progress) return null;

  const isActive = [
    "investigando",
    "generando_guion",
    "generando_voces",
    "mezclando_audio",
    "planificando_visuales",
    "renderizando_video",
    "exportando",
  ].includes(progress.state);

  const isCompleted = progress.state === "completado";
  const isError = progress.state === "error";
  const isCancelled = progress.state === "cancelado";

  return (
    <div className="w-full bg-[#0d121d]/95 backdrop-blur border-b border-[#1e293b] px-4 py-2.5 flex flex-col gap-2 transition-all">
      {/* Línea Superior: Indicadores, Texto y Acciones */}
      <div className="flex items-center justify-between gap-4">
        {/* Lado Izquierdo: Onda viva + Estado actual */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Micro-onda viva animada */}
          <div className="flex items-end gap-0.5 h-4 w-5 px-0.5 py-0.5 shrink-0 bg-slate-900/60 rounded border border-slate-800">
            <span
              className={`w-1 bg-cyan-400 rounded-full transition-all duration-300 ${
                isActive ? "animate-[pulse_0.6s_ease-in-out_infinite] h-full" : "h-1"
              }`}
            />
            <span
              className={`w-1 bg-blue-400 rounded-full transition-all duration-300 ${
                isActive ? "animate-[pulse_0.9s_ease-in-out_infinite_0.15s] h-3/4" : "h-1.5"
              }`}
            />
            <span
              className={`w-1 bg-indigo-400 rounded-full transition-all duration-300 ${
                isActive ? "animate-[pulse_0.75s_ease-in-out_infinite_0.3s] h-5/6" : "h-1"
              }`}
            />
          </div>

          {/* Estado y Acción Actual */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                {isCompleted && <CheckCircle2 size={13} className="text-emerald-400" />}
                {isError && <AlertTriangle size={13} className="text-rose-400" />}
                {isCancelled && <AlertCircle size={13} className="text-amber-400" />}
                {isActive && <Activity size={13} className="text-cyan-400 animate-spin" />}
                Fase: <span className="text-cyan-300">{progress.phase}</span>
              </span>

              {progress.counts && (
                <span className="text-[11px] font-mono px-1.5 py-0.2 bg-slate-800/80 text-cyan-200 rounded border border-slate-700">
                  {progress.counts.current}/{progress.counts.total} {progress.counts.unit}
                </span>
              )}

              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Clock size={11} />
                {formatSeconds(progress.timings.elapsedSeconds)}
                {progress.timings.estimatedRemainingSeconds ? (
                  <span className="text-cyan-300/80">
                    · ≈{formatSeconds(progress.timings.estimatedRemainingSeconds)} restantes
                  </span>
                ) : null}
              </span>
            </div>

            <p className="text-xs text-slate-200 font-medium truncate max-w-xl">
              {progress.currentAction}
            </p>
          </div>
        </div>

        {/* Lado Derecho: Porcentaje Global + Controles de Acción */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-base font-black tracking-tight text-white font-mono">
              {progress.overallPercent}%
            </span>
            <span className="text-[10px] text-slate-400 block -mt-1 font-medium">Global</span>
          </div>

          {/* Botones contextuales de acción */}
          <div className="flex items-center gap-1.5">
            {isActive && onCancel && (
              <button
                onClick={onCancel}
                disabled={cancelling}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-800/60 border border-amber-800/50 rounded transition-all disabled:opacity-50"
                title="Detener producción sin perder avance"
              >
                <Square size={11} />
                <span>{cancelling ? "Deteniendo..." : "Cancelar"}</span>
              </button>
            )}

            {isError && onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:text-white bg-rose-900/40 hover:bg-rose-800/60 border border-rose-700/50 rounded transition-all"
                title="Reintentar etapa fallida"
              >
                <RotateCcw size={13} />
                <span>Reintentar</span>
              </button>
            )}

            {onOpenFolder && (
              <button
                onClick={onOpenFolder}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-all"
                title="Abrir carpeta en el explorador de archivos"
              >
                <Folder size={13} />
                <span>Carpeta</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Progreso Global Continua */}
      <div className="w-full bg-slate-800/60 h-1.5 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, progress.overallPercent))}%` }}
        />
      </div>
    </div>
  );
};
