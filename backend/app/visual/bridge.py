"""Bridge / Adaptador para proyectos de La Veinte Radio a segmentos del motor visual.

Convierte turnos de guion y bloques producidos con Speechify en el contrato
estricto consumido por build_visual_timeline(...).
"""
from __future__ import annotations

SPEAKER_MAP = {
    "EDUARDO": "Eduardo",
    "Eduardo": "Eduardo",
    "ANDREA": "Andrea",
    "Andrea": "Andrea",
    "JAVIER": "Javier Ríos",
    "JAVIER RÍOS": "Javier Ríos",
    "JAVIER RIOS": "Javier Ríos",
    "Javier Ríos": "Javier Ríos",
    "Javier Rios": "Javier Ríos",
    "NARRADOR": "Javier Ríos",
    "ALONSO": "Javier Ríos",
    "RODRIGO": "Rodrigo Torres",
    "RODRIGO TORRES": "Rodrigo Torres",
    "Rodrigo Torres": "Rodrigo Torres",
    "CORRESPONSAL": "Rodrigo Torres",
    "VALERIA": "Valeria Soto",
    "VALERIA SOTO": "Valeria Soto",
    "Valeria Soto": "Valeria Soto",
    "COMERCIAL": "Valeria Soto",
    "PATROCINIO": "Valeria Soto",
}


def normalize_speaker(raw_speaker: str) -> str:
    cleaned = (raw_speaker or "").strip()
    return SPEAKER_MAP.get(cleaned, SPEAKER_MAP.get(cleaned.upper(), "Eduardo"))


def adapt_turn_to_segment(turn: dict) -> dict:
    speaker = normalize_speaker(turn.get("speaker") or "")
    text = turn.get("displayText") or turn.get("text") or ""
    tts_text = turn.get("ttsText") or turn.get("tts_text") or text
    intent = turn.get("intent") or "statement"
    energy = float(turn.get("energy") if turn.get("energy") is not None else 0.5)

    gap_ms = turn.get("gap_before_ms")
    if gap_ms is None:
        gap_ms = turn.get("pauseBeforeMs")
    if gap_ms is None:
        gap_ms = 200.0

    duration_s = turn.get("duration_s")
    if duration_s is None and turn.get("audioDurMs"):
        duration_s = float(turn["audioDurMs"]) / 1000.0
    if duration_s is None:
        duration_s = 0.0

    delivery = turn.get("delivery") or {}
    emphasis_words = turn.get("emphasis_words") or []
    events = turn.get("productionEvents") or turn.get("events") or []

    return {
        "id": turn.get("id") or turn.get("beat_id") or "",
        "speaker": speaker,
        "text": text,
        "tts_text": tts_text,
        "intent": intent,
        "energy": energy,
        "gap_before_ms": float(gap_ms),
        "duration_s": float(duration_s),
        "delivery": delivery,
        "emphasis_words": list(emphasis_words),
        "events": list(events),
    }


def adapt_project_turns(turns: list[dict], total_duration_s: float | None = None) -> list[dict]:
    segs = [adapt_turn_to_segment(t) for t in turns]
    missing_durations = any(s["duration_s"] <= 0 for s in segs)
    if missing_durations and total_duration_s and total_duration_s > 0 and segs:
        total_gaps = sum(s["gap_before_ms"] / 1000.0 for s in segs)
        available_speech = max(1.0, total_duration_s - total_gaps)
        lengths = [max(1, len(s["text"])) for s in segs]
        total_len = sum(lengths)
        for i, s in enumerate(segs):
            if s["duration_s"] <= 0:
                s["duration_s"] = round((lengths[i] / total_len) * available_speech, 3)
    return segs