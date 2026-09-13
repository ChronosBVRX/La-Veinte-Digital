"""Renderizador aislado por VisualBeat para La Veinte Radio.

Permite renderizar:
- STORYBOARD: 1 frame estático por beat (PNG/JPG en milisegundos, sin video).
- DRAFT: 640x360 @ 15 fps (edición rápida).
- PREVIEW: 854x480 @ 30 fps (calidad de revisión con cache).
- FINAL: 1920x1080 @ 30 fps (producción).
- SPOT PREVIEW: Previsualización de una sola escena con audio sincronizado.
- SECTION PREVIEW: Previsualización de un bloque temporal específico.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from app.visual.identity import CHARACTERS
from app.visual.renderer import Renderer
from app.visual.encoder import detect_encoder


MODES_CONFIG = {
    "storyboard": {"w": 640, "h": 360, "fps": 1, "video": False},
    "draft": {"w": 640, "h": 360, "fps": 15, "video": True, "preset": "ultrafast"},
    "preview": {"w": 854, "h": 480, "fps": 30, "video": True, "preset": "veryfast"},
    "final": {"w": 1920, "h": 1080, "fps": 30, "video": True, "preset": "p4"},
}

MODES_CONFIG_VERTICAL = {
    "storyboard": {"w": 360, "h": 640, "fps": 1, "video": False},
    "draft": {"w": 360, "h": 640, "fps": 15, "video": True, "preset": "ultrafast"},
    "preview": {"w": 480, "h": 854, "fps": 30, "video": True, "preset": "veryfast"},
    "final": {"w": 1080, "h": 1920, "fps": 30, "video": True, "preset": "p4"},
}


class BeatRenderer:
    """Ejecutor de renderizado independiente por beat visual."""

    def __init__(self, layout: str = "16x9") -> None:
        self.layout = layout
        self.vertical = (layout == "9x16")
        self.renderer = Renderer(layout=layout)
        self._enc_detected: str | None = None

    def _get_encoder(self, tmp_dir: Path) -> str:
        if self._enc_detected is None:
            det = detect_encoder(tmp_dir / "enc_probe")
            self._enc_detected = det.get("elegido") or "libx264"
        return self._enc_detected

    def render_storyboard_frame(
        self,
        ev: dict[str, Any],
        resolution: tuple[int, int] | Path | str = (640, 360),
        out_path: Path | str | None = None,
    ) -> Image.Image:
        """Renderiza exactamente 1 frame en el punto medio del beat directamente a imagen sin video."""
        if isinstance(resolution, (Path, str)):
            out_path = Path(resolution)
            resolution = (640, 360)
        w, h = resolution
        char = dict(CHARACTERS.get(ev.get("speaker"), CHARACTERS["Eduardo"]))
        fps = 30
        start_f = int(round(float(ev.get("start", 0.0)) * fps))
        end_f = int(round(float(ev.get("end", 0.0)) * fps))
        dur_f = max(1, end_f - start_f)
        mid_f = dur_f // 2

        # Asegurar tamaño en renderer
        self.renderer.W = w
        self.renderer.H = h
        self.renderer.vertical = self.vertical

        self.renderer.prepare(ev, char)
        img = self.renderer.frame(
            f=mid_f,
            fps=fps,
            ev=ev,
            char=char,
            env=[0.5] * 100,
            trans=1.0,
            env_now=0.5,
            local_f=mid_f,
            dur_f=dur_f,
        )
        if out_path:
            out_p = Path(out_path)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            img.save(out_p, quality=90)
        return img

    def render_beat_clip(
        self,
        ev: dict[str, Any],
        out_path: Path,
        resolution: tuple[int, int],
        fps: int = 30,
        preset: str = "veryfast",
        env_smooth: list[float] | None = None,
    ) -> Path:
        """Renderiza los fotogramas del beat a un clip de video MP4 silencioso independiente."""
        w, h = resolution
        start_f = int(round(float(ev.get("start", 0.0)) * fps))
        end_f = int(round(float(ev.get("end", 0.0)) * fps))
        dur_f = max(1, end_f - start_f)

        self.renderer.W = w
        self.renderer.H = h
        self.renderer.vertical = self.vertical
        char = dict(CHARACTERS.get(ev.get("speaker"), CHARACTERS["Eduardo"]))
        self.renderer.prepare(ev, char)

        out_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_out = out_path.with_suffix(".tmp.mp4")

        enc = self._get_encoder(out_path.parent)
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
            "-r", str(fps), "-i", "-",
        ]
        if enc == "h264_nvenc" and preset != "ultrafast":
            cmd += ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "23"]
        else:
            cmd += ["-c:v", "libx264", "-preset", preset, "-crf", "23"]
        cmd += ["-pix_fmt", "yuv420p", str(tmp_out)]

        import numpy as np
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

        start_time_s = float(ev.get("start", 0.0))
        for lf in range(dur_f):
            # Mapeo de envolvente si está disponible
            t_abs = start_time_s + (lf / fps)
            idx = int(t_abs / 0.03)
            env_now = 0.5
            if env_smooth and 0 <= idx < len(env_smooth):
                env_now = float(env_smooth[idx])

            img = self.renderer.frame(
                f=lf,
                fps=fps,
                ev=ev,
                char=char,
                env=env_smooth or [0.5] * 100,
                trans=1.0,
                env_now=env_now,
                local_f=lf,
                dur_f=dur_f,
            )
            proc.stdin.write(np.asarray(img).tobytes())

        proc.stdin.close()
        proc.wait()

        if tmp_out.exists() and tmp_out.stat().st_size > 500:
            if out_path.exists():
                out_path.unlink()
            tmp_out.rename(out_path)
            return out_path
        else:
            raise RuntimeError(f"Fallo al renderizar clip de beat {ev.get('beat_id')}")

    def render_storyboard_contact_sheet(
        self,
        events: list[dict[str, Any]],
        out_sheet_path: Path,
        cols: int = 4,
        thumb_resolution: tuple[int, int] = (480, 270),
    ) -> Path:
        """Genera un contact sheet / storyboard completo en 1-2 segundos sin invocar codificación de video."""
        thumb_w, thumb_h = thumb_resolution
        rows = (len(events) + cols - 1) // cols
        sheet_w = thumb_w * cols
        sheet_h = max(thumb_h, rows * thumb_h)
        sheet = Image.new("RGB", (sheet_w, sheet_h), (12, 15, 20))
        d_sheet = ImageDraw.Draw(sheet)

        for idx, ev in enumerate(events):
            frame = self.render_storyboard_frame(ev, resolution=thumb_resolution)
            col = idx % cols
            row = idx // cols
            x = col * thumb_w
            y = row * thumb_h
            sheet.paste(frame, (x, y))

            # Badge overlay
            bid = ev.get("beat_id", "")
            start = float(ev.get("start", 0.0))
            end = float(ev.get("end", 0.0))
            dur = end - start
            m_s = int(start // 60)
            s_s = int(start % 60)
            tc = f"{m_s:02d}:{s_s:02d}"
            hl = ev.get("headline") or ev.get("scene_type") or "locutor"

            d_sheet.rectangle([x, y, x + thumb_w, y + 26], fill=(10, 14, 23, 210))
            d_sheet.text((x + 8, y + 5), f"[{tc}] {bid} ({dur:.1f}s) · {hl[:32]}", fill=(245, 241, 232))

        out_sheet_path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(out_sheet_path, quality=92)
        return out_sheet_path

    def render_spot_preview(
        self,
        ev: dict[str, Any],
        out_path: Path | str,
        master_audio_path: Path | str | None = None,
        mode: str = "preview",
        resolution: tuple[int, int] | None = None,
        fps: int | None = None,
    ) -> Path:
        """Renderiza una escena individual y muxe el segmento de audio correspondiente."""
        p1 = Path(out_path)
        p2 = Path(master_audio_path) if master_audio_path else None
        if p1.suffix.lower() in [".mp3", ".wav", ".aac", ".ogg"] and p2 and p2.suffix.lower() in [".mp4", ".mov"]:
            master_audio_path, out_path = p1, p2
        else:
            out_path = p1
            master_audio_path = p2

        cfg_map = MODES_CONFIG_VERTICAL if self.vertical else MODES_CONFIG
        cfg = cfg_map.get(mode, cfg_map["preview"])
        if resolution is None:
            resolution = (cfg["w"], cfg["h"])
        if fps is None:
            fps = cfg["fps"]

        silent_clip = out_path.with_suffix(".silent.mp4")
        self.render_beat_clip(ev, silent_clip, resolution=resolution, fps=fps)

        if master_audio_path and master_audio_path.exists():
            start_s = float(ev.get("start", 0.0))
            dur_s = max(0.01, float(ev.get("end", 0.0) - start_s))
            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-ss", f"{start_s:.3f}", "-t", f"{dur_s:.3f}",
                "-i", str(master_audio_path),
                "-i", str(silent_clip),
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest", str(out_path)
            ]
            subprocess.run(cmd, check=True)
            if silent_clip.exists():
                silent_clip.unlink()
            return out_path
        else:
            if silent_clip.exists():
                if out_path.exists():
                    out_path.unlink()
                silent_clip.rename(out_path)
            return out_path
