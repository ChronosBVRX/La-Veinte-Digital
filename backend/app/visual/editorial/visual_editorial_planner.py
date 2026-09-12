"""Planificador Visual Editorial para La Veinte Radio.

Transforma el guion, el alignment canónico y las referencias investigadas
en un plan de dirección visual estructurado (visual-plan.json).

Aplica el principio editorial humano:
- Si mostrar algo diferente ayuda al trabajador -> usar referencia real, gráfico o documento.
- Si no aporta -> conservar speaker_focus.
- Los turnos pueden subdividirse en beats visuales sin alterar startMs ni endMs.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .asset_resolver import AssetResolver, ResolvedAsset
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
    resolved_asset: dict[str, Any] | None
    chart_type: str | None
    editorial_reason: str
    display_text: str
    overlay_logos: list[str] = field(default_factory=list)


@dataclass
class VisualPlan:
    project_id: str
    duration_s: float
    total_beats: int
    visual_mix: dict[str, float]  # speaker_pct, reference_broll_pct, cards_charts_pct, brand_pct
    beats: list[dict[str, Any]]

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
    ) -> VisualPlan:
        """Construye el plan visual completo para el proyecto."""
        detected_by_turn = self.detector.detect_in_script(turns)
        beats: list[VisualBeat] = []

        align_turns = alignment.get("turns", [])
        align_map = {t.get("turnId") or t.get("id"): t for t in align_turns}

        # 1. Preroll institucional de apertura (0.0 a primer turno de voz)
        first_start = 4.90
        if align_turns and "startMs" in align_turns[0]:
            first_start = align_turns[0]["startMs"] / 1000.0

        if first_start > 0.1:
            beats.append(VisualBeat(
                beat_id="beat-opening-brand",
                turn_id="preroll",
                speaker="",
                start_s=0.0,
                end_s=round(first_start, 2),
                duration_s=round(first_start, 2),
                scene_type="brand_opening",
                resolved_asset=None,
                chart_type=None,
                editorial_reason="Apertura institucional obligatoria de La Veinte Radio.",
                display_text="LA VEINTE RADIO",
                overlay_logos=[],
            ))

        # 2. Planificación turno por turno
        for idx, turn in enumerate(turns):
            tid = turn.get("id") or f"turn-{idx + 1}"
            al = align_map.get(tid)
            if not al:
                continue

            t_start = al["startMs"] / 1000.0
            t_end = al["endMs"] / 1000.0
            t_dur = t_end - t_start
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
            )
            beats.extend(turn_beats)

        # 3. Cierre institucional (desde último turno hasta duración total)
        last_end = beats[-1].end_s if beats else duration_s - 5.0
        if last_end < duration_s - 0.1:
            beats.append(VisualBeat(
                beat_id="beat-closing-brand",
                turn_id="outro",
                speaker="",
                start_s=round(last_end, 2),
                end_s=round(duration_s, 2),
                duration_s=round(duration_s - last_end, 2),
                scene_type="brand_closing",
                resolved_asset=None,
                chart_type=None,
                editorial_reason="Cierre institucional exclusivo de La Veinte Radio.",
                display_text="LA VEINTE DIGITAL",
                overlay_logos=[],
            ))

        # 4. Cálculo del visual mix
        total_time = duration_s or 1.0
        speaker_time = sum(b.duration_s for b in beats if b.scene_type == "speaker_focus")
        ref_broll_time = sum(b.duration_s for b in beats if b.scene_type in ("real_building", "document_cover", "organization_context", "topic_image"))
        cards_time = sum(b.duration_s for b in beats if b.scene_type in ("stat_card", "comparison", "payroll_visual", "number"))
        brand_time = sum(b.duration_s for b in beats if b.scene_type in ("brand_opening", "brand_closing"))

        mix = {
            "speaker_focus_pct": round(100 * speaker_time / total_time, 1),
            "real_reference_broll_pct": round(100 * ref_broll_time / total_time, 1),
            "cards_charts_pct": round(100 * cards_time / total_time, 1),
            "brand_identity_pct": round(100 * brand_time / total_time, 1),
        }

        plan = VisualPlan(
            project_id=project_id,
            duration_s=round(duration_s, 6),
            total_beats=len(beats),
            visual_mix=mix,
            beats=[asdict(b) for b in beats],
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
    ) -> list[VisualBeat]:
        """Subdivide un turno en beats según su peso editorial."""
        out: list[VisualBeat] = []

        # Turnos cortos (< 4.5s) o puramente conversacionales/reacciones -> Speaker Focus
        if t_dur < 4.5 or not entities:
            out.append(VisualBeat(
                beat_id=turn_id,
                turn_id=turn_id,
                speaker=speaker,
                start_s=round(t_start, 2),
                end_s=round(t_end, 2),
                duration_s=round(t_dur, 2),
                scene_type="speaker_focus",
                resolved_asset=None,
                chart_type=None,
                editorial_reason="Turno conversacional dinámico; conexión directa locutor-oyente.",
                display_text=text,
                overlay_logos=[],
            ))
            return out

        # Identificar si corresponde un gráfico programático
        chart_type = None
        card_scene = "topic_image"
        if any("8.55%" in e.name or "desglose" in text.lower() or "divide ese ocho" in text.lower() for e in entities):
            chart_type = "stat_breakdown_855"
            card_scene = "stat_card"
        elif any("artículo 399" in text.lower() or "artículo 400" in text.lower() or "consulta general" in text.lower() for e in entities):
            chart_type = "comparison_lft_revision"
            card_scene = "comparison"
        elif any("diez mil pesos" in text.lower() or "doscientos noventa" in text.lower() or "simulación" in text.lower() for e in entities):
            chart_type = "payroll_sim_tarjeton"
            card_scene = "payroll_visual"
        elif any("cláusula ciento cincuenta y siete" in text.lower() and ("ruta" in text.lower() or "crecimiento" in text.lower() or "octubre" in text.lower()) for e in entities):
            chart_type = "retirement_timeline_cct157"
            card_scene = "stat_card"

        # Resolver asset de B-roll / referencia real
        resolved = self.resolver.resolve(entities, current_time_s=t_start, orientation=orientation)

        # Si el turno es mediano/largo (>= 6s) y hay un gráfico o asset justificado:
        # División en 2 o 3 beats editoriales:
        # [0 .. 2.5s]: Speaker focus (establece el contacto humano del locutor)
        # [2.5 .. dur - 1.5s]: Visual de referencia o Gráfico explicativo
        # [dur - 1.5s .. dur]: Speaker focus (cierre del argumento)
        if (chart_type or (resolved and resolved.asset_id)) and t_dur >= 6.5:
            spk_intro_dur = min(3.0, t_dur * 0.3)
            visual_dur = t_dur - spk_intro_dur - 1.5
            b1_end = t_start + spk_intro_dur
            b2_end = b1_end + visual_dur

            # Beat 1: Intro speaker
            out.append(VisualBeat(
                beat_id=f"{turn_id}-b1-spk",
                turn_id=turn_id,
                speaker=speaker,
                start_s=round(t_start, 2),
                end_s=round(b1_end, 2),
                duration_s=round(spk_intro_dur, 2),
                scene_type="speaker_focus",
                resolved_asset=None,
                chart_type=None,
                editorial_reason="Apertura del argumento por el locutor.",
                display_text=text,
                overlay_logos=[],
            ))

            # Beat 2: Referencia real / Gráfico programático
            out.append(VisualBeat(
                beat_id=f"{turn_id}-b2-visual",
                turn_id=turn_id,
                speaker=speaker,
                start_s=round(b1_end, 2),
                end_s=round(b2_end, 2),
                duration_s=round(visual_dur, 2),
                scene_type=card_scene if chart_type else resolved.scene_type,
                resolved_asset=resolved.to_dict() if resolved else None,
                chart_type=chart_type,
                editorial_reason=f"Exposición visual de apoyo ({chart_type or resolved.asset_id}) para clarificar el concepto.",
                display_text=text,
                overlay_logos=resolved.overlay_logos if resolved else [],
            ))

            # Beat 3: Cierre speaker
            out.append(VisualBeat(
                beat_id=f"{turn_id}-b3-spk",
                turn_id=turn_id,
                speaker=speaker,
                start_s=round(b2_end, 2),
                end_s=round(t_end, 2),
                duration_s=round(t_end - b2_end, 2),
                scene_type="speaker_focus",
                resolved_asset=None,
                chart_type=None,
                editorial_reason="Remate del turno por el locutor.",
                display_text=text,
                overlay_logos=[],
            ))
        else:
            # Beat único
            scene_t = card_scene if chart_type else (resolved.scene_type if resolved and resolved.asset_id else "speaker_focus")
            out.append(VisualBeat(
                beat_id=turn_id,
                turn_id=turn_id,
                speaker=speaker,
                start_s=round(t_start, 2),
                end_s=round(t_end, 2),
                duration_s=round(t_dur, 2),
                scene_type=scene_t,
                resolved_asset=resolved.to_dict() if resolved and resolved.asset_id else None,
                chart_type=chart_type,
                editorial_reason="Exposición continua del punto normativo.",
                display_text=text,
                overlay_logos=resolved.overlay_logos if resolved and resolved.asset_id else [],
            ))

        return out
