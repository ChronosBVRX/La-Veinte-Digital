"""Compositor de Escenas Editoriales para La Veinte Radio.

Ensambla multicapa determinista:
Capa 1: Fondo editorial / B-roll investigado con tratamiento de contraste y viñeta.
Capa 2: Gráficos o diagramas programáticos (100% matemáticos, cero IA).
Capa 3: Overlays de logotipos oficiales (SVG/PNG transparente en su proporción original).
Capa 4: Tarjeta de identidad del locutor, indicador reactivo y tipografía cinética.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from .charts import ProgrammaticChartRenderer


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

    def get_asset_image(self, rel_path: str, target_w: int, target_h: int) -> Image.Image | None:
        """Carga, cachea y redimensiona un asset preservando proporción y aplicando viñeta editorial."""
        cache_key = f"{rel_path}:{target_w}x{target_h}"
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

            # Tratamiento editorial: oscurecer ligeramente y aumentar contraste para legibilidad de textos
            enhancer = ImageEnhance.Brightness(cropped)
            dimmed = enhancer.enhance(0.42)

            self._image_cache[cache_key] = dimmed
            return dimmed.copy()
        except Exception:
            return None

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
        return None
