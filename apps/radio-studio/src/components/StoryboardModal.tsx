import { Modal } from "./ui/Modal";
import { Badge } from "./ui/Badge";
import { Clock, Eye } from "./ui/Icons";
import type { VisualBeat } from "@la-veinte/studio-contract";

interface StoryboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  beats: VisualBeat[];
  onSelectBeat: (beat: VisualBeat) => void;
}

function formatTimeSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function StoryboardModal({
  isOpen,
  onClose,
  beats,
  onSelectBeat,
}: StoryboardModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hoja de Contacto de Escenas (Storyboard)"
      description={`${beats.length} escenas visuales independientes. Haz clic en cualquiera para abrir su inspector y previsualizarla.`}
      maxWidth="6xl"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[70vh] overflow-y-auto pr-1">
        {beats.map((b, idx) => {
          const isSpeaker = b.scene_type === "speaker" || b.scene_type === "speaker_focus";
          const dur = (b.end_s - b.start_s).toFixed(1);
          const vFunc = b.visual_function || (isSpeaker ? "LOCUTOR" : "EVIDENCIA");

          const badgeVariant =
            vFunc === "EVIDENCIA"
              ? "official"
              : vFunc === "EXPLICACION"
              ? "reference"
              : vFunc === "CONTEXTO"
              ? "context"
              : "neutral";

          return (
            <div
              key={b.beat_id || idx}
              onClick={() => {
                onSelectBeat(b);
                onClose();
              }}
              className="group cursor-pointer rounded-xl bg-slate-950/80 border border-slate-800 hover:border-blue-500/80 p-2.5 space-y-2 transition-all duration-150 hover:shadow-lg hover:shadow-blue-950/30 hover:-translate-y-0.5"
            >
              {/* Aspect box placeholder / thumbnail */}
              <div className="aspect-video w-full rounded-lg bg-slate-900 border border-slate-800/80 flex flex-col items-center justify-center p-2 relative overflow-hidden group-hover:border-blue-500/40">
                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Clock size={10} />
                  <span>{formatTimeSec(b.start_s)}</span>
                </div>
                <div className="text-xs font-semibold text-slate-200 mt-1 truncate max-w-full text-center">
                  {isSpeaker ? b.speaker : b.headline || b.scene_type}
                </div>
                <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye size={12} className="text-blue-400" />
                </div>
              </div>

              {/* Info row */}
              <div className="flex items-center justify-between text-[10px]">
                <Badge variant={badgeVariant} size="sm">
                  {vFunc}
                </Badge>
                <span className="font-mono text-slate-500">{dur}s</span>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
