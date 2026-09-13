"""Módulo de ensamblado ultra-rápido por concatenación y mux de audio para La Veinte Radio.

Aprovecha el demuxer de concatenación de FFmpeg para fusionar clips de beats en 1-2 segundos
sin recodificar video (-c copy) y añade la pista maestra de audio sin tocarla ni recodificarla.
"""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path


def get_audio_sha256(audio_path: Path | str) -> str:
    """Calcula SHA-256 del master de audio para invalidación segura de caché."""
    h = hashlib.sha256()
    with open(audio_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def prepare_cached_master_audio(
    master_audio_path: Path | str,
    cache_dir: Path | str,
) -> tuple[Path, bool]:
    """Asegura la versión AAC/M4A en caché del máster para mux ultra-rápido (-c:a copy).
    
    Devuelve (ruta_archivo_m4a, fue_generado_ahora).
    """
    aud = Path(master_audio_path)
    if not aud.exists():
        raise FileNotFoundError(f"Master audio not found: {aud}")

    sha = get_audio_sha256(aud)
    audio_dir = Path(cache_dir) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    cached_m4a = audio_dir / f"master-{sha[:16]}.m4a"

    if cached_m4a.exists() and cached_m4a.stat().st_size > 1000:
        return cached_m4a, False

    tmp_m4a = cached_m4a.with_suffix(".tmp.m4a")
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(aud),
        "-vn",
        "-c:a", "aac", "-b:a", "192k",
        str(tmp_m4a),
    ]
    subprocess.run(cmd, check=True)
    tmp_m4a.rename(cached_m4a)
    return cached_m4a, True


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
    cache_dir: Path | str | None = None,
) -> Path:
    """Muxea el video ensamblado con el máster de audio.
    
    Si se provee cache_dir, utiliza el audio AAC pre-codificado para hacer -c:a copy
    en milisegundos sin recodificar ni degradar audio.
    """
    vid = Path(assembled_video_path)
    aud = Path(master_audio_path)
    final_p = Path(final_output_path)
    final_p.parent.mkdir(parents=True, exist_ok=True)

    if cache_dir:
        cached_audio, _ = prepare_cached_master_audio(aud, cache_dir)
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(vid),
            "-i", str(cached_audio),
            "-c:v", "copy",
            "-c:a", "copy",
            "-map_metadata", "-1",
            "-shortest",
            str(final_p)
        ]
    else:
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

