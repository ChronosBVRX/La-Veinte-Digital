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


def test_adapt_project_turns_with_alignment():
    turns = [
        {"id": "t1", "speaker": "EDUARDO", "displayText": "Hola", "audioDurMs": 1000},
        {"id": "t2", "speaker": "RODRIGO", "displayText": "Mundo", "audioDurMs": 1500},
    ]
    alignment = {
        "version": 1,
        "masterPath": "data/tts/master/master.mp3",
        "durationMs": 10000,
        "blocks": [],
        "turns": [
            {"turnId": "t1", "speaker": "Eduardo", "startMs": 5800, "endMs": 7000, "durationMs": 1200},
            {"turnId": "t2", "speaker": "Rodrigo Torres", "startMs": 7200, "endMs": 9000, "durationMs": 1800},
        ],
    }
    segs = adapt_project_turns(turns, alignment=alignment)
    assert segs[0]["start"] == 5.8
    assert segs[0]["end"] == 7.0
    assert segs[0]["duration_s"] == 1.2
    assert segs[1]["start"] == 7.2
    assert segs[1]["end"] == 9.0
    assert segs[1]["duration_s"] == 1.8


def test_alignment_missing_turn_raises_error():
    import pytest
    turns = [
        {"id": "t1", "speaker": "EDUARDO", "displayText": "Hola"},
        {"id": "t2", "speaker": "RODRIGO", "displayText": "Mundo"},
    ]
    alignment = {
        "version": 1,
        "turns": [
            {"turnId": "t1", "speaker": "Eduardo", "startMs": 5800, "endMs": 7000, "durationMs": 1200},
        ],
    }
    with pytest.raises(ValueError, match="ALIGNMENT_TURN_MISSING:t2"):
        adapt_project_turns(turns, alignment=alignment)


def test_alignment_duplicate_turn_raises_error():
    import pytest
    turns = [
        {"id": "t1", "speaker": "EDUARDO", "displayText": "Hola"},
    ]
    alignment = {
        "version": 1,
        "turns": [
            {"turnId": "t1", "speaker": "Eduardo", "startMs": 1000, "endMs": 2000, "durationMs": 1000},
            {"turnId": "t1", "speaker": "Eduardo", "startMs": 2000, "endMs": 3000, "durationMs": 1000},
        ],
    }
    with pytest.raises(ValueError, match="ALIGNMENT_DUPLICATE_TURN:t1"):
        adapt_project_turns(turns, alignment=alignment)


def test_timeline_opening_and_closing_scenes():
    turns = [
        {"id": "t1", "speaker": "EDUARDO", "displayText": "Hola a todos"},
    ]
    alignment = {
        "version": 1,
        "durationMs": 12000,
        "blocks": [
            {"type": "opening", "startMs": 0, "endMs": 5000, "durationMs": 5000},
            {"type": "speech", "startMs": 5800, "endMs": 9000, "durationMs": 3200, "turnId": "t1"},
            {"type": "outro", "startMs": 9500, "endMs": 12000, "durationMs": 2500},
        ],
        "turns": [
            {"turnId": "t1", "speaker": "Eduardo", "startMs": 5800, "endMs": 9000, "durationMs": 3200},
        ],
    }
    segs = adapt_project_turns(turns, alignment=alignment)
    tl = build_visual_timeline(segs, 12.0, alignment=alignment)
    events = tl["events"]
    assert len(events) == 3
    # 1. Opening scene
    assert events[0]["beat_id"] == "scene-opening"
    assert events[0]["start"] == 0.0
    assert events[0]["end"] == 5.8
    assert events[0]["scene_type"] == "brand"
    # 2. Speech scene
    assert events[1]["beat_id"] == "t1"
    assert events[1]["start"] == 5.8
    assert events[1]["end"] == 9.0
    # 3. Closing scene
    assert events[2]["beat_id"] == "scene-closing"
    assert events[2]["start"] == 9.5
    assert events[2]["end"] == 12.0
    assert events[2]["scene_type"] == "closing"