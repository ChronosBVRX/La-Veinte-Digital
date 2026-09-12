"""Tests de movimiento V1.2: reactividad, cobertura, stage, interpreter."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.visual.motion import (
    AmbientMotionLayer, AudioReactiveIdentity, ConversationStage,
    EditorialVisualInterpreter, audio_visual_response_score, motion_coverage)


def test_reactive_smoothing_attack_release():
    r = AudioReactiveIdentity(attack=0.5, release=0.05)
    # Subida rápida
    r.update(1.0)
    up = r.value
    assert up > 0.2
    # Bajada lenta (release pequeño) -> conserva parte
    r.update(0.0)
    assert r.value > 0.0 and r.value < up
    # Estable ante jitter: dos entradas cercanas no oscilan brusco
    r2 = AudioReactiveIdentity()
    seq = [r2.update(v) for v in [0.5, 0.52, 0.48, 0.51]]
    assert max(seq) - min(seq) < 0.2


def test_reactive_delta_por_personaje():
    r = AudioReactiveIdentity()
    for _ in range(20):
        r.update(0.8, 0.8)
    for shape, key in [("circles", "radius_px"), ("curves", "amplitude_px"),
                       ("grid", "length_px"), ("bars", "separation_px")]:
        d = r.delta(shape, 0.8, base=200)
        assert key in d and d[key] > 6.0
    # Silencio -> mínimo del rango (no cero: la identidad nunca está muerta).
    r0 = AudioReactiveIdentity()
    quiet = r0.delta("circles", 0.0, base=200)["radius_px"]
    loud = r.delta("circles", 0.8, base=200)["radius_px"]
    assert quiet < loud and quiet >= 4.0
    # Amplitud perceptiva: la diferencia silencio->voz es clara (>2 px).
    assert loud - quiet > 2.0


def test_motion_coverage():
    # Serie viva: cambia cada ventana
    alive = [i * 0.05 for i in range(120)]
    assert motion_coverage(alive) > 0.8
    # Serie congelada
    frozen = [0.1] * 120
    assert motion_coverage(frozen) == 0.0


def test_response_score():
    import math
    env = [0.5 + 0.4 * math.sin(i / 5.0) for i in range(60)]
    react = [0.5 + 0.35 * math.sin(i / 5.0) for i in range(60)]  # correlacionado
    assert audio_visual_response_score(env, react) > 0.9
    flat = [0.5] * 60
    assert audio_visual_response_score(env, flat) == 0.0


def test_conversation_stage_memoria():
    st = ConversationStage(fade_frames=10)
    st.notify("circles", (245, 158, 11))
    assert st.presence() > 0.0  # recién cambiado: máxima presencia
    for _ in range(12):
        st.step()
    assert st.presence() == 0.0  # desvanecido
    # No más de dos identidades: solo guarda la anterior
    st.notify("grid", (125, 211, 252))
    st.notify("bars", (110, 231, 183))
    assert st.prev_shape == "bars"


def test_interpreter_explanation_steps():
    it = EditorialVisualInterpreter()
    ev = {"scene_type": "explanation", "intent": "explanation",
          "display_text": "Primero revisa la fecha del movimiento y luego el fundamento documental."}
    r = it.interpret(ev)
    assert r["derived"] and len(r["states"]) >= 2
    # Estados temporales: cada uno con 'at' creciente.
    ats = [s["at"] for s in r["states"]]
    assert ats == sorted(ats)
    # Derivado literal: cada concepto aparece en el texto
    for st in r["states"]:
        for line in st["lines"]:
            for tok in line.split():
                if len(tok) >= 6 and tok.isalpha():
                    assert tok.lower() in ev["display_text"].lower()


def test_interpreter_warning():
    it = EditorialVisualInterpreter()
    ev = {"scene_type": "warning", "intent": "warning",
          "display_text": "Ojo. Antes de enojarnos hay que ver la fecha del movimiento y el fundamento. Sin eso es puro rumor."}
    r = it.interpret(ev)
    assert r["derived"] and len(r["states"]) >= 2
    # No inventa: todo token relevante proviene del texto
    joined = " ".join(" ".join(s["lines"]) for s in r["states"]).lower()
    for tok in ("fecha", "fundamento", "antes", "rumor"):
        if tok in joined:
            assert tok in ev["display_text"].lower()
    # Temporal: hay un estado tardío (~0.7) con la consecuencia.
    assert max(s["at"] for s in r["states"]) >= 0.6


def test_interpreter_no_inventa_number():
    it = EditorialVisualInterpreter()
    r = it.interpret({"scene_type": "number", "intent": "statement",
                      "display_text": "mil doscientos pesos"})
    assert r["states"] == [] and not r["derived"]
