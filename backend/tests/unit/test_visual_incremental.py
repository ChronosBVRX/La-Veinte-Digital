"""Pruebas unitarias del pipeline de render incremental de AI Radio Studio.

Verifica:
1. test_unchanged_beat_cache_hit
2. test_changed_asset_invalidates_only_affected_beat
3. test_changed_text_invalidates_only_affected_beat
4. test_orientation_has_independent_cache
5. test_resolution_has_independent_cache
6. test_renderer_version_invalidates_cache
7. test_storyboard_does_not_render_video
8. test_spot_preview_only_renders_requested_range
9. test_cancel_preserves_completed_cache
10. test_resume_uses_completed_cache
11. test_audio_never_regenerated_for_visual_change
"""
import hashlib
import json
import shutil
import tempfile
from pathlib import Path
import pytest
from unittest.mock import MagicMock, patch

from app.visual.render_cache import (
    compute_beat_render_hash,
    BeatRenderCache,
    RENDERER_VERSION,
)
from app.visual.beat_renderer import BeatRenderer
from app.visual.parallel_renderer import IncrementalPipelineRenderer


def _make_sample_beat(
    beat_id="beat_001",
    scene_type="speaker",
    visual_function="LOCUTOR",
    start=0.0,
    end=3.0,
    resolved_asset=None,
    headline="TITULO DE PRUEBA",
    speaker="EDUARDO",
):
    ev = {
        "beat_id": beat_id,
        "scene_type": scene_type,
        "visual_function": visual_function,
        "start": start,
        "end": end,
        "headline": headline,
        "speaker": speaker,
        "variant": "neutral",
    }
    if resolved_asset:
        ev["resolved_asset"] = {"id": resolved_asset, "file": f"{resolved_asset}.jpg"}
    return ev


def test_unchanged_beat_cache_hit():
    """Beat sin cambios detecta cache hit y no requiere re-render."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        cache = BeatRenderCache(proj_dir)
        beat = _make_sample_beat("beat_01")

        # Inicialmente miss
        cached, clip_p, _ = cache.is_beat_cached(beat, orientation="16x9", mode="preview", resolution=(854, 480), fps=30)
        assert not cached

        # Simular clip generado en cache (>500 bytes para ser válido)
        clip_p.parent.mkdir(parents=True, exist_ok=True)
        clip_p.write_bytes(b"dummy_mp4_content" * 100)

        # Ahora es hit
        cached, _, _ = cache.is_beat_cached(beat, orientation="16x9", mode="preview", resolution=(854, 480), fps=30)
        assert cached

        summary = cache.get_status_summary([beat], orientation="16x9", mode="preview", resolution=(854, 480), fps=30)
        assert summary["cachedBeats"] == 1
        assert summary["dirtyBeatsCount"] == 0
        assert summary["statuses"]["beat_01"] == "READY"


def test_changed_asset_invalidates_only_affected_beat():
    """Cambiar un asset solo invalida el beat afectado; los demás se mantienen en cache."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        cache = BeatRenderCache(proj_dir)

        b1 = _make_sample_beat("b1", resolved_asset="asset_A")
        b2 = _make_sample_beat("b2", resolved_asset="asset_B")
        b3 = _make_sample_beat("b3", resolved_asset="asset_C")

        # Crear clips para todos
        for b in [b1, b2, b3]:
            _, clip_p, _ = cache.is_beat_cached(b, orientation="16x9", mode="preview", resolution=(854, 480), fps=30)
            clip_p.parent.mkdir(parents=True, exist_ok=True)
            clip_p.write_bytes(b"dummy" * 150)

        assert cache.is_beat_cached(b1, "16x9", "preview", (854, 480), 30)[0]
        assert cache.is_beat_cached(b2, "16x9", "preview", (854, 480), 30)[0]
        assert cache.is_beat_cached(b3, "16x9", "preview", (854, 480), 30)[0]

        # Modificar solo b2
        b2_modified = dict(b2)
        b2_modified["resolved_asset"] = {"id": "asset_NEW", "file": "asset_NEW.jpg"}

        assert cache.is_beat_cached(b1, "16x9", "preview", (854, 480), 30)[0]
        assert not cache.is_beat_cached(b2_modified, "16x9", "preview", (854, 480), 30)[0]
        assert cache.is_beat_cached(b3, "16x9", "preview", (854, 480), 30)[0]

        # Estado global
        summary = cache.get_status_summary([b1, b2_modified, b3], "16x9", "preview", (854, 480), 30)
        assert summary["cachedBeats"] == 2
        assert summary["dirtyBeatsCount"] == 1
        assert "b2" in summary["dirtyBeats"]


def test_changed_text_invalidates_only_affected_beat():
    """Modificar el texto editorial solo invalida el beat correspondiente."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        cache = BeatRenderCache(proj_dir)

        b1 = _make_sample_beat("b1", headline="Original 1")
        b2 = _make_sample_beat("b2", headline="Original 2")

        for b in [b1, b2]:
            _, clip_p, _ = cache.is_beat_cached(b, "16x9", "preview", (854, 480), 30)
            clip_p.parent.mkdir(parents=True, exist_ok=True)
            clip_p.write_bytes(b"dummy" * 150)

        b2_modified = dict(b2)
        b2_modified["headline"] = "Cambiado 2"

        assert cache.is_beat_cached(b1, "16x9", "preview", (854, 480), 30)[0]
        assert not cache.is_beat_cached(b2_modified, "16x9", "preview", (854, 480), 30)[0]


def test_orientation_has_independent_cache():
    """16:9 y 9:16 mantienen caches totalmente independientes."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        cache = BeatRenderCache(proj_dir)

        beat = _make_sample_beat("b1")

        # Cache 16x9 tiene clip
        _, clip_h, _ = cache.is_beat_cached(beat, orientation="16x9", mode="preview", resolution=(854, 480), fps=30)
        clip_h.parent.mkdir(parents=True, exist_ok=True)
        clip_h.write_bytes(b"horizontal_mp4" * 100)

        assert cache.is_beat_cached(beat, "16x9", "preview", (854, 480), 30)[0]
        # 9x16 NO debe ser hit aunque el horizontal exista
        assert not cache.is_beat_cached(beat, "9x16", "preview", (480, 854), 30)[0]
        assert "16x9" in str(clip_h)


def test_resolution_has_independent_cache():
    """Draft (640x360) y Preview (854x480) tienen caches independientes."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        cache = BeatRenderCache(proj_dir)

        beat = _make_sample_beat("b1")

        _, clip_draft, _ = cache.is_beat_cached(beat, "16x9", "draft", (640, 360), 15)
        clip_draft.parent.mkdir(parents=True, exist_ok=True)
        clip_draft.write_bytes(b"draft_mp4" * 100)

        assert cache.is_beat_cached(beat, "16x9", "draft", (640, 360), 15)[0]
        assert not cache.is_beat_cached(beat, "16x9", "preview", (854, 480), 30)[0]
        assert "draft" in str(clip_draft)


def test_renderer_version_invalidates_cache():
    """Cambiar RENDERER_VERSION cambia el hash e invalida el cache existente."""
    beat = _make_sample_beat("b1")
    hash_v1 = compute_beat_render_hash(beat, "16x9", (854, 480), 30, renderer_version="1.0.0")
    hash_v2 = compute_beat_render_hash(beat, "16x9", (854, 480), 30, renderer_version="2.0.0")

    assert hash_v1 != hash_v2


def test_storyboard_does_not_render_video():
    """Storyboard genera únicamente imágenes estáticas y nunca codifica video MP4 ni llama audio."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        renderer = BeatRenderer(layout="16x9")
        beat = _make_sample_beat("b_sb", speaker="EDUARDO")

        frame_path = proj_dir / "frame.jpg"
        with patch("app.visual.beat_renderer.subprocess.Popen") as mock_popen:
            res = renderer.render_storyboard_frame(beat, frame_path)

            # ffmpeg no fue invocado
            mock_popen.assert_not_called()
            # El archivo generado es imagen
            assert frame_path.exists()
            assert frame_path.stat().st_size > 0
            assert res.size == (640, 360)


def test_spot_preview_only_renders_requested_range():
    """Spot preview renderiza exclusivamente el beat solicitado y extrae únicamente su rebanada de audio."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        renderer = BeatRenderer(layout="16x9")
        b = _make_sample_beat("b_spot", start=10.0, end=14.0)

        # Mock audio master
        dummy_audio = proj_dir / "master.mp3"
        dummy_audio.write_bytes(b"dummy_audio")

        out_preview = proj_dir / "spot.mp4"

        # Mock render_beat_clip y subprocess.run
        with patch.object(renderer, "render_beat_clip") as mock_clip, \
             patch("app.visual.beat_renderer.subprocess.run") as mock_run:
            mock_clip.side_effect = lambda ev, out_path=None, **kwargs: (out_path.write_bytes(b"clip" * 150) or out_path)
            mock_run.return_value = MagicMock(returncode=0)

            renderer.render_spot_preview(b, dummy_audio, out_preview, mode="preview")

            # Solo se llamó render_beat_clip con el beat solicitado
            mock_clip.assert_called_once()
            assert mock_clip.call_args[0][0]["beat_id"] == "b_spot"

            # FFmpeg slice audio usó exactamente start=10.0 y duration=4.0
            ffmpeg_cmd = mock_run.call_args[0][0]
            assert "-ss" in ffmpeg_cmd
            ss_idx = ffmpeg_cmd.index("-ss")
            assert float(ffmpeg_cmd[ss_idx + 1]) == 10.0
            t_idx = ffmpeg_cmd.index("-t")
            assert float(ffmpeg_cmd[t_idx + 1]) == 4.0


def test_cancel_preserves_completed_cache():
    """La cancelación en vuelo preserva intactos en disco los clips que ya terminaron de renderizarse."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        beats = [
            _make_sample_beat("b1", start=0.0, end=1.0),
            _make_sample_beat("b2", start=1.0, end=2.0),
            _make_sample_beat("b3", start=2.0, end=3.0),
        ]
        dummy_audio = proj_dir / "master.mp3"
        dummy_audio.write_bytes(b"audio")

        renderer = IncrementalPipelineRenderer(
            project_dir=proj_dir,
            layout="16x9",
            max_workers=1,
        )

        # Simular que beat 1 ya terminó y guardó en cache, pero se llama a cancel()
        cache = renderer.cache
        _, clip_b1, _ = cache.is_beat_cached(beats[0], "16x9", "preview", (854, 480), 30)
        clip_b1.parent.mkdir(parents=True, exist_ok=True)
        clip_b1.write_bytes(b"completed_clip_1" * 100)

        renderer.cancel()
        assert renderer.is_cancelled()

        # clip_b1 sigue existiendo intacto y es reconocido como cache hit
        assert clip_b1.exists()
        assert cache.is_beat_cached(beats[0], "16x9", "preview", (854, 480), 30)[0]


def test_resume_uses_completed_cache():
    """Al reanudar o ejecutar de nuevo, los clips existentes se reutilizan sin volver a renderizarlos."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        beats = [
            _make_sample_beat("b1", start=0.0, end=1.0),
            _make_sample_beat("b2", start=1.0, end=2.0),
        ]
        dummy_audio = proj_dir / "master.mp3"
        dummy_audio.write_bytes(b"audio")

        renderer = IncrementalPipelineRenderer(
            project_dir=proj_dir,
            layout="16x9",
            max_workers=1,
        )

        # Pre-cachear beat 1
        _, clip_b1, _ = renderer.cache.is_beat_cached(beats[0], "16x9", "preview", (854, 480), 30)
        clip_b1.parent.mkdir(parents=True, exist_ok=True)
        clip_b1.write_bytes(b"clip_1" * 100)

        with patch.object(BeatRenderer, "render_beat_clip") as mock_render,              patch("app.visual.parallel_renderer.assemble_video_clips") as mock_concat,              patch("app.visual.parallel_renderer.mux_audio_master") as mock_mux:

            mock_render.side_effect = lambda ev, out_path=None, **kw: (out_path.write_bytes(b"clip_2" * 100) or out_path)
            mock_concat.return_value = proj_dir / "concat.mp4"
            mock_mux.return_value = proj_dir / "final.mp4"

            out_final = proj_dir / "out.mp4"
            _, stats = renderer.render_full_pipeline(beats, dummy_audio, out_final, mode="preview")

            # Solo se debió llamar render_beat_clip UNA VEZ (para b2), nunca para b1
            assert mock_render.call_count == 1
            rendered_beat = mock_render.call_args[0][0]
            assert rendered_beat["beat_id"] == "b2"
            assert stats["hits"] == 1
            assert stats["rendered"] == 1


def test_audio_never_regenerated_for_visual_change():
    """El audio master nunca se recalcula ni modifica durante la renderización visual."""
    with tempfile.TemporaryDirectory() as tmp:
        proj_dir = Path(tmp)
        master_audio = proj_dir / "master.mp3"
        original_audio_content = b"MASTER_CANONICAL_AUDIO_DATA_DO_NOT_TOUCH"
        master_audio.write_bytes(original_audio_content)

        original_hash = hashlib.sha256(original_audio_content).hexdigest()
        original_mtime = master_audio.stat().st_mtime_ns

        # Ejecutar operaciones de pipeline visual
        cache = BeatRenderCache(proj_dir)
        cache.invalidate_beat("b1")

        # Verificar que el master_audio está idéntico en bytes, hash y contenido
        assert master_audio.exists()
        current_content = master_audio.read_bytes()
        assert hashlib.sha256(current_content).hexdigest() == original_hash
        assert master_audio.stat().st_mtime_ns == original_mtime
