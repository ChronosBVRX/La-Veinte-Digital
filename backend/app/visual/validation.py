"""Validación pre-render del timeline visual. Crítico = needs-review (no render)."""
from __future__ import annotations

from .timeline_builder import SCENE_TYPES

VARIANTS = {
    "brand": {"brand-full"}, "conversation": {"conversation-center",
    "conversation-left", "conversation-right", "conversation-open"},
    "question": {"question-full", "question-focus", "question-dialogue"},
    "reaction": {"reaction-hit", "reaction-small"},
    "number": {"number-hero"}, "document": {"document-card"},
    "explanation": {"explanation-stack", "explanation-steps",
                    "explanation-keywords"},
    "warning": {"warning-focus"}, "quote": {"quote-card"},
    "transition": {"transition-line"}, "closing": {"closing-full"},
    "speaker_focus": {"conversation-center", "conversation-left", "conversation-right", "conversation-open"},
    "brand_opening": {"brand-full"}, "brand_closing": {"closing-full"},
    "real_building": {"building-hero", "conversation-center"},
    "organization_context": {"organization-card", "conversation-center"},
    "document_cover": {"document-card", "conversation-center"},
    "topic_image": {"topic-card", "conversation-center"},
    "stat_card": {"number-hero", "stat-card", "conversation-center"},
    "comparison": {"comparison-card", "conversation-center"},
    "payroll_visual": {"payroll-card", "conversation-center"},
}

KNOWN = {"Eduardo", "Andrea", "Javier Ríos", "Javier Rios", "Rodrigo Torres",
         "Valeria Soto", "Solo esto", "Solo recordarles"}


def validate_visual_timeline(timeline: dict, duration_s: float) -> dict:
    blocking: list[str] = []
    warnings: list[str] = []
    events = timeline.get("events", []) if isinstance(timeline, dict) else []
    if not events:
        return {"ok": False, "blocking": ["timeline visual vacío"],
                "warnings": []}
    prev_end = 0.0
    seen = set()
    for e in events:
        bid = e.get("beat_id", "?")
        st, en = float(e.get("start", -1)), float(e.get("end", -1))
        if en <= st:
            blocking.append(f"{bid} termina antes de iniciar")
        if en > duration_s + 0.05:
            blocking.append(f"{bid} rebasa la duración del WAV")
        if bid in seen:
            blocking.append(f"beat_id duplicado: {bid}")
        seen.add(bid)
        spk = e.get("speaker")
        if spk not in KNOWN and not (spk in ("", None, "La Veinte Radio") and e.get("scene_type") in ("brand", "closing", "brand_opening", "brand_closing")):
            blocking.append(f"speaker desconocido: {spk} ({bid})")
        if e.get("scene_type") not in SCENE_TYPES:
            blocking.append(f"escena inválida: {e.get('scene_type')} ({bid})")
        allowed = VARIANTS.get(e.get("scene_type"), set())
        if allowed and e.get("variant") not in allowed:
            blocking.append(f"variante inválida: {e.get('variant')} ({bid})")
        if e.get("density") not in ("quiet", "normal", "focus", "impact", None):
            blocking.append(f"densidad inválida ({bid})")
        for w in e.get("emphasis_words", [])[:3]:
            if w.lower() not in (e.get("display_text") or "").lower():
                blocking.append(f"énfasis ausente en texto ({bid}): {w}")
        if e.get("scene_type") == "document" and not e.get("refs", {}).get("normativa"):
            blocking.append(f"document sin normativa validada ({bid})")
        prev_end = max(prev_end, en)
    # Overlaps controlados: como máximo solapes breves.
    overs = [e for e in events if float(e.get("start", 0)) < prev_end and e != events[0]]
    return {"ok": not blocking, "blocking": blocking, "warnings": warnings}
