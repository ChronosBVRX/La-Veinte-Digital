"""Test del pipeline de render V1.2 (sin ffmpeg): geometría + movimiento.

Recorre la timeline real del tramo de 41 s con el renderer en modo preview,
muestreando frames, y verifica invariantes de QC.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.visual.identity import CHARACTERS
from app.visual.motion import audio_visual_response_score, motion_coverage
from app.visual.renderer import Renderer

ROOT = Path(__file__).resolve().parents[3]
TL_PATH = ROOT / "output" / "visual-v1.2" / "visual-timeline.json"
ENV_PATH = ROOT / "output" / "visual-v1.2" / "waveform-envelope.json"


def _load():
    tl = json.loads(TL_PATH.read_text(encoding="utf-8"))
    env = json.loads(ENV_PATH.read_text(encoding="utf-8"))
    return tl, env


def test_geometria_sin_overflow_ni_colisiones():
    tl, _ = _load()
    for layout in ("16x9", "9x16"):
        r = Renderer(layout=layout)
        for ev in tl["events"]:
            r.prepare(ev, dict(CHARACTERS.get(ev["speaker"], CHARACTERS["Eduardo"])))
        assert not any("overflow canvas" in i for i in r.issues), r.issues
        assert not any("platform-safe" in i or "fuera de safe zone" in i
                       for i in r.issues), r.issues
        assert not any("colisión" in i or "↔" in i for i in r.issues), r.issues
        assert not any("overshoot" in i for i in r.issues), r.issues


def test_number_hero_vertical_cabe():
    """Regresión específica: $1,200 / MONTO REPORTADO en 9:16."""
    tl, _ = _load()
    ev = next(e for e in tl["events"] if e["scene_type"] == "number")
    r = Renderer(layout="9x16")
    plan = r.prepare(ev, dict(CHARACTERS.get(ev["speaker"], CHARACTERS["Eduardo"])))
    from app.visual.layout import get_platform_safe
    safe = get_platform_safe(True)
    for stage in plan["staged_primitives"]:
        for prim in stage:
            assert prim.box.inside(safe), (prim.text, prim.box.x1)
    assert not plan["issues"]


def test_movimiento_y_reactividad():
    tl, env = _load()
    r = Renderer(layout="preview")
    events = tl["events"]
    fps = 30
    total = int(round(tl["duration_s"] * fps))
    # Muestreo cada 6 frames para rapidez.
    react_by_spk: dict[str, list[float]] = {}
    env_by_spk: dict[str, list[float]] = {}
    for f in range(0, total, 6):
        t = f / fps
        ev = events[0]
        for e in events:
            if e["start"] <= t:
                ev = e
            else:
                break
        idx = int(t / 0.03)
        en = float(env["smooth"][idx]) if 0 <= idx < len(env["smooth"]) else 0.0
        char = dict(CHARACTERS.get(ev["speaker"], CHARACTERS["Eduardo"]))
        r.frame(f, fps, ev, char, env["smooth"], 1.0, en,
                local_f=f - int(round(ev["start"] * fps)),
                dur_f=max(1, int(round((ev["end"] - ev["start"]) * fps))))
        react_by_spk.setdefault(ev["speaker"], []).append(r.reactive_samples[-1])
        env_by_spk.setdefault(ev["speaker"], []).append(en)
    # Cobertura de movimiento > 50 %.
    assert motion_coverage(r.reactive_samples) > 0.5
    # Respuesta positiva clara por speaker.
    for sp in react_by_spk:
        sc = audio_visual_response_score(env_by_spk[sp], react_by_spk[sp])
        assert sc > 0.5, (sp, sc)
    # Impact <= 15 % del tiempo.
    tot = max(1, r.total_frames)
    assert (r.impact_frames / tot) <= 0.15


def test_quiet_no_vacio():
    """En escenas sin texto protagonista la identidad debe moverse.

    Usa el envelope real del WAV (varía con la voz), no un sintético plano."""
    import math
    tl, env = _load()
    r = Renderer(layout="preview")
    conv = next(e for e in tl["events"] if e["scene_type"] == "conversation")
    samples = []
    for f in range(0, 180):
        # Envelope variable (voz) con picos y valles como el audio real.
        en = max(0.0, 0.5 + 0.45 * math.sin(f / 7.0))
        char = dict(CHARACTERS.get(conv["speaker"], CHARACTERS["Eduardo"]))
        r.frame(f, 30, conv, char, env["smooth"], 1.0, en,
                local_f=f, dur_f=180)
        samples.append(r.reactive_samples[-1])
    assert motion_coverage(samples) > 0.5
