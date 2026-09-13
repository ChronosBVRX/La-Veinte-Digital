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
from app.visual.render_cache import BeatRenderCache, compute_beat_render_hash
from app.visual.beat_renderer import BeatRenderer
from app.visual.parallel_renderer import IncrementalPipelineRenderer
from app.visual.assembler import assemble_video_clips, mux_audio_master

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
    alignment_path: Path | None = None,
    force_replan: bool = False,
    direction: str = "documental",
    text_mode: str = "editorial",
    mode: str = "preview",
    beat_id: str | None = None,
    time_range: tuple[float, float] | None = None,
    workers: int | None = None,
    incremental: bool = True,
    cache_status: bool = False,
) -> dict:
    if formats is None:
        formats = ["preview", "16x9", "9x16"]

    output_dir.mkdir(parents=True, exist_ok=True)
    proj = json.loads(project_path.read_text(encoding="utf-8"))
    script = proj.get("script") or {}
    turns = script.get("turns") or proj.get("turns") or []

    # Extraer preferencias si están guardadas en el proyecto
    prefs = proj.get("preferences") or {}
    if "visualDirection" in prefs and not direction:
        direction = prefs["visualDirection"]
    if "onScreenTextMode" in prefs and not text_mode:
        text_mode = prefs["onScreenTextMode"]

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

    # 1. Pipeline Editorial: Análisis de contenido, investigación de referencias y plan de dirección visual
    from app.visual.editorial import (
        EntityDetector,
        ReferenceResearcher,
        AssetResolver,
        VisualEditorialPlanner,
    )
    detector = EntityDetector()
    detected_by_turn = detector.detect_in_script(turns)
    researcher = ReferenceResearcher()
    research_report = researcher.generate_report(proj.get("id", "master"), turns, detected_by_turn)
    (output_dir / "reference-research.json").write_text(
        json.dumps(research_report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if project_path.parent.exists():
        (project_path.parent / "reference-research.json").write_text(
            json.dumps(research_report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
        )

    existing_plan_p = project_path.parent / "visual-plan.json"
    should_replan = force_replan or not existing_plan_p.exists()
    if not should_replan and existing_plan_p.exists():
        try:
            plan_dict = json.loads(existing_plan_p.read_text(encoding="utf-8"))
            # Si el plan existente no tiene la arquitectura moderna de 4 familias, forzar replan
            beats_list = plan_dict.get("beats", [])
            if not beats_list or "visual_function" not in beats_list[0]:
                should_replan = True
            else:
                from app.visual.editorial.visual_editorial_planner import VisualPlan
                visual_plan = VisualPlan(
                    project_id=plan_dict.get("project_id", proj.get("id", "master")),
                    duration_s=float(plan_dict.get("duration_s", dur_s)),
                    total_beats=int(plan_dict.get("total_beats", len(beats_list))),
                    visual_mix=plan_dict.get("visual_mix", {}),
                    beats=beats_list,
                    metrics=plan_dict.get("metrics", {}),
                )
        except Exception:
            should_replan = True

    if should_replan:
        resolver = AssetResolver()
        planner = VisualEditorialPlanner(entity_detector=detector, asset_resolver=resolver, researcher=researcher)
        visual_plan = planner.plan_project(
            proj.get("id", "master"),
            turns,
            alignment_obj,
            dur_s,
            direction=direction,
            text_mode=text_mode,
            existing_plan=json.loads(existing_plan_p.read_text(encoding="utf-8")) if existing_plan_p.exists() else None,
        )

    (output_dir / "visual-plan.json").write_text(
        json.dumps(visual_plan.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if project_path.parent.exists():
        (project_path.parent / "visual-plan.json").write_text(
            json.dumps(visual_plan.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # 2. Timeline visual enriquecido a partir del plan editorial
    events = []
    for b in visual_plan.beats:
        st = b["scene_type"]
        var = "brand-full" if st in ("brand", "brand_opening") else (
            "closing-full" if st in ("closing", "brand_closing") else (
                "number-hero" if st in ("number", "stat_card") else (
                    "document-card" if st in ("document", "document_cover") else "conversation-center"
                )
            )
        )
        events.append({
            "beat_id": b["beat_id"],
            "speaker": b["speaker"],
            "start": b["start_s"],
            "end": b["end_s"],
            "scene_type": st,
            "visual_function": b.get("visual_function", "LOCUTOR"),
            "headline": b.get("headline", ""),
            "subheadline": b.get("subheadline", ""),
            "key_points": b.get("key_points", []),
            "composition": b.get("composition", "full_bleed"),
            "variant": var,
            "display_text": b["display_text"],
            "essential": b["display_text"][:140],
            "chart_type": b.get("chart_type"),
            "resolved_asset": b.get("resolved_asset"),
            "overlay_logos": b.get("overlay_logos", []),
            "density": "normal",
            "energy": 0.5,
            "refs": {},
            "section": False,
            "emphasis_words": [],
            "keywords": [],
        })

    timeline = {
        "version": "1.3",
        "duration_s": dur_s,
        "metrics": visual_plan.metrics,
        "events": events,
    }
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
            r.prepare(ev, dict(CHARACTERS.get(ev.get("speaker") or "", CHARACTERS["Eduardo"])))
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
    proj_dir = project_path.parent

    # 1. Consulta de Estado de Cache únicamente
    if cache_status:
        cache = BeatRenderCache(proj_dir)
        summary = cache.get_status_summary(events, orientation="16x9", mode="preview")
        return {
            "ok": True,
            "cache_status": summary,
            "total_beats": len(events),
        }

    # 2. Modo Storyboard (1 contact sheet en milisegundos sin video)
    if mode == "storyboard":
        br = BeatRenderer(layout="16x9")
        out_sheet = output_dir / "storyboard.jpg"
        br.render_storyboard_contact_sheet(events, out_sheet)
        return {
            "ok": True,
            "mode": "storyboard",
            "file": str(out_sheet.resolve()),
            "total_beats": len(events),
        }

    # 3. Modo Spot Preview (1 beat aislado con audio sincronizado)
    if mode == "spot" and beat_id:
        br = BeatRenderer(layout="16x9")
        target_ev = next((e for e in events if e.get("beat_id") == beat_id), None)
        if not target_ev:
            raise ValueError(f"Beat {beat_id} not found in timeline events")
        out_spot = output_dir / f"spot-{beat_id}.mp4"
        br.render_spot_preview(target_ev, out_spot, master_audio_path=master_audio, mode="preview")
        return {
            "ok": True,
            "mode": "spot",
            "beat_id": beat_id,
            "file": str(out_spot.resolve()),
        }

    # 4. Modo Section Preview (rango de tiempo [start, end])
    if mode == "section" and time_range:
        s_start, s_end = time_range
        sec_events = [e for e in events if e.get("end", 0) > s_start and e.get("start", 0) < s_end]
        if not sec_events:
            raise ValueError(f"No events found in range {s_start} - {s_end}")
        pipe = IncrementalPipelineRenderer(
            project_dir=proj_dir,
            layout="16x9",
            max_workers=workers or 2,
        )
        out_sec = output_dir / f"section-{int(s_start)}-{int(s_end)}.mp4"
        pipe.render_full_pipeline(
            events=sec_events,
            master_audio_path=master_audio,
            output_mp4_path=out_sec,
            mode="preview",
            env_smooth=envelope.get("smooth"),
        )
        return {
            "ok": True,
            "mode": "section",
            "file": str(out_sec.resolve()),
            "events_count": len(sec_events),
        }

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

        if tag == "preview" and incremental:
            final = output_dir / f"episodio-{proj.get('id', 'master')}-{tag}.mp4"
            canonical_preview = output_dir / "preview.mp4"
            pipe = IncrementalPipelineRenderer(
                project_dir=proj_dir,
                layout="16x9",
                max_workers=workers or 2,
            )
            t0 = time.time()
            def _prog(info):
                pct = info.get("pct", 0)
                sys.stderr.write(f"[{tag}] Frame {int(pct*total_f/100)}/{total_f} ({int(pct)}%) - {round(time.time() - t0, 1)}s (hits={info.get('hits')}, misses={info.get('misses')})\n")
                sys.stderr.flush()

            _, rep = pipe.render_full_pipeline(
                events=events,
                master_audio_path=master_audio,
                output_mp4_path=final,
                mode="preview",
                env_smooth=envelope.get("smooth"),
                progress_callback=_prog,
            )
            if final.exists():
                try:
                    shutil.copyfile(final, canonical_preview)
                except Exception:
                    pass
            wall = round(time.time() - t0, 1)
            results[tag] = {
                "encoder": enc,
                "wall_s": wall,
                "bytes": final.stat().st_size if final.exists() else 0,
                "sync": check_sync(
                    str(final), timeline["duration_s"],
                    [{"id": e["beat_id"], "start": e["start"], "end": e["end"]} for e in timeline["events"]],
                    alignment=alignment_obj,
                ),
                "cache_report": rep,
            }
            out_files[tag] = str(final.resolve())
            continue

        layout, w, h = VERSIONS[tag]
        rend = Renderer(layout=layout)
        for ev in events:
            rend.prepare(ev, dict(CHARACTERS.get(ev.get("speaker") or "", CHARACTERS["Eduardo"])))

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

            if f > 0 and f % 300 == 0:
                sys.stderr.write(f"[{tag}] Frame {f}/{total_f} ({f*100//total_f}%) - {round(time.time() - t0, 1)}s\n")
                sys.stderr.flush()

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
        proc.wait(timeout=1800)
        wall = round(time.time() - t0, 1)

        final = output_dir / f"episodio-{proj.get('id', 'master')}-{tag}.mp4"
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(silent), "-i", str(master_audio),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-map_metadata", "-1", "-shortest", str(final),
        ], check=True, timeout=1800)

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

    planned_context_s = sum(
        b["duration_s"] for b in visual_plan.beats if b.get("visual_function") == "CONTEXTO"
    )
    rendered_context_s = sum(
        b["duration_s"] for b in visual_plan.beats
        if b.get("visual_function") == "CONTEXTO" and b.get("resolved_asset") and b["resolved_asset"].get("file")
    )
    missing_asset_s = sum(
        b["duration_s"] for b in visual_plan.beats
        if b.get("visual_function") in ("EVIDENCIA", "CONTEXTO") and not b.get("resolved_asset") and not b.get("chart_type")
    )
    unexpected_fallback_s = 0.0

    rendered_asset_coverage = {
        "plannedContextSeconds": round(planned_context_s, 2),
        "actuallyRenderedContextSeconds": round(rendered_context_s, 2),
        "missingAssetSeconds": round(missing_asset_s, 2),
        "unexpectedFallbackSeconds": round(unexpected_fallback_s, 2),
    }

    report = {
        "editorial": editorial,
        "visual_editorial": {
            "research_report": research_report.to_dict(),
            "visual_plan_beats": visual_plan.total_beats,
            "visual_mix": visual_plan.visual_mix,
            "rendered_asset_coverage": rendered_asset_coverage,
        },
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
    p.add_argument("--force-replan", action="store_true", help="Fuerza la regeneración del plan visual")
    p.add_argument("--direction", default="documental", help="Dirección visual: documental, conversacional, infografica")
    p.add_argument("--text-mode", default="editorial", help="Modo de texto en pantalla: editorial, editorial_subtitulos, solo_subtitulos, minimo")
    p.add_argument("--mode", default="preview", choices=["storyboard", "draft", "preview", "final", "spot", "section", "all"], help="Modo de revisión o render")
    p.add_argument("--beat-id", help="ID del beat para modo spot")
    p.add_argument("--range", help="Rango de segundos para modo section (ej. 10.0,25.0)")
    p.add_argument("--workers", type=int, default=2, help="Número de workers concurrentes")
    p.add_argument("--no-incremental", action="store_true", help="Desactiva el renderizado incremental por cache")
    p.add_argument("--cache-status", action="store_true", help="Consulta solo el estado del cache")
    args = p.parse_args()

    formats = [f.strip() for f in args.formats.split(",") if f.strip()]
    if args.mode == "storyboard":
        formats = []
    elif args.mode in ("draft", "preview", "spot", "section"):
        formats = [args.mode] if args.mode in ("preview", "draft") else []

    t_range = None
    if args.range:
        parts = [float(x.strip()) for x in args.range.split(",") if x.strip()]
        if len(parts) >= 2:
            t_range = (parts[0], parts[1])

    res = render_project_visual(
        Path(args.project),
        Path(args.master),
        Path(args.output_dir),
        formats=formats,
        alignment_path=Path(args.alignment) if args.alignment else None,
        force_replan=args.force_replan,
        direction=args.direction,
        text_mode=args.text_mode,
        mode=args.mode,
        beat_id=args.beat_id,
        time_range=t_range,
        workers=args.workers,
        incremental=not args.no_incremental,
        cache_status=args.cache_status,
    )
    print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()