"""Memoria Editorial y Penalizaciones Visuales para La Veinte Radio.

Registra en tiempo de planificación:
- Conceptos introducidos y explicados
- Activos y documentos mostrados
- Gráficos y simulaciones programáticas
- Familias visuales recientes (LOCUTOR, EVIDENCIA, EXPLICACIÓN, CONTEXTO)
- Aplica strongRepetitionPenalty (ej. stat_breakdown_855 solo 1 vez en full)
- Aplica genericnessPenalty (evita tarjetas oscuras genéricas cuando hay evidencia real)
"""
from __future__ import annotations

from typing import Any


class EditorialMemory:
    """Rastrea el historial visual para evitar redundancias, karaoke y tarjetas genéricas."""

    def __init__(self) -> None:
        self.concepts_introduced: set[str] = set()
        self.concepts_explained: dict[str, float] = {}  # concepto -> timestamp_s
        self.assets_used: list[dict[str, Any]] = []
        self.documents_shown: list[dict[str, Any]] = []
        self.charts_shown: list[dict[str, Any]] = []
        self.entities_shown: dict[str, list[float]] = {}
        self.scene_families: list[str] = []
        self.strong_penalties_applied: int = 0
        self.genericness_penalties_applied: int = 0

    def record_beat(self, beat: dict[str, Any]) -> None:
        """Registra un beat visual en la memoria editorial."""
        family = beat.get("visual_function") or "LOCUTOR"
        self.scene_families.append(family)

        t_s = float(beat.get("start_s", 0.0))

        # Registrar activo si existe
        asset = beat.get("resolved_asset")
        if asset:
            aid = asset.get("id") or asset.get("file", "")
            entity = asset.get("entity") or ""
            self.assets_used.append({"id": aid, "time_s": t_s, "entity": entity})
            if entity:
                self.entities_shown.setdefault(entity, []).append(t_s)
            if asset.get("type") == "document" or "documents" in asset.get("file", ""):
                self.documents_shown.append({"id": aid, "time_s": t_s, "entity": entity})

        # Registrar gráfico
        chart = beat.get("chart_type")
        if chart:
            self.charts_shown.append({"chart": chart, "time_s": t_s})
            if chart == "stat_breakdown_855":
                self.concepts_explained["incremento_855"] = t_s

        # Registrar conceptos clave
        display_t = (beat.get("headline") or beat.get("display_text") or "").lower()
        if "8.55" in display_t:
            self.concepts_introduced.add("incremento_855")
        if "cct" in display_t or "contrato colectivo" in display_t:
            self.concepts_introduced.add("cct_2025_2027")
        if "lft" in display_t or "ley federal" in display_t:
            self.concepts_introduced.add("lft")
        if "tarjetón" in display_t or "tarjeton" in display_t:
            self.concepts_introduced.add("tarjeton")

    def has_concept_been_explained(self, concept: str) -> bool:
        """Determina si un concepto ya recibió su explicación visual principal."""
        return concept in self.concepts_explained

    def get_repetition_penalty(
        self,
        asset_or_chart_id: str,
        current_time_s: float,
        window_s: float = 180.0,
    ) -> float:
        """Calcula penalización por repetición.
        
        Para stat_breakdown_855: si ya se mostró una vez completa, la penalización
        es severa (strongRepetitionPenalty), obligando a usar un dato compacto o locutor.
        """
        if not asset_or_chart_id:
            return 0.0

        # Regla maestra para stat_breakdown_855
        if asset_or_chart_id == "stat_breakdown_855":
            already_shown = any(c["chart"] == "stat_breakdown_855" for c in self.charts_shown)
            if already_shown:
                self.strong_penalties_applied += 1
                return 999.0  # Prohibición casi absoluta de reaparición completa

        # Para otros gráficos: penalización según tiempo desde última aparición
        for c in reversed(self.charts_shown):
            if c["chart"] == asset_or_chart_id:
                dt = current_time_s - c["time_s"]
                if dt < window_s:
                    return max(0.0, 50.0 * (1.0 - dt / window_s))

        # Para activos de imagen:
        for a in reversed(self.assets_used):
            if a["id"] == asset_or_chart_id:
                dt = current_time_s - a["time_s"]
                if dt < window_s:
                    return max(0.0, 40.0 * (1.0 - dt / window_s))

        return 0.0

    def get_genericness_penalty(
        self,
        candidate_scene_type: str,
        has_real_evidence_available: bool,
    ) -> float:
        """Penaliza el uso de tarjetas genéricas si existen activos reales disponibles."""
        if has_real_evidence_available and candidate_scene_type in (
            "explanation",
            "warning",
            "clarification",
            "summary",
            "conversation",
        ):
            self.genericness_penalties_applied += 1
            return 45.0  # Prioriza el documento o referencia real
        return 0.0

    def recent_family_streak(self, family: str) -> int:
        """Cuenta cuántos beats consecutivos inmediatos pertenecen a la misma familia."""
        count = 0
        for f in reversed(self.scene_families):
            if f == family:
                count += 1
            else:
                break
        return count

    def get_summary(self) -> dict[str, Any]:
        """Devuelve un resumen de estado de la memoria editorial."""
        return {
            "concepts_introduced": list(self.concepts_introduced),
            "concepts_explained": list(self.concepts_explained.keys()),
            "total_assets_used": len(self.assets_used),
            "documents_shown_count": len(self.documents_shown),
            "charts_shown_count": len(self.charts_shown),
            "strong_penalties_applied": self.strong_penalties_applied,
            "genericness_penalties_applied": self.genericness_penalties_applied,
        }

    def calculate_documentary_value(self, beat: dict[str, Any]) -> float:
        """Calcula el valor documental (0.0 a 1.0) para un beat no-locutor.
        
        Pondera:
        - Especificidad: Activo exacto/oficial (1.0), referencia investigada (0.85), contexto realista (0.75), infografía programática (0.70), genérico (0.20)
        - Calidad de fuente: Oficial/Gobierno/CCT (1.0), verificado institucional (0.90), interno (0.80)
        - Relevancia: Coincidencia de entidad investigada (1.0), categoría documental (0.80)
        - Valor explicativo: Alto en evidencia y explicación (0.90-1.0), medio en ambientación (0.60)
        - Novedad: 1.0 en primer uso, decae con repeticiones
        """
        vf = beat.get("visual_function") or "LOCUTOR"
        if vf == "LOCUTOR":
            return 0.0

        asset = beat.get("resolved_asset") or {}
        chart = beat.get("chart_type")
        aid = asset.get("asset_id") or chart or ""

        # 1. Especificidad
        atype = (asset.get("asset_type") or "").upper()
        if atype == "OFFICIAL" or "hgr1_charo" in aid:
            specificity = 1.0
        elif atype in ("REFERENCE_BASED", "REFERENCE_BASED_AI") or "cct" in aid or "tarjeton" in aid or "sntss" in aid:
            specificity = 0.88
        elif atype in ("GENERIC_CONTEXTUAL_AI", "CONTEXTUAL", "GENERIC") or vf == "CONTEXTO":
            specificity = 0.78
        elif chart:
            specificity = 0.72
        else:
            specificity = 0.25

        # 2. Calidad de fuente
        if "cct" in aid or "lft" in aid or "imss" in aid or "cfcrl" in aid or "sntss" in aid:
            source_quality = 0.95
        elif atype in ("OFFICIAL", "REFERENCE_BASED", "REFERENCE_BASED_AI"):
            source_quality = 0.90
        elif atype in ("GENERIC_CONTEXTUAL_AI", "CONTEXTUAL", "GENERIC"):
            source_quality = 0.82
        elif chart:
            source_quality = 0.80
        else:
            source_quality = 0.30

        # 3. Relevancia
        relevance = 0.90 if asset.get("entity") or chart else 0.50

        # 4. Valor explicativo
        if vf == "EVIDENCIA":
            expl_val = 0.95
        elif vf == "EXPLICACION":
            expl_val = 0.90
        elif vf == "CONTEXTO":
            expl_val = 0.75
        else:
            expl_val = 0.40

        # 5. Novedad
        times_used = sum(1 for a in self.assets_used if a["id"] == aid) + sum(1 for c in self.charts_shown if c["chart"] == aid)
        novelty = max(0.40, 1.0 - (times_used * 0.15))

        score = (
            specificity * 0.35
            + source_quality * 0.25
            + relevance * 0.20
            + expl_val * 0.10
            + novelty * 0.10
        )
        return round(score, 2)

    def get_generic_visual_ratio(self, beats: list[dict[str, Any]]) -> dict[str, Any]:
        """Calcula el desglose de genericidad y autenticidad visual para todos los beats."""
        generic_cards = 0
        generic_backgrounds = 0
        exact_reference_assets = 0
        reference_based_assets = 0
        contextual_assets = 0
        programmatic_charts = 0

        non_speaker_beats = [
            b for b in beats
            if b.get("visual_function") != "LOCUTOR" and b.get("scene_type") not in ("brand_opening", "brand_closing")
        ]
        total_non_speaker = len(non_speaker_beats) or 1

        for b in non_speaker_beats:
            asset = b.get("resolved_asset") or {}
            chart = b.get("chart_type")
            atype = (asset.get("asset_type") or "").upper()
            aid = asset.get("asset_id") or ""

            if chart:
                programmatic_charts += 1
            elif "hgr1_charo" in aid or atype == "OFFICIAL":
                exact_reference_assets += 1
            elif atype in ("REFERENCE_BASED", "REFERENCE_BASED_AI") or "cct" in aid or "tarjeton" in aid or "sntss" in aid:
                reference_based_assets += 1
            elif atype in ("GENERIC_CONTEXTUAL_AI", "CONTEXTUAL", "GENERIC") or b.get("visual_function") == "CONTEXTO":
                contextual_assets += 1
            elif b.get("scene_type") in ("explanation", "warning", "clarification", "summary", "topic_image"):
                generic_cards += 1
            else:
                generic_backgrounds += 1

        generic_count = generic_cards + generic_backgrounds
        reference_count = exact_reference_assets + reference_based_assets + contextual_assets + programmatic_charts

        return {
            "generic_cards_count": generic_cards,
            "generic_backgrounds_count": generic_backgrounds,
            "exact_reference_assets_count": exact_reference_assets,
            "reference_based_assets_count": reference_based_assets,
            "contextual_assets_count": contextual_assets,
            "programmatic_charts_count": programmatic_charts,
            "total_non_speaker_beats": total_non_speaker,
            "generic_visuals_pct": round(100.0 * generic_count / total_non_speaker, 1),
            "exact_reference_visuals_pct": round(100.0 * reference_count / total_non_speaker, 1),
        }

    def get_documentary_value_breakdown(self, beats: list[dict[str, Any]], total_duration_s: float) -> dict[str, Any]:
        """Calcula el desglose estricto en las 5 categorías requeridas:
        - exactOfficialVisuals
        - referenceBasedVisuals
        - genericContextualVisuals
        - programmaticExplanations
        - speaker
        Total = 100%.
        """
        exact_official_s = 0.0
        reference_based_s = 0.0
        generic_contextual_s = 0.0
        programmatic_s = 0.0
        speaker_s = 0.0

        exact_official_beats = 0
        reference_based_beats = 0
        generic_contextual_beats = 0
        programmatic_beats = 0
        speaker_beats = 0

        for b in beats:
            vf = b.get("visual_function") or "LOCUTOR"
            st = b.get("scene_type") or "speaker_focus"
            asset = b.get("resolved_asset") or {}
            chart = b.get("chart_type")
            aid = asset.get("asset_id") or ""
            atype = (asset.get("asset_type") or "").upper()
            dur = float(b.get("duration_s", 0.0))

            if vf == "BRAND" or st in ("brand_opening", "brand_closing") or vf == "LOCUTOR" or st == "speaker_focus":
                speaker_s += dur
                speaker_beats += 1
            elif vf == "EXPLICACION" or chart:
                programmatic_s += dur
                programmatic_beats += 1
            elif vf == "CONTEXTO" or atype in ("GENERIC_CONTEXTUAL_AI", "CONTEXTUAL", "GENERIC"):
                generic_contextual_s += dur
                generic_contextual_beats += 1
            elif vf == "EVIDENCIA":
                # EXACT / OFFICIAL vs REFERENCE_BASED
                if atype == "OFFICIAL" or "logo" in aid or "lft" in aid or "official" in aid:
                    exact_official_s += dur
                    exact_official_beats += 1
                else:
                    reference_based_s += dur
                    reference_based_beats += 1
            else:
                generic_contextual_s += dur
                generic_contextual_beats += 1

        total_d = total_duration_s or 1.0
        total_b = len(beats) or 1

        raw_eo = 100.0 * exact_official_s / total_d
        raw_rb = 100.0 * reference_based_s / total_d
        raw_gc = 100.0 * generic_contextual_s / total_d
        raw_pr = 100.0 * programmatic_s / total_d
        raw_sp = 100.0 * speaker_s / total_d

        pct_eo = round(raw_eo, 1)
        pct_rb = round(raw_rb, 1)
        pct_gc = round(raw_gc, 1)
        pct_pr = round(raw_pr, 1)
        pct_sp = round(raw_sp, 1)

        diff = round(100.0 - (pct_eo + pct_rb + pct_gc + pct_pr + pct_sp), 1)
        if abs(diff) > 0.001:
            pct_sp = round(pct_sp + diff, 1)

        return {
            "exactOfficialVisuals": {
                "duration_s": round(exact_official_s, 2),
                "pct": pct_eo,
                "beats_count": exact_official_beats,
            },
            "referenceBasedVisuals": {
                "duration_s": round(reference_based_s, 2),
                "pct": pct_rb,
                "beats_count": reference_based_beats,
            },
            "genericContextualVisuals": {
                "duration_s": round(generic_contextual_s, 2),
                "pct": pct_gc,
                "beats_count": generic_contextual_beats,
            },
            "programmaticExplanations": {
                "duration_s": round(programmatic_s, 2),
                "pct": pct_pr,
                "beats_count": programmatic_beats,
            },
            "speaker": {
                "duration_s": round(speaker_s, 2),
                "pct": pct_sp,
                "beats_count": speaker_beats,
            },
            "total_duration_s": round(total_d, 2),
            "total_beats": total_b,
        }

    def check_speaker_overuse(self, speaker_time_pct: float) -> list[str]:
        """Comprueba si el locutor domina excesivamente el metraje documental."""
        warnings: list[str] = []
        if speaker_time_pct > 60.0:
            warnings.append(
                f"DOCUMENTARY_SPEAKER_OVERUSE: El locutor ocupa el {speaker_time_pct:.1f}% del episodio "
                "(límite objetivo: <= 55.0%). Se requiere rebalancear con mayor presencia de evidencia y contexto."
            )
        return warnings
