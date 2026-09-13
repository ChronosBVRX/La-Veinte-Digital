"""Lado Python del motor visual (solo lee el audio aprobado, nunca lo toca).

- timeline_builder: conversación -> visual-timeline.json (misma duración).
- validation: reglas pre-render (crítico = needs-review, no render).
- envelope: AudioEnvelopeExtractor (una lectura, 30 ms/muestra).
- sync: AudioVideoSyncValidator (±1 frame @30fps).
- encoder: VideoEncoderDetector (NVENC con prueba real, fallback libx264).
"""
from .timeline_builder import SCENE_TYPES, build_visual_timeline
from .validation import validate_visual_timeline
from .envelope import extract_envelope
from .sync import check_sync
from .encoder import detect_encoder

__all__ = [
    "SCENE_TYPES", "build_visual_timeline",
    "validate_visual_timeline",
    "extract_envelope",
    "check_sync",
    "detect_encoder",
]
