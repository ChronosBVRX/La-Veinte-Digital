"""Pruebas del puente adaptador de proyectos La Veinte Radio al motor visual."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.visual.bridge import adapt_project_turns, adapt_turn_to_segment, normalize_speaker
from app.visual.timeline_builder import build_visual_timeline


def test_normalize_speakers():
    assert normalize_speaker("EDUARDO") == "Eduardo"
    assert normalize_speaker("ANDREA") == "Andrea"
    assert normalize_speaker("JAVIER") == "Javier Ríos"
    assert normalize_speaker("JAVIER RÍOS") == "Javier Ríos"
    assert normalize_speaker("NARRADOR") == "Javier Ríos"
    assert normalize_speaker("RODRIGO") == "Rodrigo Torres"
    assert normalize_speaker("RODRIGO TORRES") == "Rodrigo Torres"
    assert normalize_speaker("VALERIA") == "Valeria Soto"
    assert normalize_speaker("VALERIA SOTO") == "Valeria Soto"
    assert normalize_speaker("DESCONOCIDO") == "Eduardo"


def test_adapt_turn_to_segment():
    turn = {
        "id": "turn-001",
        "speaker": "JAVIER",
        "displayText": "Ojo con el Artículo 47.",
        "ttsText": "Ojo con el Artículo cuarenta y siete.",
        "intent": "warning",
        "energy": 0.7,
        "pauseBeforeMs": 300,
        "audioDurMs": 2400,
        "delivery": {"styles": ["firm"]},
        "emphasis_words": ["Artículo"],
        "productionEvents": [{"type": "pause", "durationMs": 300}],
    }
    seg = adapt_turn_to_segment(turn)
    assert seg["id"] == "turn-001"
    assert seg["speaker"] == "Javier Ríos"
    assert seg["text"] == "Ojo con el Artículo 47."
    assert seg["tts_text"] == "Ojo con el Artículo cuarenta y siete."
    assert seg["intent"] == "warning"
    assert seg["energy"] == 0.7
    assert seg["gap_before_ms"] == 300.0
    assert seg["duration_s"] == 2.4
    assert seg["delivery"]["styles"] == ["firm"]
    assert seg["emphasis_words"] == ["Artículo"]
    assert len(seg["events"]) == 1


def test_adapt_and_build_timeline():
    turns = [
        {
            "id": "t1",
            "speaker": "EDUARDO",
            "displayText": "Bienvenidos a La Veinte Radio.",
            "intent": "brand",
            "pauseBeforeMs": 0,
            "audioDurMs": 3000,
        },
        {
            "id": "t2",
            "speaker": "RODRIGO",
            "displayText": "Tenemos un reporte de $1,200 pesos.",
            "intent": "number",
            "pauseBeforeMs": 200,
            "audioDurMs": 2500,
        },
    ]
    segs = adapt_project_turns(turns)
    tl = build_visual_timeline(segs, 5.7)
    assert tl["duration_s"] == 5.7
    assert len(tl["events"]) == 2
    assert tl["events"][0]["speaker"] == "Eduardo"
    assert tl["events"][0]["scene_type"] == "brand"
    assert tl["events"][1]["speaker"] == "Rodrigo Torres"
    assert tl["events"][1]["scene_type"] == "number"