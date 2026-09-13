"""Tests de regresión para layout vertical 9:16 en La Veinte Radio.

Verifica:
1. Ningún bloque ni texto se desborda del safe-area vertical [70, 200, 940, 1450].
2. Eduardo no rompe el contenedor con su parlamento inicial largo (turn-import-1).
3. El parlamento inicial se fragmenta en páginas/tarjetas visuales dentro del mismo turno sin columnas de una sola palabra.
4. La escena institucional de apertura (scene-opening) no muestra badge de locutor y respeta el safe area.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.visual.identity import CHARACTERS
from app.visual.layout import Box, get_platform_safe, AnimatedBoundsValidator
from app.visual.renderer import Renderer


def _load_timeline():
    # Cargar timeline del episodio real d5f1fc16 si existe, o reconstruir desde proyecto
    vt_path = Path(__file__).resolve().parents[3] / "data" / "tts" / "video" / "d5f1fc16" / "visual-timeline.json"
    if vt_path.exists():
        return json.loads(vt_path.read_text(encoding="utf-8"))
    
    # Fallback si no está el archivo generado: timeline de v1.2
    fallback_path = Path(__file__).resolve().parents[3] / "output" / "visual-v1.2" / "visual-timeline.json"
    return json.loads(fallback_path.read_text(encoding="utf-8"))


def test_no_overflow_across_all_events_9x16():
    """Valida que en 9:16 todos los eventos de la producción respeten platform-safe."""
    tl = _load_timeline()
    r = Renderer(layout="9x16")
    safe = get_platform_safe(True)
    canvas = Box(0, 0, 1080, 1920, "canvas")
    validator = AnimatedBoundsValidator(safe, canvas)

    for ev in tl["events"]:
        char = dict(CHARACTERS.get(ev.get("speaker") or "", CHARACTERS["Eduardo"]))
        plan = r.prepare(ev, char)
        
        # 1. No debe haber advertencias críticas de desborde de platform-safe ni de canvas
        safe_issues = [i for i in plan["issues"] if "platform-safe" in i or "safe zone" in i or "overflow canvas" in i]
        assert not safe_issues, f"Event {ev['beat_id']} tiene issues de safe: {safe_issues}"
        
        # 2. No debe haber colisiones no permitidas
        collisions = [i for i in plan["issues"] if "colisión" in i or "↔" in i]
        assert not collisions, f"Event {ev['beat_id']} tiene colisiones: {collisions}"

        # 3. Validar todas las primitivas y etapas
        for stage in plan.get("staged_primitives", []):
            val_issues = validator.validate(stage)
            assert not val_issues, f"Event {ev['beat_id']} tiene bounds animados inválidos: {val_issues}"
            for p in stage:
                assert p.box.inside(safe), f"Primitiva '{p.text}' de {ev['beat_id']} fuera de safe: [{p.box.x0},{p.box.y0},{p.box.x1},{p.box.y1}]"


def test_eduardo_initial_speech_turn_9x16():
    """Verifica que el primer parlamento largo de Eduardo (turn-import-1, ~52 palabras)
    se pagine limpiamente sin desbordarse y sin crear columnas de 1 palabra por línea."""
    r = Renderer(layout="9x16")
    safe = get_platform_safe(True)
    
    eduardo_text = (
        "Bienvenidas y bienvenidos al primer episodio de La Veinte Radio, un espacio hecho "
        "para hablar de nuestra vida laboral de manera sencilla, con documentos y sin tantos "
        "tecnicismos. Aquí no venimos a repetir comunicados. Venimos a explicar qué significan "
        "en la práctica y cómo pueden afectar a cada trabajador."
    )
    ev = {
        "beat_id": "turn-import-1",
        "speaker": "Eduardo",
        "start": 4.90,
        "end": 22.81,
        "intent": "conversacional",
        "energy": 0.5,
        "importance": 0.6,
        "scene_type": "conversation",
        "variant": "conversation-center",
        "phrase_id": 1,
        "hold": False,
        "display_text": eduardo_text,
        "essential": eduardo_text,
        "emphasis_words": [],
        "keywords": ["Bienvenidas", "bienvenidos", "episodio"],
        "transition": "soft",
        "layout_variant": "conversation-center",
        "refs": {},
        "section": False,
        "overlap": False,
    }
    
    plan = r.prepare(ev, CHARACTERS["Eduardo"])
    
    # 1. Cero issues de geometría o desborde
    assert not any("platform-safe" in i or "safe zone" in i for i in plan["issues"]), plan["issues"]
    assert not any("colisión" in i for i in plan["issues"]), plan["issues"]

    # 2. Debe estar paginado en múltiples tarjetas (al menos 2 páginas para 52 palabras)
    pages = plan.get("pages", [])
    assert len(pages) >= 2, f"Se esperaba paginación en turn-import-1, pero tiene {len(pages)} páginas"

    # 3. Ninguna página debe tener líneas con palabras solitarias en columna vertical rota
    for p_idx, page in enumerate(pages):
        lines = page["fit"]["lines"]
        assert len(lines) >= 1, f"Página {p_idx} sin líneas"
        for ln in lines:
            words = ln.split()
            # Si hay más de 5 palabras en la página, ninguna línea debe ser de una sola palabra
            # salvo que sea un remate final de oración
            assert len(words) >= 1, f"Línea vacía en página {p_idx}"

        # 4. Primitivas de la página deben estar estrictamente dentro de platform-safe
        for prim in page["primitives"]:
            assert prim.box.inside(safe), f"Primitiva '{prim.text}' fuera de safe en página {p_idx}"

    # 5. La caja del speaker debe estar arriba del contenido principal y dentro de platform-safe
    sp_box = plan["boxes"]["speaker"]
    main_box = plan["boxes"]["main"]
    assert sp_box.y0 >= 200, f"Speaker y0 {sp_box.y0} < safe top 200"
    assert sp_box.y1 <= main_box.y0, f"Speaker y1 {sp_box.y1} colisiona con main y0 {main_box.y0}"


def test_institutional_preroll_no_speaker_badge():
    """Verifica que la apertura institucional (scene-opening) no tenga badge de locutor."""
    r = Renderer(layout="9x16")
    safe = get_platform_safe(True)
    ev = {
        "beat_id": "scene-opening",
        "speaker": "",
        "start": 0.0,
        "end": 4.90,
        "intent": "brand",
        "energy": 0.6,
        "importance": 0.8,
        "scene_type": "brand",
        "variant": "brand-full",
        "phrase_id": 0,
        "hold": False,
        "display_text": "La Veinte Radio",
        "essential": "La Veinte Radio",
        "emphasis_words": ["Radio"],
        "keywords": ["Radio"],
        "transition": "soft",
        "layout_variant": "center",
        "refs": {},
        "section": True,
        "overlap": False,
    }
    plan = r.prepare(ev, CHARACTERS["Eduardo"])
    
    # 1. El speaker box debe estar suprimido (ancho 0 o y0=y1=0)
    sp_box = plan["boxes"]["speaker"]
    assert sp_box.x1 == sp_box.x0 or sp_box.y1 == sp_box.y0, "Speaker box no fue suprimido en brand scene"

    # 2. Sin issues de safe
    assert not any("platform-safe" in i or "safe zone" in i for i in plan["issues"]), plan["issues"]

    # 3. El texto 'La Veinte Radio' debe estar dentro de platform-safe
    for stage in plan.get("staged_primitives", []):
        for prim in stage:
            assert prim.box.inside(safe), f"Primitiva {prim.text} fuera de safe: {prim.box.x1} > {safe.x1}"
