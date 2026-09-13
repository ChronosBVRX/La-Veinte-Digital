"""Compositor de Escenas Editoriales para La Veinte Radio.

Ensambla multicapa determinista:
Capa 1: Fondo editorial / B-roll investigado con tratamiento de contraste y viñeta.
Capa 2: Gráficos o diagramas programáticos (100% matemáticos, cero IA).
Capa 3: Overlays de logotipos oficiales (SVG/PNG transparente en su proporción original).
Capa 4: Tarjeta de identidad del locutor, indicador reactivo y tipografía cinética.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from .charts import ProgrammaticChartRenderer, _get_font


class SceneComposer:
    """Compone escenas combinando B-roll, gráficos programáticos y logos oficiales."""

    def __init__(self, assets_root: Path | str | None = None) -> None:
        if assets_root is None:
            root = Path(__file__).resolve().parents[4]
            self.assets_root = root / "assets" / "editorial"
        else:
            self.assets_root = Path(assets_root)

        self.charts = ProgrammaticChartRenderer()
        self._image_cache: dict[str, Image.Image] = {}
        self._character_cache: dict[str, Image.Image] = {}
        self._studio_backdrop_cache: dict[str, Image.Image] = {}

    def get_asset_image(
        self,
        rel_path: str,
        target_w: int,
        target_h: int,
        protagonist: bool = False,
    ) -> Image.Image | None:
        """Carga, cachea y redimensiona un asset preservando proporción y aplicando viñeta editorial."""
        cache_key = f"{rel_path}:{target_w}x{target_h}:{'p' if protagonist else 'b'}"
        if cache_key in self._image_cache:
            return self._image_cache[cache_key].copy()

        full_path = self.assets_root / rel_path
        if not full_path.exists():
            return None

        try:
            raw = Image.open(full_path).convert("RGBA")
            # Ajuste de tamaño manteniendo relación de aspecto con recorte centrado (cover)
            src_w, src_h = raw.size
            ratio = max(target_w / src_w, target_h / src_h)
            new_w, new_h = int(src_w * ratio), int(src_h * ratio)
            resized = raw.resize((new_w, new_h), Image.Resampling.LANCZOS)

            # Recorte centrado
            crop_x = (new_w - target_w) // 2
            crop_y = (new_h - target_h) // 2
            cropped = resized.crop((crop_x, crop_y, crop_x + target_w, crop_y + target_h))

            if protagonist:
                # Claridad natural para documentos y referencias protagonistas: brillo natural y alto contraste
                enhancer = ImageEnhance.Brightness(cropped)
                enhanced = enhancer.enhance(0.92)
                self._image_cache[cache_key] = enhanced
                return enhanced.copy()
            else:
                # Tratamiento de fondo para cuando hay tarjetas de texto encima: oscurecer
                enhancer = ImageEnhance.Brightness(cropped)
                dimmed = enhancer.enhance(0.42)
                self._image_cache[cache_key] = dimmed
                return dimmed.copy()
        except Exception:
            return None

    def render_documentary_evidence_scene(
        self,
        base_img: Image.Image,
        resolved_asset: dict | None,
        headline: str,
        subheadline: str,
        w: int,
        h: int,
        vertical: bool = False,
        overlay_logos: list[str] | None = None,
        progress: float = 0.0,
    ) -> Image.Image:
        """Compone una escena documental donde el activo real es el protagonista (80-100% canvas).
        
        Incluye viñeta cinematográfica, badge inferior discreto para titular/cláusula/ubicación,
        y logotipos oficiales en esquina superior derecha sin tapar el documento.
        """
        if not resolved_asset or not resolved_asset.get("file"):
            return base_img

        # 1. Cargar asset con calidad protagonista
        asset_img = self.get_asset_image(resolved_asset["file"], w, h, protagonist=True)
        if asset_img is None:
            return base_img

        out = Image.alpha_composite(base_img.convert("RGBA"), asset_img)
        d = ImageDraw.Draw(out, "RGBA")

        # 2. Escala y fuentes
        s = min(w / 1920.0, h / 1080.0) if not vertical else min(w / 1080.0, h / 1920.0)
        from .charts import _get_font
        f_title = _get_font(True, max(12, int(22 * s)))
        f_sub = _get_font(False, max(10, int(15 * s)))

        # 3. Badge discreto en margen inferior seguro
        asset_id = resolved_asset.get("asset_id") or ""
        badge_hl = headline
        badge_sub = subheadline

        if not badge_hl:
            if "hgr1_charo" in asset_id:
                badge_hl = "HGR No. 1 · Charo, Michoacán"
            elif "sntss_congress" in asset_id:
                badge_hl = "SNTSS · CONGRESO NACIONAL ORDINARIO"
            elif "cct" in asset_id:
                badge_hl = "CONTRATO COLECTIVO DE TRABAJO"
            elif "tarjeton" in asset_id:
                badge_hl = "TARJETÓN IMSS DIGITAL"
            else:
                badge_hl = resolved_asset.get("entity", "")

        if not badge_sub:
            if "hgr1_charo" in asset_id:
                badge_sub = "Hospital General Regional No. 1 del IMSS"
            elif "sntss_congress" in asset_id:
                badge_sub = "Sede Sindical Nacional · Auditorio Principal"
            elif "cct" in asset_id:
                badge_sub = "Edición Oficial Vigente 2025–2027 · IMSS - SNTSS"
            elif "tarjeton" in asset_id:
                badge_sub = "Comprobante Oficial de Percepciones y Deducciones"
            else:
                badge_sub = resolved_asset.get("notes", "")

        if badge_hl or badge_sub:
            if vertical:
                pad_x = int(70 * s)
                bx0 = max(20, pad_x)
                by0 = h - int(320 * s)
                bw = w - bx0 * 2
                bh = int(100 * s)
            else:
                bx0 = int(w * 0.06)
                by0 = int(h * 0.82)
                bw = int(w * 0.52)
                bh = int(72 * s)

            bx1 = bx0 + bw
            by1 = by0 + bh

            # Fondo del badge: pill oscuro semitransparente
            d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(8 * s), fill=(10, 14, 23, 220), outline=(51, 65, 85, 180), width=1)

            # Barra vertical de acento (rojo institucional para documentos/normativa o azul para otros)
            is_doc = resolved_asset.get("type") == "document" or "cct" in (resolved_asset.get("file") or "").lower()
            accent_col = (225, 29, 72, 255) if is_doc else (37, 99, 235, 255)
            bar_w = max(3, int(5 * s))
            d.rectangle([bx0 + int(6 * s), by0 + int(10 * s), bx0 + int(6 * s) + bar_w, by1 - int(10 * s)], fill=accent_col)

            # Textos del badge
            tx = bx0 + int(18 * s)
            ty1 = by0 + int(10 * s)
            d.text((tx, ty1), badge_hl, font=f_title, fill=(255, 255, 255, 255))

            if badge_sub:
                ty2 = ty1 + int(26 * s)
                d.text((tx, ty2), badge_sub, font=f_sub, fill=(148, 163, 184, 240))

        # 4. Overlays de logos oficiales
        logos = overlay_logos or resolved_asset.get("overlay_logos") or []
        if logos:
            out = self.overlay_official_logos(out.convert("RGB"), logos, w, h, vertical=vertical).convert("RGBA")

        return out.convert("RGB")

    def render_documentary_context_scene(
        self,
        base_img: Image.Image,
        resolved_asset: dict | None,
        headline: str,
        subheadline: str,
        w: int,
        h: int,
        vertical: bool = False,
        progress: float = 0.0,
    ) -> Image.Image:
        """Compone una escena de B-roll o contexto realista con tratamiento documental."""
        if not resolved_asset or not resolved_asset.get("file"):
            return base_img

        broll = self.get_asset_image(resolved_asset["file"], w, h, protagonist=True)
        if broll is None:
            return base_img

        # Tratamiento de contexto: brillo natural (0.86)
        enhancer = ImageEnhance.Brightness(broll)
        broll = enhancer.enhance(0.86)

        out = Image.alpha_composite(base_img.convert("RGBA"), broll.convert("RGBA"))
        d = ImageDraw.Draw(out, "RGBA")

        s = min(w / 1920.0, h / 1080.0) if not vertical else min(w / 1080.0, h / 1920.0)
        from .charts import _get_font
        f_title = _get_font(True, max(12, int(20 * s)))
        f_sub = _get_font(False, max(10, int(14 * s)))

        badge_hl = headline or resolved_asset.get("entity", "ENTORNO LABORAL IMSS")
        badge_sub = subheadline or "Contexto y Práctica Laboral en Turno"

        if badge_hl or badge_sub:
            if vertical:
                pad_x = int(70 * s)
                bx0 = max(20, pad_x)
                by0 = h - int(320 * s)
                bw = w - bx0 * 2
                bh = int(90 * s)
            else:
                bx0 = int(w * 0.06)
                by0 = int(h * 0.83)
                bw = int(w * 0.48)
                bh = int(68 * s)

            bx1 = bx0 + bw
            by1 = by0 + bh

            d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(8 * s), fill=(10, 14, 23, 210), outline=(51, 65, 85, 160), width=1)

            accent_col = (11, 79, 55, 255)
            bar_w = max(3, int(5 * s))
            d.rectangle([bx0 + int(6 * s), by0 + int(8 * s), bx0 + int(6 * s) + bar_w, by1 - int(8 * s)], fill=accent_col)

            tx = bx0 + int(18 * s)
            ty1 = by0 + int(8 * s)
            d.text((tx, ty1), badge_hl, font=f_title, fill=(255, 255, 255, 255))

            if badge_sub:
                ty2 = ty1 + int(24 * s)
                d.text((tx, ty2), badge_sub, font=f_sub, fill=(148, 163, 184, 230))

        return out.convert("RGB")


    def compose_background(
        self,
        base_img: Image.Image,
        resolved_asset: dict | None,
        w: int,
        h: int,
        vertical: bool = False,
    ) -> Image.Image:
        """Compone la capa de fondo combinando la paleta base con el asset B-roll."""
        if not resolved_asset or not resolved_asset.get("file"):
            return base_img

        broll = self.get_asset_image(resolved_asset["file"], w, h)
        if broll is None:
            return base_img

        # Mezcla suave entre el fondo plano de la identidad y la imagen editorial
        out = Image.alpha_composite(base_img.convert("RGBA"), broll)
        return out.convert("RGB")

    def overlay_official_logos(
        self,
        canvas: Image.Image,
        logo_ids: list[str],
        w: int,
        h: int,
        vertical: bool = False,
    ) -> Image.Image:
        """Superpone logotipos oficiales como overlay vectorial/PNG sin distorsión."""
        if not logo_ids:
            return canvas

        out = canvas.convert("RGBA")
        logo_map = {
            "logo_imss_official": "logos/imss_official_logo.png",
            "logo_sntss_official": "logos/sntss_official_logo.png",
            "logo_cfcrl_official": "logos/cfcrl_official_logo.png",
        }

        # Posición de badge de logo oficial: esquina superior derecha dentro de safe area
        logo_h = 44 if not vertical else 48
        cur_x = (w - (110 if not vertical else 90))

        for lid in logo_ids:
            rel = logo_map.get(lid)
            if not rel:
                continue
            logo_path = self.assets_root / rel
            if not logo_path.exists():
                continue

            try:
                logo_img = Image.open(logo_path).convert("RGBA")
                aspect = logo_img.width / max(1, logo_img.height)
                calc_w = int(logo_h * aspect)
                resized_logo = logo_img.resize((calc_w, logo_h), Image.Resampling.LANCZOS)

                pos_x = cur_x - calc_w
                pos_y = 60 if not vertical else 110
                out.alpha_composite(resized_logo, (pos_x, pos_y))
                cur_x = pos_x - 20
            except Exception:
                continue

        return out.convert("RGB")

    def render_programmatic_chart_beat(
        self,
        chart_type: str,
        w: int,
        h: int,
        vertical: bool = False,
        progress: float = 1.0,
    ) -> Image.Image | None:
        """Invoca el generador programático correspondiente al beat visual."""
        if chart_type == "stat_breakdown_855":
            return self.charts.render_stat_breakdown_card(w, h, vertical=vertical, progress=progress)
        elif chart_type == "comparison_lft_revision":
            return self.charts.render_comparison_card(w, h, vertical=vertical)
        elif chart_type == "payroll_sim_tarjeton":
            return self.charts.render_payroll_simulation_card(w, h, vertical=vertical)
        elif chart_type == "retirement_timeline_cct157":
            return self.charts.render_retirement_timeline_card(w, h, vertical=vertical)
        elif chart_type == "lft_document_399bis":
            return self.charts.render_lft_document_card(w, h, article_code="399bis", vertical=vertical)
        elif chart_type == "lft_document_400bis":
            return self.charts.render_lft_document_card(w, h, article_code="400bis", vertical=vertical)
        elif chart_type == "cct_clause_157":
            return self.charts.render_cct_clause_card(w, h, clause_code="157", vertical=vertical)
        elif chart_type == "tarjeton_detail_c02":
            return self.charts.render_tarjeton_detail_card(w, h, concept_code="02", vertical=vertical)
        elif chart_type == "tarjeton_detail_c11":
            return self.charts.render_tarjeton_detail_card(w, h, concept_code="11", vertical=vertical)
        return None

    def get_studio_backdrop(
        self,
        slug: str,
        char_accent: tuple[int, int, int],
        w: int,
        h: int,
        vertical: bool = False,
    ) -> Image.Image:
        key = f"{slug}:{char_accent}:{w}x{h}:{'v' if vertical else 'h'}"
        if key in self._studio_backdrop_cache:
            return self._studio_backdrop_cache[key].copy()

        out = Image.new("RGBA", (w, h), (14, 17, 23, 255))
        s = min(w / 1920.0, h / 1080.0) if not vertical else min(w / 1080.0, h / 1920.0)
        glow_cx = int(w * 0.62) if not vertical else int(w * 0.50)
        glow_cy = int(h * 0.45) if not vertical else int(h * 0.40)
        glow_radius = int(h * 0.65) if not vertical else int(w * 0.80)

        glow_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d_glow = ImageDraw.Draw(glow_layer, "RGBA")
        r, g, b = char_accent
        for rad in range(glow_radius, 20, -15 if not vertical else -20):
            alpha = int(45 * (1.0 - rad / glow_radius) ** 1.8)
            d_glow.ellipse([glow_cx - rad, glow_cy - rad, glow_cx + rad, glow_cy + rad], fill=(r, g, b, alpha))
        glow_blur = glow_layer.filter(ImageFilter.GaussianBlur(radius=int(25 * s) if s >= 0.5 else 12))
        out = Image.alpha_composite(out, glow_blur)

        d = ImageDraw.Draw(out, "RGBA")
        top_h = int(h * 0.035)
        d.rectangle([0, 0, w, top_h], fill=(10, 13, 18, 255))
        d.line([0, top_h, w, top_h], fill=(char_accent[0], char_accent[1], char_accent[2], 120), width=max(1, int(2 * s)))

        self._studio_backdrop_cache[key] = out
        return out.copy()

    def render_speaker_character_scene(
        self,
        base_img: Image.Image,
        speaker_name: str,
        rol: str,
        w: int,
        h: int,
        accent: tuple[int, int, int] | None = None,
        vertical: bool = False,
        variant: str = "neutral",
        headline: str = "",
        subheadline: str = "",
        progress: float = 0.0,
        react_val: float = 0.0,
    ) -> Image.Image:
        """Compone una escena de alta fidelidad centrada en el locutor en cabina.

        Incluye:
        - Iluminación ambiental cálida coherente con la identidad del locutor (cacheados en memoria).
        - Retrato transparente del locutor con micro-respiración y pulso audio-reactivo.
        - Identificador lower-third discreto con nombre, rol y credencial institucional.
        - Tarjeta de titular/bullet opcional sin sobrecargar de texto (anti-karaoke).
        """
        slug_map = {
            "eduardo": "eduardo",
            "andrea": "andrea",
            "javier": "javier",
            "javier ríos": "javier",
            "javier rios": "javier",
            "rodrigo": "rodrigo",
            "rodrigo torres": "rodrigo",
            "valeria": "valeria",
            "valeria soto": "valeria",
        }
        spk_raw = speaker_name.lower().strip()
        slug = slug_map.get(spk_raw)
        if not slug:
            for k, v in slug_map.items():
                if k in spk_raw:
                    slug = v
                    break
        if not slug:
            slug = "eduardo"

        role_map = {
            "eduardo": ("EDUARDO", "Conductor Titular · La Veinte Radio", (245, 158, 11)),
            "andrea": ("ANDREA", "Co-Conductora · Asuntos Colectivos", (251, 191, 36)),
            "javier": ("JAVIER RÍOS", "Analista Laboral y Normativo", (125, 211, 252)),
            "rodrigo": ("RODRIGO TORRES", "Corresponsal y Enlace Informativo", (110, 231, 183)),
            "valeria": ("VALERIA SOTO", "Asuntos Jurídicos e Institucionales", (225, 29, 72)),
        }
        default_name, default_role, default_accent = role_map.get(slug, ("LOCUTOR", "La Veinte Radio", (245, 158, 11)))
        display_name = default_name
        display_role = rol or default_role
        char_accent = accent or default_accent

        # 1. Fondo de estudio pre-cacheado (evita GaussianBlur costoso en cada cuadro)
        out = self.get_studio_backdrop(slug, char_accent, w, h, vertical=vertical)
        s = min(w / 1920.0, h / 1080.0) if not vertical else min(w / 1080.0, h / 1920.0)

        # 2. Cargar y posicionar personaje con micro-vida (respiración y pulso audio-reactivo)
        char_dir = self.assets_root / "characters" / slug
        valid_variants = ("neutral", "explaining", "listening", "serious", "question", "emphasis")
        chosen_variant = variant if variant in valid_variants else "neutral"
        char_file = char_dir / f"{chosen_variant}.png"
        if not char_file.exists():
            char_file = char_dir / "neutral.png"

        if char_file.exists():
            cache_k = f"{char_file}:{w}x{h}:{chosen_variant}"
            if cache_k in self._character_cache:
                char_raw = self._character_cache[cache_k]
            else:
                char_raw = Image.open(char_file).convert("RGBA")
                self._character_cache[cache_k] = char_raw

            if not vertical:
                target_char_h = int(h * 0.86)
                scale_pulse = 1.0 + 0.005 * math.sin(progress * 2 * math.pi) + 0.010 * max(0.0, min(1.0, react_val))
                final_char_h = int(target_char_h * scale_pulse)
                final_char_w = int(char_raw.width * (final_char_h / char_raw.height))
                char_resized = char_raw.resize((final_char_w, final_char_h), Image.Resampling.LANCZOS)

                char_x = int(w * 0.62) - final_char_w // 2
                char_y = h - final_char_h + int(-3 * math.sin(progress * 2 * math.pi) - 5 * react_val)
                out.alpha_composite(char_resized, (char_x, char_y))
            else:
                target_char_h = int(h * 0.55)
                scale_pulse = 1.0 + 0.005 * math.sin(progress * 2 * math.pi) + 0.010 * max(0.0, min(1.0, react_val))
                final_char_h = int(target_char_h * scale_pulse)
                final_char_w = int(char_raw.width * (final_char_h / char_raw.height))
                char_resized = char_raw.resize((final_char_w, final_char_h), Image.Resampling.LANCZOS)

                char_x = (w - final_char_w) // 2
                char_y = int(h * 0.28) + int(-3 * math.sin(progress * 2 * math.pi) - 5 * react_val)
                out.alpha_composite(char_resized, (char_x, char_y))

        # 3. Lower-Third Badge discreto (estilo broadcast)
        d = ImageDraw.Draw(out, "RGBA")
        f_tag = _get_font(True, max(8, int(11 * s)))
        f_name = _get_font(True, max(12, int(23 * s)))
        f_role = _get_font(False, max(9, int(14 * s)))

        if not vertical:
            bx0 = int(w * 0.06)
            by0 = int(h * 0.77)
            bw = int(w * 0.40)
            bh = int(88 * s)
            bx1 = bx0 + bw
            by1 = by0 + bh

            d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(10 * s), fill=(10, 14, 23, 235), outline=(51, 65, 85, 200), width=1)
            bar_w = max(3, int(6 * s))
            d.rounded_rectangle([bx0, by0, bx0 + bar_w, by1], radius=int(3 * s), fill=(char_accent[0], char_accent[1], char_accent[2], 255))

            tx = bx0 + int(18 * s)
            d.text((tx, by0 + int(10 * s)), "LA VEINTE RADIO · PROGRAMA INFORMATIVO", font=f_tag, fill=(char_accent[0], char_accent[1], char_accent[2], 240))
            d.text((tx, by0 + int(26 * s)), display_name, font=f_name, fill=(255, 255, 255, 255))
            d.text((tx, by0 + int(56 * s)), display_role, font=f_role, fill=(148, 163, 184, 240))

            # Titular / Clave editorial opcional en el tercio medio izquierdo (anti-karaoke)
            if headline:
                f_hl = _get_font(True, max(12, int(20 * s)))
                f_sub = _get_font(False, max(10, int(15 * s)))
                hx0 = int(w * 0.06)
                hy0 = int(h * 0.38)
                hw = int(w * 0.40)
                hh = int(110 * s)
                d.rounded_rectangle([hx0, hy0, hx0 + hw, hy0 + hh], radius=int(10 * s), fill=(15, 20, 30, 210), outline=(51, 65, 85, 150), width=1)
                d.rectangle([hx0 + int(5 * s), hy0 + int(10 * s), hx0 + int(5 * s) + max(3, int(4 * s)), hy0 + hh - int(10 * s)], fill=(char_accent[0], char_accent[1], char_accent[2], 255))
                d.text((hx0 + int(18 * s), hy0 + int(14 * s)), headline[:45], font=f_hl, fill=(255, 255, 255, 255))
                if subheadline:
                    d.text((hx0 + int(18 * s), hy0 + int(48 * s)), subheadline[:60], font=f_sub, fill=(203, 213, 225, 220))
        else:
            bx0 = int(w * 0.08)
            by0 = int(h * 0.78)
            bw = int(w * 0.84)
            bh = int(110 * s)
            bx1 = bx0 + bw
            by1 = by0 + bh

            d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(12 * s), fill=(10, 14, 23, 235), outline=(51, 65, 85, 200), width=1)
            bar_w = max(4, int(7 * s))
            d.rounded_rectangle([bx0, by0, bx0 + bar_w, by1], radius=int(4 * s), fill=(char_accent[0], char_accent[1], char_accent[2], 255))

            tx = bx0 + int(22 * s)
            d.text((tx, by0 + int(12 * s)), "LA VEINTE RADIO · EN DIRECTO", font=f_tag, fill=(char_accent[0], char_accent[1], char_accent[2], 240))
            d.text((tx, by0 + int(34 * s)), display_name, font=f_name, fill=(255, 255, 255, 255))
            d.text((tx, by0 + int(72 * s)), display_role, font=f_role, fill=(148, 163, 184, 240))

            if headline:
                f_hl = _get_font(True, max(14, int(24 * s)))
                f_sub = _get_font(False, max(11, int(17 * s)))
                hx0 = int(w * 0.08)
                hy0 = int(h * 0.14)
                hw = int(w * 0.84)
                hh = int(120 * s)
                d.rounded_rectangle([hx0, hy0, hx0 + hw, hy0 + hh], radius=int(12 * s), fill=(15, 20, 30, 210), outline=(51, 65, 85, 150), width=1)
                d.rectangle([hx0 + int(6 * s), hy0 + int(12 * s), hx0 + int(6 * s) + max(3, int(4 * s)), hy0 + hh - int(12 * s)], fill=(char_accent[0], char_accent[1], char_accent[2], 255))
                d.text((hx0 + int(22 * s), hy0 + int(16 * s)), headline[:45], font=f_hl, fill=(255, 255, 255, 255))
                if subheadline:
                    d.text((hx0 + int(22 * s), hy0 + int(56 * s)), subheadline[:60], font=f_sub, fill=(203, 213, 225, 220))

        return out.convert("RGB")

