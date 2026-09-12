"""VisualTimelineBuilder v1.1: eventos con variante, frase visual, densidad,
texto esencial y layout. Determinista. Misma duración que el audio.
"""
from __future__ import annotations

import re

SCENE_TYPES = {"brand", "conversation", "question", "reaction", "number",
               "document", "explanation", "warning", "quote", "transition",
               "closing"}

_STOP = {"que", "los", "las", "una", "para", "con", "sin", "por", "como",
         "esto", "esta", "este", "pero", "porque", "cuando", "donde",
         "hasta", "desde", "sobre", "entre", "ante", "todo", "todos",
         "cada", "este", "esta", "más", "muy", "tan", "así", "ahí"}

_UNIDADES = {"cero": 0, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4,
             "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9}
_DECENAS = {"diez": 10, "veinte": 20, "treinta": 30, "cuarenta": 40,
            "cincuenta": 50, "sesenta": 60, "setenta": 70, "ochenta": 80,
            "noventa": 90}
_CENTENAS = {"cien": 100, "ciento": 100, "doscientos": 200, "doscientas": 200,
             "trescientos": 300, "quinientos": 500, "setecientos": 700,
             "novecientos": 900}


def parse_monto(text: str) -> dict | None:
    """'mil doscientos pesos' -> {value:1200, currency:'MXN'} (mx + dígitos)."""
    t = text or ""
    m = re.search(r"\$\s*([\d,]+(?:\.\d+)?)", t)
    if m:
        return {"value": int(float(m.group(1).replace(",", ""))),
                "currency": "MXN"}
    low = t.lower()
    total, cur, used = 0, 0, False
    for w in re.findall(r"[a-záéíóúüñ]+", low):
        if w in ("mil",):
            total = (total or 1) * 0  # se resuelve abajo con miles
            cur = (cur or 1)
            total = cur * 1000 if cur else 1000
            cur, used = 0, True
        elif w in ("millones", "millón"):
            total = (total + cur) * 1000000
            cur, used = 0, True
        elif w in _CENTENAS:
            cur += _CENTENAS[w]
            used = True
        elif w in _DECENAS:
            cur += _DECENAS[w]
            used = True
        elif w in _UNIDADES:
            cur += _UNIDADES[w]
            used = True
        elif w in ("y",):
            continue
        elif used:
            break
    total += cur
    if used and total > 0 and re.search(r"pesos?", low):
        return {"value": total, "currency": "MXN"}
    return None


def _keywords(text: str, n: int = 3) -> list[str]:
    words = re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{7,}", text or "")
    out = []
    for w in words:
        if w.lower() not in _STOP and w not in out:
            out.append(w)
        if len(out) >= n:
            break
    return out


def _sentences(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"(?<=[.!?…])\s+", (text or "").strip()) if p.strip()]


def essential_text(display: str, scene: str) -> str:
    """Derivado SIEMPRE del display_text (sin inventar)."""
    ss = _sentences(display)
    if scene == "number":
        return display
    if scene == "question":
        return display if len(display) <= 140 else (ss[0] if ss else display)
    if scene == "explanation":
        return ss[0] if ss else display
    if len(display) <= 200:
        return display
    return " ".join(ss[:2])


def _importance(seg: dict, duration_s: float) -> float:
    score = 0.4
    intent = (seg.get("intent") or "").lower()
    if intent in ("question", "warning", "brand", "closing"):
        score += 0.25
    if intent in ("reaction", "agreement"):
        score += 0.15
    if seg.get("delivery"):
        score += 0.1
    if duration_s >= 8:
        score += 0.1
    if (seg.get("events") or []):
        score += 0.05
    return round(min(1.0, score), 2)


def _find_refs(text: str) -> dict:
    t = text or ""
    out: dict = {}
    m = re.search(r"\$\s*([\d,]+(?:\.\d+)?)\s*(\w+)?", t)
    if m:
        out["cantidad"] = (m.group(0).strip(), "")
    else:
        pm = parse_monto(t)
        if pm:
            out["cantidad"] = (f"${pm['value']:,}".replace(",", ","), "MONTO REPORTADO")
            out["monto"] = pm
    m = re.search(r"\b(\d{1,2}/\d{1,2}/\d{4}|\d+\s+de\s+\w+\s+de\s+\d{4})\b", t)
    if m:
        out["fecha"] = m.group(1)
    m = re.search(r"\b(Cláusula\s+\d+[^\n,.]{0,40}|Artículo\s+\d+[^\n,.]{0,40}|Contrato Colectivo[^\n,.]{0,40}|Reglamento[^\n,.]{0,40}|NOM[^\n,.]{0,40})\b", t)
    if m:
        out["normativa"] = m.group(1).strip()
    return out


def _scene_variant(seg: dict, text: str, refs: dict, duration_s: float) -> tuple[str, str]:
    intent = (seg.get("intent") or "statement").lower()
    if intent == "brand" or "La Veinte Radio" in text:
        return "brand", "brand-full"
    if intent == "closing":
        return "closing", "closing-full"
    if "cantidad" in refs:
        return "number", "number-hero"
    if intent == "question":
        if len(text) <= 40:
            return "question", "question-dialogue"
        if seg.get("emphasis_words"):
            return "question", "question-focus"
        return "question", "question-full"
    if intent in ("reaction", "agreement", "disagreement") and len(text) <= 60:
        if len(text) <= 14:
            return "reaction", "reaction-hit"
        return "reaction", "reaction-small"
    if "normativa" in refs:
        return "document", "document-card"
    if intent == "warning":
        return "warning", "warning-focus"
    if intent == "transition":
        return "transition", "transition-line"
    if '"' in text or "“" in text:
        return "quote", "quote-card"
    if intent in ("explanation", "clarification", "summary"):
        ns = len(_sentences(text))
        if ns >= 3:
            return "explanation", "explanation-steps"
        if _keywords(text):
            return "explanation", "explanation-keywords"
        return "explanation", "explanation-stack"
    return "conversation", ""  # variante estructural abajo


_CONV_VARIANT = {
    "Eduardo": "conversation-center",
    "Andrea": "conversation-open",
    "Javier Ríos": "conversation-left",
    "Rodrigo Torres": "conversation-right",
    "Valeria Soto": "conversation-center",
}


def _transition_for(prev_kind: str, timing: str) -> str:
    if timing in ("interruption",):
        return "interrupt"
    if timing in ("new_topic", "section"):
        return "section"
    if timing in ("reflection",):
        return "soft"
    if prev_kind in ("question",):
        return "quick"
    return "soft"


def _density(events: list[dict]) -> None:
    scored = sorted(
        [(e.get("importance", 0.4), i) for i, e in enumerate(events)],
        reverse=True)
    n = len(events)
    # Tope impact ≤12 % del tiempo: solo los de mayor importancia.
    impact_budget = max(1, int(n * 0.12))
    impact_ids = {i for _, i in scored[:impact_budget]}
    for rank, (_, i) in enumerate(scored):
        e = events[i]
        if i in impact_ids and e["scene_type"] in (
                "number", "question", "brand", "closing", "reaction", "warning"):
            e["density"] = "impact"
        elif e["scene_type"] in ("number", "question", "brand", "closing",
                                 "warning", "document", "reaction"):
            e["density"] = "focus"
        elif len(e.get("display_text", "")) < 40 and e.get("energy", 0.5) < 0.45:
            e["density"] = "quiet"
        else:
            e["density"] = "normal"


def build_visual_timeline(segments: list[dict], duration_s: float) -> dict:
    events: list[dict] = []
    t = 0.0
    prev_kind = ""
    prev_speaker = ""
    phrase = 0
    for s in segments:
        dur = float(s.get("duration_s") or 0)
        gap = float(s.get("gap_before_ms") or 0) / 1000.0
        start = max(0.0, t + gap)
        text = s.get("text") or ""
        refs = _find_refs(text)
        kind, variant = _scene_variant(s, text, refs, dur)
        if kind == "conversation":
            variant = _CONV_VARIANT.get(s.get("speaker"), "conversation-center")
        timing = s.get("timing", "normal")
        # Frase visual: continúa si mismo concepto (mismo speaker o reacción
        # breve encadenada, sin sección y gap corto).
        cont = (events and s.get("speaker") == prev_speaker
                and kind in ("conversation", "reaction")
                and gap >= 0 and gap < 0.4
                and not s.get("section_boundary", False))
        if not cont:
            phrase += 1
        emphasis = list(s.get("emphasis_words") or [])[:3]
        ev = {
            "beat_id": s.get("beat_id", s.get("id")),
            "speaker": s.get("speaker"),
            "start": round(start, 2),
            "end": round(start + dur, 2),
            "intent": s.get("intent", "statement"),
            "energy": float(s.get("energy", 0.5) or 0.5),
            "importance": _importance(s, dur),
            "scene_type": kind,
            "variant": variant,
            "phrase_id": phrase,
            "hold": bool(cont),
            "display_text": text,
            "essential": essential_text(text, kind),
            "emphasis_words": emphasis,
            "keywords": _keywords(text),
            "transition": _transition_for(prev_kind, timing),
            "layout_variant": _CONV_VARIANT.get(s.get("speaker"), "conversation-center")
            if kind == "conversation" else "center",
            "refs": refs,
            "section": bool(s.get("section_boundary", False)),
            "overlap": bool(float(s.get("overlap_ms") or 0) > 0),
        }
        events.append(ev)
        prev_kind = kind
        prev_speaker = s.get("speaker", "")
        t = start + dur
    _density(events)
    return {"duration_s": round(duration_s, 2), "events": events}
