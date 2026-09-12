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