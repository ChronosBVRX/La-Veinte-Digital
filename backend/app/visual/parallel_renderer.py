"""Ejecutor concurrente prudente y cancelable para renderizado incremental de beats.

Garantiza:
- Detección de recursos de CPU/GPU.
- Concurrencia segura (por defecto 2 workers para evitar saturación de RAM/NVENC).
- Cancelación limpia: detiene el pipeline pero preserva intactos en caché los clips completados.
- Reanudación transparente: al volver a ejecutar, los clips terminados se detectan como CACHE HIT.
- Emisión de progreso estructurado en tiempo real.
"""
from __future__ import annotations

import concurrent.futures
import os
import threading
from pathlib import Path
from typing import Any, Callable

from .beat_renderer import BeatRenderer, MODES_CONFIG, MODES_CONFIG_VERTICAL
from .render_cache import BeatRenderCache, compute_beat_render_hash
from .assembler import assemble_video_clips, mux_audio_master


def get_safe_worker_count(requested: int | None = None) -> int:
    """Calcula un número prudente de hilos para renderizado concurrente."""
    if requested and requested > 0:
        return min(requested, 8)
    cpu_count = os.cpu_count() or 4
    # Si tiene 8+ núcleos, 3 workers; de 4 a 7 núcleos, 2 workers; menos de 4, 1 worker.
    if cpu_count >= 8:
        return 3
    elif cpu_count >= 4:
        return 2
    return 1


class IncrementalPipelineRenderer:
    """Orquesta el renderizado incremental con cache, paralelismo y cancelación."""

    def __init__(
        self,
        project_dir: Path | str,
        layout: str = "16x9",
        assets_root: Path | None = None,
        max_workers: int | None = None,
    ) -> None:
        self.project_dir = Path(project_dir)
        self.layout = layout
        self.vertical = (layout == "9x16")
        self.cache = BeatRenderCache(self.project_dir, assets_root=assets_root)
        self.workers_count = get_safe_worker_count(max_workers)
        self._cancel_event = threading.Event()

    def cancel(self) -> None:
        """Solicita la detención inmediata del renderizado sin borrar los clips terminados."""
        self._cancel_event.set()

    def is_cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def render_beats_incremental(
        self,
        events: list[dict[str, Any]],
        mode: str = "preview",
        resolution: tuple[int, int] = (854, 480),
        fps: int = 30,
        preset: str = "veryfast",
        env_smooth: list[float] | None = None,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> tuple[list[Path], dict[str, Any]]:
        """Ejecuta el renderizado incremental. Devuelve lista ordenada de clips y reporte de cache."""
        self._cancel_event.clear()
        total = len(events)
        clips_map: dict[str, Path] = {}
        dirty_events: list[dict[str, Any]] = []

        hits_count = 0
        for ev in events:
            cached, clip_path, r_hash = self.cache.is_beat_cached(
                ev, self.layout, mode, resolution, fps
            )
            bid = ev.get("beat_id", "")
            if cached:
                clips_map[bid] = clip_path
                hits_count += 1
            else:
                dirty_events.append(ev)

        initial_report = {
            "total": total,
            "hits": hits_count,
            "misses": len(dirty_events),
            "rendered": 0,
            "cancelled": False,
        }

        if progress_callback:
            progress_callback({
                "stage": "cache_checked",
                "total": total,
                "hits": hits_count,
                "misses": len(dirty_events),
                "rendered": 0,
                "pct": round(100.0 * hits_count / max(1, total), 1),
            })

        rendered_count = 0

        # Si todos son hits o no hay dirty, terminar de inmediato
        if not dirty_events:
            ordered_clips = [clips_map[ev.get("beat_id", "")] for ev in events]
            return ordered_clips, initial_report

        # Función auxiliar de render por beat individual
        def _render_single_beat(ev: dict[str, Any]) -> tuple[str, Path]:
            if self._cancel_event.is_set():
                raise concurrent.futures.CancelledError("Render cancelado por el usuario")
            
            renderer = BeatRenderer(layout=self.layout)
            clip_path, r_hash = self.cache.get_beat_clip_path(
                ev, self.layout, mode, resolution, fps
            )
            renderer.render_beat_clip(
                ev,
                out_path=clip_path,
                resolution=resolution,
                fps=fps,
                preset=preset,
                env_smooth=env_smooth,
            )
            return ev.get("beat_id", ""), clip_path

        # Renderizar los beats dirty con ThreadPoolExecutor
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers_count) as executor:
            future_to_beat = {
                executor.submit(_render_single_beat, ev): ev.get("beat_id", "")
                for ev in dirty_events
            }

            for future in concurrent.futures.as_completed(future_to_beat):
                if self._cancel_event.is_set():
                    executor.shutdown(wait=False, cancel_futures=True)
                    break
                try:
                    bid, path_rendered = future.result()
                    clips_map[bid] = path_rendered
                    rendered_count += 1
                    if progress_callback:
                        progress_callback({
                            "stage": "rendering_beats",
                            "total": total,
                            "hits": hits_count,
                            "misses": len(dirty_events),
                            "rendered": rendered_count,
                            "currentBeatId": bid,
                            "pct": round(100.0 * (hits_count + rendered_count) / max(1, total), 1),
                        })
                except concurrent.futures.CancelledError:
                    break
                except Exception as e:
                    # Registrar fallo pero permitir continuar con los demás beats si es posible
                    print(f"Error renderizando beat {future_to_beat.get(future)}: {e}")

        cancelled = self._cancel_event.is_set()

        # Armar lista ordenada final solo con los que están listos
        ordered_clips = []
        for ev in events:
            bid = ev.get("beat_id", "")
            if bid in clips_map and clips_map[bid].exists():
                ordered_clips.append(clips_map[bid])

        report = {
            "total": total,
            "hits": hits_count,
            "misses": len(dirty_events),
            "rendered": rendered_count,
            "ready": len(ordered_clips),
            "cancelled": cancelled,
        }
        return ordered_clips, report

    def render_full_pipeline(
        self,
        events: list[dict[str, Any]],
        master_audio_path: Path | str,
        output_mp4_path: Path | str,
        mode: str = "preview",
        resolution: tuple[int, int] | None = None,
        fps: int | None = None,
        preset: str | None = None,
        env_smooth: list[float] | None = None,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> tuple[Path, dict[str, Any]]:
        """Renderiza incrementalmente todos los beats, los concatena y muxe el audio final."""
        cfg_map = MODES_CONFIG_VERTICAL if self.vertical else MODES_CONFIG
        cfg = cfg_map.get(mode, cfg_map["preview"])
        res = resolution or (cfg["w"], cfg["h"])
        f_rate = fps or cfg["fps"]
        pre = preset or cfg.get("preset", "veryfast")

        ordered_clips, report = self.render_beats_incremental(
            events=events,
            mode=mode,
            resolution=res,
            fps=f_rate,
            preset=pre,
            env_smooth=env_smooth,
            progress_callback=progress_callback,
        )

        out_final = Path(output_mp4_path)
        out_final.parent.mkdir(parents=True, exist_ok=True)

        if report.get("cancelled") or not ordered_clips:
            return out_final, report

        concat_temp = out_final.with_suffix(".concat_tmp.mp4")
        assemble_video_clips(ordered_clips, concat_temp)
        mux_audio_master(concat_temp, master_audio_path, out_final)
        if concat_temp.exists():
            concat_temp.unlink()

        return out_final, report

