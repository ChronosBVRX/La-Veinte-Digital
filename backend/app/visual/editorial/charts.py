"""Generador Programático de Gráficos y Diagramas Editoriales para La Veinte Radio.

Produce representaciones visuales exactas mediante Pillow:
- Cero IA generativa para texto, números o diagramas.
- Datos derivados 100% de los documentos oficiales y el guion.
- Adaptación geométrica responsiva para 16:9, 9:16 y preview (854x480).
- Cumplimiento estricto de las zonas seguras (safe areas).
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "C:/Windows/Fonts/segoeui.ttf"
FONT_BOLD_PATH = "C:/Windows/Fonts/segoeuib.ttf"
FONT_LIGHT_PATH = "C:/Windows/Fonts/segoeuil.ttf"


def _get_font(bold: bool, size: int) -> ImageFont.FreeTypeFont:
    try:
        p = FONT_BOLD_PATH if bold else FONT_PATH
        return ImageFont.truetype(p, max(11, size))
    except Exception:
        return ImageFont.load_default()


def _draw_wrapped_text(
    d: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple,
    x: int,
    y: int,
    max_w: int,
    line_spacing: float = 1.2,
) -> int:
    """Dibuja texto con ajuste de línea para no rebasar max_w."""
    words = (text or "").split()
    lines = []
    cur = ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    fsize = getattr(font, "size", 16)
    lh = int(fsize * line_spacing)
    for i, ln in enumerate(lines):
        d.text((x, y + i * lh), ln, font=font, fill=fill)
    return y + len(lines) * lh


class ProgrammaticChartRenderer:
    """Renderiza tarjetas estadísticas, diagramas de proceso y nómina."""

    def __init__(self) -> None:
        self.bg_dark = (16, 18, 24)
        self.card_bg = (24, 28, 38)
        self.card_border = (44, 52, 70)
        self.text_cream = (245, 241, 232)
        self.text_muted = (168, 162, 154)
        self.accent_gold = (245, 158, 11)
        self.accent_blue = (56, 189, 248)
        self.accent_green = (16, 185, 129)
        self.accent_red = (239, 68, 68)

    def _get_boxes_and_scale(self, w: int, h: int, vertical: bool) -> tuple[int, int, int, int, float]:
        """Calcula bounding box y factor de escala para preview (854x480), 1080p y 9:16."""
        if vertical:
            box_x0 = int(w * 0.08)  # 86 en 1080 (safe: 70..940)
            box_x1 = int(w * 0.86)  # 928 en 1080
            box_y0 = int(h * 0.23)  # 441 en 1920 (safe: 200..1450)
            box_y1 = int(h * 0.70)  # 1344 en 1920
            scale = w / 1080.0
        else:
            box_x0 = int(w * 0.14)  # 268 en 1920, 119 en 854 (safe: 96..1824)
            box_x1 = int(w * 0.86)  # 1651 en 1920, 734 en 854
            box_y0 = int(h * 0.15)  # 162 en 1080, 72 en 480 (safe: 54..1026)
            box_y1 = int(h * 0.85)  # 918 en 1080, 408 en 480
            scale = h / 1080.0
        return box_x0, box_y0, box_x1, box_y1, scale

    def render_stat_breakdown_card(
        self,
        w: int,
        h: int,
        vertical: bool = False,
        progress: float = 1.0,
    ) -> Image.Image:
        """Renderiza el desglose exacto del incremento del 8.55% anunciado en el Congreso."""
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        box_x0, box_y0, box_x1, box_y1, s = self._get_boxes_and_scale(w, h, vertical)

        # Tarjeta contenedor
        radius = int(24 * s)
        d.rounded_rectangle([box_x0, box_y0, box_x1, box_y1], radius=max(8, radius), fill=self.card_bg, outline=self.card_border, width=max(1, int(2 * s)))

        # Encabezado
        f_title = _get_font(True, int((34 if not vertical else 36) * s))
        f_sub = _get_font(False, int((20 if not vertical else 22) * s))
        f_val = _get_font(True, int((42 if not vertical else 46) * s))
        f_lbl = _get_font(True, int((22 if not vertical else 24) * s))
        f_desc = _get_font(False, int((18 if not vertical else 20) * s))

        pad_x = int(35 * s)
        _draw_wrapped_text(d, "DESGLOSE DEL INCREMENTO ANUNCIADO (8.55%)", f_title, self.accent_gold, box_x0 + pad_x, box_y0 + int(30 * s), box_x1 - box_x0 - pad_x * 2)
        _draw_wrapped_text(d, "Cifra ponderada global presentada en el Congreso del SNTSS", f_sub, self.text_muted, box_x0 + pad_x, box_y0 + int(70 * s), box_x1 - box_x0 - pad_x * 2)

        items = [
            {
                "pct": "2.90%",
                "label": "SUELDO TABULAR",
                "color": self.accent_gold,
                "desc": "Aumento directo al salario base según categoría y jornada.",
                "val_ratio": 2.90 / 8.55,
            },
            {
                "pct": "3.90%",
                "label": "CONCEPTO 11 (AYUDA DE RENTA)",
                "color": self.accent_blue,
                "desc": "Prestación contractual vinculada a la Cláusula 63 Bis del CCT.",
                "val_ratio": 3.90 / 8.55,
            },
            {
                "pct": "1.75%",
                "label": "CLÁUSULA 157 (PREVISIÓN / RETIRO)",
                "color": self.accent_green,
                "desc": "Aportación patronal a cuenta individual (Nueva Generación).",
                "val_ratio": 1.75 / 8.55,
            },
        ]

        y_cursor = box_y0 + int((125 if not vertical else 145) * s)
        item_spacing = int((145 if not vertical else 175) * s)

        for it in items:
            row_h = int((115 if not vertical else 145) * s)
            row_y1 = y_cursor + row_h
            d.rounded_rectangle([box_x0 + int(25 * s), y_cursor, box_x1 - int(25 * s), row_y1], radius=max(6, int(14 * s)), fill=(32, 38, 52), outline=self.card_border, width=1)

            # Porcentaje destacado
            d.text((box_x0 + int(45 * s), y_cursor + int(18 * s)), it["pct"], font=f_val, fill=it["color"])

            max_desc_w = (box_x1 - box_x0 - int(260 * s)) if not vertical else (box_x1 - box_x0 - int(80 * s))
            tx = box_x0 + int(220 * s) if not vertical else box_x0 + int(45 * s)
            ty_lbl = y_cursor + int(20 * s) if not vertical else y_cursor + int(68 * s)
            ty_desc = y_cursor + int(52 * s) if not vertical else y_cursor + int(98 * s)

            d.text((tx, ty_lbl), it["label"], font=f_lbl, fill=self.text_cream)
            _draw_wrapped_text(d, it["desc"], f_desc, self.text_muted, tx, ty_desc, max_desc_w)

            # Barra proporcional animada
            bar_w = int((box_x1 - box_x0 - int(80 * s)) * it["val_ratio"] * min(1.0, progress * 1.2))
            bar_y = row_y1 - int(8 * s)
            d.rectangle([box_x0 + int(35 * s), bar_y, box_x0 + int(35 * s) + bar_w, bar_y + max(2, int(4 * s))], fill=it["color"])

            y_cursor += item_spacing

        # Conclusión editorial en pie de tarjeta
        note = "Nota: El 8.55% no llega íntegro a la quincena; se divide entre sueldo, renta y ahorro para retiro."
        f_note = _get_font(False, int((16 if not vertical else 18) * s))
        _draw_wrapped_text(d, note, f_note, self.text_muted, box_x0 + pad_x, box_y1 - int(40 * s), box_x1 - box_x0 - pad_x * 2)

        return img

    def render_comparison_card(
        self,
        w: int,
        h: int,
        vertical: bool = False,
    ) -> Image.Image:
        """Compara Revisión Salarial Anual vs Revisión Contractual Integral (LFT)."""
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        box_x0, box_y0, box_x1, box_y1, s = self._get_boxes_and_scale(w, h, vertical)

        radius = int(24 * s)
        d.rounded_rectangle([box_x0, box_y0, box_x1, box_y1], radius=max(8, radius), fill=self.card_bg, outline=self.card_border, width=max(1, int(2 * s)))

        f_title = _get_font(True, int((30 if not vertical else 34) * s))
        f_sub = _get_font(False, int((18 if not vertical else 20) * s))
        f_col_title = _get_font(True, int((22 if not vertical else 26) * s))
        f_body = _get_font(False, int((17 if not vertical else 19) * s))

        pad_x = int(35 * s)
        _draw_wrapped_text(d, "LEY FEDERAL DEL TRABAJO: TIPOS DE REVISIÓN", f_title, self.accent_blue, box_x0 + pad_x, box_y0 + int(30 * s), box_x1 - box_x0 - pad_x * 2)
        _draw_wrapped_text(d, "Marco legal aplicable ante el Centro Federal Laboral (CFCRL)", f_sub, self.text_muted, box_x0 + pad_x, box_y0 + int(68 * s), box_x1 - box_x0 - pad_x * 2)

        if not vertical:
            col_w = (box_x1 - box_x0 - int(80 * s)) // 2
            c1_x0 = box_x0 + int(30 * s)
            c1_x1 = c1_x0 + col_w
            d.rounded_rectangle([c1_x0, box_y0 + int(115 * s), c1_x1, box_y1 - int(35 * s)], radius=max(6, int(14 * s)), fill=(30, 36, 48), outline=self.card_border, width=1)
            d.text((c1_x0 + int(20 * s), box_y0 + int(135 * s)), "REVISIÓN SALARIAL ANUAL", font=f_col_title, fill=self.accent_gold)
            d.text((c1_x0 + int(20 * s), box_y0 + int(168 * s)), "Artículo 399 Bis LFT", font=f_sub, fill=self.accent_blue)

            points_1 = [
                "• Revisa cada año salarios por cuota diaria.",
                "• Acuerdo bilateral entre sindicato y patrón.",
                "• La guía del CFCRL aclara que no requiere consulta a toda la base.",
                "• Se formaliza directamente ante la autoridad laboral.",
            ]
            py = box_y0 + int(210 * s)
            for pt in points_1:
                py = _draw_wrapped_text(d, pt, f_body, self.text_cream, c1_x0 + int(20 * s), py, col_w - int(40 * s)) + int(12 * s)

            c2_x0 = c1_x1 + int(20 * s)
            c2_x1 = box_x1 - int(30 * s)
            d.rounded_rectangle([c2_x0, box_y0 + int(115 * s), c2_x1, box_y1 - int(35 * s)], radius=max(6, int(14 * s)), fill=(30, 36, 48), outline=self.card_border, width=1)
            d.text((c2_x0 + int(20 * s), box_y0 + int(135 * s)), "REVISIÓN CONTRACTUAL INTEGRAL", font=f_col_title, fill=self.accent_green)
            d.text((c2_x0 + int(20 * s), box_y0 + int(168 * s)), "Artículos 400 Bis y 390 Ter LFT", font=f_sub, fill=self.accent_blue)

            points_2 = [
                "• Se realiza cada 2 años para todo el clausulado.",
                "• Obligatorio someter a consulta democrática.",
                "• Voto personal, libre, directo y secreto.",
                "• Requiere mayoría de votos a favor para ser válido.",
            ]
            py = box_y0 + int(210 * s)
            for pt in points_2:
                py = _draw_wrapped_text(d, pt, f_body, self.text_cream, c2_x0 + int(20 * s), py, col_w - int(40 * s)) + int(12 * s)
        else:
            h_half = (box_y1 - box_y0 - int(160 * s)) // 2
            b1_y0 = box_y0 + int(115 * s)
            b1_y1 = b1_y0 + h_half
            d.rounded_rectangle([box_x0 + int(20 * s), b1_y0, box_x1 - int(20 * s), b1_y1], radius=max(6, int(14 * s)), fill=(30, 36, 48), outline=self.card_border, width=1)
            d.text((box_x0 + int(35 * s), b1_y0 + int(18 * s)), "REVISIÓN SALARIAL ANUAL", font=f_col_title, fill=self.accent_gold)
            d.text((box_x0 + int(35 * s), b1_y0 + int(48 * s)), "Art. 399 Bis LFT (Sin votación de base)", font=f_sub, fill=self.text_muted)
            _draw_wrapped_text(d, "Revisa cuota diaria y no requiere consulta democrática a toda la base.", f_body, self.text_cream, box_x0 + int(35 * s), b1_y0 + int(85 * s), box_x1 - box_x0 - int(70 * s))

            b2_y0 = b1_y1 + int(15 * s)
            b2_y1 = b2_y0 + h_half
            d.rounded_rectangle([box_x0 + int(20 * s), b2_y0, box_x1 - int(20 * s), b2_y1], radius=max(6, int(14 * s)), fill=(30, 36, 48), outline=self.card_border, width=1)
            d.text((box_x0 + int(35 * s), b2_y0 + int(18 * s)), "REVISIÓN CONTRACTUAL INTEGRAL", font=f_col_title, fill=self.accent_green)
            d.text((box_x0 + int(35 * s), b2_y0 + int(48 * s)), "Arts. 400 Bis y 390 Ter LFT (Voto obligatorio)", font=f_sub, fill=self.text_muted)
            _draw_wrapped_text(d, "Revisa el Contrato Colectivo completo cada 2 años con aprobación por voto personal, libre y secreto.", f_body, self.text_cream, box_x0 + int(35 * s), b2_y0 + int(85 * s), box_x1 - box_x0 - int(70 * s))

        return img

    def render_payroll_simulation_card(
        self,
        w: int,
        h: int,
        vertical: bool = False,
    ) -> Image.Image:
        """Muestra el ejemplo numérico real del tarjetón ($10,000 tabular -> +$290, etc.)."""
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        box_x0, box_y0, box_x1, box_y1, s = self._get_boxes_and_scale(w, h, vertical)

        radius = int(24 * s)
        d.rounded_rectangle([box_x0, box_y0, box_x1, box_y1], radius=max(8, radius), fill=self.card_bg, outline=self.card_border, width=max(1, int(2 * s)))

        f_title = _get_font(True, int((30 if not vertical else 34) * s))
        f_sub = _get_font(False, int((18 if not vertical else 20) * s))
        f_head = _get_font(True, int((20 if not vertical else 22) * s))
        f_text = _get_font(False, int((18 if not vertical else 20) * s))
        f_bold = _get_font(True, int((20 if not vertical else 22) * s))
        f_big = _get_font(True, int((34 if not vertical else 38) * s))

        pad_x = int(35 * s)
        _draw_wrapped_text(d, "SIMULACIÓN DE IMPACTO EN TARJETÓN", f_title, self.accent_gold, box_x0 + pad_x, box_y0 + int(30 * s), box_x1 - box_x0 - pad_x * 2)
        _draw_wrapped_text(d, "Ejemplo práctico sobre percepciones mensuales brutas", f_sub, self.text_muted, box_x0 + pad_x, box_y0 + int(68 * s), box_x1 - box_x0 - pad_x * 2)

        rows = [
            ("Concepto 02 (Sueldo Tabular)", "+2.9%", "+$290.00 MXN"),
            ("Concepto 11 (Ayuda de Renta)", "+3.9%", "+$78.00 MXN"),
            ("Cláusula 157 (Retiro Afore)", "+1.75%", "Ahorro Retiro"),
        ]

        ty = box_y0 + int((115 if not vertical else 135) * s)
        table_h = int((210 if not vertical else 270) * s)
        d.rounded_rectangle([box_x0 + int(25 * s), ty, box_x1 - int(25 * s), ty + table_h],
                            radius=max(6, int(14 * s)), fill=(30, 36, 48), outline=self.card_border, width=1)

        d.text((box_x0 + int(45 * s), ty + int(15 * s)), "CONCEPTO", font=f_head, fill=self.accent_blue)
        d.text((box_x1 - int(220 * s), ty + int(15 * s)), "AUMENTO", font=f_head, fill=self.accent_blue)

        line_y = ty + int(55 * s)
        for r_name, r_rate, r_res in rows:
            d.text((box_x0 + int(45 * s), line_y), r_name, font=f_text, fill=self.text_cream)
            d.text((box_x1 - int(220 * s), line_y), r_res, font=f_bold, fill=self.accent_gold if "+" in r_res else self.accent_green)
            line_y += int((50 if not vertical else 65) * s)

        bottom_y = ty + table_h + int(15 * s)
        d.rounded_rectangle([box_x0 + int(25 * s), bottom_y, box_x1 - int(25 * s), box_y1 - int(25 * s)],
                            radius=max(6, int(14 * s)), fill=(40, 50, 68), outline=self.accent_gold, width=max(1, int(2 * s)))

        d.text((box_x0 + int(45 * s), bottom_y + int(18 * s)), "AUMENTO INMEDIATO EN EFECTIVO BRUTO:", font=f_head, fill=self.text_cream)
        d.text((box_x0 + int(45 * s), bottom_y + int(50 * s)), "+$368.00 MXN", font=f_big, fill=self.accent_gold)
        _draw_wrapped_text(d, "(En vez de $855 que sugeriría una multiplicación simple del 8.55%)", f_sub, self.text_muted,
                           box_x0 + int(45 * s) if vertical else box_x0 + int(300 * s),
                           bottom_y + int(95 * s) if vertical else bottom_y + int(60 * s),
                           box_x1 - box_x0 - int(80 * s))

        return img

    def render_retirement_timeline_card(
        self,
        w: int,
        h: int,
        vertical: bool = False,
    ) -> Image.Image:
        """Muestra la ruta escalonada de crecimiento de la Cláusula 157 CCT."""
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        box_x0, box_y0, box_x1, box_y1, s = self._get_boxes_and_scale(w, h, vertical)

        radius = int(24 * s)
        d.rounded_rectangle([box_x0, box_y0, box_x1, box_y1], radius=max(8, radius), fill=self.card_bg, outline=self.card_border, width=max(1, int(2 * s)))

        f_title = _get_font(True, int((28 if not vertical else 32) * s))
        f_sub = _get_font(False, int((18 if not vertical else 20) * s))
        f_year = _get_font(True, int((18 if not vertical else 22) * s))
        f_rate = _get_font(True, int((30 if not vertical else 34) * s))
        f_desc = _get_font(False, int((15 if not vertical else 17) * s))

        pad_x = int(35 * s)
        _draw_wrapped_text(d, "RUTA CONTRACTUAL PACTADA — CLÁUSULA 157 CCT", f_title, self.accent_green, box_x0 + pad_x, box_y0 + int(30 * s), box_x1 - box_x0 - pad_x * 2)
        _draw_wrapped_text(d, "Aportación patronal para el retiro de trabajadores Nueva Generación", f_sub, self.text_muted, box_x0 + pad_x, box_y0 + int(68 * s), box_x1 - box_x0 - pad_x * 2)

        steps = [
            ("OCT 2025 - 2026", "1.25%", "Vigente primer año CCT"),
            ("OCT 2026 - 2027", "2.50%", "Segundo año pactado"),
            ("OCT 2027 - 2028", "3.75%", "Escalonamiento"),
            ("OCT 2028+", "5.00%", "Tope definitivo"),
        ]

        if not vertical:
            step_w = (box_x1 - box_x0 - int(80 * s)) // len(steps)
            sx = box_x0 + int(30 * s)
            sy = box_y0 + int(135 * s)
            card_step_h = box_y1 - sy - int(35 * s)
            for s_date, s_val, s_note in steps:
                d.rounded_rectangle([sx, sy, sx + step_w - int(12 * s), sy + card_step_h], radius=max(6, int(14 * s)), fill=(30, 36, 48), outline=self.card_border, width=1)
                d.text((sx + int(15 * s), sy + int(20 * s)), s_date, font=_get_font(True, int(14 * s)), fill=self.accent_blue)
                d.text((sx + int(15 * s), sy + int(55 * s)), s_val, font=f_rate, fill=self.accent_green)
                _draw_wrapped_text(d, s_note, f_desc, self.text_muted, sx + int(15 * s), sy + int(110 * s), step_w - int(30 * s))
                sx += step_w
        else:
            sy = box_y0 + int(115 * s)
            sh = (box_y1 - box_y0 - int(160 * s)) // len(steps)
            for s_date, s_val, s_note in steps:
                d.rounded_rectangle([box_x0 + int(25 * s), sy, box_x1 - int(25 * s), sy + sh - int(10 * s)], radius=max(6, int(14 * s)), fill=(30, 36, 48), outline=self.card_border, width=1)
                d.text((box_x0 + int(45 * s), sy + int(15 * s)), s_date, font=f_year, fill=self.accent_blue)
                d.text((box_x1 - int(160 * s), sy + int(12 * s)), s_val, font=f_rate, fill=self.accent_green)
                _draw_wrapped_text(d, s_note, f_desc, self.text_muted, box_x0 + int(45 * s), sy + int(45 * s), box_x1 - box_x0 - int(220 * s))
                sy += sh

        return img
