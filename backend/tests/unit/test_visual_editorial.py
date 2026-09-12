"""Suite de pruebas unitarias para el motor visual editorial de La Veinte Radio.

Valida:
- Detección exhaustiva de entidades del mundo laboral e institucional.
- Investigación jerárquica de referencias oficiales y trazabilidad de licencias.
- Prioridad del AssetResolver y penalización por repetición.
- Salvaguarda estricta contra falsa atribución de unidades no verificadas.
- Preservación inmutable de la duración canónica en VisualPlan.
- Generación de gráficos programáticos y cumplimiento de áreas de seguridad (safe zones).
"""
import json
from pathlib import Path
import pytest
from PIL import Image

from app.visual.editorial import (
    EntityDetector,
    DetectedEntity,
    ReferenceResearcher,
    ReferenceRegistry,
    AssetRegistry,
    AssetItem,
    AssetResolver,
    VisualEditorialPlanner,
    ProgrammaticChartRenderer,
)


def test_entity_detector_categories():
    detector = EntityDetector()
    text = (
        "El Sindicato Nacional de Trabajadores del Seguro Social presentó un "
        "incremento ponderado de 8.55% en el Congreso del SNTSS, dividiendo "
        "2.9% al sueldo tabular y 3.9% al Concepto once conforme a la Cláusula 63 Bis "
        "del Contrato Colectivo de Trabajo 2025-2027. Además, para los trabajadores "
        "de Nueva Generación se incluye 1.75% en la Cláusula 157. Según el artículo "
        "399 Bis de la Ley Federal del Trabajo ante el CFCRL, no se requiere consulta, "
        "pero el artículo 400 Bis exige voto libre y secreto en revisiones integrales. "
        "Esto fue reportado en el Hospital General Regional No. 1 Charo del IMSS."
    )
    ents = detector.detect_in_text(text)
    names = {e.name: e.category for e in ents}

    # Organizaciones
    assert "IMSS" in names
    assert names["IMSS"] == "organization"
    assert "SNTSS" in names
    assert "CFCRL" in names

    # Documentos y Leyes
    assert "Contrato Colectivo de Trabajo" in names
    assert names["Contrato Colectivo de Trabajo"] == "document"
    assert "Ley Federal del Trabajo" in names
    assert "Artículo 399 Bis LFT" in names
    assert "Artículo 400 Bis LFT" in names

    # Cláusulas y Conceptos
    assert "Cláusula 63 Bis CCT" in names
    assert "Cláusula 157 CCT" in names
    assert "Concepto 11 - Ayuda de Renta" in names
    assert "Concepto 02 - Sueldo Tabular" in names

    # Cifras
    assert "8.55% Incremento Ponderado" in names
    assert "2.9% Sueldo Tabular" in names
    assert "3.9% Concepto 11" in names
    assert "1.75% Cláusula 157 (Retiro)" in names

    # Edificios y Eventos
    assert "Hospital General Regional No. 1 Charo" in names
    assert names["Hospital General Regional No. 1 Charo"] == "hospital"
    assert "Congreso Nacional SNTSS" in names


def test_reference_researcher_hierarchy_and_provenance():
    researcher = ReferenceResearcher()
    ref_imss = researcher.registry.get("imss_official_identity")
    assert ref_imss is not None
    assert ref_imss.status == "verified"
    assert any("imss.gob.mx" in s["url"] or "wikimedia.org" in s["url"] for s in ref_imss.sources)
    assert ref_imss.sources[0]["license"] in ("official", "public-domain", "reference-only")

    ref_cct = researcher.registry.get("cct_imss_sntss_2025_2027")
    assert ref_cct is not None
    assert ref_cct.verified_characteristics["edition"] == "2025-2027"
    assert "63_bis" in ref_cct.verified_characteristics["verified_clauses"]


def test_asset_resolver_priority_and_repetition_penalty():
    asset_reg = AssetRegistry()
    ref_reg = ReferenceRegistry()
    resolver = AssetResolver(asset_registry=asset_reg, reference_registry=ref_reg, min_reuse_interval_s=60.0)

    # 1. Prioridad: coincidencia exacta por entidad
    ent_charo = [DetectedEntity(name="Hospital General Regional No. 1 Charo", category="hospital", raw_text="HGR 1")]
    res1 = resolver.resolve(ent_charo, current_time_s=10.0, orientation="16:9")
    assert res1.resolution_method == "exact_entity"
    assert res1.asset_id == "hgr1_charo_exterior_asset"

    # 2. Penalización por repetición dentro del intervalo de 60s
    res2 = resolver.resolve(ent_charo, current_time_s=30.0, orientation="16:9")
    # Al estar penalizado recientemente, debe evitar repetir el mismo asset
    assert res2.asset_id != "hgr1_charo_exterior_asset"

    # 3. Tras expirar el intervalo (elapsed >= 60s), el asset vuelve a ser elegible
    res3 = resolver.resolve(ent_charo, current_time_s=75.0, orientation="16:9")
    assert res3.asset_id == "hgr1_charo_exterior_asset"


def test_anti_false_attribution_guard():
    resolver = AssetResolver()
    # Entidad hospitalaria no verificada (UMF 999 sin referencia)
    ent_unverified = [DetectedEntity(name="Unidad de Medicina Familiar IMSS", category="clinic", raw_text="UMF 999", attributes={"generic": True})]
    res = resolver.resolve(ent_unverified, current_time_s=10.0, orientation="16:9")

    # No debe atribuirse como una unidad específica verificada
    if res.asset_id:
        asset = resolver.assets.get(res.asset_id)
        assert asset.type == "generic" or not asset.based_on_verified_references
        assert res.entity != "UMF 999"


def test_programmatic_charts_rendering_and_safe_zones():
    charts = ProgrammaticChartRenderer()

    # Probar renderizado en 16:9 y 9:16
    for vertical, w, h in [(False, 1920, 1080), (True, 1080, 1920)]:
        card_stat = charts.render_stat_breakdown_card(w, h, vertical=vertical)
        assert isinstance(card_stat, Image.Image)
        assert card_stat.size == (w, h)

        card_comp = charts.render_comparison_card(w, h, vertical=vertical)
        assert isinstance(card_comp, Image.Image)
        assert card_comp.size == (w, h)

        card_pay = charts.render_payroll_simulation_card(w, h, vertical=vertical)
        assert isinstance(card_pay, Image.Image)
        assert card_pay.size == (w, h)

        card_ret = charts.render_retirement_timeline_card(w, h, vertical=vertical)
        assert isinstance(card_ret, Image.Image)
        assert card_ret.size == (w, h)

        # En vertical (9:16), verificar que el contenido no dibuje fuera de platform-safe [70, 200, 940, 1450]
        if vertical:
            bbox = card_stat.getbbox()
            assert bbox is not None
            x0, y0, x1, y1 = bbox
            assert x0 >= 70, f"x0 ({x0}) rebasó safeLeft (70)"
            assert x1 <= 940, f"x1 ({x1}) rebasó safeRight (940)"
            assert y0 >= 200, f"y0 ({y0}) rebasó safeTop (200)"
            assert y1 <= 1450, f"y1 ({y1}) rebasó safeBottom (1450)"


def test_visual_plan_preserves_duration_and_preroll():
    root = Path(__file__).resolve().parents[3]
    project_dir = root / "data" / "projects" / "d5f1fc16"
    if not (project_dir / "script.json").exists() or not (project_dir / "timeline-alignment.json").exists():
        pytest.skip("Archivos del episodio d5f1fc16 no disponibles en esta ruta")

    script = json.loads((project_dir / "script.json").read_text(encoding="utf-8"))
    turns = script.get("turns") or [t for s in script.get("scenes", []) for t in s.get("turns", [])]
    alignment = json.loads((project_dir / "timeline-alignment.json").read_text(encoding="utf-8"))
    duration_s = (alignment.get("durationMs") or 735969) / 1000.0

    planner = VisualEditorialPlanner()
    plan = planner.plan_project("d5f1fc16", turns, alignment, duration_s, orientation="16:9")

    # Duración canónica idéntica
    assert abs(plan.duration_s - duration_s) < 0.01

    # Preroll institucional de apertura: speaker vacío
    first_beat = plan.beats[0]
    assert first_beat["scene_type"] == "brand_opening"
    assert first_beat["speaker"] == ""
    assert first_beat["start_s"] == 0.0

    # Cierre institucional: speaker vacío
    last_beat = plan.beats[-1]
    assert last_beat["scene_type"] == "brand_closing"
    assert last_beat["speaker"] == ""
    assert last_beat["end_s"] == round(duration_s, 2)

    # Mix visual equilibrado
    assert 35.0 <= plan.visual_mix["speaker_focus_pct"] <= 60.0
    assert 10.0 <= plan.visual_mix["real_reference_broll_pct"] <= 35.0
    assert 15.0 <= plan.visual_mix["cards_charts_pct"] <= 35.0
