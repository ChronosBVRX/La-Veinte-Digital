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

# Paleta oficial Wave Premium: La voz es el visual
SPEAKER_WAVE_PALETTES = {
    "Eduardo": {
        "name": "EDUARDO",
        "role": "Conductor Titular",
        "primary": (37, 99, 235),      # Azul premium #2563EB
        "glow": (59, 130, 246),         # #3B82F6
        "light": (147, 197, 253),       # #93C5FD
        "bg_glow": (18, 38, 90),
    },
    "Andrea": {
        "name": "ANDREA",
        "role": "Co-conductora",
        "primary": (217, 70, 239),     # Magenta elegante #D946EF
        "glow": (236, 72, 153),        # #EC4899
        "light": (244, 114, 182),      # #F472B6
        "bg_glow": (80, 22, 92),
    },
    "Javier Ríos": {
        "name": "JAVIER RÍOS",
        "role": "Analista Laboral",
        "primary": (6, 182, 212),      # Cian limpio #06B6D4
        "glow": (14, 165, 233),        # #0EA5E9
        "light": (125, 211, 252),      # #7DD3FC
        "bg_glow": (12, 60, 82),
    },
    "Rodrigo Torres": {
        "name": "RODRIGO TORRES",
        "role": "Enlace Informativo",
        "primary": (16, 185, 129),     # Verde esmeralda #10B981
        "glow": (5, 150, 105),         # #059669
        "light": (110, 231, 183),      # #6EE7B7
        "bg_glow": (10, 64, 45),
    },
    "Valeria Soto": {
        "name": "VALERIA SOTO",
        "role": "Asuntos Jurídicos",
        "primary": (245, 158, 11),     # Ámbar suave #F59E0B
        "glow": (234, 179, 8),         # #EAB308
        "light": (253, 224, 71),       # #FDE047
        "bg_glow": (85, 55, 12),
    },
}

# Geometría/movimiento por personaje (velocidad en ciclos por segundo).
CHARACTERS = {
    "Eduardo": {"shape": "circles", "speed": 0.25, "accent": SPEAKER_WAVE_PALETTES["Eduardo"]["primary"],
                "rol": "Conductor Titular", "enter": "warm"},
    "Andrea": {"shape": "curves", "speed": 0.45, "accent": SPEAKER_WAVE_PALETTES["Andrea"]["primary"],
               "rol": "Co-conductora", "enter": "quick"},
    "Javier Ríos": {"shape": "grid", "speed": 0.18, "accent": SPEAKER_WAVE_PALETTES["Javier Ríos"]["primary"],
                    "rol": "Analista Laboral", "enter": "steady"},
    "Rodrigo Torres": {"shape": "bars", "speed": 0.35, "accent": SPEAKER_WAVE_PALETTES["Rodrigo Torres"]["primary"],
                       "rol": "Enlace Informativo", "enter": "firm"},
    "Valeria Soto": {"shape": "brand", "speed": 0.25, "accent": SPEAKER_WAVE_PALETTES["Valeria Soto"]["primary"],
                     "rol": "Asuntos Jurídicos", "enter": "brand"},
    "Solo esto": {"shape": "bars", "speed": 0.35, "accent": SPEAKER_WAVE_PALETTES["Rodrigo Torres"]["primary"],
                  "rol": "", "enter": "firm"},
    "Solo recordarles": {"shape": "curves", "speed": 0.45, "accent": SPEAKER_WAVE_PALETTES["Andrea"]["primary"],
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
