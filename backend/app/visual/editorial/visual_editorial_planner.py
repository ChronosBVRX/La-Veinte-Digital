"""Planificador Visual Editorial para La Veinte Radio.

Transforma el guion, el alignment canónico y las referencias investigadas
en un plan de dirección visual estructurado (visual-plan.json).

Aplica la arquitectura Evidence-First y Anti-Karaoke:
- AUDIO = Narración principal (la voz cuenta la historia).
- VIDEO = Evidencia + Contexto + Explicación + Ritmo.
- Cero efecto karaoke: el video no transcribe el podcast.
- 4 Grandes Familias Visuales: LOCUTOR, EVIDENCIA, EXPLICACIÓN, CONTEXTO.
- EditorialMemory: penalización por repetición (stat_breakdown_855 solo 1 vez en full)
  y penalización por genericidad (preferir documentos reales sobre tarjetas oscuras).
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .asset_resolver import AssetResolver, ResolvedAsset
from .editorial_memory import EditorialMemory
from .entity_detector import DetectedEntity, EntityDetector
from .reference_research import ReferenceResearcher


@dataclass
class VisualBeat:
    beat_id: str
    turn_id: str
    speaker: str
    start_s: float
    end_s: float
    duration_s: float
    scene_type: str  # speaker_focus, brand_opening, brand_closing, real_building, document_cover, stat_card, comparison, payroll_visual, topic_image
    visual_function: str  # LOCUTOR, EVIDENCIA, EXPLICACION, CONTEXTO
    resolved_asset: dict[str, Any] | None
    chart_type: str | None
    editorial_reason: str
    display_text: str
    headline: str = ""
    subheadline: str = ""
    key_points: list[str] = field(default_factory=list)
    overlay_logos: list[str] = field(default_factory=list)
    lockedByUser: bool = False
    composition: str = "full_bleed"
    document_treatment: dict[str, Any] = field(default_factory=dict)
    subtitles: list[dict[str, Any]] = field(default_factory=list)
    documentary_value: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class VisualPlan:
    project_id: str
    duration_s: float
    total_beats: int
    visual_mix: dict[str, float]
    beats: list[dict[str, Any]]
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class VisualEditorialPlanner:
    """Diseña la dirección visual del episodio respetando el alignment canónico."""

    def __init__(
        self,
        entity_detector: EntityDetector | None = None,
        asset_resolver: AssetResolver | None = None,
        researcher: ReferenceResearcher | None = None,
    ) -> None:
        self.detector = entity_detector or EntityDetector()
        self.resolver = asset_resolver or AssetResolver()
        self.researcher = researcher or ReferenceResearcher()

    def plan_project(
        self,
        project_id: str,
        turns: list[dict],
        alignment: dict,
        duration_s: float,
        orientation: str = "16:9",
        direction: str = "documental",
        text_mode: str = "editorial",
        existing_plan: dict | None = None,
    ) -> VisualPlan:
        """Construye el plan visual completo para el proyecto con Evidence-First y Anti-Karaoke."""
        detected_by_turn = self.detector.detect_in_script(turns)
        beats: list[VisualBeat] = []
        memory = EditorialMemory()

        # Mapear beats bloqueados previamente por el usuario
        locked_beats_by_id: dict[str, dict] = {}
        if existing_plan and "beats" in existing_plan:
            for b in existing_plan["beats"]:
                if b.get("lockedByUser"):
                    locked_beats_by_id[b["beat_id"]] = b

        align_turns = alignment.get("turns", [])
        align_map = {t.get("turnId") or t.get("id"): t for t in align_turns}

        # 1. Preroll institucional de apertura (0.0 a primer turno de voz)
        first_start = 4.90
        if align_turns and "startMs" in align_turns[0]:
            first_start = align_turns[0]["startMs"] / 1000.0

        if first_start > 0.1:
            opening_beat = VisualBeat(
                beat_id="beat-opening-brand",
                turn_id="preroll",
                speaker="",
                start_s=0.0,
                end_s=round(first_start, 2),
                duration_s=round(first_start, 2),
                scene_type="brand_opening",
                visual_function="BRAND",
                resolved_asset=None,
                chart_type=None,
                editorial_reason="Apertura institucional obligatoria de La Veinte Radio.",
                display_text="LA VEINTE RADIO",
                headline="LA VEINTE RADIO",
                subheadline="Información que defiende tus derechos",
                overlay_logos=[],
                composition="full_bleed",
            )
            beats.append(opening_beat)
            memory.record_beat(opening_beat.to_dict())

        # 2. Planificación turno por turno con Evidence-First y Memoria Editorial
        for idx, turn in enumerate(turns):
            tid = turn.get("id") or f"turn-{idx + 1}"
            al = align_map.get(tid)
            if not al:
                continue

            t_start = al["startMs"] / 1000.0
            t_end = al["endMs"] / 1000.0
            t_dur = t_end - t_start

            # Determinar el inicio del siguiente turno alineado para continuidad sin huecos
            next_start = None
            for nxt in turns[idx + 1:]:
                nxt_id = nxt.get("id") or f"turn-{idx + 2}"
                nxt_al = align_map.get(nxt_id)
                if nxt_al:
                    next_start = nxt_al["startMs"] / 1000.0
                    break

            from ..bridge import normalize_speaker
            speaker = normalize_speaker(turn.get("speaker") or "Eduardo")
            text = turn.get("displayText") or turn.get("display_text") or ""
            ents = detected_by_turn.get(tid, [])

            # Decisión editorial de beats por turno
            turn_beats = self._plan_turn_beats(
                idx=idx,
                turn_id=tid,
                speaker=speaker,
                text=text,
                t_start=t_start,
                t_end=t_end,
                t_dur=t_dur,
                entities=ents,
                orientation=orientation,
                direction=direction,
                text_mode=text_mode,
                memory=memory,
                locked_beats=locked_beats_by_id,
            )

            # Puente continuo: sostener el plano activo durante las pausas entre turnos
            if turn_beats and next_start is not None and next_start > turn_beats[-1].end_s:
                turn_beats[-1].end_s = round(next_start, 2)
                turn_beats[-1].duration_s = round(turn_beats[-1].end_s - turn_beats[-1].start_s, 2)

            for b in turn_beats:
                beats.append(b)
                memory.record_beat(b.to_dict())

        # 3. Cierre institucional (desde último turno hasta duración total)
        last_end = beats[-1].end_s if beats else duration_s - 5.0
        if last_end < duration_s - 0.05:
            closing_beat = VisualBeat(
                beat_id="beat-closing-brand",
                turn_id="outro",
                speaker="",
                start_s=round(last_end, 2),
                end_s=round(duration_s, 2),
                duration_s=round(duration_s - last_end, 2),
                scene_type="brand_closing",
                visual_function="BRAND",
                resolved_asset=None,
                chart_type=None,
                editorial_reason="Cierre institucional exclusivo de La Veinte Radio.",
                display_text="LA VEINTE DIGITAL",
                headline="LA VEINTE DIGITAL",
                subheadline="Sindicato y Derechos Laborales IMSS",
                overlay_logos=[],
                composition="full_bleed",
            )
            beats.append(closing_beat)
            memory.record_beat(closing_beat.to_dict())

        # 4. Cálculo del visual mix equilibrado (suma exacta de 100.0%)
        total_time = duration_s or 1.0
        speaker_time = sum(b.duration_s for b in beats if b.visual_function == "LOCUTOR")
        evidencia_time = sum(b.duration_s for b in beats if b.visual_function == "EVIDENCIA")
        explicacion_time = sum(b.duration_s for b in beats if b.visual_function == "EXPLICACION")
        contexto_time = sum(b.duration_s for b in beats if b.visual_function == "CONTEXTO")
        brand_time = sum(b.duration_s for b in beats if b.visual_function == "BRAND" or b.scene_type in ("brand_opening", "brand_closing"))

        raw_loc = 100.0 * speaker_time / total_time
        raw_evi = 100.0 * evidencia_time / total_time
        raw_exp = 100.0 * explicacion_time / total_time
        raw_ctx = 100.0 * contexto_time / total_time
        raw_bra = 100.0 * brand_time / total_time

        loc_pct = round(raw_loc, 1)
        evi_pct = round(raw_evi, 1)
        exp_pct = round(raw_exp, 1)
        ctx_pct = round(raw_ctx, 1)
        bra_pct = round(raw_bra, 1)

        diff = round(100.0 - (loc_pct + evi_pct + exp_pct + ctx_pct + bra_pct), 1)
        if abs(diff) > 0.001:
            loc_pct = round(loc_pct + diff, 1)

        mix = {
            "speaker_focus_pct": loc_pct,
            "real_reference_broll_pct": round(evi_pct + ctx_pct, 1),
            "cards_charts_pct": exp_pct,
            "brand_identity_pct": bra_pct,
            # Claves de las 4 familias modernas + brand
            "locutor_pct": loc_pct,
            "evidencia_pct": evi_pct,
            "explicacion_pct": exp_pct,
            "contexto_pct": ctx_pct,
            "brand_pct": bra_pct,
        }

        # 5. Métricas Anti-Karaoke y de Calidad
        total_spoken_words = sum(len((t.get("displayText") or t.get("display_text") or "").split()) for t in turns)
        editorial_words_list = []
        for b in beats:
            if b.scene_type in ("brand_opening", "brand_closing") or b.visual_function == "LOCUTOR":
                continue
            beat_editorial_text = f"{b.headline} {b.subheadline} {b.display_text}".strip()
            if beat_editorial_text:
                editorial_words_list.extend(beat_editorial_text.split())

        total_editorial_words = len(editorial_words_list)
        narrative_ratio = round(100.0 * total_editorial_words / max(1, total_spoken_words), 1)

        # Detección de riesgo de karaoke: secuencias de más de 6 palabras idénticas al guion
        karaoke_risks = 0
        turn_texts = [(t.get("displayText") or t.get("display_text") or "").lower() for t in turns]
        for b in beats:
            if b.scene_type in ("brand_opening", "brand_closing") or b.visual_function == "LOCUTOR":
                continue
            for text_field in (b.display_text, b.headline, b.subheadline):
                dt = text_field.strip().lower()
                if not dt:
                    continue
                words_dt = dt.split()
                if len(words_dt) >= 7:
                    for t_txt in turn_texts:
                        t_words = t_txt.split()
                        for i in range(len(t_words) - 6):
                            chunk = " ".join(t_words[i : i + 7])
                            if chunk in dt:
                                karaoke_risks += 1
                                break

        # Calcular valor documental por beat
        for b in beats:
            b.documentary_value = memory.calculate_documentary_value(b.to_dict())

        non_spk_vals = [
            b.documentary_value for b in beats
            if b.visual_function != "LOCUTOR" and b.scene_type not in ("brand_opening", "brand_closing")
        ]
        doc_val_avg = round(sum(non_spk_vals) / max(1, len(non_spk_vals)), 2)

        # Desglose de autenticidad vs genericidad
        generic_report = memory.get_generic_visual_ratio([b.to_dict() for b in beats])
        doc_breakdown = memory.get_documentary_value_breakdown([b.to_dict() for b in beats], total_time)

        # Advertencia de uso excesivo del locutor
        warnings = memory.check_speaker_overuse(mix["locutor_pct"])

        metrics = {
            "total_spoken_words": total_spoken_words,
            "total_editorial_words": total_editorial_words,
            "narrative_text_ratio_pct": narrative_ratio,
            "karaoke_risk_beats": karaoke_risks,
            "visual_direction": direction,
            "onScreen_text_mode": text_mode,
            "strong_repetition_penalties_applied": memory.strong_penalties_applied,
            "genericness_penalties_applied": memory.genericness_penalties_applied,
            "generic_visuals_report": generic_report,
            "documentary_value_breakdown": doc_breakdown,
            "documentary_value_avg": doc_val_avg,
            "warnings": warnings,
            "memory_summary": memory.get_summary(),
        }

        plan = VisualPlan(
            project_id=project_id,
            duration_s=round(duration_s, 6),
            total_beats=len(beats),
            visual_mix=mix,
            beats=[b.to_dict() for b in beats],
            metrics=metrics,
        )
        return plan

    def _plan_turn_beats(
        self,
        idx: int,
        turn_id: str,
        speaker: str,
        text: str,
        t_start: float,
        t_end: float,
        t_dur: float,
        entities: list[DetectedEntity],
        orientation: str,
        direction: str,
        text_mode: str,
        memory: EditorialMemory,
        locked_beats: dict[str, dict],
    ) -> list[VisualBeat]:
        """Subdivide un turno en beats aplicando jerarquía Evidence-First."""
        # Si este beat ya estaba bloqueado por el usuario, respetarlo exactamente
        if turn_id in locked_beats:
            lb = locked_beats[turn_id]
            return [VisualBeat(
                beat_id=lb["beat_id"],
                turn_id=lb["turn_id"],
                speaker=lb["speaker"],
                start_s=lb["start_s"],
                end_s=lb["end_s"],
                duration_s=lb["duration_s"],
                scene_type=lb["scene_type"],
                visual_function=lb.get("visual_function", "LOCUTOR"),
                resolved_asset=lb.get("resolved_asset"),
                chart_type=lb.get("chart_type"),
                editorial_reason=lb.get("editorial_reason", "Bloqueado manualmente por el usuario."),
                display_text=lb.get("display_text", ""),
                headline=lb.get("headline", ""),
                subheadline=lb.get("subheadline", ""),
                key_points=lb.get("key_points", []),
                overlay_logos=lb.get("overlay_logos", []),
                lockedByUser=True,
                composition=lb.get("composition", "full_bleed"),
            )]

        out: list[VisualBeat] = []

        visual_func, scene_type, resolved_asset, chart_type, logos = self._determine_turn_visual(
            idx, turn_id, text, entities, t_start, memory, orientation
        )

        has_visual = visual_func != "LOCUTOR"

        # Desglose obligatorio de turnos largos (>= 20s):
        # Si un locutor habla de forma prolongada sin visual, intercalar contexto documental B-roll
        if not has_visual and t_dur >= 20.0:
            lowered = text.lower()
            if any(w in lowered for w in ("clínica", "hospital", "médic", "enfermer", "paciente", "urgencia")):
                ctx_hint = "hospital_corridor"
            elif any(w in lowered for w in ("contrato", "cláusula", "acuerdo", "ley", "norma", "sindicato", "convenio")):
                ctx_hint = "worker_reviewing_document"
            elif any(w in lowered for w in ("sueldo", "salario", "pesos", "dinero", "quincena", "pago", "descuento", "isr", "deducción")):
                ctx_hint = "worker_reviewing_payslip"
            else:
                ctx_hint = "administrative_office_imss"

            ctx = self.resolver.resolve_context(ctx_hint, t_start, orientation)
            if ctx and ctx.file:
                visual_func = "CONTEXTO"
                scene_type = "context_broll"
                resolved_asset = ctx.to_dict()
                chart_type = None
                logos = ["logo_imss_official"]
                has_visual = True

        if has_visual and t_dur >= 6.0:
            spk_intro_dur = max(2.5, min(3.5, round(t_dur * 0.30, 2)))
            spk_outro_dur = max(1.8, min(2.8, round(t_dur * 0.22, 2))) if t_dur >= 8.5 else 0.0
            visual_dur = round(t_dur - spk_intro_dur - spk_outro_dur, 2)
            if visual_dur < 2.5:
                has_visual = False
            else:
                b1_end = round(t_start + spk_intro_dur, 2)
                b2_end = round(b1_end + visual_dur, 2)

            # Beat 1: Intro speaker (contacto humano de apertura)
            out.append(VisualBeat(
                beat_id=f"{turn_id}-b1-spk",
                turn_id=turn_id,
                speaker=speaker,
                start_s=round(t_start, 2),
                end_s=round(b1_end, 2),
                duration_s=round(spk_intro_dur, 2),
                scene_type="speaker_focus",
                visual_function="LOCUTOR",
                resolved_asset=None,
                chart_type=None,
                editorial_reason="Apertura del punto por el locutor.",
                display_text="",
                headline="",
                subheadline="",
                key_points=[],
                overlay_logos=[],
                composition="speaker",
            ))

            # Beat 2: Evidencia / Explicación / Contexto (protagonista)
            hl2, sub2, pts2, dt2 = self._extract_editorial_text(text, entities, visual_func, scene_type, chart_type, text_mode)
            comp2 = "document_focus" if visual_func == "EVIDENCIA" else ("data_focus" if visual_func == "EXPLICACION" else "full_bleed")
            out.append(VisualBeat(
                beat_id=f"{turn_id}-b2-visual",
                turn_id=turn_id,
                speaker=speaker,
                start_s=round(b1_end, 2),
                end_s=round(b2_end, 2),
                duration_s=round(visual_dur, 2),
                scene_type=scene_type,
                visual_function=visual_func,
                resolved_asset=resolved_asset,
                chart_type=chart_type,
                editorial_reason=f"Exposición de {visual_func.lower()} como protagonista visual.",
                display_text=dt2,
                headline=hl2,
                subheadline=sub2,
                key_points=pts2,
                overlay_logos=logos,
                composition=comp2,
            ))

            # Beat 3: Cierre speaker si el turno es suficientemente largo
            if spk_outro_dur > 0.0:
                out.append(VisualBeat(
                    beat_id=f"{turn_id}-b3-spk",
                    turn_id=turn_id,
                    speaker=speaker,
                    start_s=round(b2_end, 2),
                    end_s=round(t_end, 2),
                    duration_s=round(spk_outro_dur, 2),
                    scene_type="speaker_focus",
                    visual_function="LOCUTOR",
                    resolved_asset=None,
                    chart_type=None,
                    editorial_reason="Remate del turno por el locutor.",
                    display_text="",
                    headline="",
                    subheadline="",
                    key_points=[],
                    overlay_logos=[],
                    composition="speaker",
                ))
        else:
            # Beat único
            if visual_func == "LOCUTOR":
                out.append(VisualBeat(
                    beat_id=turn_id,
                    turn_id=turn_id,
                    speaker=speaker,
                    start_s=round(t_start, 2),
                    end_s=round(t_end, 2),
                    duration_s=round(t_dur, 2),
                    scene_type="speaker_focus",
                    visual_function="LOCUTOR",
                    resolved_asset=None,
                    chart_type=None,
                    editorial_reason="Conexión conversacional directa del locutor.",
                    display_text="",
                    headline="",
                    subheadline="",
                    key_points=[],
                    overlay_logos=[],
                    composition="speaker",
                ))
            else:
                hl, sub, pts, dt = self._extract_editorial_text(text, entities, visual_func, scene_type, chart_type, text_mode)
                comp = "document_focus" if visual_func == "EVIDENCIA" else ("data_focus" if visual_func == "EXPLICACION" else "full_bleed")
                out.append(VisualBeat(
                    beat_id=turn_id,
                    turn_id=turn_id,
                    speaker=speaker,
                    start_s=round(t_start, 2),
                    end_s=round(t_end, 2),
                    duration_s=round(t_dur, 2),
                    scene_type=scene_type,
                    visual_function=visual_func,
                    resolved_asset=resolved_asset,
                    chart_type=chart_type,
                    editorial_reason="Exposición continua del punto visual.",
                    display_text=dt,
                    headline=hl,
                    subheadline=sub,
                    key_points=pts,
                    overlay_logos=logos,
                    composition=comp,
                ))

        return out

    def _determine_turn_visual(
        self,
        idx: int,
        turn_id: str,
        text: str,
        entities: list[DetectedEntity],
        t_start: float,
        memory: EditorialMemory,
        orientation: str,
    ) -> tuple[str, str, dict[str, Any] | None, str | None, list[str]]:
        """Determina la función visual, scene_type, activo, chart_type y logos basándose
        exclusivamente en EntityDetector, intención semántica, contexto de sección y referencias verificadas.
        """
        lowered = text.lower()

        # Extraer categorías de entidades presentes en el turno
        stat_ents = [e for e in entities if e.category == "financial_stat"]
        doc_ents = [e for e in entities if e.category == "document"]
        law_ents = [e for e in entities if e.category == "law"]
        clause_ents = [e for e in entities if e.category == "clause"]
        payroll_ents = [e for e in entities if e.category == "payroll_concept"]
        building_ents = [e for e in entities if e.category in ("hospital", "clinic", "building", "workplace")]
        event_ents = [e for e in entities if e.category == "event"]

        # 1. Gráficos, simulaciones matemáticas e infografías programáticas (EXPLICACION)
        # 1.1 Cifra ponderada global (ej. 8.55%) - solo la primera vez en full
        is_stat_composite = any("8.55" in e.name for e in stat_ents) or ("8.55" in lowered)
        if is_stat_composite:
            rep_pen = memory.get_repetition_penalty("stat_breakdown_855", t_start)
            if rep_pen < 50.0:
                return "EXPLICACION", "stat_card", None, "stat_breakdown_855", []

        # 1.2 Simulación financiera / cálculo de salario o prestación
        has_currency_amount = any(e.attributes.get("currency") == "MXN" for e in stat_ents) or bool(re.search(r"\$\s*[\d,]+|\bpesos\b", lowered))
        is_sim_intent = bool(re.search(r"\b(?:simulaci[oó]n|c[aá]lculo|ejemplo\s+(?:sencillo|pr[aá]ctico)|neto\s+quincenal)\b", lowered))
        if is_sim_intent and (has_currency_amount or bool(payroll_ents) or any(e.category == "financial_stat" for e in entities) or "porcentaje" in lowered):
            return "EXPLICACION", "payroll_visual", None, "payroll_sim_tarjeton", []

        # 1.3 Comparación legal o contractual
        is_comparison_intent = bool(re.search(r"\b(?:compar(?:ar|aci[oó]n|ativa)|diferencia\s+entre|revisi[oó]n\s+salarial\s+(?:vs|y\s+revisi[oó]n\s+contractual))\b", lowered))
        has_multiple_legal_articles = len([e for e in law_ents if "artículo" in e.name.lower()]) >= 2 or (("399" in lowered or "revisión salarial" in lowered) and ("400" in lowered or "contractual" in lowered) and is_comparison_intent)
        if is_comparison_intent or has_multiple_legal_articles:
            return "EXPLICACION", "comparison", None, "comparison_lft_revision", []

        # 1.4 Ruta escalonada / cronograma / timeline
        is_timeline_intent = bool(re.search(r"\b(?:ruta|escalonamiento|progresi[oó]n|cronograma|timeline|calendario|plazos?)\b", lowered))
        if is_timeline_intent and (clause_ents or "157" in lowered or "retiro" in lowered or "fondo" in lowered):
            return "EXPLICACION", "stat_card", None, "retirement_timeline_cct157", []

        # 1.5 Cifras de cálculo y desglose porcentual matemático
        if stat_ents and any(w in lowered for w in ("divide", "cálculo", "ponderado", "ejemplo", "representa", "suma", "combinad", "serían", "porcentaje")):
            return "EXPLICACION", "number", None, None, []

        # 2. Documentos oficiales, leyes y sedes verificadas (EVIDENCIA)
        # 2.1 Artículos específicos de leyes federales (LFT, LSS)
        for le in law_ents:
            art_val = le.attributes.get("article", "")
            if "399" in art_val or "399 bis" in lowered:
                return "EVIDENCIA", "document_cover", None, "lft_document_399bis", ["logo_imss_official"]
            if "400" in art_val or "400 bis" in lowered:
                return "EVIDENCIA", "document_cover", None, "lft_document_400bis", ["logo_imss_official"]

        # 2.1.2 Leyes federales generales (LFT, LSS sin artículo específico)
        if law_ents and not clause_ents and not payroll_ents and not stat_ents:
            ctx_doc = self.resolver.resolve_context("worker_reviewing_document", t_start, orientation)
            if ctx_doc and ctx_doc.file:
                return "CONTEXTO", "context_broll", ctx_doc.to_dict(), None, ["logo_imss_official"]
            return "LOCUTOR", "speaker_focus", None, None, []

        # 2.2 Conceptos específicos en desglose de nómina (Tarjetón IMSS)
        for pe in payroll_ents:
            code = pe.attributes.get("code", "")
            if code == "011" or "concepto 11" in pe.name.lower() or "ayuda de renta" in pe.name.lower():
                c11_count = sum(1 for c in memory.charts_shown if c.get("chart") == "tarjeton_detail_c11")
                if c11_count < 2:
                    return "EVIDENCIA", "payroll_visual", None, "tarjeton_detail_c11", ["logo_imss_official"]
            if code == "002" and pe.attributes.get("is_base") or "concepto 02" in pe.name.lower() or "sueldo tabular" in pe.name.lower():
                c02_count = sum(1 for c in memory.charts_shown if c.get("chart") == "tarjeton_detail_c02")
                if c02_count < 2:
                    return "EVIDENCIA", "payroll_visual", None, "tarjeton_detail_c02", ["logo_imss_official"]

        # 2.3 Cláusulas contractuales del CCT
        for ce in clause_ents:
            clause_val = ce.attributes.get("clause", "")
            if "157" in clause_val or "157" in ce.name:
                c157_count = sum(1 for c in memory.charts_shown if c.get("chart") == "cct_clause_157")
                if "beneficia" in lowered or "ordena" in lowered or "aportaci" in lowered or "prestaci" in lowered:
                    if c157_count < 2:
                        return "EVIDENCIA", "document_cover", None, "cct_clause_157", ["logo_imss_official", "logo_sntss_official"]
                else:
                    cct_asset_count = sum(1 for a in memory.assets_used if "cct_2025_2027_cover" in a.get("id", ""))
                    if cct_asset_count < 2:
                        aid = "cct_2025_2027_cover_asset" if orientation == "16:9" else "cct_2025_2027_cover_asset_9x16"
                        asset = self.resolver.assets.get(aid)
                        return "EVIDENCIA", "document_cover", asset.to_dict() if asset else None, None, ["logo_imss_official", "logo_sntss_official"]

        # 2.4 Documento Contrato Colectivo de Trabajo (portada oficial) u otros documentos oficiales
        has_cct_doc = any("contrato colectivo" in de.name.lower() or "cct" in de.name.lower() for de in doc_ents)
        if has_cct_doc and any(w in lowered for w in ("contrato", "cct", "acuerdo", "pactado", "normativa", "vigente")):
            cct_asset_count = sum(1 for a in memory.assets_used if "cct_2025_2027_cover" in a.get("id", ""))
            if cct_asset_count < 2:
                aid = "cct_2025_2027_cover_asset" if orientation == "16:9" else "cct_2025_2027_cover_asset_9x16"
                asset = self.resolver.assets.get(aid)
                if asset:
                    return "EVIDENCIA", "document_cover", asset.to_dict(), None, ["logo_imss_official", "logo_sntss_official"]

        # Tarjetón IMSS y comprobantes de nómina oficiales (EVIDENCIA con asset real o CONTEXTO B-roll)
        is_tarjeton = any(
            "tarjet" in de.name.lower() or "recibo" in de.name.lower() or "nómina" in de.name.lower()
            for de in doc_ents
        ) or bool(re.search(r"\b(?:tarjet[oó]n|recibo\s+de\s+n[oó]mina|comprobante)\b", lowered))
        if is_tarjeton:
            tarjeton_count = sum(1 for a in memory.assets_used if "tarjeton_imss_context" in a.get("id", ""))
            if tarjeton_count < 3:
                aid = "tarjeton_imss_context_asset" if orientation == "16:9" else "tarjeton_imss_context_asset_9x16"
                asset = self.resolver.assets.get(aid)
                if asset:
                    return "EVIDENCIA", "document_cover", asset.to_dict(), None, ["logo_imss_official"]
            ctx_p = self.resolver.resolve_context("worker_reviewing_payslip", t_start, orientation)
            if ctx_p and ctx_p.file:
                return "CONTEXTO", "context_broll", ctx_p.to_dict(), None, ["logo_imss_official"]

        # Otros documentos normativos y formatos oficiales
        if doc_ents:
            resolved_doc = self.resolver.resolve(doc_ents, t_start, orientation)
            if resolved_doc and resolved_doc.file:
                return "EVIDENCIA", "document_cover", resolved_doc.to_dict(), None, ["logo_imss_official"]
            ctx_doc = self.resolver.resolve_context("worker_reviewing_document", t_start, orientation)
            if ctx_doc and ctx_doc.file:
                return "CONTEXTO", "context_broll", ctx_doc.to_dict(), None, ["logo_imss_official"]
            return "LOCUTOR", "speaker_focus", None, None, []



        # 2.5 Edificio hospitalario verificado (SOLO si fue detectado como entidad verificada)
        for be in building_ents:
            if be.category == "hospital" and be.attributes.get("verified"):
                aid = "hgr1_charo_exterior_asset" if orientation == "16:9" else "hgr1_charo_exterior_asset_9x16"
                asset = self.resolver.assets.get(aid)
                return "EVIDENCIA", "real_building", asset.to_dict() if asset else None, None, ["logo_imss_official"]

        # 2.6 Evento o recinto sindical verificado (Congreso SNTSS)
        for ev in event_ents:
            if "congreso" in ev.name.lower() or ev.attributes.get("organization") == "SNTSS":
                sntss_count = sum(1 for a in memory.assets_used if "sntss_congress" in a.get("id", ""))
                if sntss_count < 2:
                    aid = "sntss_congress_hall_asset" if orientation == "16:9" else "sntss_congress_hall_asset_9x16"
                    asset = self.resolver.assets.get(aid)
                    return "EVIDENCIA", "organization_context", asset.to_dict() if asset else None, None, ["logo_sntss_official"]


        # 3. Contexto B-Roll realista (escenas ambientales sin falsa atribución)
        # Evitar acumulación consecutiva excesiva de B-Roll ambiental (máximo 1 beat consecutivo de contexto)
        context_streak = memory.recent_family_streak("CONTEXTO")

        # 3.1 Pasillo y atención hospitalaria / clínica
        is_clinical_context = (
            any(be.category in ("hospital", "clinic") for be in building_ents)
            or bool(re.search(r"\b(?:m[eé]dic[oa]s?|enfermer[ií]a|camiller[oa]s?|urgencias|pacientes?|personal\s+de\s+salud|guardia|cl[ií]nica|hospital|unidades?\s+m[eé]dicas?)\b", lowered))
        )
        if is_clinical_context and context_streak == 0:
            ctx = self.resolver.resolve_context("hospital_corridor", t_start, orientation)
            if ctx and memory.get_repetition_penalty(ctx.asset_id, t_start, window_s=90.0) < 20.0:
                return "CONTEXTO", "context_broll", ctx.to_dict() if ctx else None, None, ["logo_imss_official"]

        # 3.2 Oficina administrativa / Recursos Humanos
        is_office_context = (
            any(be.category == "workplace" for be in building_ents)
            or bool(re.search(r"\b(?:recursos\s+humanos|oficinas?|ventanilla|tr[aá]mite|expedientes?|personal\s+de\s+base|sustitutos?|confianza|adscripci[oó]n)\b", lowered))
        )
        if is_office_context and context_streak == 0:
            ctx = self.resolver.resolve_context("administrative_office_imss", t_start, orientation)
            if ctx and memory.get_repetition_penalty(ctx.asset_id, t_start, window_s=90.0) < 20.0:
                return "CONTEXTO", "context_broll", ctx.to_dict() if ctx else None, None, ["logo_imss_official"]

        # 3.3 Revisión de percepciones / deducciones / recibo quincenal
        is_payslip_context = (
            bool(payroll_ents)
            or bool(re.search(r"\b(?:quincena|deducci[oó]n(?:es)?|descuentos?|impuestos?|brutos?|recibo\s+de\s+pago|tal[oó]n|cuotas?\s+sindicales?|cuentas\s+claras)\b", lowered))
        )
        if is_payslip_context and context_streak == 0:
            ctx = self.resolver.resolve_context("worker_reviewing_payslip", t_start, orientation)
            if ctx and memory.get_repetition_penalty(ctx.asset_id, t_start, window_s=90.0) < 20.0:
                return "CONTEXTO", "context_broll", ctx.to_dict() if ctx else None, None, ["logo_imss_official"]

        # 3.4 Consulta documental / derechos laborales / nueva generación
        is_doc_study_context = (
            bool(doc_ents or law_ents)
            or bool(re.search(r"\b(?:estudio\s+normativo|derechos\s+laborales|estatutos?|convenio|acuerdo\s+laboral|normativa|nueva\s+generaci[oó]n|difusi[oó]n)\b", lowered))
        )
        if is_doc_study_context and context_streak == 0:
            ctx = self.resolver.resolve_context("worker_reviewing_document", t_start, orientation)
            if ctx and memory.get_repetition_penalty(ctx.asset_id, t_start, window_s=90.0) < 20.0:
                return "CONTEXTO", "context_broll", ctx.to_dict() if ctx else None, None, ["logo_imss_official"]


        # 4. Cifras porcentuales secundarias (solo si no hubo evidencia previa y hay mención explícita)
        has_pct_stat = any(e.attributes.get("type") == "percentage" for e in stat_ents)
        if has_pct_stat and any(kw in lowered for kw in ("porcentaje ponderado", "tasa de incremento", "cifra del congreso")):
            return "EXPLICACION", "number", None, None, []

        # 5. Fallback con AssetResolver general (por categoría de entidad)
        resolved = self.resolver.resolve(entities, current_time_s=t_start, orientation=orientation)
        if resolved and resolved.asset_id:
            v_func = "EVIDENCIA" if ((resolved.asset_type or "").upper() in ("OFFICIAL", "REFERENCE_BASED", "REFERENCE_BASED_AI") or resolved.scene_type in ("document_cover", "real_building")) else "CONTEXTO"
            return v_func, resolved.scene_type, resolved.to_dict(), None, resolved.overlay_logos

        # 6. Locutor
        return "LOCUTOR", "speaker_focus", None, None, []

    def _extract_editorial_text(
        self,
        spoken_text: str,
        entities: list[DetectedEntity],
        visual_func: str,
        scene_type: str,
        chart_type: str | None,
        text_mode: str,
    ) -> tuple[str, str, list[str], str]:
        """Sintetiza titulares concisos (2-6 palabras) con información editorial útil
        (documentos, artículos, cláusulas, cifras, sedes) sin transcribir el guion.
        """
        if text_mode == "minimo":
            for e in entities:
                if e.category == "financial_stat":
                    return e.name, "", [], e.name
            return "", "", [], ""

        lowered = spoken_text.lower()
        headline = ""
        subheadline = ""
        key_points: list[str] = []
        display_text = ""

        # A. EXPLICACIÓN PROGRAMÁTICA
        if visual_func == "EXPLICACION" or chart_type:
            if chart_type == "stat_breakdown_855" or "8.55" in lowered or any("8.55" in e.name for e in entities):
                headline = "Dato Referencial: 8.55%" if chart_type != "stat_breakdown_855" else "Desglose Ponderado: 8.55%"
                subheadline = "Cifra Presentada en el Congreso"
                display_text = "8.55% Ponderado"
            elif chart_type == "comparison_lft_revision" or "revisión" in lowered and "contractual" in lowered:
                headline = "Revisión Salarial vs Contractual"
                subheadline = "Art. 399 Bis vs Art. 400 Bis LFT"
                display_text = "Comparativa LFT"
            elif chart_type == "payroll_sim_tarjeton" or "simulación" in lowered or "tabular" in lowered:
                curr_ent = next((e for e in entities if e.attributes.get("currency") == "MXN"), None)
                curr_txt = curr_ent.name if curr_ent else ""
                headline = "Simulación Salarial IMSS" if ("salarial" in lowered or "sueldo" in lowered) else "Simulación de Prestaciones IMSS"
                subheadline = f"Base de Referencia: {curr_txt}" if curr_txt else "Cálculo según Tabulador IMSS"
                display_text = curr_txt if curr_txt else "Cálculo de Percepciones"
            elif chart_type == "retirement_timeline_cct157" or "ruta" in lowered or "escalonamiento" in lowered or "157" in lowered:
                headline = "Ruta Escalonada Pactada"
                subheadline = "Cláusula 157 CCT · Fondo de Retiro"
                display_text = "Cláusula 157 CCT"
            else:
                for e in entities:
                    if e.category == "financial_stat":
                        headline = f"Análisis Normativo: {e.name}"
                        subheadline = "Cifra Analizada en Turno"
                        display_text = e.name
                        break
                if not headline:
                    headline = "Análisis Salarial IMSS"
                    subheadline = "Desglose Normativo y Cifras Clave"
                    display_text = ""

        # B. EVIDENCIA DOCUMENTAL O EDIFICIOS
        elif visual_func == "EVIDENCIA":
            if chart_type == "lft_document_399bis":
                headline = "Ley Federal del Trabajo"
                subheadline = "Art. 399 Bis · Revisión Salarial Anual"
                display_text = "Art. 399 Bis LFT"
            elif chart_type == "lft_document_400bis":
                headline = "Ley Federal del Trabajo"
                subheadline = "Art. 400 Bis · Revisión Integral Contractual"
                display_text = "Art. 400 Bis LFT"
            elif chart_type == "cct_clause_157":
                headline = "Contrato Colectivo de Trabajo"
                subheadline = "Cláusula 157 · Aportaciones de Retiro"
                display_text = "Cláusula 157 CCT"
            elif chart_type == "tarjeton_detail_c02":
                pct_ent = next((e for e in entities if e.category == "financial_stat"), None)
                headline = "Tarjetón IMSS Digital"
                subheadline = f"Concepto 02: Sueldo Tabular Base ({pct_ent.name})" if pct_ent else "Concepto 02: Sueldo Tabular Base"
                display_text = "Concepto 02"
            elif chart_type == "tarjeton_detail_c11":
                pct_ent = next((e for e in entities if e.category == "financial_stat"), None)
                headline = "Tarjetón IMSS Digital"
                subheadline = f"Concepto 11: Ayuda de Renta ({pct_ent.name})" if pct_ent else "Concepto 11: Ayuda de Renta"
                display_text = "Concepto 11"
            elif any(e.category == "document" and "cct" not in e.name.lower() for e in entities):
                doc = next(e for e in entities if e.category == "document" and "cct" not in e.name.lower())
                headline = doc.name
                subheadline = "Documento Oficial IMSS"
                display_text = doc.name
            elif any("contrato colectivo" in e.name.lower() or "cct" in e.name.lower() for e in entities) or "contrato" in lowered:
                headline = "Contrato Colectivo de Trabajo"
                subheadline = "CCT 2025–2027 · SNTSS - IMSS"
                display_text = "CCT 2025–2027"
            elif any(e.category == "hospital" for e in entities):
                hosp = next(e for e in entities if e.category == "hospital")
                headline = hosp.name
                subheadline = "Hospital General Regional IMSS"
                display_text = hosp.name
            elif any("tarjetón" in e.name.lower() or "tarjeton" in e.name.lower() for e in entities) or "tarjet" in lowered:
                headline = "Tarjetón IMSS Digital"
                subheadline = "Comprobante Oficial de Percepciones"
                display_text = "Tarjetón IMSS"
            elif any("sntss" in e.name.lower() or "congreso" in e.name.lower() for e in entities):
                headline = "SNTSS · Congreso Nacional"
                subheadline = "Sede Sindical Nacional · Aprobación Salarial"
                display_text = "Congreso SNTSS"
            elif any(e.category == "law" for e in entities):
                le = next(e for e in entities if e.category == "law")
                headline = le.name
                subheadline = "Marco Jurídico Oficial Federal"
                display_text = le.name
            else:

                headline = "Evidencia Normativa Oficial"
                subheadline = "Marco Colectivo y Regulatorio IMSS"
                display_text = ""

        # C. CONTEXTO B-ROLL REALISTA
        elif visual_func == "CONTEXTO":
            if "hospital" in lowered or "clínica" in lowered or "médic" in lowered or "salud" in lowered:
                headline = "Entorno Hospitalario IMSS"
                subheadline = "Atención Clínica y Personal en Turno"
            elif "oficina" in lowered or "personal" in lowered or "recursos humanos" in lowered or "trámite" in lowered:
                headline = "Oficina de Personal IMSS"
                subheadline = "Gestión de Recursos Humanos y Nómina"
            elif "quincena" in lowered or "deducción" in lowered or "cuotas" in lowered or "recibo" in lowered or "cuentas" in lowered:
                headline = "Revisión de Percepciones"
                subheadline = "Comprobante y Salario Quincenal"
            else:
                headline = "Consulta Normativa CCT"
                subheadline = "Estudio de Derechos y Marco Laboral"
            display_text = ""

        # D. LOCUTOR (Cero texto en pantalla para evitar riesgo karaoke)
        else:
            headline = ""
            subheadline = ""
            display_text = ""

        if text_mode == "solo_subtitulos":
            display_text = ""

        return headline, subheadline, key_points, display_text

