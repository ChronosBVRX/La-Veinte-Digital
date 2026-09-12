"""Identidad La Veinte Radio: paleta, tipografía, geometría por personaje,
layouts horizontal/vertical con safe zones, reduced motion.

Editorial, laboral, moderno y cercano. Sin caras ni avatares: la diferencia
es geometría + composición + velocidad + ritmo (no solo color).
"""
from __future__ import annotations

BG = (16, 18, 24)
BG2 = (22, 25, 34)
CREAM = (245, 241, 232)
MUTED = (168, 162, 154)
ACCENT = (245, 158, 11)
ACCENT_DIM = (120, 84, 20)
LINE = (44, 48, 60)

FONT = "C:/Windows/Fonts/segoeui.ttf"
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_LIGHT = "C:/Windows/Fonts/segoeuil.ttf"

# Geometría/movimiento por personaje (velocidad en ciclos por segundo).
CHARACTERS = {
    "Eduardo": {"shape": "circles", "speed": 0.25, "accent": ACCENT,
                "rol": "Conductor", "enter": "warm"},
    "Andrea": {"shape": "curves", "speed": 0.45, "accent": (251, 191, 36),
               "rol": "Co-conductora", "enter": "quick"},
    "Javier Ríos": {"shape": "grid", "speed": 0.18, "accent": (125, 211, 252),
                    "rol": "Analista", "enter": "steady"},
    "Rodrigo Torres": {"shape": "bars", "speed": 0.35, "accent": (110, 231, 183),
                       "rol": "Corresponsal", "enter": "firm"},
    "Valeria Soto": {"shape": "brand", "speed": 0.25, "accent": ACCENT,
                     "rol": "Identidad", "enter": "brand"},
    "Solo esto": {"shape": "bars", "speed": 0.35, "accent": (110, 231, 183),
                  "rol": "", "enter": "firm"},
    "Solo recordarles": {"shape": "curves", "speed": 0.45, "accent": (251, 191, 36),
                         "rol": "", "enter": "quick"},
}

LAYOUTS = {
    "16x9": {"w": 1920, "h": 1080,
             "safe": (96, 54, 1920 - 96, 1080 - 54),
             "brand": (96, 54), "wave": (96, 880, 1728, 120)},
    "9x16": {"w": 1080, "h": 1920,
             "safe": (54, 96, 1080 - 54, 1920 - 96),
             "brand": (54, 96), "wave": (54, 1620, 972, 140)},
    "preview": {"w": 854, "h": 480,
                "safe": (42, 24, 854 - 42, 480 - 24),
                "brand": (42, 24), "wave": (42, 392, 770, 54)},
}


def get_layout(name: str) -> dict:
    return dict(LAYOUTS[name])


def motion_scale(energy: float, reduced: bool = False) -> float:
    """Energía 0-1 -> escala de movimiento con curva suavizada."""
    if reduced:
        return 0.15
    e = max(0.0, min(1.0, energy))
    return 0.25 + 0.75 * (e * e * (3 - 2 * e))  # smoothstep
