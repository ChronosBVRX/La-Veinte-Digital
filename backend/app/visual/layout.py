"""Layout engine v1.1: tokens, AutoFitText, SpeakerIdentity, colisiones,
zonas verticales y presets short-form. Mide ANTES de renderizar."""
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import ImageFont

TOKENS = json.loads((Path(__file__).resolve().parents[3] / "visual_engine" / "presets" /
                     "la-veinte-radio-visual-v1.json").read_text(encoding="utf-8"))


def _font(bold: bool, size: int):
    base = Path(__file__).resolve().parents[3]
    for cand in ([base / "assets" / "fonts" / "Inter.ttf"] if True else []):
        if cand.exists():
            try:
                return ImageFont.truetype(str(cand), size)
            except Exception:
                pass
    fb = TOKENS["typography"]["fallback_bold" if bold else "fallback"]
    try:
        return ImageFont.truetype(fb, size)
    except Exception:
        return ImageFont.load_default()


def font_for(level: str, h: int, bold: bool = True):
    base = TOKENS["typography"]["scale"][level]
    size = max(8, int(base * h / 1080))
    return _font(bold, size)


def min_size(level: str, h: int) -> int:
    base = TOKENS["typography"]["min_px_1080p"][level]
    return max(8, int(base * h / 1080))


class Box:
    def __init__(self, x0, y0, x1, y1, name=""):
        self.x0, self.y0, self.x1, self.y1, self.name = x0, y0, x1, y1, name

    def intersects(self, o: "Box") -> bool:
        return not (self.x1 <= o.x0 or o.x1 <= self.x0 or
                    self.y1 <= o.y0 or o.y1 <= self.y0)

    def inside(self, o: "Box") -> bool:
        return (self.x0 >= o.x0 and self.y0 >= o.y0 and
                self.x1 <= o.x1 and self.y1 <= o.y1)


def autofit(draw, text: str, level: str, box: Box, h: int,
            max_lines: int = 4) -> dict:
    """Calcula layout sin cortar: reduce tamaño, re-balancea líneas, reduce
    interlineado y, si no cabe, pide variante compacta. Nunca bajo el mínimo.
    `draw` es un ImageDraw para medir con la fuente real.
    """
    base = TOKENS["typography"]["scale"][level]
    size = max(8, int(base * h / 1080))
    lo = min_size(level, h)
    spacing = TOKENS["typography"]["line_spacing"]
    words = (text or "").split()
    box_w = box.x1 - box.x0
    while size >= lo:
        fnt = _font(True, size)
        # Palabra sola más ancha que la caja: imposible a este tamaño.
        if any(draw.textlength(w, font=fnt) > box_w for w in words):
            size = int(size * 0.92) or lo - 1
            continue
        lines: list[str] = []
        cur = ""
        for w in words:
            t = (cur + " " + w).strip()
            if draw.textlength(t, font=fnt) <= box_w or not cur:
                cur = t
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        if len(lines) > max_lines:
            size = int(size * 0.92) or lo - 1
            continue
        lh = size * spacing
        if lh * len(lines) <= (box.y1 - box.y0):
            widths = [draw.textlength(ln, font=fnt) for ln in lines]
            # Verificación final: ninguna línea fuera (defensa contra redondeo).
            if max(widths or [0]) > box_w + 0.5:
                size = int(size * 0.92) or lo - 1
                continue
            return {"ok": True, "size": size, "lines": lines, "spacing": spacing,
                    "compact": False, "max_w": max(widths) if widths else 0}
        if spacing > TOKENS["typography"]["line_spacing_min"]:
            spacing = max(TOKENS["typography"]["line_spacing_min"], spacing - 0.05)
            continue
        size = int(size * 0.92) or lo - 1
    return {"ok": False, "size": lo, "lines": words[:max_lines * 3],
            "spacing": spacing, "compact": True, "max_w": 0}


def speaker_identity(name: str, rol: str, h: int, stacked: bool = True) -> dict:
    """Bloque medido nombre+rol (nunca superpuestos por aproximación)."""
    fn = font_for("headline", h)
    fr = font_for("caption", h)
    from PIL import Image
    import PIL.ImageDraw as D
    dd = D.Draw(Image.new("RGB", (8, 8)))
    nw = dd.textlength(name or "", font=fn)
    nh = fn.size if hasattr(fn, "size") else 48
    rw = dd.textlength(rol or "", font=fr) if rol else 0
    rh = (fr.size if hasattr(fr, "size") else 24) if rol else 0
    gap = int(10 * h / 1080)
    if stacked or not rol:
        return {"mode": "stacked", "name_w": nw, "h": nh + (gap + rh if rol else 0),
                "role_y": nh + gap}
    return {"mode": "inline", "name_w": nw, "h": max(nh, rh), "role_y": 0,
            "role_x": nw + int(24 * h / 1080)}


def check_collisions(boxes: list[Box], allowed: set | None = None) -> list[str]:
    """Intersecciones no autorizadas entre pares (nombre, nombre)."""
    allowed = allowed or set()
    issues = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            if a.intersects(b) and (a.name, b.name) not in allowed \
                    and (b.name, a.name) not in allowed:
                issues.append(f"colisión: {a.name} ↔ {b.name}")
    return issues


def outside_safe(boxes: list[Box], safe: Box) -> list[str]:
    """Elementos críticos fuera de la safe zone de plataforma."""
    issues = []
    for b in boxes:
        if not b.inside(safe):
            issues.append(f"fuera de safe zone: {b.name}")
    return issues


def staged_number_lines(ev: dict) -> list[list[str]]:
    """Fuente única de etapas del number-hero (prepare + frame + validator)."""
    raw, ctx = ev.get("refs", {}).get("cantidad", ("", ""))
    val = (ev.get("refs", {}).get("monto") or {}).get("value")
    big = f"${val:,}".replace(",", ",") if val else raw
    label = ctx or "MONTO REPORTADO"
    # V1.4: la cifra completa ("$1,200") es la unidad mínima visible; nunca
    # aparece un "$" aislado. La etapa 1 mantiene la jerarquía de 3 pasos.
    return [[big], [big], [big, label]]


def build_number_primitives(draw, ev: dict, main: Box, h: int, stage: int) -> list["DrawText"]:
    """Primitivas number-hero con jerarquía: la cifra es la hero (display-xl),
    el contexto (MONTO REPORTADO) va a nivel caption, más pequeño.

    Etapa 0: '$' ; Etapa 1: cifra ; Etapa 2: cifra + contexto.
    Cada línea se mide a su propio nivel (sin uniformar tamaños).
    """
    inset = Box(main.x0 + 12, main.y0, main.x1 - 12, main.y1, name=main.name)
    big = staged_number_lines(ev)[1][0]
    label = staged_number_lines(ev)[2][1] if len(staged_number_lines(ev)[2]) > 1 else ""
    # (texto, nivel, es_critico)
    if stage == 0:
        specs = [(big, "display-xl", True)]
    elif stage == 1:
        specs = [(big, "display-xl", True)]
    else:
        specs = [(big, "display-xl", True), (label, "caption", True)]
    fitted = []
    for text, level, critical in specs:
        fit = autofit(draw, text, level, inset, h, max_lines=2)
        if not fit["ok"]:
            fit = autofit(draw, text, "headline", inset, h, max_lines=2)
        fitted.append((text, level, fit["size"], fit["spacing"], critical))
    gap = int(18 * h / 1080)
    total_h = sum(sz * sp for _, _, sz, sp, _ in fitted) + gap * (len(fitted) - 1)
    y0 = main.y0 + (main.y1 - main.y0 - total_h) / 2
    primitives: list[DrawText] = []
    y = y0
    for text, level, size, spacing, critical in fitted:
        fnt = _font(True, size)
        w = draw.textlength(text, font=fnt)
        x0 = main.x0 + (main.x1 - main.x0 - w) / 2
        box = Box(x0, y, x0 + w, y + size, name=f"number-{level}")
        anim = {"dx": 6, "dy": 0, "scale": 0.02}
        primitives.append(DrawText(text, x0, y, fnt, size, f"number-{level}",
                                   critical, box, anim))
        y += size * spacing + gap
    return primitives


class AnimatedBoundsValidator:
    """Valida elementos críticos durante toda su animación, no solo en destino."""
    def __init__(self, platform_safe: Box, canvas: Box):
        self.safe = platform_safe
        self.canvas = canvas

    def validate(self, primitives: list["DrawText"]) -> list[str]:
        issues: list[str] = []
        checkpoints = [0.0, 0.5, 1.0]
        for p in primitives:
            if not p.critical:
                continue
            for prog in checkpoints:
                b = p.bounds_at(prog)
                if not b.inside(self.canvas):
                    issues.append(f"overflow canvas: {p.role} @ {prog:.1f}")
                if not b.inside(self.safe):
                    issues.append(f"fuera de platform-safe: {p.role} @ {prog:.1f} [{b.x0:.0f},{b.y0:.0f},{b.x1:.0f},{b.y1:.0f}]")
                # Extremos adicionales si hay overshoot.
                if p.anim.get("overshoot"):
                    b2 = p.bounds_at(0.6)
                    if not b2.inside(self.safe):
                        issues.append(f"overshoot fuera de safe: {p.role}")
        # También detectar colisión entre críticos durante animación.
        for i in range(len(primitives)):
            for j in range(i + 1, len(primitives)):
                a, b = primitives[i], primitives[j]
                if not a.critical or not b.critical:
                    continue
                for prog in checkpoints:
                    if a.bounds_at(prog).intersects(b.bounds_at(prog)):
                        issues.append(f"colisión animada: {a.role} ↔ {b.role} @ {prog:.1f}")
                        break
        return issues


def get_platform_safe(vertical: bool) -> Box:
    """Safe zone de plataforma (intersección conservadora TikTok/Reels/Shorts)."""
    key = "v" if vertical else "h"
    coords = TOKENS.get("platform", {}).get(key) or TOKENS["safe"][key]
    x0, y0, x1, y1 = coords
    return Box(x0, y0, x1, y1, name="platform-safe")


def get_canvas_box(w: int, h: int) -> Box:
    return Box(0, 0, w, h, name="canvas")


def get_main_box(layout_name: str, variant: str, w: int, h: int) -> Box:
    """Zona de contenido protagonista según variante, dentro de platform-safe."""
    vertical = h > w
    if vertical:
        # Vertical: respeta platform-safe [70,200,940,1450] para texto crítico.
        return Box(70, 700, 940, 1350, "main")
    if variant in ("conversation-left",):
        return Box(int(w * 0.38), int(h * 0.30), int(w * 0.92), int(h * 0.72), "main")
    if variant in ("conversation-right",):
        return Box(int(w * 0.08), int(h * 0.30), int(w * 0.62), int(h * 0.72), "main")
    return Box(int(w * 0.14), int(h * 0.30), int(w * 0.86), int(h * 0.74), "main")


# --- Fuente única de primitivas de dibujo ---

class DrawText:
    """Representación intermedia entre layout y render/validación."""
    def __init__(self, text: str, x: float, y: float, font, size: int,
                 role: str, critical: bool, box: Box, anim: dict | None = None):
        self.text = text
        self.x = x
        self.y = y
        self.font = font
        self.size = size
        self.role = role
        self.critical = critical
        self.box = box  # bounds estáticos finales
        self.anim = anim or {}  # {dx, dy, scale, overshoot}

    def bounds_at(self, progress: float) -> Box:
        """Bounds interpolados para validación animada."""
        dx = float(self.anim.get("dx", 0) * (1 - progress))
        dy = float(self.anim.get("dy", 0) * (1 - progress))
        scale = 1.0 + float(self.anim.get("scale", 0)) * (1 - progress)
        # Overshoot: pico en 0.6
        over = float(self.anim.get("overshoot", 0))
        if over and 0.4 < progress < 0.8:
            scale += over * math.sin((progress - 0.4) / 0.4 * math.pi)
        w = (self.box.x1 - self.box.x0) * scale
        h = (self.box.y1 - self.box.y0) * scale
        cx = (self.box.x0 + self.box.x1) / 2 + dx
        cy = (self.box.y0 + self.box.y1) / 2 + dy
        return Box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, name=self.box.name)
