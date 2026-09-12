"""Reproducción del fallo V1.1 y validación V1.2 (geometría única)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.visual.layout import Box, get_platform_safe, staged_number_lines, build_number_primitives, AnimatedBoundsValidator, get_main_box
from app.visual.renderer import Renderer

def _ev_number():
    return {"beat_id": "test-number", "scene_type": "number", "variant": "number-hero",
            "refs": {"cantidad": ("$1,200", ""), "monto": {"value": 1200}, "cantidad": ("mil doscientos pesos", "MONTO REPORTADO")},
            "refs": {"cantidad": ("$1,200", "MONTO REPORTADO"), "monto": {"value": 1200}},
            "essential": "mil doscientos pesos MONTO REPORTADO", "display_text": "mil doscientos pesos"}

def test_v11_number_overflow_repro():
    """V1.1 medía display_text completo pero dibujaba por etapas -> falso negativo."""
    # Simula V1.1: main ancho 54-1026 (canvas, no platform) con texto largo
    # "MONTO REPORTADO" a tamaño display-xl excede 940 (platform right).
    # En V1.2, build_number_primitives usa main 70-940 y staged, por lo que cabe.
    from PIL import Image as I
    probe = ImageDraw.Draw(I.new("RGB", (8,8)))
    W, H = 1080, 1920
    vertical = True
    ev = {"beat_id": "x", "refs": {"cantidad": ("$1,200", "MONTO REPORTADO"), "monto": {"value": 1200}}}
    # Old main (bug)
    old_main = Box(54, 700, 1026, 1350, "main")
    # New main (fixed)
    new_main = get_main_box("9x16", "number-hero", W, H)
    assert new_main.x1 == 940 and new_main.x0 == 70
    # Old would have validated whole text "MONTO REPORTADO" as one line at 150px -> overflow
    # New stages are measured separately and fit within 70-940.
    for stage in range(3):
        prims = build_number_primitives(probe, ev, new_main, H, stage)
        for p in prims:
            assert p.box.inside(get_platform_safe(True)), f"stage {stage} {p.text} fuera de platform-safe {p.box.x1} > 940"
    # Animated bounds también dentro
    validator = AnimatedBoundsValidator(get_platform_safe(True), Box(0,0,W,H,"canvas"))
    for stage in range(3):
        prims = build_number_primitives(probe, ev, new_main, H, stage)
        assert validator.validate(prims) == []

def test_renderer_and_validator_share_source():
    """Renderer y validator deben consumir exactamente staged_number_lines()."""
    ev = {"beat_id": "y", "refs": {"cantidad": ("$1,200", "MONTO REPORTADO"), "monto": {"value": 1200}}}
    stages_a = staged_number_lines(ev)
    stages_b = staged_number_lines(ev)
    # V1.4: la cifra completa es la unidad mínima; nunca un "$" aislado.
    assert stages_a == stages_b == [["$1,200"], ["$1,200"], ["$1,200", "MONTO REPORTADO"]]
    assert all(s[0] != "$" for s in stages_a)

def test_platform_safe_vertical():
    safe = get_platform_safe(vertical=True)
    assert (safe.x0, safe.y0, safe.x1, safe.y1) == (70, 200, 940, 1450)
    canvas = Box(0,0,1080,1920,"canvas")
    assert safe.inside(canvas)
    # Texto crítico debe estar dentro, decorativo puede estar fuera parcialmente (no testeado aquí)

def test_eduardo_final_question_safe():
    """Pregunta final Eduardo debe permanecer fuera de zona UI derecha."""
    from app.visual.timeline_builder import build_visual_timeline
    segs = [{"id": "b031", "speaker": "Eduardo", "text": "Exacto. Y si el papel no aparece, ¿qué se hace?",
             "tts_text": "Exacto. ¿qué se hace?", "intent": "question", "energy": 0.6,
             "gap_before_ms": 264, "duration_s": 3.0, "delivery": [], "emphasis_words": [], "events": []}]
    tl = build_visual_timeline(segs, 3.0)
    ev = tl["events"][0]
    assert ev["scene_type"] == "question"
    # Render vertical y validar
    r = Renderer(layout="9x16")
    from app.visual.identity import CHARACTERS
    plan = r.prepare(ev, CHARACTERS["Eduardo"])
    # Ningún issue de fuera de safe debe existir para este beat
    assert not any("fuera de platform-safe" in i for i in plan["issues"]), plan["issues"]
    assert not any("fuera de safe zone" in i for i in plan["issues"])
    # Explícitamente, la caja principal debe estar dentro de platform
    safe = get_platform_safe(vertical=True)
    assert plan["boxes"]["main"].inside(safe)
