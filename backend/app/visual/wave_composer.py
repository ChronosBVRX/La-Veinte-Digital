"""Wave Premium Visual Composer para La Veinte Radio / AI Radio Studio.

Dirección de Arte: 'La voz es el visual'.
- Cero avatares, ilustraciones de busto ni retratos generados.
- Síntesis programática de ondas de audio reactivas en tiempo real.
- Identidad de color única por conductor (Eduardo, Andrea, Javier, Rodrigo, Valeria).
- Tipografía editorial limpia, sobria y profesional (sin karaoke).
- Adaptación responsiva estricta para 16:9, 9:16 vertical y resoluciones preview.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .identity import SPEAKER_WAVE_PALETTES
from .editorial.charts import _get_font, _draw_wrapped_text

BG_BASE = (10, 13, 18)


class WaveComposer:
    """Generador visual de la dirección Wave Premium."""

    def __init__(self) -> None:
        self._backdrop_cache: dict[tuple[str, int, int, bool], Image.Image] = {}

    def get_speaker_palette(self, speaker_name: str) -> dict[str, Any]:
        """Resuelve la paleta oficial Wave Premium a partir del nombre del hablante."""
        spk_raw = (speaker_name or "").lower().strip()
        slug_map = {
            "eduardo": "Eduardo",
            "andrea": "Andrea",
            "javier": "Javier Ríos",
            "javier ríos": "Javier Ríos",
            "javier rios": "Javier Ríos",
            "rodrigo": "Rodrigo Torres",
            "rodrigo torres": "Rodrigo Torres",
            "valeria": "Valeria Soto",
            "valeria soto": "Valeria Soto",
        }
        resolved_key = "Eduardo"
        for k, v in slug_map.items():
            if k in spk_raw:
                resolved_key = v
                break

        return SPEAKER_WAVE_PALETTES.get(resolved_key, SPEAKER_WAVE_PALETTES["Eduardo"])

    def get_ambient_backdrop(
        self,
        speaker_key: str,
        w: int,
        h: int,
        vertical: bool = False,
    ) -> Image.Image:
        """Devuelve el fondo oscuro con glow radial cacheados en memoria para cero sobrecosto."""
        cache_key = (speaker_key, w, h, vertical)
        if cache_key in self._backdrop_cache:
            return self._backdrop_cache[cache_key].copy()

        pal = self.get_speaker_palette(speaker_key)
        bg_col = pal.get("bg_glow", (18, 38, 90))

        base = Image.new("RGB", (w, h), BG_BASE)

        # Generar máscara radial suave en resolución 1/4 para máxima velocidad y suavidad
        rw, rh = max(16, w // 4), max(16, h // 4)
        cx, cy = rw // 2, int(rh * (0.50 if vertical else 0.52))
        rad_x = rw * (0.45 if vertical else 0.50)
        rad_y = rh * (0.35 if vertical else 0.40)

        yy, xx = np.ogrid[:rh, :rw]
        dist = np.sqrt(((xx - cx) / rad_x) ** 2 + ((yy - cy) / rad_y) ** 2)
        glow_mask = np.clip(1.0 - dist, 0.0, 1.0)
        glow_mask = (glow_mask ** 1.8) * 0.55  # Intensidad sutil de estudio

        glow_layer_arr = np.zeros((rh, rw, 3), dtype=np.uint8)
        glow_layer_arr[..., 0] = int(bg_col[0])
        glow_layer_arr[..., 1] = int(bg_col[1])
        glow_layer_arr[..., 2] = int(bg_col[2])

        glow_img = Image.fromarray(glow_layer_arr, mode="RGB")
        mask_img = Image.fromarray((glow_mask * 255).astype(np.uint8), mode="L")

        glow_scaled = glow_img.resize((w, h), Image.Resampling.BILINEAR)
        mask_scaled = mask_img.resize((w, h), Image.Resampling.BICUBIC)

        base.paste(glow_scaled, (0, 0), mask_scaled)

        # Viñeta sutil en los bordes para encuadre cinematográfico
        vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        vd = ImageDraw.Draw(vignette)
        margin = int(min(w, h) * 0.08)
        vd.rectangle([0, 0, w, h], outline=(0, 0, 0, 70), width=margin)
        base.paste(vignette, (0, 0), vignette)

        self._backdrop_cache[cache_key] = base
        return base.copy()

    def _generate_harmonic_points(
        self,
        cx: float,
        cy: float,
        width: float,
        amp: float,
        time_t: float,
        harmonics: list[tuple[float, float, float]],
        num_points: int = 240,
    ) -> list[tuple[float, float]]:
        """Genera puntos (x, y) de una onda fluida amortiguada por ventana suave."""
        half_w = width / 2.0
        x_start = cx - half_w
        dx = width / max(1, num_points - 1)

        points: list[tuple[float, float]] = []
        for i in range(num_points):
            x = x_start + i * dx
            u = i / float(num_points - 1)  # 0.0 a 1.0

            # Ventana Hanning / seno al cuadrado (amplitud cero en los extremos)
            win = math.sin(math.pi * u) ** 1.3

            # Suma armónica
            val = 0.0
            for freq, weight, speed in harmonics:
                val += math.sin(u * freq + time_t * speed) * weight

            y = cy - (val * amp * win)
            points.append((x, y))

        return points

    def render_wave_scene(
        self,
        speaker_name: str,
        rol: str,
        w: int,
        h: int,
        vertical: bool = False,
        composition: str = "wave-centered",
        headline: str = "",
        subheadline: str = "",
        display_text: str = "",
        key_points: list[str] | None = None,
        progress: float = 0.0,
        react_val: float = 0.0,
        energy: float = 0.0,
        beat_duration: float = 5.0,
    ) -> Image.Image:
        """Compone un cuadro completo bajo la dirección artística Wave Premium."""
        pal = self.get_speaker_palette(speaker_name)
        primary = pal["primary"]
        glow = pal["glow"]
        light = pal["light"]
        display_name = pal["name"]
        display_role = rol or pal["role"]

        # Escala responsiva estándar
        s = (w / 1080.0) if vertical else (w / 1920.0)
        s = max(0.40, s)

        # 1. Fondo atmosférico de estudio con glow de hablante
        canvas = self.get_ambient_backdrop(speaker_name, w, h, vertical=vertical)
        overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay, "RGBA")

        # 2. Reactividad & Respiración viva (idle breathing en pausas)
        effective_react = max(0.08, float(react_val))
        effective_energy = max(0.12, float(energy))
        time_t = (progress * max(1.0, beat_duration)) * 2.8

        # 3. Determinar geometrías según la composición seleccionada
        comp = composition or "wave-centered"
        if comp not in (
            "wave-centered",
            "wave-left-title",
            "wave-bottom-editorial",
            "wave-ribbon",
            "wave-minimal",
            "wave-focus-quote",
        ):
            comp = "wave-centered"

        # Zonas seguras
        pad_x = int(72 * s) if not vertical else int(54 * s)
        safe_top = int(60 * s) if not vertical else int(150 * s)
        safe_bottom = int(50 * s) if not vertical else int(220 * s)

        # Título superior institucional obligatorio
        self._render_brand_header(draw, w, safe_top, s, primary, vertical)

        # Selector de composición
        if comp == "wave-centered":
            self._render_comp_centered(
                draw, pal, w, h, s, vertical, pad_x, safe_top, safe_bottom,
                display_name, display_role, headline, subheadline,
                effective_react, effective_energy, time_t, progress,
            )
        elif comp == "wave-left-title":
            self._render_comp_left_title(
                draw, pal, w, h, s, vertical, pad_x, safe_top, safe_bottom,
                display_name, display_role, headline, subheadline,
                effective_react, effective_energy, time_t, progress,
            )
        elif comp == "wave-bottom-editorial":
            self._render_comp_bottom_editorial(
                draw, pal, w, h, s, vertical, pad_x, safe_top, safe_bottom,
                display_name, display_role, headline, subheadline, key_points,
                effective_react, effective_energy, time_t, progress,
            )
        elif comp == "wave-ribbon":
            self._render_comp_ribbon(
                draw, pal, w, h, s, vertical, pad_x, safe_top, safe_bottom,
                display_name, display_role, headline, subheadline,
                effective_react, effective_energy, time_t, progress,
            )
        elif comp == "wave-minimal":
            self._render_comp_minimal(
                draw, pal, w, h, s, vertical, pad_x, safe_top, safe_bottom,
                display_name, display_role,
                effective_react, effective_energy, time_t, progress,
            )
        elif comp == "wave-focus-quote":
            self._render_comp_focus_quote(
                draw, pal, w, h, s, vertical, pad_x, safe_top, safe_bottom,
                display_name, display_role, headline or display_text, subheadline,
                effective_react, effective_energy, time_t, progress,
            )

        # Barra de progreso inferior discreta (sincronizada)
        self._render_progress_bar(draw, w, h, safe_bottom, pad_x, s, primary, light, progress)

        # Composición final
        canvas.paste(overlay, (0, 0), overlay)
        return canvas

    # -------------------------------------------------------------------------
    # COMPONENTES EDITORIALES Y CAPAS VISUALES
    # -------------------------------------------------------------------------

    def _render_brand_header(
        self,
        d: ImageDraw.ImageDraw,
        w: int,
        safe_top: int,
        s: float,
        accent: tuple[int, int, int],
        vertical: bool,
    ) -> None:
        """Cabecera de marca sobria en zona segura superior."""
        f_brand = _get_font(True, max(12, int(15 * s)))
        f_tag = _get_font(False, max(10, int(12 * s)))

        brand_txt = "LA VEINTE RADIO"
        tag_txt = "96.1 FM · VOZ SINDICAL IMSS" if not vertical else "VOZ SINDICAL"

        y = safe_top
        if vertical:
            cx = w // 2
            pill_w = int(240 * s)
            pill_h = int(32 * s)
            bx0 = cx - pill_w // 2
            d.rounded_rectangle([bx0, y, bx0 + pill_w, y + pill_h], radius=int(16 * s), fill=(16, 21, 30, 200), outline=(45, 55, 75, 140), width=1)
            dot_r = int(4 * s)
            d.ellipse([bx0 + int(14 * s) - dot_r, y + pill_h // 2 - dot_r, bx0 + int(14 * s) + dot_r, y + pill_h // 2 + dot_r], fill=accent)
            d.text((bx0 + int(26 * s), y + int(7 * s)), f"{brand_txt} · {tag_txt}", font=f_brand, fill=(226, 232, 240, 240))
        else:
            bx0 = int(72 * s)
            dot_r = int(4 * s)
            d.ellipse([bx0, y + int(7 * s) - dot_r, bx0 + dot_r * 2, y + int(7 * s) + dot_r], fill=accent)
            d.text((bx0 + int(16 * s), y), brand_txt, font=f_brand, fill=(241, 245, 249, 255))
            d.text((bx0 + int(155 * s), y + int(2 * s)), f"|  {tag_txt}", font=f_tag, fill=(148, 163, 184, 210))

    def _render_speaker_badge(
        self,
        d: ImageDraw.ImageDraw,
        x: int,
        y: int,
        s: float,
        name: str,
        role: str,
        accent: tuple[int, int, int],
        align: str = "left",
    ) -> tuple[int, int]:
        """Badge de locutor con identidad de color y tipografía limpia."""
        f_name = _get_font(True, max(14, int(24 * s)))
        f_role = _get_font(False, max(11, int(14 * s)))

        name_len = d.textlength(name, font=f_name)
        role_len = d.textlength(role, font=f_role)
        card_w = int(max(name_len, role_len) + 48 * s)
        card_h = int(58 * s)

        bx0 = x if align == "left" else (x - card_w // 2 if align == "center" else x - card_w)
        by0 = y
        bx1 = bx0 + card_w
        by1 = by0 + card_h

        d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(8 * s), fill=(14, 18, 26, 220), outline=(40, 48, 65, 160), width=1)

        bar_w = max(3, int(5 * s))
        d.rounded_rectangle([bx0 + int(6 * s), by0 + int(8 * s), bx0 + int(6 * s) + bar_w, by1 - int(8 * s)], radius=max(1, int(2 * s)), fill=accent)

        tx = bx0 + int(20 * s)
        d.text((tx, by0 + int(7 * s)), name, font=f_name, fill=(255, 255, 255, 255))
        d.text((tx, by0 + int(33 * s)), role, font=f_role, fill=(148, 163, 184, 230))

        return card_w, card_h

    def _render_editorial_card(
        self,
        d: ImageDraw.ImageDraw,
        x: int,
        y: int,
        max_w: int,
        s: float,
        headline: str,
        subheadline: str,
        accent: tuple[int, int, int],
    ) -> int:
        """Tarjeta editorial limpia para ideas clave (cero karaoke)."""
        if not headline and not subheadline:
            return y

        f_hl = _get_font(True, max(13, int(20 * s)))
        f_sub = _get_font(False, max(11, int(14 * s)))

        card_pad = int(22 * s)
        inner_w = max_w - card_pad * 2

        words = (headline or "").split()
        lines = 1
        cur = ""
        for w in words:
            t = (cur + " " + w).strip()
            if d.textlength(t, font=f_hl) <= inner_w or not cur:
                cur = t
            else:
                lines += 1
                cur = w

        lh_hl = int(f_hl.size * 1.25)
        card_h = card_pad * 2 + lines * lh_hl + (int(28 * s) if subheadline else 0)

        bx0 = x
        by0 = y
        bx1 = x + max_w
        by1 = by0 + card_h

        d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(10 * s), fill=(15, 20, 30, 225), outline=(42, 52, 72, 170), width=1)

        pill_h = int(18 * s)
        pill_w = int(105 * s)
        d.rounded_rectangle([bx0 + card_pad, by0 + int(12 * s), bx0 + card_pad + pill_w, by0 + int(12 * s) + pill_h], radius=int(4 * s), fill=(accent[0], accent[1], accent[2], 50))
        f_tag = _get_font(True, max(9, int(10 * s)))
        d.text((bx0 + card_pad + int(8 * s), by0 + int(14 * s)), "PUNTO CLAVE", font=f_tag, fill=accent)

        ty = by0 + int(36 * s)
        ty = _draw_wrapped_text(d, headline, f_hl, (255, 255, 255, 255), bx0 + card_pad, ty, inner_w, 1.25)

        if subheadline:
            d.text((bx0 + card_pad, ty + int(6 * s)), subheadline, font=f_sub, fill=(148, 163, 184, 230))

        return by1

    def _draw_multi_layer_wave(
        self,
        d: ImageDraw.ImageDraw,
        points: list[tuple[float, float]],
        ghost_points: list[tuple[float, float]] | None,
        pal: dict[str, Any],
        s: float,
        react_val: float,
    ) -> None:
        """Renderiza el conjunto multi-capa de onda premium."""
        if len(points) < 2:
            return

        primary = pal["primary"]
        glow = pal["glow"]
        light = pal["light"]

        # Capa 1: Resplandor difuso exterior (glow stroke amplio con baja opacidad)
        glow_w = max(4, int(16 * s))
        glow_rgba = (glow[0], glow[1], glow[2], 40)
        d.line(points, fill=glow_rgba, width=glow_w, joint="curve")

        # Capa 2: Halo intermedio
        halo_w = max(3, int(8 * s))
        halo_rgba = (glow[0], glow[1], glow[2], 110)
        d.line(points, fill=halo_rgba, width=halo_w, joint="curve")

        # Capa 3: Ghost ribbon (cinta secundaria para profundidad dimensional)
        if ghost_points and len(ghost_points) >= 2:
            ghost_w = max(1, int(3 * s))
            ghost_rgba = (primary[0], primary[1], primary[2], 75)
            d.line(ghost_points, fill=ghost_rgba, width=ghost_w, joint="curve")

        # Capa 4: Cinta central nítida (core ribbon de alta definición)
        core_w = max(2, int(4 * s))
        core_rgba = (light[0], light[1], light[2], 255)
        d.line(points, fill=core_rgba, width=core_w, joint="curve")

        # Capa 5: Nodos brillantes discretos en crestas notables
        node_step = max(15, len(points) // 10)
        node_r = max(2, int(4 * s))
        for idx in range(node_step, len(points) - node_step, node_step):
            px, py = points[idx]
            if react_val > 0.18:
                d.ellipse([px - node_r * 2, py - node_r * 2, px + node_r * 2, py + node_r * 2], fill=(glow[0], glow[1], glow[2], 60))
                d.ellipse([px - node_r, py - node_r, px + node_r, py + node_r], fill=(255, 255, 255, 240))

    def _render_progress_bar(
        self,
        d: ImageDraw.ImageDraw,
        w: int,
        h: int,
        safe_bottom: int,
        pad_x: int,
        s: float,
        accent: tuple[int, int, int],
        light: tuple[int, int, int],
        progress: float,
    ) -> None:
        """Barra de progreso inferior discreta y sincronizada."""
        prog = max(0.0, min(1.0, float(progress)))
        y = h - safe_bottom + int(14 * s)
        x0 = pad_x
        x1 = w - pad_x
        total_w = x1 - x0

        track_h = max(2, int(3 * s))
        d.rounded_rectangle([x0, y, x1, y + track_h], radius=track_h // 2, fill=(35, 42, 56, 160))

        cur_w = int(total_w * prog)
        if cur_w > 0:
            d.rounded_rectangle([x0, y, x0 + cur_w, y + track_h], radius=track_h // 2, fill=accent)

            head_x = x0 + cur_w
            head_y = y + track_h // 2
            hr = max(2, int(4 * s))
            d.ellipse([head_x - hr * 2, head_y - hr * 2, head_x + hr * 2, head_y + hr * 2], fill=(accent[0], accent[1], accent[2], 90))
            d.ellipse([head_x - hr, head_y - hr, head_x + hr, head_y + hr], fill=(255, 255, 255, 255))

    # -------------------------------------------------------------------------
    # LAS 6 COMPOSICIONES OFICIALES
    # -------------------------------------------------------------------------

    def _render_comp_centered(
        self,
        d: ImageDraw.ImageDraw,
        pal: dict[str, Any],
        w: int,
        h: int,
        s: float,
        vertical: bool,
        pad_x: int,
        safe_top: int,
        safe_bottom: int,
        name: str,
        role: str,
        headline: str,
        subheadline: str,
        react_val: float,
        energy: float,
        time_t: float,
        progress: float,
    ) -> None:
        """Composición 1: Onda centrada protagonista con badge y metadatos limpios."""
        cx = w / 2.0
        cy = h * (0.52 if vertical else 0.54)

        badge_y = int(h * (0.30 if vertical else 0.28))
        self._render_speaker_badge(d, int(cx), badge_y, s, name, role, pal["primary"], align="center")

        if headline:
            card_w = min(int(w * (0.84 if vertical else 0.55)), w - pad_x * 2)
            card_x = int(cx - card_w / 2.0)
            card_y = int(h * (0.68 if vertical else 0.72))
            self._render_editorial_card(d, card_x, card_y, card_w, s, headline, subheadline, pal["primary"])

        wave_w = w * (0.88 if vertical else 0.76)
        max_amp = (h * 0.16) if vertical else (h * 0.22)

        harmonics = [
            (12.0, 0.60, 2.2),
            (24.0, 0.28, -3.1),
            (36.0, 0.14, 1.6),
        ]
        ghost_harmonics = [
            (14.0, 0.50, 1.7),
            (28.0, 0.25, -2.4),
        ]

        pts = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val, time_t, harmonics)
        ghost_pts = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val * 0.65, time_t, ghost_harmonics)

        self._draw_multi_layer_wave(d, pts, ghost_pts, pal, s, react_val)

    def _render_comp_left_title(
        self,
        d: ImageDraw.ImageDraw,
        pal: dict[str, Any],
        w: int,
        h: int,
        s: float,
        vertical: bool,
        pad_x: int,
        safe_top: int,
        safe_bottom: int,
        name: str,
        role: str,
        headline: str,
        subheadline: str,
        react_val: float,
        energy: float,
        time_t: float,
        progress: float,
    ) -> None:
        """Composición 2: Titular editorial destacado en bloque lateral o superior."""
        if vertical:
            card_w = w - pad_x * 2
            card_y = safe_top + int(60 * s)
            end_card_y = self._render_editorial_card(d, pad_x, card_y, card_w, s, headline or "CONVERSACIÓN EN CABINA", subheadline, pal["primary"])

            cx = w / 2.0
            cy = max(end_card_y + int(140 * s), h * 0.65)
            wave_w = w * 0.88
            max_amp = h * 0.15

            self._render_speaker_badge(d, pad_x, int(cy - int(80 * s)), s, name, role, pal["primary"], align="left")
        else:
            col_w = int(w * 0.44)
            card_y = int(h * 0.30)
            self._render_speaker_badge(d, pad_x, int(h * 0.20), s, name, role, pal["primary"], align="left")
            self._render_editorial_card(d, pad_x, card_y, col_w, s, headline or "ANÁLISIS NORMATIVO Y SINDICAL", subheadline, pal["primary"])

            cx = w * 0.70
            cy = h * 0.50
            wave_w = w * 0.50
            max_amp = h * 0.22

        harmonics = [(13.0, 0.62, 2.4), (26.0, 0.26, -2.8), (38.0, 0.12, 1.4)]
        ghost_harmonics = [(15.0, 0.45, 1.6), (30.0, 0.22, -2.1)]

        pts = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val, time_t, harmonics)
        ghost_pts = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val * 0.60, time_t, ghost_harmonics)

        self._draw_multi_layer_wave(d, pts, ghost_pts, pal, s, react_val)

    def _render_comp_bottom_editorial(
        self,
        d: ImageDraw.ImageDraw,
        pal: dict[str, Any],
        w: int,
        h: int,
        s: float,
        vertical: bool,
        pad_x: int,
        safe_top: int,
        safe_bottom: int,
        name: str,
        role: str,
        headline: str,
        subheadline: str,
        key_points: list[str] | None,
        react_val: float,
        energy: float,
        time_t: float,
        progress: float,
    ) -> None:
        """Composición 3: Onda en tercio inferior con tarjeta explicativa arriba."""
        cx = w / 2.0
        cy = h * (0.76 if vertical else 0.75)

        card_w = min(int(w * (0.88 if vertical else 0.62)), w - pad_x * 2)
        card_x = int(cx - card_w / 2.0)
        card_y = safe_top + int(45 * s) if vertical else int(h * 0.18)

        self._render_speaker_badge(d, card_x, card_y, s, name, role, pal["primary"], align="left")
        self._render_editorial_card(d, card_x, card_y + int(70 * s), card_w, s, headline or "DATOS Y CONCLUSIÓN CLAVE", subheadline, pal["primary"])

        wave_w = w * (0.90 if vertical else 0.82)
        max_amp = (h * 0.14) if vertical else (h * 0.18)

        harmonics = [(11.0, 0.65, 2.0), (22.0, 0.25, -3.0), (33.0, 0.10, 1.8)]
        ghost_harmonics = [(13.0, 0.50, 1.5), (25.0, 0.20, -2.2)]

        pts = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val, time_t, harmonics)
        ghost_pts = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val * 0.60, time_t, ghost_harmonics)

        self._draw_multi_layer_wave(d, pts, ghost_pts, pal, s, react_val)

    def _render_comp_ribbon(
        self,
        d: ImageDraw.ImageDraw,
        pal: dict[str, Any],
        w: int,
        h: int,
        s: float,
        vertical: bool,
        pad_x: int,
        safe_top: int,
        safe_bottom: int,
        name: str,
        role: str,
        headline: str,
        subheadline: str,
        react_val: float,
        energy: float,
        time_t: float,
        progress: float,
    ) -> None:
        """Composición 4: Flujo fluido multi-cinta horizontal continuo."""
        cx = w / 2.0
        cy = h * (0.50 if vertical else 0.50)

        badge_y = int(h * (0.24 if vertical else 0.22))
        self._render_speaker_badge(d, int(cx), badge_y, s, name, role, pal["primary"], align="center")

        wave_w = w * (0.92 if vertical else 0.86)
        max_amp = (h * 0.15) if vertical else (h * 0.20)

        h1 = [(10.0, 0.60, 2.5), (20.0, 0.30, -2.8)]
        pts1 = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val, time_t, h1)

        h2 = [(14.0, 0.50, -1.9), (28.0, 0.25, 3.2)]
        pts2 = self._generate_harmonic_points(cx, cy + int(15 * s), wave_w, max_amp * react_val * 0.80, time_t * 1.2, h2)

        h3 = [(8.0, 0.40, 1.4), (16.0, 0.20, -1.8)]
        pts3 = self._generate_harmonic_points(cx, cy - int(15 * s), wave_w, max_amp * react_val * 0.60, time_t * 0.8, h3)

        self._draw_multi_layer_wave(d, pts2, None, pal, s, react_val * 0.8)
        self._draw_multi_layer_wave(d, pts3, None, pal, s, react_val * 0.6)
        self._draw_multi_layer_wave(d, pts1, None, pal, s, react_val)

    def _render_comp_minimal(
        self,
        d: ImageDraw.ImageDraw,
        pal: dict[str, Any],
        w: int,
        h: int,
        s: float,
        vertical: bool,
        pad_x: int,
        safe_top: int,
        safe_bottom: int,
        name: str,
        role: str,
        react_val: float,
        energy: float,
        time_t: float,
        progress: float,
    ) -> None:
        """Composición 5: Minimalismo absoluto — onda pura + speaker badge."""
        cx = w / 2.0
        cy = h * 0.50

        badge_y = h - safe_bottom - int(70 * s)
        self._render_speaker_badge(d, pad_x, badge_y, s, name, role, pal["primary"], align="left")

        wave_w = w * (0.86 if vertical else 0.78)
        max_amp = (h * 0.18) if vertical else (h * 0.24)

        harmonics = [(12.0, 0.65, 2.2), (24.0, 0.25, -3.0), (36.0, 0.10, 1.7)]
        ghost_harmonics = [(14.0, 0.45, 1.5), (28.0, 0.20, -2.3)]

        pts = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val, time_t, harmonics)
        ghost_pts = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val * 0.55, time_t, ghost_harmonics)

        self._draw_multi_layer_wave(d, pts, ghost_pts, pal, s, react_val)

    def _render_comp_focus_quote(
        self,
        d: ImageDraw.ImageDraw,
        pal: dict[str, Any],
        w: int,
        h: int,
        s: float,
        vertical: bool,
        pad_x: int,
        safe_top: int,
        safe_bottom: int,
        name: str,
        role: str,
        quote_text: str,
        context_sub: str,
        react_val: float,
        energy: float,
        time_t: float,
        progress: float,
    ) -> None:
        """Composición 6: Tarjeta de cita destacada con mini-onda reactiva debajo."""
        cx = w / 2.0

        card_w = min(int(w * (0.88 if vertical else 0.60)), w - pad_x * 2)
        card_x = int(cx - card_w / 2.0)
        card_y = safe_top + int(40 * s) if vertical else int(h * 0.16)

        self._render_speaker_badge(d, card_x, card_y, s, name, role, pal["primary"], align="left")

        f_quote = _get_font(True, max(14, int(22 * s)))
        f_sub = _get_font(False, max(11, int(13 * s)))
        f_mark = _get_font(True, max(28, int(48 * s)))

        card_pad = int(24 * s)
        inner_w = card_w - card_pad * 2

        raw_txt = (quote_text or "Defensa permanente de los derechos del trabajador IMSS.").strip()
        cleaned_quote = f'"{raw_txt}"' if not raw_txt.startswith('"') else raw_txt

        by0 = card_y + int(70 * s)
        by1 = _draw_wrapped_text(d, cleaned_quote, f_quote, (255, 255, 255, 255), card_x + card_pad, by0 + int(28 * s), inner_w, 1.3)
        if context_sub:
            d.text((card_x + card_pad, by1 + int(6 * s)), context_sub, font=f_sub, fill=(148, 163, 184, 230))
            by1 += int(24 * s)

        by1 += card_pad
        d.rounded_rectangle([card_x, by0, card_x + card_w, by1], radius=int(10 * s), fill=(16, 21, 31, 230), outline=(45, 55, 75, 170), width=1)
        d.text((card_x + int(14 * s), by0 - int(6 * s)), "“", font=f_mark, fill=(pal["primary"][0], pal["primary"][1], pal["primary"][2], 120))
        ty = _draw_wrapped_text(d, cleaned_quote, f_quote, (255, 255, 255, 255), card_x + card_pad, by0 + int(24 * s), inner_w, 1.3)
        if context_sub:
            d.text((card_x + card_pad, ty + int(6 * s)), context_sub, font=f_sub, fill=(148, 163, 184, 230))

        cy = by1 + int((h - safe_bottom - by1) * 0.45)
        wave_w = card_w * 0.90
        max_amp = (h * 0.10) if vertical else (h * 0.14)

        harmonics = [(12.0, 0.65, 2.0), (24.0, 0.25, -2.7)]
        pts = self._generate_harmonic_points(cx, cy, wave_w, max_amp * react_val, time_t, harmonics)
        self._draw_multi_layer_wave(d, pts, None, pal, s, react_val)
