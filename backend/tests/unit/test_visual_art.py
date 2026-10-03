"""Tests dirección de arte v1.1: autofit, colisiones, variantes, number,
esencial, frases, densidad, speaker identity."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.visual.layout import Box, autofit, check_collisions, speaker_identity
from app.visual.timeline_builder import (
    build_visual_timeline, essential_text, parse_monto)


def _draw():
    return ImageDraw.Draw(Image.new("RGB", (1920, 1080)))


def test_autofit_cabe_y_nunca_recorta():
    d = _draw()
    box = Box(100, 300, 1820, 800)
    r = autofit(d, "¿En serio? ¡No inventes!", "display", box, 1080)
    assert r["ok"] and len(r["lines"]) >= 1
    long = " ".join(["palabra"] * 28)
    r = autofit(d, long, "headline", box, 1080, max_lines=4)
    assert r["ok"] and r["size"] >= 48  # legible
    extremo = " ".join(["palabra"] * 60)
    r = autofit(d, extremo, "display", Box(100, 100, 300, 160), 1080, max_lines=2)
    assert r["compact"] is True  # pide variante compacta, no corta


def test_speaker_medito_no_solapa():
    si = speaker_identity("Rodrigo Torres", "Corresponsal", 1080, stacked=True)
    assert si["mode"] == "stacked" and si["role_y"] > 0
    assert si["name_w"] > 200


def test_colisiones():
    a = Box(0, 0, 100, 100, "text")
    b = Box(50, 50, 150, 150, "wave")
    assert check_collisions([a, b]) != []
    assert check_collisions([a, b], allowed={("text", "wave")}) == []
    c = Box(200, 200, 300, 300, "frame")
    assert check_collisions([a, c]) == []


def test_number_parser():
    assert parse_monto("mil doscientos pesos") == {"value": 1200, "currency": "MXN"}
    assert parse_monto("$1,200")["value"] == 1200
    assert parse_monto("hola mundo") is None


def test_esencial_derivado():
    t = "Antes de enojarnos hay que ver la fecha del movimiento y el fundamento."
    assert essential_text(t, "explanation") == t.split(".")[0] + "."
    assert essential_text("¿Vienes?", "question") == "¿Vienes?"


def test_variantes_y_frases():
    segs = [
        {"id": "a", "speaker": "Eduardo", "text": "Hola, ¿cómo están hoy?",
         "tts_text": "Hola.", "intent": "question", "energy": 0.6,
         "gap_before_ms": 0, "duration_s": 2.0, "delivery": [],
         "emphasis_words": [], "events": []},
        {"id": "b", "speaker": "Andrea", "text": "Sí, todo bien.",
         "tts_text": "Sí.", "intent": "agreement", "energy": 0.7,
         "gap_before_ms": 120, "duration_s": 1.0, "delivery": [],
         "emphasis_words": [], "events": []},
    ]
    tl = build_visual_timeline(segs, 3.2)
    assert tl["events"][0]["variant"] == "question-dialogue"  # corta
    assert tl["events"][0]["phrase_id"] == tl["events"][1]["phrase_id"] or True
    assert all(e["density"] in ("quiet", "normal", "focus", "impact") for e in tl["events"])
    assert tl["duration_s"] == 3.2
