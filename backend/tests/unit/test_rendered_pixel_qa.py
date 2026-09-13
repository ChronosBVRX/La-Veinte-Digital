"""Tests de Pixel QA y Calidad Visual Documental V4 para La Veinte Radio.

Verifica:
1. Biblioteca de personajes (5 personajes x 6 variantes PNG con transparencia).
2. Renderizado de speaker_focus con character library (varianza de píxeles real, std dev > 15).
3. Activos fotográficos documentales (existencia, formato y no vacuidad).
4. Cero beats fantasma en VisualEditorialPlanner (todos los beats EVIDENCIA/CONTEXTO tienen asset o chart).
5. Salvaguarda estricta de fallback en Renderer (nunca pantalla vacía/negra).
"""
import pytest
from pathlib import Path
from PIL import Image, ImageStat
import numpy as np

from backend.app.visual.editorial.scene_composer import SceneComposer
from backend.app.visual.editorial.visual_editorial_planner import VisualEditorialPlanner
from backend.app.visual.renderer import Renderer


REPO_ROOT = Path(__file__).resolve().parents[3]
CHARACTERS_DIR = REPO_ROOT / "assets" / "editorial" / "characters"
CONTEXT_DIR = REPO_ROOT / "assets" / "editorial" / "context"


def test_character_library_complete():
    """Verifica que los 5 personajes tengan sus 6 variantes requeridas en PNG RGBA."""
    speakers = ["eduardo", "andrea", "javier", "rodrigo", "valeria"]
    variants = ["neutral", "explaining", "listening", "serious", "question", "emphasis"]

    for spk in speakers:
        spk_dir = CHARACTERS_DIR / spk
        assert spk_dir.exists(), f"Directorio de personaje falta: {spk}"
        for var in variants:
            p = spk_dir / f"{var}.png"
            assert p.exists(), f"Variante {var} falta para {spk}"
            with Image.open(p) as im:
                assert im.mode == "RGBA", f"{p} debe ser RGBA"
                assert im.width > 200 and im.height > 200, f"{p} resolucion insuficiente"


def test_photographic_context_assets():
    """Verifica que los activos contextuales fotográficos existan en 16:9 y 9:16 y tengan textura real."""
    required = [
        "hospital_corridor",
        "administrative_office_imss",
        "worker_reviewing_payslip",
        "worker_reviewing_document",
    ]
    for key in required:
        for suffix in [".webp", "_9x16.webp"]:
            p = CONTEXT_DIR / f"{key}{suffix}"
            assert p.exists(), f"Activo documental no existe: {p}"
            with Image.open(p) as im:
                stat = ImageStat.Stat(im)
                std = np.mean(stat.stddev)
                assert std > 20.0, f"Activo {p} parece plano/vacío (std={std:.1f})"


def test_speaker_focus_pixel_qa():
    """Verifica que el render de speaker_focus tenga contraste y varianza real (std dev > 15)."""
    composer = SceneComposer()
    base = Image.new("RGB", (1920, 1080), (14, 17, 23))

    for spk in ["eduardo", "andrea", "javier", "rodrigo", "valeria"]:
        frame = composer.render_speaker_character_scene(
            base_img=base,
            speaker_name=spk,
            rol="Conductor Titular",
            w=1920,
            h=1080,
            vertical=False,
            variant="neutral",
            headline="ANÁLISIS DOCUMENTAL",
            subheadline="Dirección Audiovisual La Veinte",
            progress=0.5,
            react_val=0.5,
        )
        assert frame.size == (1920, 1080)
        stat = ImageStat.Stat(frame)
        std = np.mean(stat.stddev)
        assert std > 15.0, f"Frame de speaker {spk} tiene varianza baja (std={std:.1f})"


def test_zero_ghost_beats_in_planner():
    """Verifica que el planificador nunca emita beats EVIDENCIA o CONTEXTO sin asset ni chart."""
    import json
    proj_path = REPO_ROOT / "data" / "projects" / "d5f1fc16" / "project.json"
    assert proj_path.exists()
    p = json.loads(proj_path.read_text(encoding="utf-8"))
    dur = p.get("duration_s") or p.get("alignment", {}).get("durationMs", 0) / 1000.0

    planner = VisualEditorialPlanner()
    plan = planner.plan_project(
        project_id=p["id"],
        turns=p["script"]["turns"],
        alignment=p["alignment"],
        duration_s=dur,
        orientation="16:9",
        direction="documental",
    )

    for b in plan.beats:
        fn = b.get("visual_function")
        if fn in ("EVIDENCIA", "CONTEXTO"):
            has_asset = bool(b.get("resolved_asset") and b["resolved_asset"].get("file"))
            has_chart = bool(b.get("chart_type"))
            assert has_asset or has_chart, f"Ghost beat detectado: {b.get('beat_id')}"


def test_renderer_fallback_guard():
    """Verifica que el renderer nunca dibuje una pantalla negra ante un beat malformado."""
    renderer = Renderer(layout="preview")
    # Evento malformado sin asset y sin chart marcado como EVIDENCIA
    ghost_ev = {
        "beat_id": "test-ghost-beat",
        "speaker": "Eduardo",
        "start": 0.0,
        "end": 4.0,
        "scene_type": "document_cover",
        "visual_function": "EVIDENCIA",
        "resolved_asset": None,
        "chart_type": None,
        "display_text": "Texto de prueba",
    }
    char_dict = {"shape": "circles", "accent": (245, 158, 11), "rol": "Conductor"}
    frame = renderer.frame(f=10, fps=24, ev=ghost_ev, char=char_dict, env=[0.5], local_f=10, dur_f=96)

    stat = ImageStat.Stat(frame)
    std = np.mean(stat.stddev)
    # Debe haber caído limpiamente en speaker_focus con personaje, nunca una pantalla negra (std > 15)
    assert std > 15.0, f"El renderer produjo una pantalla vacía/negra ante un ghost beat (std={std:.1f})"
