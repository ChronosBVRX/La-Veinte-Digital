"""Renderer v1.1: dirección de arte editorial (sin audio, sin azar).

- AutoFitText: mide antes de dibujar; nunca overflow ni bajo mínimo.
- SpeakerIdentity medido (nombre+rol separados de verdad).
- Variantes reales por escena (no skins): question×3, reaction×2,
  explanation×3, number-hero, warning-focus, conversation×4.
- Identidad espacial: la geometría forma el layout, no solo el icono.
- ReactiveAudioElement por personaje (se elimina la barra inferior).
- Transiciones con memoria espacial (lados por speaker).
- Microanimación reactiva al RMS con easing; texto domina = fondo calmo.
- Zonas verticales + safe zones short-form; reduced-motion.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .identity import CHARACTERS, get_layout, motion_scale
from .layout import (AnimatedBoundsValidator, Box, DrawText, autofit,
                     build_number_primitives, check_collisions, font_for,
                     get_canvas_box, get_main_box, get_platform_safe,
                     outside_safe, speaker_identity, staged_number_lines)
from .motion import (AmbientMotionLayer, AudioReactiveIdentity,
                     ConversationStage, EditorialVisualInterpreter,
                     ease_out_cubic)

SIDES = {"Eduardo": -1, "Javier Ríos": -1, "Andrea": 1, "Rodrigo Torres": 1,
         "Valeria Soto": 0}


def _font(bold: bool, size: int):
    from .layout import _font as _f
    return _f(bold, size)


def _wrap(draw, text, font, max_w):
    words, lines, cur = (text or "").split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


class Renderer:
    def __init__(self, layout: str = "16x9", reduced_motion: bool = False,
                 subtitles: str = "essential") -> None:
        self.L = get_layout(layout)
        self.name = layout
        self.vertical = self.L["h"] > self.L["w"]
        self.W, self.H = self.L["w"], self.L["h"]
        self.reduced = reduced_motion
        self.subtitles = subtitles
        self.prepared: dict[str, dict] = {}
        self.issues: list[str] = []
        from .editorial.scene_composer import SceneComposer
        self.scene_composer = SceneComposer()
        # V1.2 — movimiento e interpretación editorial.
        self.ambient = AmbientMotionLayer()
        self.reactive = AudioReactiveIdentity()
        self.stage = ConversationStage()
        self.interpreter = EditorialVisualInterpreter()
        self._last_shape: str | None = None
        self._prev_speaker: str | None = None
        self._speaker_age = 999
        # Telemetría para QC (motion coverage / response score / densidad).
        self.reactive_samples: list[float] = []
        self.semantic_strong_frames = 0
        self.semantic_pulses = 0
        self.impact_frames = 0
        self.focus_frames = 0
        self.quiet_frames = 0
        self.normal_frames = 0
        self.total_frames = 0

    # -- preparación (mide todo antes de renderizar) -------------------------
    def prepare(self, ev: dict, char: dict) -> dict:
        """Calcula boxes, autofit y colisiones usando ÚNICA fuente de primitives.
        Tanto validator como frame consumen los mismos DrawText, con animación
        incluida. No hay lógica duplicada."""
        from PIL import Image as _I
        probe = ImageDraw.Draw(_I.new("RGB", (8, 8)))
        W, H = self.W, self.H
        plan: dict = {"variant": ev.get("variant", ""), "boxes": {},
                      "issues": [], "kinetic": None, "identity": None,
                      "primitives": []}
        stacked = True
        si = speaker_identity(ev.get("speaker", ""), char.get("rol", ""), H, stacked)
        plan["speaker"] = si
        kind = ev.get("scene_type", "conversation")
        variant = ev.get("variant", "")
        main = get_main_box(self.name, variant, W, H)
        plan["boxes"]["main"] = main
        # --- Primitivas de texto (única fuente) ---
        staged_primitives: list[list[DrawText]] = []
        primitives_flat: list[DrawText] = []
        if ev.get("chart_type"):
            plan["kinetic"] = {"size": 24, "lines": [""], "spacing": 1.0, "ok": True, "max_w": 0}
            plan["pages"] = []
            plan["staged_primitives"] = []
        elif kind == "number" and ev.get("refs", {}).get("cantidad"):
            for stage_idx in range(3):
                stage_prims = build_number_primitives(probe, ev, main, H, stage_idx)
                staged_primitives.append(stage_prims)
                primitives_flat.extend(stage_prims)
            fit_stage = staged_primitives[2]
            plan["kinetic"] = {"size": fit_stage[0].size if fit_stage else 0,
                               "lines": [p.text for p in fit_stage],
                               "spacing": 1.22, "ok": bool(fit_stage)}
            plan["level"] = "display-xl"
            plan["staged_primitives"] = staged_primitives
        else:
            text = ev.get("essential") or ev.get("display_text", "")
            words_count = len(text.split())
            level = "display" if (kind in ("question", "brand", "closing") and words_count <= 8) else (
                "headline" if kind in ("warning", "reaction", "quote") else "body")
            # Inset para animación dx=8: texto crítico permanece dentro de platform.
            # En vertical, un inset horizontal de 20px garantiza que con dx=8 y scale=0.02
            # nunca se sobrepase el límite derecho (940) o izquierdo (70) de platform-safe.
            inset_pad = 20 if self.vertical else 8
            inset = Box(main.x0 + inset_pad, main.y0, main.x1 - inset_pad, main.y1, name="main-inset")
            from .layout import paginate_text
            pages_text = paginate_text(probe, text, level, inset, H,
                                       max_lines=5 if self.vertical else 4,
                                       max_words_per_page=22 if self.vertical else 30)
            pages_plan = []
            total_words = max(1, sum(len(p.split()) for p in pages_text))
            acc_prog = 0.0
            for p_idx, p_text in enumerate(pages_text):
                p_words = max(1, len(p_text.split()))
                p_frac = p_words / total_words
                p_start = acc_prog
                p_end = 1.0 if p_idx == len(pages_text) - 1 else min(1.0, acc_prog + p_frac)
                acc_prog = p_end

                fit = autofit(probe, p_text, level, inset, H, max_lines=5 if self.vertical else 4)
                if not fit["ok"]:
                    plan["issues"].append(f"autofit compacto en {ev.get('beat_id')} p{p_idx}")
                    fit = autofit(probe, p_text, "body" if level != "body" else "caption",
                                  inset, H, max_lines=6 if self.vertical else 5)

                p_y0 = inset.y0 + (inset.y1 - inset.y0 - fit["size"] * fit["spacing"] * len(fit["lines"])) / 2
                p_prims: list[DrawText] = []
                for i, ln in enumerate(fit["lines"]):
                    w = probe.textlength(ln, font=_font(True, fit["size"]))
                    x0 = inset.x0 + (inset.x1 - inset.x0 - w) / 2
                    y = p_y0 + i * fit["size"] * fit["spacing"]
                    box = Box(x0, y, x0 + w, y + fit["size"], name=f"text-p{p_idx}-{i}")
                    dt = DrawText(ln, x0, y, _font(True, fit["size"]),
                                  fit["size"], f"text-p{p_idx}-{i}", True, box,
                                  {"dx": 8, "scale": 0.02})
                    p_prims.append(dt)
                pages_plan.append({
                    "text": p_text,
                    "fit": fit,
                    "start_prog": p_start,
                    "end_prog": p_end,
                    "primitives": p_prims,
                })
                staged_primitives.append(p_prims)
                primitives_flat.extend(p_prims)

            plan["pages"] = pages_plan
            plan["kinetic"] = pages_plan[0]["fit"] if pages_plan else {"ok": False, "size": 28, "lines": [text], "spacing": 1.22, "max_w": 0}
            plan["level"] = level
        plan["primitives"] = primitives_flat
        plan["staged_primitives"] = staged_primitives
        # Speaker box: suprimir en aperturas/cierres institucionales
        is_brand_or_closing = kind in ("brand", "closing") or not ev.get("speaker") or ev.get("speaker") == "La Veinte Radio"
        if is_brand_or_closing:
            plan["boxes"]["speaker"] = Box(0, 0, 0, 0, "speaker")
        elif self.vertical:
            # Dentro de platform-safe vertical [70,200,940,1450], elevado en top safe margin (y:220..320)
            sp_y = 220
            plan["boxes"]["speaker"] = Box(main.x0, sp_y,
                                           main.x0 + si["name_w"] + 40,
                                           sp_y + si["h"], "speaker")
        else:
            plan["boxes"]["speaker"] = Box(main.x0, main.y0 - si["h"] - 24,
                                           main.x0 + si["name_w"] + 40,
                                           main.y0 - 24 + 0, "speaker")
        if self.vertical:
            # Dentro de platform-safe vertical [70,200,940,1450], elevado sobre controles.
            plan["boxes"]["reactive"] = Box(70, 1360, 940, 1450, "reactive")
        else:
            # V1.3: elemento reactivo más grande y visible (antes 0.30x0.12).
            plan["boxes"]["reactive"] = Box(int(W * 0.06), int(H * 0.78),
                                           int(W * 0.42), int(H * 0.95), "reactive")
        # Validación geométrica sobre primitivas reales (incluye animación) — por etapa.
        platform = get_platform_safe(self.vertical)
        canvas = get_canvas_box(W, H)
        validator = AnimatedBoundsValidator(platform, canvas)
        for stage_idx, stage_prims in enumerate(plan["staged_primitives"]):
            anim_issues = validator.validate(stage_prims)
            if anim_issues:
                plan["issues"].extend([f"stage{stage_idx}:{m}" for m in anim_issues])
            safe_issues = outside_safe([p.box for p in stage_prims if p.critical], platform)
            if safe_issues:
                plan["issues"].extend([f"stage{stage_idx}:{m}" for m in safe_issues])
        # Colisiones clásicas (speaker/reactive/frame vs texto principal).
        boxes = [Box(*[v for v in [main.x0, main.y0, main.x1, main.y1]], "text")]
        if plan["boxes"]["speaker"].x1 > plan["boxes"]["speaker"].x0:
            boxes.append(plan["boxes"]["speaker"])
        boxes.append(plan["boxes"]["reactive"])
        boxes.append(Box(0, 0, W, 40 if not self.vertical else 60, "frame"))
        coll = check_collisions(boxes)
        coll = [c for c in coll if not (
            ("text" in c and "reactive" in c) and not self.vertical)]
        plan["issues"].extend(coll)
        self.issues.extend(f"{ev.get('beat_id')}: {c}" for c in plan["issues"] if c)
        self.prepared[ev.get("beat_id", "")] = plan
        return plan

    # -- primitivas ------------------------------------------------------------
    def _bg(self, d, f, energy, char, variant, semantic_strong=False):
        """AmbientMotionLayer: 2-4 elementos grandes y sutiles, presentes
        aunque no haya texto. Se calma cuando Semantic domina."""
        d.rectangle([0, 0, self.W, self.H], fill=(16, 18, 24))
        shape = char.get("shape", "circles")
        ac = char.get("accent", (245, 158, 11))
        # Memoria espacial del speaker anterior (ConversationStage).
        pres = self.stage.presence()
        if pres > 0.01 and self.stage.prev_shape:
            prev_char = {"shape": self.stage.prev_shape,
                         "accent": self.stage.prev_accent or ac}
            self.ambient.draw(d, f, 30, energy * 0.5, prev_char["shape"],
                              prev_char["accent"], self.reduced, semantic_strong)
        self.ambient.draw(d, f, 30, energy, shape, ac, self.reduced, semantic_strong)
        if self.vertical and not self.reduced:
            self._vertical_identity(d, f, energy, shape, ac)

    def _vertical_identity(self, d, f, energy, shape, ac):
        """V1.4 (9:16): la identidad ocupa la zona media con estructura
        lateral/vertical, aprovechando la altura sin más subtítulos ni mover
        safe zones. Muy tenue: es fondo, no información."""
        dim = tuple(max(20, int(c * 0.32)) for c in ac)
        x0, x1 = int(self.W * 0.10), int(self.W * 0.90)
        y0, y1 = int(self.H * 0.22), int(self.H * 0.68)
        if shape == "bars":
            # Barras laterales que enmarcan la zona media.
            for gx in (x0, x1):
                d.line([gx, y0, gx, y1], fill=dim, width=3)
            for k in range(1, 5):
                gy = y0 + (y1 - y0) * k / 5
                d.line([x0, gy, x1, gy], fill=dim, width=1)
        elif shape == "grid":
            # Retícula que se extiende verticalmente.
            step = 90
            for gx in range(x0, x1 + 1, step):
                d.line([gx, y0, gx, y1], fill=dim, width=1)
            for gy in range(y0, y1 + 1, step):
                d.line([x0, gy, x1, gy], fill=dim, width=1)

    def _brandbar(self, d, sting: bool = False, f: int = 0):
        x, y = self.L["brand"]
        size = 34
        if sting and not self.reduced:
            k = min(1.0, (f % 18) / 18.0)
            size = int(34 + 14 * math.sin(math.pi * min(1.0, k)))
        from .layout import _font as _f
        d.text((x, y), "LA VEINTE RADIO", font=_f(True, size),
               fill=(245, 241, 232) if sting else (168, 162, 154))

    def _speaker_block(self, d, plan, ev, char, x, y):
        si = plan["speaker"]
        d.text((x, y), ev.get("speaker", ""),
               font=font_for("headline", self.H), fill=(245, 241, 232))
        if char.get("rol"):
            d.text((x, y + si["role_y"] + 4),
                   char["rol"], font=font_for("caption", self.H), fill=(168, 162, 154))

    def _reactive(self, d, plan, ev, char, f, cx, cy, R, smooth: float,
                  energy: float, semantic: dict | None = None,
                  enter: float = 1.0):
        """AudioReactiveIdentity: reacción integrada a la geometría del
        personaje (no un ecualizador). V1.4: sin pulso periódico; la vida
        proviene del audio (smooth/energy), de la entrada del speaker y de
        los eventos semánticos (`semantic`)."""
        ac = char.get("accent", (245, 158, 11))
        shape = char.get("shape", "circles")
        delta = self.reactive.delta(shape, energy, base=R)
        # Respiración ligada a la VOZ (no al reloj): si hay voz, hay vida.
        # El término por-frame es la reactividad de audio aprobada: hace que
        # la identidad siga la dinámica de la locución sin eventos periódicos.
        amp = max(0.0, min(1.0, smooth))
        breath = 1.0 + 0.10 * amp
        enter = max(0.0, min(1.0, enter))
        if shape == "circles":  # Eduardo: anillo que expande con la voz
            r = (R + delta["radius_px"]) * breath + R * 0.35 * amp
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ac,
                      width=int(4 + delta["stroke_delta"]))
            d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=ac)
        elif shape == "curves":  # Andrea: curva gana amplitud con la voz
            w = R * 2.2 * breath
            h = (R * 0.9 + delta["amplitude_px"]) * breath + R * 0.9 * amp
            d.arc([cx - w, cy - h, cx + w, cy + h], 200, 340, fill=ac,
                  width=int(5 + delta["stroke_delta"]))
        elif shape == "grid":  # Javier: retícula que CONSTRUYE estructura
            self._grid_structure(d, cx, cy, R, ac, delta, semantic or {}, amp)
        else:  # Rodrigo / brand: barras divisorias que crecen con la voz
            self._bar_dividers(d, plan, cx, cy, R, ac, delta, enter, amp)

    def _grid_structure(self, d, cx, cy, R, ac, delta, semantic: dict,
                        amp: float = 0.0) -> None:
        """Javier: nodos aparecen al introducir conceptos, líneas los conectan,
        y al cerrar el argumento la conexión se atenúa. Sin barridos."""
        concepts = semantic.get("concepts") or []
        total = max(2, min(4, len(concepts)))
        revealed = max(1, min(total, int(semantic.get("revealed", 1))))
        closing = bool(semantic.get("closing"))
        dim = (70, 76, 95)
        # Eje: horizontal en 16:9, vertical en 9:16 (aprovecha la altura).
        pts = []
        for i in range(total):
            k = i / (total - 1) if total > 1 else 0.5
            if self.vertical:
                pts.append((cx, cy - R + 2 * R * k))
            else:
                pts.append((cx - R + 2 * R * k, cy))
        # Retícula base tenue.
        for k in range(-2, 3):
            if self.vertical:
                d.line([cx + k * 16, cy - R, cx + k * 16, cy + R], fill=dim, width=2)
            else:
                d.line([cx - R, cy + k * 16, cx + R, cy + k * 16], fill=dim, width=2)
        # Conexiones entre conceptos ya introducidos.
        link = (70, 76, 95) if closing else ac
        for i in range(revealed - 1):
            d.line([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]],
                   fill=link, width=3)
        # Nodos.
        for i in range(revealed):
            x, y = pts[i]
            r = 7 if i < revealed - 1 else 10
            d.ellipse([x - r, y - r, x + r, y + r], outline=ac, width=3)
            if i == revealed - 1:
                d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=ac)
        # El último nodo late con la voz, no con el reloj.
        if pts and not closing:
            x, y = pts[revealed - 1]
            rr = 12 + delta.get("length_px", 0) * 0.3 + R * 0.5 * amp
            d.ellipse([x - rr, y - rr, x + rr, y + rr], outline=ac, width=2)

    def _bar_dividers(self, d, plan, cx, cy, R, ac, delta, enter: float,
                      amp: float) -> None:
        """Rodrigo: barras anchas que ocupan el ancho, actúan como divisores,
        crecen desde el margen al entrar el speaker y responden al ritmo."""
        box = plan["boxes"]["reactive"]
        n = 5
        span = box.x1 - box.x0
        step = span / (n + 1)
        dim = (70, 76, 95)
        hmax = (box.y1 - box.y0) * 0.5
        for k in range(n):
            x0 = box.x0 + step * (k + 1) - 7
            # Divisor tenue de margen a margen (estructura, sin información).
            d.line([x0 + 7, box.y0, x0 + 7, box.y1], fill=dim, width=1)
            h = (14 + delta["height_px"] * (0.4 + 0.6 * (k % 3) / 2))
            h = min(hmax, h) * enter * (0.25 + 0.9 * amp)
            if h < 2:
                continue
            d.rectangle([x0, cy - h, x0 + 14, cy + h], fill=ac)

    def _kinetic_block(self, d, plan, ev, x, y_top, progress, cx_ref):
        kin = plan["kinetic"]
        fnt = _font(True, kin["size"])
        el = [e.lower() for e in (ev.get("emphasis_words", []) or [])][:3]
        y = y_top
        lh = kin["size"] * kin["spacing"]
        n_show = max(1, int(len(kin["lines"]) * min(1.0, progress * 1.4)))
        for ln in kin["lines"][:n_show]:
            words = ln.split()
            x = cx_ref - kin["max_w"] / 2 if len(kin["lines"]) > 1 else cx_ref - d.textlength(ln, font=fnt) / 2
            for w_ in words:
                hot = w_.strip("¿?¡!.,;:").lower() in el
                if hot:
                    d.text((x - 2, y - 2), w_, font=fnt, fill=(90, 60, 10))
                d.text((x, y), w_, font=fnt, fill=(245, 158, 11) if hot else (245, 241, 232))
                x += d.textlength(w_ + " ", font=fnt)
            y += lh
        return y

    def _render_pages_or_kinetic(self, d, plan, ev, prog, main, ccx, y_offset=20):
        pages = plan.get("pages")
        if pages and len(pages) > 1:
            active_page = pages[-1]
            for p in pages:
                if p["start_prog"] <= prog < p["end_prog"]:
                    active_page = p
                    break
            p_span = max(0.001, active_page["end_prog"] - active_page["start_prog"])
            p_prog = min(1.0, max(0.0, (prog - active_page["start_prog"]) / p_span))
            p_plan = {**plan, "kinetic": active_page["fit"]}
            p_ev = {**ev, "emphasis_words": ev.get("emphasis_words", [])}
            self._kinetic_block(d, p_plan, p_ev, main.x0, main.y0 + y_offset, p_prog, ccx)
        elif pages and len(pages) == 1:
            self._kinetic_block(d, {**plan, "kinetic": pages[0]["fit"]}, ev, main.x0, main.y0 + y_offset, prog, ccx)
        elif plan.get("kinetic"):
            self._kinetic_block(d, plan, ev, main.x0, main.y0 + y_offset, prog, ccx)

    # -- frame -------------------------------------------------------------------
    def frame(self, f: int, fps: int, ev: dict, char: dict, env: list[float],
              trans: float = 1.0, env_now: float = 0.5,
              local_f: int = 0, dur_f: int = 1) -> "Image.Image":
        from PIL import Image, ImageDraw
        plan = self.prepared.get(ev.get("beat_id", "")) or self.prepare(ev, char)
        img = Image.new("RGB", (self.W, self.H), (16, 18, 24))
        d = ImageDraw.Draw(img, "RGBA")
        energy = float(ev.get("energy", 0.5) or 0.5)
        kind = ev.get("scene_type", "conversation")
        density = ev.get("density", "normal")
        # Semantic fuerte (focus/impact) calma Ambient; quiet conserva vida.
        semantic_strong = density in ("focus", "impact")
        # ConversationStage: memoria espacial del speaker anterior.
        speaker_name = ev.get("speaker", "")
        if speaker_name != self._prev_speaker:
            # Evento semántico: cambio de speaker (no el reloj).
            self.ambient.pulse(1.0)
            self.semantic_pulses += 1
            self._prev_speaker = speaker_name
            self._speaker_age = 0
        else:
            self._speaker_age += 1
        self.stage.notify(char.get("shape", "circles"),
                          char.get("accent", (245, 158, 11)))
        self.stage.step()
        self.ambient.step()
        # AudioReactiveIdentity: actualiza suavizado con el envelope real.
        react_val = self.reactive.update(env_now, energy)
        self.reactive_samples.append(round(react_val, 4))
        self.total_frames += 1
        if density == "impact":
            self.impact_frames += 1
        elif density == "focus":
            self.focus_frames += 1
        elif density == "quiet":
            self.quiet_frames += 1
        else:
            self.normal_frames += 1
        if semantic_strong:
            self.semantic_strong_frames += 1
        calm = 0.35 if kind in ("question", "number", "document", "warning",
                                "brand", "closing", "quote", "stat_card",
                                "comparison", "payroll_visual", "brand_opening",
                                "brand_closing") else 1.0
        self._bg(d, f, energy * calm, char, ev.get("variant", ""), semantic_strong)
        # Capa B-roll editorial si el evento tiene un asset resuelto
        if ev.get("resolved_asset") and ev["resolved_asset"].get("file"):
            img = self.scene_composer.compose_background(img, ev["resolved_asset"], self.W, self.H, self.vertical)
            d = ImageDraw.Draw(img, "RGBA")
        sting = ev.get("section", False) or kind in ("brand", "closing", "brand_opening", "brand_closing")
        self._brandbar(d, sting=sting, f=f)
        cx = self.W // 2
        main = plan["boxes"]["main"]
        # Posición contenido según variante conversacional.
        variant = ev.get("variant", "")
        if variant == "conversation-left":
            ccx = int(self.W * 0.62)
        elif variant == "conversation-right":
            ccx = int(self.W * 0.38)
        else:
            ccx = cx
        # Speaker arriba del bloque principal (medido, sin solape).
        si = plan["speaker"]
        sp_box = plan["boxes"].get("speaker")
        is_brand_or_closing = kind in ("brand", "closing", "brand_opening", "brand_closing") or not ev.get("speaker") or ev.get("speaker") == "La Veinte Radio"
        if not is_brand_or_closing and sp_box and sp_box.y1 > sp_box.y0:
            self._speaker_block(d, plan, ev, char, sp_box.x0, sp_box.y0)
        # Contenido por variante — number usa primitivas validadas (única fuente).
        dur_f = max(1, int((ev.get("end", 0) - ev.get("start", 0)) * fps))
        prog = min(1.0, max(0.0, local_f / dur_f)) if dur_f else 1.0
        semantic: dict | None = None
        chart_t = ev.get("chart_type")
        if chart_t:
            chart_card = self.scene_composer.render_programmatic_chart_beat(
                chart_t, self.W, self.H, vertical=self.vertical, progress=prog
            )
            if chart_card:
                img = Image.alpha_composite(img.convert("RGBA"), chart_card).convert("RGB")
                d = ImageDraw.Draw(img, "RGBA")
        elif kind == "number" and ev.get("refs", {}).get("cantidad"):
            stages = plan.get("staged_primitives") or []
            if stages:
                # V1.4: "$1,200" entra como UNA sola unidad desde el primer
                # frame visible (antes el '$' quedaba aislado ~100 ms). El
                # contexto (MONTO REPORTADO) aparece a ~8 frames (~270 ms).
                idx = 0 if local_f < 8 else 2
                idx = min(idx, len(stages) - 1)
                # Entrada rápida: primera vez que aparece, sube con easeOut.
                enter = min(1.0, (local_f + 1) / 6.0)
                ease = 1 - (1 - enter) ** 3
                for prim in stages[idx]:
                    b = prim.bounds_at(prog)
                    fill = tuple(int(c * (0.35 + 0.65 * ease)) for c in (245, 241, 232))
                    d.text((b.x0, b.y0), prim.text, font=prim.font, fill=fill)
            else:
                raw, ctx = ev["refs"]["cantidad"]
                val = (ev.get("refs", {}).get("monto") or {}).get("value")
                big = f"${val:,}".replace(",", ",") if val else raw
                staged = [big] if prog < 0.5 else [big, ctx or ""]
                self._kinetic_block(d, {**plan, "kinetic": {
                    **plan["kinetic"], "lines": staged, "max_w": plan["kinetic"]["max_w"]}},
                    {**ev, "emphasis_words": []}, main.x0, main.y0 + 20, 1.0, ccx)
        elif kind in ("explanation", "warning", "clarification", "summary"):
            # EditorialVisualInterpreter temporal: estados derivados del texto,
            # sincronizados a la frase (misma composición, no diapositivas).
            interp = plan.get("interpret") or self.interpreter.interpret(ev)
            plan["interpret"] = interp
            states = interp.get("states") or []
            if states:
                idx = 0
                for i, st in enumerate(states):
                    if prog >= float(st.get("at", 0)):
                        idx = i
                # Evento semántico: un nuevo concepto entra en escena.
                if plan.get("_state_idx") != idx:
                    self.ambient.pulse(0.8)
                    self.semantic_pulses += 1
                    plan["_state_idx"] = idx
                semantic = {"concepts": interp.get("concepts") or [],
                            "revealed": idx + 1,
                            "closing": idx == len(states) - 1 and prog > 0.85}
                lines = list(states[idx]["lines"])
                emph = list(states[idx].get("emphasis", []))
                # Entrada rápida del estado (fast-in + settle).
                prev_at = float(states[idx].get("at", 0))
                local = (prog - prev_at) / max(0.001, 0.12)
                ease = ease_out_cubic(local)
                self._kinetic_block(d, {**plan, "kinetic": {
                    **plan["kinetic"], "lines": lines,
                    "max_w": max(plan["kinetic"]["max_w"], 10)}},
                    {**ev, "emphasis_words": emph}, main.x0, main.y0 + 20, ease, ccx)
            else:
                self._render_pages_or_kinetic(d, plan, ev, prog, main, ccx, y_offset=20)
        elif kind in ("question", "brand", "closing", "quote", "document"):
            self._render_pages_or_kinetic(d, plan, ev, prog, main, ccx, y_offset=10)
        elif kind == "reaction":
            self._render_pages_or_kinetic(d, plan, ev, prog, main, ccx, y_offset=40)
        else:
            self._render_pages_or_kinetic(d, plan, ev, prog, main, ccx, y_offset=20)
        # V1.4 (Javier): aunque el evento sea 'conversation', su retícula
        # construye/desmonta estructura según avanza la explicación. Sin
        # eventos periódicos: los nodos entran con el discurso.
        if semantic is None and char.get("shape") == "grid":
            concepts = self.interpreter._concepts(
                ev.get("display_text", ""), ev.get("emphasis_words"))
            total = max(2, min(4, len(concepts)))
            revealed = min(total, 1 + int(prog * total))
            semantic = {"concepts": concepts, "revealed": revealed,
                        "closing": prog > 0.85}
        # Overlays oficiales de logotipos
        overlay_logos = ev.get("overlay_logos") or []
        if overlay_logos:
            img = self.scene_composer.overlay_official_logos(
                img, overlay_logos, self.W, self.H, vertical=self.vertical
            )
            d = ImageDraw.Draw(img, "RGBA")
        # Reactive por personaje (cerca de identidad, no barra inferior).
        rx = plan["boxes"]["reactive"]
        rcx, rcy = (rx.x0 + rx.x1) // 2, (rx.y0 + rx.y1) // 2
        rR = min(rx.x1 - rx.x0, rx.y1 - rx.y0) // 2
        enter = min(1.0, (self._speaker_age + 1) / 8.0)
        self._reactive(d, plan, ev, char, f, rcx, rcy, rR, react_val, energy,
                       semantic=semantic, enter=enter)
        if trans < 1.0:
            ov = Image.new("RGB", (self.W, self.H), (16, 18, 24))
            img = Image.blend(ov, img, max(0.0, min(1.0, trans)))
        return img
