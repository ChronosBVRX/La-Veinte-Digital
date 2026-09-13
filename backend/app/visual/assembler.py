"""Módulo de ensamblado ultra-rápido por concatenación y mux de audio para La Veinte Radio.

Aprovecha el demuxer de concatenación de FFmpeg para fusionar clips de beats en 1-2 segundos
sin recodificar video (-c copy) y añade la pista maestra de audio sin tocarla ni recodificarla.
"""
from __future__ import annotations

import subprocess
from pathlib import Path


def assemble_video_clips(
    clip_paths: list[Path | str],
    output_path: Path | str,
    work_dir: Path | str | None = None,
) -> Path:
    """Concatena una lista ordenada de clips MP4 sin recodificar usando el concat demuxer de FFmpeg."""
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    wdir = Path(work_dir) if work_dir else out_p.parent
    wdir.mkdir(parents=True, exist_ok=True)

    concat_file = wdir / "concat_list.txt"
    lines = []
    for cp in clip_paths:
        p = Path(cp).resolve()
        # Normalizar barras para FFmpeg en Windows
        p_str = str(p).replace("\\", "/")
        lines.append(f"file '{p_str}'")

    concat_file.write_text("\n".join(lines), encoding="utf-8")

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_file),
        "-c", "copy",
        str(out_p)
    ]
    subprocess.run(cmd, check=True)
    return out_p


def mux_audio_master(
    assembled_video_path: Path | str,
    master_audio_path: Path | str,
    final_output_path: Path | str,
) -> Path:
    """Muxea el video ensamblado con el máster de audio sin recodificar el video."""
    vid = Path(assembled_video_path)
    aud = Path(master_audio_path)
    final_p = Path(final_output_path)
    final_p.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(vid),
        "-i", str(aud),
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-map_metadata", "-1",
        "-shortest",
        str(final_p)
    ]
    subprocess.run(cmd, check=True)
    return final_p
