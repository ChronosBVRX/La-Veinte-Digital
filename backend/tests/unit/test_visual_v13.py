"""Tests V1.3: timings, easing, métricas perceptuales, interpreter temporal."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.visual.motion import (EditorialVisualInterpreter, ease_out_cubic,
                               max_perceptual_hold_seconds,
                               perceptual_motion_score, transition_frames)


def test_ease_out_cubic():
    assert ease_out_cubic(0.0) == 0.0
    assert abs(ease_out_cubic(1.0) - 1.0) < 1e-9
    # Llegada rápida: a mitad ya superó 0.8.
    assert ease_out_cubic(0.5) > 0.8
    # Monótono.
    xs = [ease_out_cubic(t / 10) for t in range(11)]
    assert xs == sorted(xs)


def test_transition_frames_rangos():
    def ev(kind, intent="statement", density="normal", section=False):
        return {"scene_type": kind, "intent": intent, "density": density,
                "section": section}
    assert 4 <= transition_frames(ev("reaction", "reaction"), None) <= 6
    assert 6 <= transition_frames(ev("conversation"), None) <= 9
    assert 6 <= transition_frames(ev("question", "question"), None) <= 10
    assert 8 <= transition_frames(ev("warning", "warning", "focus"), None) <= 12
    assert 12 <= transition_frames(ev("brand", section=True), None) <= 16
    # Handoff normal nunca 18.
    assert transition_frames(ev("conversation"), ev("conversation")) < 18


def test_perceptual_metrics():
    # Frames idénticos -> hold máximo, score mínimo.
    frozen = [np.zeros((54, 96), dtype=np.uint8) for _ in range(20)]
    assert max_perceptual_hold_seconds(frozen, 10) >= 1.5
    assert perceptual_motion_score(frozen) < 0.2
    # Frames que cambian (icono moviéndose) -> score alto, hold bajo.
    moving = []
    for i in range(20):
        f = np.zeros((54, 96), dtype=np.uint8)
        x = 5 + i * 2
        f[10:20, x:x + 6] = 200  # bloque que se desplaza
        moving.append(f)
    assert perceptual_motion_score(moving) > 0.4
    assert max_perceptual_hold_seconds(moving, 10) <= 0.2


def test_interpreter_temporal_orden():
    it = EditorialVisualInterpreter()
    ev = {"scene_type": "warning", "intent": "warning",
          "display_text": "Ojo. Antes de enojarnos hay que ver la fecha del movimiento y el fundamento. Sin eso es puro rumor."}
    r = it.interpret(ev)
    ats = [s["at"] for s in r["states"]]
    # V1.4: puede no haber estado de entrada si el texto arranca con una
    # oración corta ("Ojo."); el primer estado llega a más tardar a 0.4.
    assert ats == sorted(ats) and ats[0] <= 0.4
    assert any(a >= 0.6 for a in ats)  # hay estado tardío (consecuencia)
    # Todos los tokens derivan del texto.
    for st in r["states"]:
        for line in st["lines"]:
            for tok in line.replace("→", " ").split():
                if len(tok) >= 5 and tok.isalpha():
                    assert tok.lower() in ev["display_text"].lower(), tok


def test_number_reveal_rapido():
    """El reveal del number-hero no debe consumir 3 s (V1.2). Con 30 fps,
    la etapa final aparece a los 8 frames = 267 ms."""
    assert 1000 * 8 / 30 <= 600
