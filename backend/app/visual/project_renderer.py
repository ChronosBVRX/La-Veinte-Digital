"""Ejecutor de Render Visual por Proyecto para La Veinte Radio.

Consume un project.json (o script.turns) y el master de audio (WAV o MP3),
generando las versiones de video aprobadas (16:9, 9:16 y preview) sin rediseño.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from app.visual import check_sync, detect_encoder
from app.visual.bridge import adapt_project_turns
from app.visual.envelope import extract_envelope
from app.visual.identity import CHARACTERS
from app.visual.motion import (
    EditorialVisualInterpreter,
    audio_visual_response_score,
    ease_out_cubic,
    max_perceptual_hold_seconds,
    motion_coverage,
    perceptual_motion_score,
    transition_frames,
)
from app.visual.renderer import Renderer
from app.visual.timeline_builder import build_visual_timeline
from app.visual.validation import validate_visual_timeline

FPS = 30
PSTEP = 3
SIDES = {
    "Eduardo": -1,
    "Javier Ríos": -1,
    "Andrea": 1,
    "Rodrigo Torres": 1,
    "Valeria Soto": 0,
}
VERSIONS = {
    "preview": ("preview", 854, 480),
    "16x9": ("16x9", 1920, 1080),
    "9x16": ("9x16", 1080, 1920),
}


def ensure_master_wav(master_path: Path, work_dir: Path) -> tuple[Path, float]:
    """Asegura un archivo WAV PCM accesible para la extracción de envolvente y medición de duración."""
    import soundfile as sf

    if master_path.suffix.lower() == ".wav":
        wav_path = master_path
    else:
        wav_path = work_dir / "master.wav"
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(master_path),
            "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le",
            str(wav_path),
        ]
        subprocess.run(cmd, check=True, timeout=120)

    info = sf.info(str(wav_path))
    dur_s = float(info.duration)
    return wav_path, dur_s


def render_project_visual(
    project_path: Path,
    master_audio: Path,
    output_dir: Path,
    formats: list[str] | None = None,
    alignment_path: Path | str | None = None,
) -> dict:
    if formats is None:
        formats = ["preview", "16x9", "9x16"]

    output_dir.mkdir(parents=True, exist_ok=True)
    proj = json.loads(project_path.read_text(encoding="utf-8"))
    script = proj.get("script") or {}
    turns = script.get("turns") or proj.get("turns") or []

    alignment_obj = None
    if alignment_path:
        al_p = Path(alignment_path)
        if not al_p.exists():
            raise FileNotFoundError(f"Alignment file not found: {al_p}")
        alignment_obj = json.loads(al_p.read_text(encoding="utf-8"))
    elif (project_path.parent / "timeline-alignment.json").exists():
        alignment_obj = json.loads((project_path.parent / "timeline-alignment.json").read_text(encoding="utf-8"))
    elif proj.get("alignment"):
        alignment_obj = proj["alignment"]

    if alignment_obj is None:
        raise ValueError("ALIGNMENT_REQUIRED")

    wav_path, dur_s = ensure_master_wav(master_audio, output_dir)
    segments = adapt_project_turns(turns, dur_s, alignment=alignment_obj)
    timeline = build_visual_timeline(segments, dur_s, alignment=alignment_obj)
    (output_dir / "visual-timeline.json").write_text(
        json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    envelope = extract_envelope(str(wav_path))
    (output_dir / "waveform-envelope.json").write_text(
        json.dumps(envelope), encoding="utf-8"
    )

    val = validate_visual_timeline(timeline, dur_s)
    if not val["ok"]:
        raise ValueError(f"Timeline validation failed: {val['blocking']}")

    det = detect_encoder(output_dir / "enc-test")
    enc = det["elegido"] or "libx264"

    geo = {"layouts": {}}
    for layout in ["16x9", "9x16"]:
        r = Renderer(layout=layout)
        for ev in timeline["events"]:
            r.prepare(ev, dict(CHARACTERS.get(ev["speaker"], CHARACTERS["Eduardo"])))
        geo["layouts"][layout] = {
            "elements_validated": sum(len(p.get("primitives", [])) for p in r.prepared.values()),
            "overflow_canvas": len([i for i in r.issues if "overflow canvas" in i]),
            "overflow_platform_safe": len([i for i in r.issues if "platform-safe" in i or "safe zone" in i]),
            "animated_bound_violations": len([i for i in r.issues if "overshoot" in i]),
            "collisions": len([i for i in r.issues if "colisión" in i or "↔" in i]),
            "false_negatives_known": 0,
            "issues": r.issues,
        }

    from PIL import Image
    import numpy as np

    events = timeline["events"]
    total_f = int(round(timeline["duration_s"] * FPS))
    by_frame = []
    for f in range(total_f):
        t = f / FPS
        ev = None
        for e in events:
            if e["start"] <= t <= e["end"]:
                ev = e
                break
        if ev is None:
            if events and t < events[0]["start"]:
                ev = events[0]
            else:
                past = [e for e in events if e["end"] <= t]
                ev = past[-1] if past else (events[0] if events else {})
        by_frame.append(ev)

    results: dict[str, dict] = {}
    motion: dict[str, dict] = {}
    out_files: dict[str, str] = {}

    for tag in formats:
        if tag not in VERSIONS:
            continue
        layout, w, h = VERSIONS[tag]
        rend = Renderer(layout=layout)
        for ev in events:
            rend.prepare(ev, dict(CHARACTERS.get(ev["speaker"], CHARACTERS["Eduardo"])))

        silent = output_dir / f"silent-{tag}.mp4"
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{rend.W}x{rend.H}",
            "-r", str(FPS), "-i", "-",
        ]
        cmd += (
            ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "23"]
            if enc == "h264_nvenc"
            else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]
        )
        cmd += ["-pix_fmt", "yuv420p", str(silent)]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

        prev_img, prev_side, prev_ev = None, 0, by_frame[0] if by_frame else {}
        shot_taken = set()
        react_by_spk: dict[str, list[float]] = {}
        env_by_spk: dict[str, list[float]] = {}
        small_frames: list = []
        trans_durations: list[int] = []
        number_reveal_f = None
        t0 = time.time()

        for f in range(total_f):
            ev = by_frame[f]
            char = dict(CHARACTERS.get(ev.get("speaker"), CHARACTERS["Eduardo"]))
            idx = int(f / FPS / 0.03)
            env_now = float(envelope["smooth"][idx]) if 0 <= idx < len(envelope["smooth"]) else 0.0
            start_f = int(round(ev.get("start", 0) * FPS))
            lf = f - start_f
            dur_f = max(1, int(round((ev.get("end", 0) - ev.get("start", 0)) * FPS)))

            img = rend.frame(
                f, FPS, ev, char, envelope["smooth"], 1.0, env_now,
                local_f=lf, dur_f=dur_f
            )

            if ev.get("scene_type") == "number" and number_reveal_f is None and lf >= 8:
                number_reveal_f = lf

            side = SIDES.get(ev.get("speaker"), 0)
            if ev.get("beat_id") != prev_ev.get("beat_id") and prev_img is not None and not rend.reduced:
                k = f - next((i for i, e in enumerate(by_frame) if e.get("beat_id") == ev.get("beat_id") and i <= f), f)
                steps = transition_frames(ev, prev_ev)
                if 0 <= k < steps:
                    if k == 0:
                        trans_durations.append(steps)
                    a = ease_out_cubic((k + 1) / steps)
                    shift = int((side - prev_side) * 44 * (1 - a))
                    base = prev_img.crop((max(0, shift), 0, min(rend.W, rend.W + max(0, shift)), rend.H)) if shift else prev_img.crop((0, 0, rend.W, rend.H))
                    cur = np.asarray(img).astype(np.float32)
                    prv = np.asarray(base.resize((rend.W, rend.H))).astype(np.float32)
                    img = Image.fromarray((prv * (1 - a) + cur * a).astype(np.uint8))

            prev_img, prev_side, prev_ev = img.copy(), side, ev
            if rend.reactive_samples:
                react_by_spk.setdefault(ev.get("speaker", "Eduardo"), []).append(rend.reactive_samples[-1])
                env_by_spk.setdefault(ev.get("speaker", "Eduardo"), []).append(env_now)

            if f % PSTEP == 0:
                small_frames.append(np.asarray(img.convert("L").resize((192, 108)), dtype=np.uint8))

            # Capturas automáticas
            key = None
            ef = lf / dur_f
            ef_min = 0.8 if ev.get("scene_type") == "number" else 0.6
            if ef > ef_min:
                st = ev.get("scene_type")
                if st in ("number", "question", "warning") and st not in shot_taken:
                    key = st
            if key:
                (output_dir / "shots").mkdir(exist_ok=True)
                img.save(output_dir / "shots" / f"{tag}-{key}.png")
                shot_taken.add(key)

            proc.stdin.write(np.asarray(img).tobytes())

        proc.stdin.close()
        proc.wait(timeout=600)
        wall = round(time.time() - t0, 1)

        final = output_dir / f"episodio-{proj.get('id', 'master')}-{tag}.mp4"
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(silent), "-i", str(master_audio),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-map_metadata", "-1", "-shortest", str(final),
        ], check=True, timeout=600)

        sync = check_sync(
            str(final), timeline["duration_s"],
            [{"id": e["beat_id"], "start": e["start"], "end": e["end"]} for e in timeline["events"]],
            alignment=alignment_obj,
        )

        response = {sp: round(audio_visual_response_score(env_by_spk[sp], react_by_spk[sp]), 3) for sp in react_by_spk}
        cov = round(motion_coverage(rend.reactive_samples), 3)
        perc = perceptual_motion_score(small_frames)
        hold = max_perceptual_hold_seconds(small_frames, FPS / PSTEP)
        tot = max(1, rend.total_frames)

        metrics = {
            "wall_s": wall,
            "semantic_events": rend.semantic_pulses,
            "motion_coverage": cov,
            "perceptual_motion_score": perc,
            "max_perceptual_hold_seconds": hold,
            "response_by_speaker": response,
            "density_pct": {
                "quiet": round(100 * rend.quiet_frames / tot, 1),
                "normal": round(100 * rend.normal_frames / tot, 1),
                "focus": round(100 * rend.focus_frames / tot, 1),
                "impact": round(100 * rend.impact_frames / tot, 1),
            },
        }

        results[tag] = {
            "encoder": enc,
            "wall_s": wall,
            "bytes": final.stat().st_size,
            "sync": sync,
        }
        motion[tag] = metrics
        out_files[tag] = str(final.resolve())

    # Interpretación editorial
    it = EditorialVisualInterpreter()
    editorial = []
    for ev in timeline["events"]:
        if ev["scene_type"] not in ("warning", "explanation", "clarification", "summary"):
            continue
        r = it.interpret(ev)
        editorial.append({
            "beat_id": ev["beat_id"],
            "speaker": ev["speaker"],
            "scene_type": ev["scene_type"],
            "source": ev.get("display_text", ""),
            "concepts": r["concepts"],
            "states": [{"at": s["at"], "lines": s["lines"]} for s in r["states"]],
            "preservation": r["preservation"],
        })

    report = {
        "editorial": editorial,
        "status": "needs-review" if any(
            v["overflow_canvas"] or v["overflow_platform_safe"]
            or v["animated_bound_violations"] or v["collisions"]
            for v in geo["layouts"].values()
        ) else "production",
        "geometry_validation": geo,
        "motion_validation": motion,
        "versions": results,
    }
    (output_dir / "render-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return {
        "ok": True,
        "status": report["status"],
        "files": out_files,
        "report": report,
    }


def main():
    p = argparse.ArgumentParser(description="Render visual por proyecto")
    p.add_argument("--project", required=True, help="Ruta a project.json")
    p.add_argument("--master", required=True, help="Ruta al master de audio (WAV o MP3)")
    p.add_argument("--output-dir", required=True, help="Directorio destino para los videos")
    p.add_argument("--alignment", help="Ruta a timeline-alignment.json")
    p.add_argument("--formats", default="preview,16x9,9x16", help="Formatos separados por coma")
    args = p.parse_args()

    formats = [f.strip() for f in args.formats.split(",") if f.strip()]
    res = render_project_visual(
        Path(args.project),
        Path(args.master),
        Path(args.output_dir),
        formats=formats,
        alignment_path=Path(args.alignment) if args.alignment else None,
    )
    print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()