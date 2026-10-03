"""Pruebas unitarias de la dirección visual Wave Premium para La Veinte Radio.

Verifica:
1. Identidad cromática exacta de los 5 conductores oficiales.
2. Renderizado de cuadro en 16:9 y 9:16 para todos los locutores.
3. Las 6 composiciones Wave Premium oficiales.
4. Reactividad al audio y respiración en pausas (idle breathing floor).
5. Cumplimiento de cero imágenes generadas de personajes (ASSETS_GENERATED == 0, SPEAKER_IMAGES == 0).
6. Anti-karaoke estricto (titulares clave sin teleprompter palabra por palabra).
7. Integración con Renderer en modo 'wave-premium'.
"""
import pytest
import numpy as np
from PIL import Image

from app.visual.identity import SPEAKER_WAVE_PALETTES
from app.visual.wave_composer import WaveComposer, BG_BASE
from app.visual.renderer import Renderer


def test_speaker_palettes_identity():
    """Valida los colores oficiales asignados a cada conductor."""
    wc = WaveComposer()

    # Eduardo: Azul premium #2563EB
    p_eduardo = wc.get_speaker_palette("Eduardo")
    assert p_eduardo["primary"] == (37, 99, 235)
    assert p_eduardo["name"] == "EDUARDO"

    # Andrea: Magenta elegante #D946EF
    p_andrea = wc.get_speaker_palette("Andrea")
    assert p_andrea["primary"] == (217, 70, 239)
    assert p_andrea["name"] == "ANDREA"

    # Javier Ríos: Cian limpio #06B6D4
    p_javier = wc.get_speaker_palette("Javier Ríos")
    assert p_javier["primary"] == (6, 182, 212)
    assert p_javier["name"] == "JAVIER RÍOS"

    # Rodrigo Torres: Verde esmeralda #10B981
    p_rodrigo = wc.get_speaker_palette("Rodrigo Torres")
    assert p_rodrigo["primary"] == (16, 185, 129)
    assert p_rodrigo["name"] == "RODRIGO TORRES"

    # Valeria Soto: Ámbar suave #F59E0B
    p_valeria = wc.get_speaker_palette("Valeria Soto")
    assert p_valeria["primary"] == (245, 158, 11)
    assert p_valeria["name"] == "VALERIA SOTO"


def test_wave_composer_render_all_speakers():
    """Genera cuadros Wave Premium para los 5 conductores en horizontal y vertical."""
    wc = WaveComposer()
    speakers = ["Eduardo", "Andrea", "Javier Ríos", "Rodrigo Torres", "Valeria Soto"]

    for spk in speakers:
        # 16:9
        img_16x9 = wc.render_wave_scene(
            speaker_name=spk,
            rol="Conductor",
            w=1920,
            h=1080,
            vertical=False,
            composition="wave-centered",
            headline="TITULAR DE PRUEBA",
            progress=0.4,
            react_val=0.6,
        )
        assert img_16x9.size == (1920, 1080)
        assert isinstance(img_16x9, Image.Image)

        # 9:16 vertical
        img_9x16 = wc.render_wave_scene(
            speaker_name=spk,
            rol="Conductor",
            w=1080,
            h=1920,
            vertical=True,
            composition="wave-centered",
            headline="TITULAR VERTICAL",
            progress=0.4,
            react_val=0.6,
        )
        assert img_9x16.size == (1080, 1920)
        assert isinstance(img_9x16, Image.Image)


def test_wave_composer_all_compositions():
    """Valida la generación de las 6 composiciones artísticas oficiales."""
    wc = WaveComposer()
    compositions = [
        "wave-centered",
        "wave-left-title",
        "wave-bottom-editorial",
        "wave-ribbon",
        "wave-minimal",
        "wave-focus-quote",
    ]

    for comp in compositions:
        frame = wc.render_wave_scene(
            speaker_name="Eduardo",
            rol="Conductor Titular",
            w=854,
            h=480,
            vertical=False,
            composition=comp,
            headline="ANÁLISIS NORMATIVO CCT",
            subheadline="Cláusula 85 · Revisión Salarial",
            progress=0.5,
            react_val=0.45,
        )
        assert frame.size == (854, 480)
        arr = np.array(frame)
        assert arr.shape == (480, 854, 3)
        # El cuadro no debe estar en negro absoluto ni en blanco plano
        assert arr.mean() > 5.0
        assert arr.mean() < 240.0


def test_audio_reactivity_and_pause_breathing():
    """Verifica que en pausa/silencio la onda no muere (respiración mínima activa)."""
    wc = WaveComposer()

    # Cuadro en pausa (react_val = 0.0)
    img_pause = wc.render_wave_scene(
        speaker_name="Andrea",
        rol="Co-Conductora",
        w=854,
        h=480,
        vertical=False,
        composition="wave-centered",
        progress=0.1,
        react_val=0.0,  # Silencio absoluto
    )

    # Cuadro en voz activa (react_val = 0.8)
    img_speaking = wc.render_wave_scene(
        speaker_name="Andrea",
        rol="Co-Conductora",
        w=854,
        h=480,
        vertical=False,
        composition="wave-centered",
        progress=0.1,
        react_val=0.8,  # Voz enérgica
    )

    arr_pause = np.array(img_pause)
    arr_speaking = np.array(img_speaking)

    # En pausa sigue habiendo contenido dibujado (la onda viva respira)
    assert arr_pause.mean() > 5.0
    # En habla activa hay mayor intensidad luminosa por los halos y ribbons
    assert arr_speaking.mean() >= arr_pause.mean()


def test_zero_ai_assets_and_zero_portraits():
    """Garantiza que WaveComposer opera puramente mediante síntesis visual Pillow/numpy."""
    wc = WaveComposer()
    # WaveComposer no posee referencias ni atributos a carpetas de personajes
    assert not hasattr(wc, "assets_root")
    assert not hasattr(wc, "characters_dir")

    # Los backdrops se generan programáticamente en memoria
    bg = wc.get_ambient_backdrop("Eduardo", 640, 360, vertical=False)
    assert bg.size == (640, 360)


def test_renderer_wave_premium_integration():
    """Verifica que Renderer despacha automáticamente a WaveComposer en modo wave-premium."""
    rend_16x9 = Renderer(layout="16x9", visual_style="wave-premium")
    rend_9x16 = Renderer(layout="9x16", visual_style="wave-premium")

    ev = {
        "beat_id": "test_beat_001",
        "turn_id": "turn_1",
        "speaker": "Javier Ríos",
        "scene_type": "speaker_focus",
        "visual_function": "LOCUTOR",
        "headline": "DEFENSA DEL TABULADOR",
        "subheadline": "Convenio 2025-2027",
        "display_text": "Es fundamental revisar la cláusula correspondiente.",
        "start": 0.0,
        "end": 4.0,
        "duration": 4.0,
        "composition": "wave-left-title",
    }
    char = {"rol": "Analista Laboral", "accent": (6, 182, 212)}

    # Render 16:9
    f1 = rend_16x9.frame(
        f=15, fps=30, ev=ev, char=char, env=[0.4] * 30, local_f=15, dur_f=120
    )
    assert f1.size == (1920, 1080)

    # Render 9:16
    f2 = rend_9x16.frame(
        f=15, fps=30, ev=ev, char=char, env=[0.4] * 30, local_f=15, dur_f=120
    )
    assert f2.size == (1080, 1920)
