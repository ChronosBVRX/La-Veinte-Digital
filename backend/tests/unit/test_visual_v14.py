"""Tests V1.4: sin metrónomo, interpretación semántica, preservación, redundancia."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.visual.motion import (AmbientMotionLayer, EditorialVisualInterpreter,
                               editorial_meaning_preservation)


def test_sin_evento_periodico_ambient():
    """AmbientMotionLayer no debe exponer ni usar un sweep periódico; su único
    acento extra viene de pulse() (evento semántico)."""
    amb = AmbientMotionLayer()
    assert not hasattr(amb, "sweep")
    assert amb.boost == 0.0
    amb.pulse(1.0)
    assert amb.boost > 0.0
    for _ in range(40):
        amb.step()
    assert amb.boost < 0.01  # decae sin reloj externo


def test_frame_change_detecta_movimiento_localizado():
    """Un elemento pequeño (0.7 % del frame) debe contar como cambio; la
    métrica global antigua lo ignoraba y reportaba 'congelado'."""
    import numpy as np
    from app.visual.motion import _frame_change
    a = np.zeros((108, 192), dtype=np.uint8)
    b = a.copy()
    b[50:62, 90:102] = 120  # celda localizada de 12x12
    assert _frame_change(a, b) >= 0.004
    assert _frame_change(a, a) == 0.0


def test_interpreter_elige_objetos_no_primeras_palabras():
    """El bug V1.3 (ENOJARNOS + MOVIMIENTO) no debe repetirse: los objetos de
    la proposición son FECHA y FUNDAMENTO."""
    it = EditorialVisualInterpreter()
    ev = {"scene_type": "warning", "intent": "warning",
          "display_text": "Antes de enojarnos hay que ver la fecha del "
                          "movimiento y el fundamento. Sin eso es puro rumor."}
    r = it.interpret(ev)
    assert r["concepts"][:2] == ["fecha", "fundamento"]
    flat = " ".join(ln for s in r["states"] for ln in s["lines"]).upper()
    assert "ENOJARNOS" not in flat.replace("ANTES DE ENOJARNOS", "")
    assert "FECHA" in flat and "FUNDAMENTO" in flat
    assert "SIN ESO" in flat and "RUMOR" in flat


def test_interpreter_usa_emphasis_words():
    it = EditorialVisualInterpreter()
    ev = {"scene_type": "warning", "intent": "warning",
          "display_text": "El plazo vence y el comprobante falta. Sin eso no hay nada.",
          "emphasis_words": ["comprobante", "plazo"]}
    r = it.interpret(ev)
    assert r["concepts"][0] == "comprobante"  # metadata tiene prioridad


def test_redundancia_remate_no_repite():
    it = EditorialVisualInterpreter()
    ev = {"scene_type": "warning", "intent": "warning",
          "display_text": "Hay que ver el fundamento. Sin eso es puro rumor."}
    r = it.interpret(ev)
    flat = " ".join(ln for s in r["states"] for ln in s["lines"]).upper()
    # RUMOR no debe aparecer dos veces (ni 'SIN ESO ES PURO RUMOR → RUMOR').
    assert flat.count("RUMOR") == 1
    assert r["preservation"]["ok"], r["preservation"]["issues"]


def test_preservation_detecta_token_no_literal():
    ev = {"display_text": "Solo hay fecha."}
    states = [{"lines": ["FECHA"], "at": 0.0, "emphasis": []},
              {"lines": ["INVENTADO"], "at": 0.5, "emphasis": []}]
    r = editorial_meaning_preservation(ev, states)
    assert not r["ok"]
    assert any("INVENTADO" in i for i in r["issues"])


def test_preservation_ok_texto_literal():
    ev = {"display_text": "Antes de enojarnos hay que ver la fecha del "
                          "movimiento y el fundamento. Sin eso es puro rumor."}
    states = [{"lines": ["ANTES DE ENOJARNOS"], "at": 0.0, "emphasis": []},
              {"lines": ["FECHA", "+", "FUNDAMENTO"], "at": 0.4, "emphasis": []},
              {"lines": ["SIN ESO", "→ RUMOR"], "at": 0.72, "emphasis": []}]
    assert editorial_meaning_preservation(ev, states)["ok"]


def test_pacing_intacto():
    from app.visual.motion import transition_frames

    def ev(kind, intent="statement", density="normal", section=False):
        return {"scene_type": kind, "intent": intent, "density": density,
                "section": section}
    assert 4 <= transition_frames(ev("reaction", "reaction"), None) <= 6
    assert 6 <= transition_frames(ev("conversation"), None) <= 9
    assert 6 <= transition_frames(ev("question", "question"), None) <= 10
    assert 8 <= transition_frames(ev("warning", "warning", "focus"), None) <= 12
    assert 12 <= transition_frames(ev("brand", section=True), None) <= 16
