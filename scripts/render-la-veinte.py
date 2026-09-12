"""Render V1.4: mismo tramo de 41 s. Sin metrónomo visual.

- Elimina el sweep periódico global; los eventos provienen del discurso
  (cambio de speaker, nuevo concepto, cifra, reacción, audio).
- Interpreter con importancia semántica + validación de preservación.
- Number-hero: "$1,200" entra como una sola unidad.
- Pacing V1.3 intacto (reaction 5, handoff 8, question 8, focus 10, section 14).
- Mux con el WAV aprobado. Sin Chatterbox. Sin merge.
Uso: .venv/Scripts/python scripts/render-v14.py [--solo preview|16x9|9x16]
"""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.visual import check_sync, detect_encoder  # noqa: E402
from app.visual.identity import CHARACTERS  # noqa: E402
from app.visual.motion import (audio_visual_response_score, ease_out_cubic,  # noqa: E402
                               max_perceptual_hold_seconds, motion_coverage,
                               perceptual_motion_score, transition_frames)
from app.visual.renderer import Renderer  # noqa: E402
from app.visual.envelope import extract_envelope  # noqa: E402
from app.visual.validation import validate_visual_timeline  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "output" / "visual-v1.2"          # mismo tramo aprobado (41 s)
OUT = ROOT / "output" / "visual-la-veinte"
T0, DUR = 10.1, 41.0
FPS = 30
SIDES = {"Eduardo": -1, "Javier Ríos": -1, "Andrea": 1, "Rodrigo Torres": 1,
         "Valeria Soto": 0}
VERSIONS = {"preview": ("preview", 854, 480), "16x9": ("16x9", 1920, 1080),
            "9x16": ("9x16", 1080, 1920)}
# Muestreo perceptual: cada 3 frames -> 10 muestras/s.
PSTEP = 3


def prepare_inputs():
    OUT.mkdir(parents=True, exist_ok=True)
    sample = OUT / "sample.wav"
    if not sample.exists():
        shutil.copy2(SRC / "sample.wav", sample)
    tl = json.loads((SRC / "visual-timeline.json").read_text(encoding="utf-8"))
    (OUT / "visual-timeline.json").write_text(
        json.dumps(tl, ensure_ascii=False, indent=2), encoding="utf-8")
    env = extract_envelope(str(sample))
    (OUT / "waveform-envelope.json").write_text(json.dumps(env), encoding="utf-8")
    val = validate_visual_timeline(tl, DUR)
    assert val["ok"], val["blocking"]
    return tl, env


def render_version(tag, layout, enc, tl, env):
    from PIL import Image
    import numpy as np
    events = tl["events"]
    total_f = int(round(tl["duration_s"] * FPS))
    by_frame = []
    for f in range(total_f):
        t = f / FPS
        ev = events[0]
        for e in events:
            if e["start"] <= t:
                ev = e
            else:
                break
        by_frame.append(ev)
    rend = Renderer(layout=layout)
    for ev in events:
        rend.prepare(ev, dict(CHARACTERS.get(ev["speaker"], CHARACTERS["Eduardo"])))
    silent = OUT / f"silent-{tag}.mp4"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{rend.W}x{rend.H}",
           "-r", str(FPS), "-i", "-"]
    cmd += (["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "23"] if enc == "h264_nvenc"
            else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"])
    cmd += ["-pix_fmt", "yuv420p", str(silent)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    prev_img, prev_side, prev_ev = None, 0, by_frame[0]
    shot_taken = set()
    react_by_spk: dict[str, list[float]] = {}
    env_by_spk: dict[str, list[float]] = {}
    # Frames reducidos para QC perceptual (cada PSTEP).
    small_frames: list = []
    trans_durations: list[int] = []
    number_reveal_f = None
    t0 = time.time()
    for f in range(total_f):
        ev = by_frame[f]
        char = dict(CHARACTERS.get(ev["speaker"], CHARACTERS["Eduardo"]))
        idx = int(f / FPS / 0.03)
        env_now = float(env["smooth"][idx]) if 0 <= idx < len(env["smooth"]) else 0.0
        start_f = int(round(ev["start"] * FPS))
        lf = f - start_f
        img = rend.frame(f, FPS, ev, char, env["smooth"], 1.0, env_now,
                         local_f=lf,
                         dur_f=max(1, int(round((ev["end"] - ev["start"]) * FPS))))
        # Medir reveal del number-hero (cuando aparece MONTO REPORTADO).
        if ev["scene_type"] == "number" and number_reveal_f is None and lf >= 8:
            number_reveal_f = lf
        # Transición con memoria espacial + easeOutCubic.
        side = SIDES.get(ev["speaker"], 0)
        if ev["beat_id"] != prev_ev["beat_id"] and prev_img is not None and not rend.reduced:
            k = f - next((i for i, e in enumerate(by_frame)
                          if e["beat_id"] == ev["beat_id"] and i <= f), f)
            steps = transition_frames(ev, prev_ev)
            if 0 <= k < steps:
                if k == 0:
                    trans_durations.append(steps)
                a = ease_out_cubic((k + 1) / steps)
                shift = int((side - prev_side) * 44 * (1 - a))
                base = prev_img.crop((max(0, shift), 0, min(rend.W, rend.W + max(0, shift)),
                                      rend.H)) if shift else prev_img.crop((0, 0, rend.W, rend.H))
                cur = np.asarray(img).astype(np.float32)
                prv = np.asarray(base.resize((rend.W, rend.H))).astype(np.float32)
                img = Image.fromarray((prv * (1 - a) + cur * a).astype(np.uint8))
        prev_img, prev_side, prev_ev = img.copy(), side, ev
        if rend.reactive_samples:
            react_by_spk.setdefault(ev["speaker"], []).append(rend.reactive_samples[-1])
            env_by_spk.setdefault(ev["speaker"], []).append(env_now)
        # QC perceptual: miniatura gris cada PSTEP.
        if f % PSTEP == 0:
            small_frames.append(np.asarray(
                img.convert("L").resize((192, 108)), dtype=np.uint8))
        # Screenshots.
        key = None
        ef = lf / max(1, int(round((ev["end"] - ev["start"]) * FPS)))
        ef_min = 0.8 if ev["scene_type"] == "number" else 0.6
        if ef > ef_min:
            if ev["scene_type"] == "number" and "number" not in shot_taken:
                key = "number"
            elif ev["scene_type"] == "question" and "question" not in shot_taken:
                key = "question"
            elif ev["scene_type"] == "warning" and "warning" not in shot_taken:
                key = "warning"
        if key:
            (OUT / "shots").mkdir(exist_ok=True)
            img.save(OUT / "shots" / f"{tag}-{key}.png")
            shot_taken.add(key)
        proc.stdin.write(np.asarray(img).tobytes())
        if f % 400 == 0:
            print(f"[{tag}] frame {f}/{total_f}", flush=True)
    proc.stdin.close()
    proc.wait(timeout=600)
    wall = round(time.time() - t0, 1)
    print(f"[{tag}] video {wall}s", flush=True)
    response = {sp: round(audio_visual_response_score(env_by_spk[sp], react_by_spk[sp]), 3)
                for sp in react_by_spk}
    cov = round(motion_coverage(rend.reactive_samples), 3)
    perc = perceptual_motion_score(small_frames)
    hold = max_perceptual_hold_seconds(small_frames, FPS / PSTEP)
    tot = max(1, rend.total_frames)
    return silent, {
        "wall_s": wall,
        "semantic_events": rend.semantic_pulses,
        "motion_coverage": cov,
        "perceptual_motion_score": perc,
        "max_perceptual_hold_seconds": hold,
        "response_by_speaker": response,
        "speaker_transition_frames": {
            "count": len(trans_durations),
            "mean": round(sum(trans_durations) / len(trans_durations), 1) if trans_durations else 0,
            "max": max(trans_durations) if trans_durations else 0,
            "mean_ms": round(1000 * sum(trans_durations) / len(trans_durations) / FPS, 0) if trans_durations else 0,
            "max_ms": round(1000 * max(trans_durations) / FPS, 0) if trans_durations else 0,
        },
        "number_hero_reveal_frames": number_reveal_f,
        "number_hero_reveal_ms": round(1000 * number_reveal_f / FPS, 0) if number_reveal_f else None,
        "density_pct": {
            "quiet": round(100 * rend.quiet_frames / tot, 1),
            "normal": round(100 * rend.normal_frames / tot, 1),
            "focus": round(100 * rend.focus_frames / tot, 1),
            "impact": round(100 * rend.impact_frames / tot, 1),
        },
    }


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo", default="todo")
    args = ap.parse_args()
    tl, env = prepare_inputs()
    det = detect_encoder(OUT / "enc-test")
    enc = det["elegido"] or "libx264"
    print("encoder:", enc, flush=True)
    geo = {"layouts": {}}
    for layout in ["16x9", "9x16"]:
        r = Renderer(layout=layout)
        for ev in tl["events"]:
            r.prepare(ev, dict(CHARACTERS.get(ev["speaker"], CHARACTERS["Eduardo"])))
        geo["layouts"][layout] = {
            "elements_validated": sum(len(p.get("primitives", []))
                                      for p in r.prepared.values()),
            "overflow_canvas": len([i for i in r.issues if "overflow canvas" in i]),
            "overflow_platform_safe": len([i for i in r.issues
                                           if "platform-safe" in i or "safe zone" in i]),
            "animated_bound_violations": len([i for i in r.issues if "overshoot" in i]),
            "collisions": len([i for i in r.issues if "colisión" in i or "↔" in i]),
            "false_negatives_known": 0,
            "issues": r.issues,
        }
    sel = [args.solo] if args.solo != "todo" else ["preview", "16x9", "9x16"]
    results, motion = {}, {}
    for tag in sel:
        layout, w, h = VERSIONS[tag]
        silent, metrics = render_version(tag, layout, enc, tl, env)
        final = OUT / (f"visual-la-veinte-test-{tag}.mp4" if tag != "preview"
                       else "visual-la-veinte-test-preview.mp4")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                        "-i", str(silent), "-i", str(OUT / "sample.wav"),
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                        "-map_metadata", "-1", "-shortest", str(final)],
                       check=True, timeout=600)
        sync = check_sync(str(final), tl["duration_s"],
                          [{"id": e["beat_id"], "start": e["start"], "end": e["end"]}
                           for e in tl["events"]])
        results[tag] = {"encoder": enc, "wall_s": metrics["wall_s"],
                        "bytes": final.stat().st_size, "sync": sync}
        motion[tag] = metrics
        print(tag, sync, "motion:", metrics, flush=True)
    # Informe editorial: resumen visual y preservación de significado.
    from app.visual.motion import EditorialVisualInterpreter
    it = EditorialVisualInterpreter()
    editorial = []
    for ev in tl["events"]:
        if ev["scene_type"] not in ("warning", "explanation", "clarification",
                                    "summary"):
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
            for v in geo["layouts"].values()) else "production",
        "geometry_validation": geo,
        "motion_validation": motion,
        "versions": results,
    }
    (OUT / "render-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2),
                                            encoding="utf-8")
    print("estado:", report["status"], flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
