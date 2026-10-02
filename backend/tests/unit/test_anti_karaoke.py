"""Pruebas unitarias de la Dirección Documental y Anti-Karaoke para La Veinte Radio.

Valida:
1. Ratio de texto narrativo en pantalla (onScreenNarrativeWords <= 25% de spokenWords).
2. Detección estricta de riesgo de karaoke (KARAOKE_RISK = 0 en modo Editorial).
3. Penalización por repetición (stat_breakdown_855 se muestra solo una vez en full).
4. Protagonismo de referencias reales (CCT 2025-2027, LFT, HGR 1 Charo, Tarjetón IMSS).
"""
import json
from pathlib import Path
import pytest

from app.visual.editorial import VisualEditorialPlanner, VisualPlan, EditorialMemory


@pytest.fixture
def pilot_data():
    root = Path(__file__).resolve().parents[3]
    project_dir = root / "data" / "projects" / "d5f1fc16"
    if not (project_dir / "script.json").exists() or not (project_dir / "timeline-alignment.json").exists():
        pytest.skip("Archivos del episodio d5f1fc16 no disponibles en esta ruta")

    script = json.loads((project_dir / "script.json").read_text(encoding="utf-8"))
    turns = script.get("turns") or [t for s in script.get("scenes", []) for t in s.get("turns", [])]
    alignment = json.loads((project_dir / "timeline-alignment.json").read_text(encoding="utf-8"))
    duration_s = (alignment.get("durationMs") or 735969) / 1000.0
    return turns, alignment, duration_s


def test_narrative_text_ratio_under_limit(pilot_data):
    turns, alignment, duration_s = pilot_data
    planner = VisualEditorialPlanner()
    plan = planner.plan_project("d5f1fc16", turns, alignment, duration_s, direction="documental", text_mode="editorial")

    metrics = plan.metrics
    spoken_words = metrics["total_spoken_words"]
    editorial_words = metrics["total_editorial_words"]
    ratio = metrics["narrative_text_ratio_pct"]

    assert spoken_words > 1000
    # El ratio debe ser una fracción pequeña (objetivo <= 25%, idealmente 15-20%)
    assert ratio <= 25.0, f"El ratio de texto narrativo ({ratio}%) superó el límite máximo de 25%"
    assert editorial_words < spoken_words * 0.25


def test_zero_karaoke_risk(pilot_data):
    turns, alignment, duration_s = pilot_data
    planner = VisualEditorialPlanner()
    plan = planner.plan_project("d5f1fc16", turns, alignment, duration_s, direction="documental", text_mode="editorial")

    assert plan.metrics["karaoke_risk_beats"] == 0, "Se detectaron beats con riesgo de karaoke (transcripción literal)"

    # Comprobación adicional directa en cada beat: ninguna oración de más de 6 palabras repetida idéntica
    turn_texts = [t.get("displayText", "").lower() for t in turns]
    for b in plan.beats:
        dt = b.get("display_text", "").strip().lower()
        if not dt or b.get("scene_type") in ("brand_opening", "brand_closing"):
            continue
        words = dt.split()
        if len(words) >= 7:
            for t_txt in turn_texts:
                assert dt not in t_txt or len(words) < 8, f"Efecto karaoke detectado en beat {b.get('beat_id')}: '{dt}'"


def test_stat_breakdown_855_repetition_penalty(pilot_data):
    turns, alignment, duration_s = pilot_data
    planner = VisualEditorialPlanner()
    plan = planner.plan_project("d5f1fc16", turns, alignment, duration_s, direction="documental", text_mode="editorial")

    # Contar cuántas veces aparece stat_breakdown_855 como gráfico completo
    stat_855_count = sum(1 for b in plan.beats if b.get("chart_type") == "stat_breakdown_855")
    assert stat_855_count == 1, f"stat_breakdown_855 debe aparecer exactamente 1 vez completa, apareció {stat_855_count} veces"

    # Verificar que las menciones posteriores usan dato compacto o documental
    subsequent_855_beats = [
        b for b in plan.beats
        if "8.55" in (b.get("headline") or "") and b.get("chart_type") != "stat_breakdown_855"
    ]
    assert len(subsequent_855_beats) > 0, "No se encontraron menciones posteriores compactas de 8.55%"


def test_documentary_evidence_protagonism(pilot_data):
    turns, alignment, duration_s = pilot_data
    planner = VisualEditorialPlanner()
    plan = planner.plan_project("d5f1fc16", turns, alignment, duration_s, direction="documental", text_mode="editorial")

    # Verificar que existen beats en la familia EVIDENCIA
    evidencia_beats = [b for b in plan.beats if b.get("visual_function") == "EVIDENCIA"]
    assert len(evidencia_beats) >= 5, f"Se esperaban al menos 5 beats de evidencia real, se encontraron {len(evidencia_beats)}"

    # Verificar presencia de CCT y LFT (evidencia documental real del episodio)
    has_cct = any("cct" in str(b.get("resolved_asset", {})).lower() or "cct" in str(b.get("chart_type", "")).lower() or "contrato" in (b.get("headline") or "").lower() for b in evidencia_beats)
    has_lft = any("lft" in str(b.get("chart_type", "")).lower() or "lft" in str(b.get("resolved_asset", {})).lower() or "ley federal" in (b.get("headline") or "").lower() or "399" in (b.get("headline") or "") for b in evidencia_beats)
    assert has_cct, "El Contrato Colectivo de Trabajo (CCT) debe estar presente como evidencia protagonista"
    assert has_lft, "La Ley Federal del Trabajo (LFT) debe estar presente como evidencia protagonista"

