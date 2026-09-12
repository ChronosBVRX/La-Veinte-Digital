"""AudioEnvelopeExtractor: lee el WAV una vez, envelope 30 ms/muestra.

RMS + pico normalizado + envelope suavizado. Sin cálculo por frame.
"""
from __future__ import annotations

import numpy as np


def extract_envelope(path: str, frame_ms: int = 30) -> dict:
    import soundfile as sf
    d, sr = sf.read(path, dtype="float32", always_2d=False)
    x = np.asarray(d, dtype=np.float32).reshape(-1)
    n = max(1, int(sr * frame_ms / 1000))
    fr = x[:len(x) // n * n].reshape(-1, n)
    rms = np.sqrt((fr.astype(np.float64) ** 2).mean(axis=1))
    peak = np.abs(fr).max(axis=1)
    k = max(1, len(rms) // 50)
    sm = np.convolve(rms, np.ones(k) / k, mode="same")
    mx = float(rms.max()) if rms.size else 0.0
    return {
        "sr": sr, "frame_ms": frame_ms, "n": int(len(rms)),
        "duration_s": round(len(x) / sr, 2),
        "rms": [round(float(v) / max(mx, 1e-9), 4) for v in rms],
        "peak": [round(float(v), 4) for v in peak],
        "smooth": [round(float(v) / max(mx, 1e-9), 4) for v in sm],
    }
