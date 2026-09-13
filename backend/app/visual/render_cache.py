"""Módulo de gestión de caché determinista por VisualBeat para La Veinte Radio.

Organización de caché:
data/projects/<id>/render-cache/
    16x9/
        draft/
        preview/
        final/
    9x16/
        draft/
        preview/
        final/

Nombres de archivo: <beatId>-<renderHash>.mp4
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

RENDERER_VERSION = "v2.0-incremental"
VISUAL_STYLE_VERSION = "v1.4"
LAYOUT_VERSION = "v1.4"


def get_file_content_hash(file_path: Path | str | None) -> str:
    """Calcula un hash rápido de contenido/mtime para activos estáticos."""
    if not file_path:
        return "none"
    p = Path(file_path)
    if not p.exists():
        return "missing"
    try:
        st = p.stat()
        return f"{int(st.st_mtime)}-{st.st_size}"
    except Exception:
        return "err"


def compute_beat_render_hash(
    ev: dict[str, Any],
    orientation: str = "16x9",
    resolution: tuple[int, int] = (854, 480),
    fps: int = 30,
    assets_root: Path | None = None,
    renderer_version: str = RENDERER_VERSION,
) -> str:
    """Calcula un hash SHA-256 determinista basado ÚNICAMENTE en lo que afecta visualmente el beat."""
    ra = ev.get("resolved_asset") or {}
    asset_file = ra.get("file") or ""
    asset_hash = "none"
    if asset_file and assets_root:
        asset_hash = get_file_content_hash(assets_root / asset_file)

    dur = round(float(ev.get("end", 0.0) - ev.get("start", 0.0)), 3)

    payload = {
        "beat_id": ev.get("beat_id", ""),
        "scene_type": ev.get("scene_type", ""),
        "visual_function": ev.get("visual_function", "LOCUTOR"),
        "duration_s": dur,
        "asset_id": ra.get("id") or ra.get("asset_id") or "",
        "asset_file": asset_file,
        "asset_file_hash": asset_hash,
        "overlay_logos": sorted(ev.get("overlay_logos") or []),
        "chart_type": ev.get("chart_type") or "",
        "headline": ev.get("headline") or "",
        "subheadline": ev.get("subheadline") or "",
        "display_text": ev.get("display_text") or "",
        "essential": ev.get("essential") or "",
        "speaker": ev.get("speaker") or "",
        "variant": ev.get("variant") or "neutral",
        "orientation": orientation,
        "resolution": f"{resolution[0]}x{resolution[1]}",
        "fps": fps,
        "visual_style_version": VISUAL_STYLE_VERSION,
        "layout_version": LAYOUT_VERSION,
        "renderer_version": renderer_version,
    }

    raw_bytes = json.dumps(payload, sort_keys=True, ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(raw_bytes).hexdigest()[:12]


class BeatRenderCache:
    """Administra la consulta, almacenamiento e invalidación de clips de beats en caché."""

    def __init__(self, project_dir: Path | str, assets_root: Path | None = None) -> None:
        self.project_dir = Path(project_dir)
        self.cache_root = self.project_dir / "render-cache"
        self.assets_root = assets_root or (Path(__file__).resolve().parents[3] / "assets" / "editorial")
        self.cache_root.mkdir(parents=True, exist_ok=True)

    def get_mode_dir(self, orientation: str, mode: str) -> Path:
        """Devuelve el directorio específico para orientación y modo (draft, preview, final)."""
        d = self.cache_root / orientation / mode
        d.mkdir(parents=True, exist_ok=True)
        return d

    def get_beat_clip_path(
        self,
        ev: dict[str, Any],
        orientation: str,
        mode: str,
        resolution: tuple[int, int],
        fps: int,
        renderer_version: str = RENDERER_VERSION,
    ) -> tuple[Path, str]:
        """Devuelve la ruta esperada del clip y su hash calculado."""
        r_hash = compute_beat_render_hash(
            ev,
            orientation=orientation,
            resolution=resolution,
            fps=fps,
            assets_root=self.assets_root,
            renderer_version=renderer_version,
        )
        mode_dir = self.get_mode_dir(orientation, mode)
        bid = ev.get("beat_id", "beat")
        clip_path = mode_dir / f"{bid}-{r_hash}.mp4"
        return clip_path, r_hash

    def is_beat_cached(
        self,
        ev: dict[str, Any],
        orientation: str,
        mode: str,
        resolution: tuple[int, int],
        fps: int,
        renderer_version: str = RENDERER_VERSION,
    ) -> tuple[bool, Path, str]:
        """Verifica si el beat ya cuenta con un clip renderizado válido y no vacío."""
        clip_path, r_hash = self.get_beat_clip_path(
            ev, orientation, mode, resolution, fps, renderer_version=renderer_version
        )
        exists = clip_path.exists() and clip_path.stat().st_size > 500
        return exists, clip_path, r_hash

    def invalidate_beat(self, beat_id: str, orientation: str | None = None) -> int:
        """Elimina todos los clips cacheados de un beat específico."""
        count = 0
        search_dirs = [self.cache_root / orientation] if orientation else [self.cache_root]
        for sdir in search_dirs:
            if not sdir.exists():
                continue
            for f in sdir.glob(f"**/{beat_id}-*.mp4"):
                try:
                    f.unlink()
                    count += 1
                except Exception:
                    pass
        return count

    def get_status_summary(
        self,
        events: list[dict[str, Any]],
        orientation: str = "16x9",
        mode: str = "preview",
        resolution: tuple[int, int] = (854, 480),
        fps: int = 30,
    ) -> dict[str, Any]:
        """Devuelve el desglose de estado para toda la lista de beats."""
        total = len(events)
        cached_count = 0
        dirty_beats = []
        statuses = {}

        for ev in events:
            bid = ev.get("beat_id", "")
            cached, clip_path, r_hash = self.is_beat_cached(ev, orientation, mode, resolution, fps)
            if cached:
                cached_count += 1
                statuses[bid] = "READY"
            else:
                dirty_beats.append(bid)
                statuses[bid] = "PENDING"

        return {
            "totalBeats": total,
            "cachedBeats": cached_count,
            "dirtyBeatsCount": len(dirty_beats),
            "dirtyBeats": dirty_beats,
            "isFullyCached": cached_count == total,
            "statuses": statuses,
        }
