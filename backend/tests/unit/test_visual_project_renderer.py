"""Prueba unitaria de la lógica de project_renderer (preparación y timelines)."""
import json
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.visual.project_renderer import ensure_master_wav


def test_ensure_master_wav_con_wav():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "audio.wav"
        # Crear un archivo WAV mínimo válido con soundfile o bytes
        import numpy as np
        import soundfile as sf
        data = np.zeros(24000, dtype=np.float32)
        sf.write(str(p), data, 24000)

        out_wav, dur_s = ensure_master_wav(p, Path(tmp))
        assert out_wav == p
        assert abs(dur_s - 1.0) < 0.05


def test_render_project_visual_requires_alignment():
    import pytest
    from app.visual.project_renderer import render_project_visual

    with tempfile.TemporaryDirectory() as tmp:
        tmp_p = Path(tmp)
        proj_p = tmp_p / "project.json"
        proj_p.write_text(json.dumps({"id": "p1", "turns": []}), encoding="utf-8")
        master_p = tmp_p / "master.wav"
        import numpy as np
        import soundfile as sf
        sf.write(str(master_p), np.zeros(24000, dtype=np.float32), 24000)

        with pytest.raises(ValueError, match="ALIGNMENT_REQUIRED"):
            render_project_visual(proj_p, master_p, tmp_p / "out")


def test_render_project_visual_with_alignment_file():
    from app.visual.project_renderer import render_project_visual

    with tempfile.TemporaryDirectory() as tmp:
        tmp_p = Path(tmp)
        proj_p = tmp_p / "project.json"
        proj_p.write_text(json.dumps({
            "id": "p1",
            "turns": [
                {"id": "t1", "speaker": "Eduardo", "displayText": "Hola"}
            ]
        }), encoding="utf-8")
        al_p = tmp_p / "timeline-alignment.json"
        al_p.write_text(json.dumps({
            "version": 1,
            "durationMs": 1000,
            "blocks": [],
            "turns": [
                {"turnId": "t1", "speaker": "Eduardo", "startMs": 0, "endMs": 1000, "durationMs": 1000}
            ]
        }), encoding="utf-8")
        master_p = tmp_p / "master.wav"
        import numpy as np
        import soundfile as sf
        sf.write(str(master_p), np.zeros(24000, dtype=np.float32), 24000)

        res = render_project_visual(proj_p, master_p, tmp_p / "out", formats=[], alignment_path=al_p)
        assert res["ok"] is True
        assert (tmp_p / "out" / "visual-timeline.json").exists()
        written_tl = json.loads((tmp_p / "out" / "visual-timeline.json").read_text(encoding="utf-8"))
        assert len(written_tl["events"]) == 1
        assert written_tl["events"][0]["beat_id"] == "t1"
        assert written_tl["events"][0]["start"] == 0.0
        assert written_tl["events"][0]["end"] == 1.0