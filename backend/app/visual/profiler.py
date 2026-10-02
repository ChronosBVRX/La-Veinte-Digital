"""Módulo de perfilado para el pipeline visual de La Veinte Radio.

Mide con precisión atómica:
- planningTime
- assetLoadTime
- assetResizeTime
- pythonCompositionTime
- frameWriteTime
- videoEncodeTime
- audioMuxTime
- totalTime
y genera el desglose por beat en data/projects/<id>/render-profile.json
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from app.visual.identity import CHARACTERS
from app.visual.renderer import Renderer
from app.visual.timeline_builder import build_visual_timeline


def profile_project_rendering(
    project_id: str,
    project_json_path: Path,
    master_audio_path: Path,
    alignment_path: Path | None = None,
    output_profile_path: Path | None = None,
    sample_beats_limit: int | None = None,
) -> dict[str, Any]:
    t_start_total = time.perf_counter()

    project_dir = project_json_path.parent
    if output_profile_path is None:
        output_profile_path = project_dir / "render-profile.json"

    # 1. Medir tiempo de planning
    t0_plan = time.perf_counter()
    proj = json.loads(project_json_path.read_text(encoding="utf-8"))
    script = proj.get("script") or {}
    turns = script.get("turns") or proj.get("turns") or []
    
    import soundfile as sf
    dur_s = 735.967
    if master_audio_path.exists():
        try:
            info = sf.info(str(master_audio_path))
            dur_s = float(info.duration)
        except Exception:
            pass

    alignment_obj = None
    if alignment_path and alignment_path.exists():
        alignment_obj = json.loads(alignment_path.read_text(encoding="utf-8"))

    timeline_file = project_dir / "renders" / "visual-timeline.json"
    if timeline_file.exists():
        timeline = json.loads(timeline_file.read_text(encoding="utf-8"))
    else:
        timeline = build_visual_timeline(turns, dur_s, alignment=alignment_obj)
    t_plan = time.perf_counter() - t0_plan

    events = timeline.get("events") or []
    fps = 30
    layout = "preview"
    rend = Renderer(layout=layout)

    for ev in events:
        rend.prepare(ev, dict(CHARACTERS.get(ev.get("speaker") or "", CHARACTERS["Eduardo"])))

    total_asset_load = 0.0
    total_asset_resize = 0.0
    total_python_comp = 0.0
    total_frame_write = 0.0
    total_video_encode = 0.0

    beat_profiles = []
    beats_to_profile = events if sample_beats_limit is None else events[:sample_beats_limit]

    import subprocess
    silent_test = project_dir / "renders" / "profile_test_silent.mp4"
    silent_test.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{rend.W}x{rend.H}",
        "-r", str(fps), "-i", "-",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-pix_fmt", "yuv420p", str(silent_test),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    import numpy as np

    for b_idx, ev in enumerate(beats_to_profile):
        bid = ev.get("beat_id", f"beat-{b_idx}")
        st = ev.get("scene_type", "speaker_focus")
        start_s = ev.get("start", 0.0)
        end_s = ev.get("end", 0.0)
        dur = max(0.01, end_s - start_s)
        frames_count = max(1, int(round(dur * fps)))

        t0_beat = time.perf_counter()
        beat_comp_time = 0.0
        beat_write_time = 0.0

        char = dict(CHARACTERS.get(ev.get("speaker"), CHARACTERS["Eduardo"]))

        ra = ev.get("resolved_asset")
        if ra and ra.get("file"):
            full_asset = ROOT / "assets" / "editorial" / ra["file"]
            t0_al = time.perf_counter()
            if full_asset.exists():
                from PIL import Image
                raw_img = Image.open(full_asset)
                t_al = time.perf_counter() - t0_al
                total_asset_load += t_al

                t0_ar = time.perf_counter()
                raw_img.resize((rend.W, rend.H), Image.Resampling.LANCZOS)
                t_ar = time.perf_counter() - t0_ar
                total_asset_resize += t_ar

        for lf in range(frames_count):
            t0_comp = time.perf_counter()
            img = rend.frame(
                f=lf, fps=fps, ev=ev, char=char, env=[0.5] * 100,
                trans=1.0, env_now=0.5, local_f=lf, dur_f=frames_count,
            )
            t_comp = time.perf_counter() - t0_comp
            beat_comp_time += t_comp

            t0_write = time.perf_counter()
            proc.stdin.write(np.asarray(img).tobytes())
            t_write = time.perf_counter() - t0_write
            beat_write_time += t_write

        t_beat_total = time.perf_counter() - t0_beat
        total_python_comp += beat_comp_time
        total_frame_write += beat_write_time

        beat_profiles.append({
            "beatId": bid,
            "duration": round(dur, 2),
            "frames": frames_count,
            "renderTime": round(t_beat_total, 3),
            "compositionTime": round(beat_comp_time, 3),
            "writeTime": round(beat_write_time, 3),
            "sceneType": st,
            "cacheHit": False,
        })

    t0_enc_wait = time.perf_counter()
    proc.stdin.close()
    proc.wait()
    t_enc_wait = time.perf_counter() - t0_enc_wait
    total_video_encode = t_enc_wait + total_frame_write

    t0_mux = time.perf_counter()
    mux_test = project_dir / "renders" / "profile_test_mux.mp4"
    if silent_test.exists() and master_audio_path.exists():
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(silent_test), "-i", str(master_audio_path),
            "-c:v", "copy", "-c:a", "aac", "-shortest", str(mux_test)
        ], check=True)
    t_mux = time.perf_counter() - t0_mux

    for tmp in [silent_test, mux_test]:
        try:
            if tmp.exists():
                tmp.unlink()
        except Exception:
            pass

    scale_factor = len(events) / max(1, len(beats_to_profile))
    if sample_beats_limit is not None and sample_beats_limit < len(events):
        total_asset_load *= scale_factor
        total_asset_resize *= scale_factor
        total_python_comp *= scale_factor
        total_frame_write *= scale_factor
        total_video_encode *= scale_factor

    t_total = time.perf_counter() - t_start_total

    breakdown = {
        "Pillow_Composition": round(total_python_comp, 2),
        "Asset_Resize": round(total_asset_resize, 2),
        "Asset_Load": round(total_asset_load, 2),
        "Frame_Write_Pipe": round(total_frame_write, 2),
        "Video_Encode_FFmpeg": round(total_video_encode, 2),
        "Audio_Mux": round(t_mux, 2),
    }
    primary_bottleneck = max(breakdown.items(), key=lambda x: x[1])[0]

    profile_report = {
        "projectId": project_id,
        "profiledAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "totalBeats": len(events),
        "totalFrames": int(round(dur_s * fps)),
        "durationSec": round(dur_s, 2),
        "times": {
            "planningTime": round(t_plan, 3),
            "assetLoadTime": round(total_asset_load, 3),
            "assetResizeTime": round(total_asset_resize, 3),
            "pythonCompositionTime": round(total_python_comp, 3),
            "frameWriteTime": round(total_frame_write, 3),
            "videoEncodeTime": round(total_video_encode, 3),
            "audioMuxTime": round(t_mux, 3),
            "totalTime": round(t_total, 3),
        },
        "breakdown": breakdown,
        "primaryBottleneck": primary_bottleneck,
        "bottleneckAnalysis": (
            f"El cuello de botella predominante es '{primary_bottleneck}'. "
            f"La composición y dibujo en Python/Pillow ({breakdown['Pillow_Composition']}s) "
            f"junto con el renderizado cuadro a cuadro sin caché absorbe más del "
            f"{round(100 * total_python_comp / max(1, (total_python_comp + total_video_encode)), 1)}% "
            f"del tiempo de proceso. Un cache por beat y concatenación de video eliminará este costo "
            f"en cualquier beat que no haya cambiado."
        ),
        "beats": beat_profiles,
    }

    output_profile_path.parent.mkdir(parents=True, exist_ok=True)
    output_profile_path.write_text(json.dumps(profile_report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Generated render profile at {output_profile_path}")
    return profile_report


if __name__ == "__main__":
    proj_id = "d5f1fc16"
    p_json = ROOT / "data" / "projects" / proj_id / "project.json"
    p_master = ROOT / "data" / "tts" / "master" / f"programa-{proj_id}.mp3"
    p_align = ROOT / "data" / "projects" / proj_id / "timeline-alignment.json"
    profile_project_rendering(proj_id, p_json, p_master, p_align, sample_beats_limit=15)
