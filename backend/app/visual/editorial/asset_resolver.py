"""Resolutor Inteligente de Assets Editoriales para La Veinte Radio.

Aplica la jerarquía estricta:
1. Entity exact match
2. Verified reference asset
3. Category match
4. Generic asset
5. speaker_focus fallback

Incorpora penalización por repetición (repetitionPenalty) y salvaguarda
contra falsa atribución.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .asset_registry import AssetItem, AssetRegistry
from .entity_detector import DetectedEntity
from .reference_registry import ReferenceRegistry


@dataclass
class ResolvedAsset:
    asset_id: str | None
    asset_type: str  # official, reference_based, generic, fallback_speaker
    file: str | None
    resolution_method: str  # exact_entity, verified_reference, category, generic, fallback_speaker
    entity: str
    scene_type: str
    overlay_logos: list[str] = field(default_factory=list)
    confidence: float = 1.0
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "asset_type": self.asset_type,
            "file": self.file,
            "resolution_method": self.resolution_method,
            "entity": self.entity,
            "scene_type": self.scene_type,
            "overlay_logos": self.overlay_logos,
            "confidence": self.confidence,
            "reason": self.reason,
        }


class AssetResolver:
    """Resuelve el asset adecuado para un turno o beat visual."""

    def __init__(
        self,
        asset_registry: AssetRegistry | None = None,
        reference_registry: ReferenceRegistry | None = None,
        min_reuse_interval_s: float = 60.0,
    ) -> None:
        self.assets = asset_registry or AssetRegistry()
        self.references = reference_registry or ReferenceRegistry()
        self.min_reuse_interval_s = min_reuse_interval_s
        self._last_used: dict[str, float] = {}  # asset_id -> timestamp_s

    def resolve(
        self,
        entities: list[DetectedEntity],
        current_time_s: float = 0.0,
        orientation: str = "16:9",
        intent: str = "dialogue",
    ) -> ResolvedAsset:
        """Determina el asset visual óptimo para el conjunto de entidades."""
        if not entities:
            return ResolvedAsset(
                asset_id=None,
                asset_type="fallback_speaker",
                file=None,
                resolution_method="fallback_speaker",
                entity="",
                scene_type="speaker_focus",
                reason="Sin entidades específicas; el editor prioriza la conexión con el locutor.",
            )

        # 1. Buscar coincidencias exactas por entidad (excluyendo logos de overlay)
        for ent in entities:
            candidates = [c for c in self.assets.find_by_entity(ent.name, orientation=orientation) if c.category != "logos"]
            best = self._pick_least_recent(candidates, current_time_s)
            if best:
                self._record_usage(best.id, current_time_s)
                overlays = self._get_applicable_logos(ent.name)
                scene_t = self._infer_scene_type(best, ent)
                return ResolvedAsset(
                    asset_id=best.id,
                    asset_type=best.type,
                    file=best.file,
                    resolution_method="exact_entity",
                    entity=ent.name,
                    scene_type=scene_t,
                    overlay_logos=overlays,
                    confidence=0.98,
                    reason=f"Coincidencia exacta con entidad '{ent.name}' investigada y catalogada.",
                )

        # 2. Buscar por referencia verificada vinculada (excluyendo logos de overlay)
        for ent in entities:
            ref_matches = self.references.find_by_entity(ent.name)
            for ref in ref_matches:
                # Buscar assets que tengan reference_id = ref.id
                matching_assets = [
                    a for a in self.assets.all()
                    if ref.id in a.reference_ids and (orientation in a.orientation) and a.category != "logos"
                ]
                best = self._pick_least_recent(matching_assets, current_time_s)
                if best:
                    self._record_usage(best.id, current_time_s)
                    overlays = self._get_applicable_logos(ent.name)
                    scene_t = self._infer_scene_type(best, ent)
                    return ResolvedAsset(
                        asset_id=best.id,
                        asset_type=best.type,
                        file=best.file,
                        resolution_method="verified_reference",
                        entity=ref.entity,
                        scene_type=scene_t,
                        overlay_logos=overlays,
                        confidence=0.90,
                        reason=f"Asset basado en referencia verificada '{ref.id}' ({ref.entity}).",
                    )

        # 3. Buscar por categoría temática (hospital, nómina, sindicato, etc.)
        for ent in entities:
            cat_map = {
                "hospital": "buildings",
                "clinic": "buildings",
                "building": "buildings",
                "document": "documents",
                "law": "documents",
                "payroll_concept": "payroll",
                "event": "union",
            }
            target_cat = cat_map.get(ent.category)
            if target_cat:
                cat_candidates = self.assets.find_by_category(target_cat, orientation=orientation)
                # Priorizar assets genéricos para evitar falsa atribución si la entidad no está verificada
                generic_candidates = [c for c in cat_candidates if c.type == "generic"]
                best = self._pick_least_recent(generic_candidates or cat_candidates, current_time_s)
                if best:
                    # Salvaguarda: si es un hospital genérico, no atribuir a una unidad no verificada
                    self._record_usage(best.id, current_time_s)
                    overlays = self._get_applicable_logos(ent.name)
                    return ResolvedAsset(
                        asset_id=best.id,
                        asset_type=best.type,
                        file=best.file,
                        resolution_method="category" if best.type != "generic" else "generic",
                        entity=ent.name if best.based_on_verified_references else "Entorno contextual",
                        scene_type=self._infer_scene_type(best, ent),
                        overlay_logos=overlays,
                        confidence=0.75,
                        reason=f"Contexto visual por categoría '{target_cat}' sin falsa atribución.",
                    )

        # 4. Fallback a speaker_focus
        return ResolvedAsset(
            asset_id=None,
            asset_type="fallback_speaker",
            file=None,
            resolution_method="fallback_speaker",
            entity=entities[0].name if entities else "",
            scene_type="speaker_focus",
            reason="Sin asset específico disponible o penalización por repetición activa; foco en el locutor.",
        )

    def _pick_least_recent(self, candidates: list[AssetItem], current_time_s: float) -> AssetItem | None:
        """Selecciona el candidato con menor penalización por repetición."""
        if not candidates:
            return None
        valid = []
        for c in candidates:
            last_t = self._last_used.get(c.id, -9999.0)
            elapsed = current_time_s - last_t
            if elapsed >= self.min_reuse_interval_s:
                valid.append((elapsed, c))

        if valid:
            valid.sort(key=lambda x: x[0], reverse=True)
            return valid[0][1]

        # Si todos fueron usados recientemente, devolver None para forzar variedad o fallback
        return None

    def _record_usage(self, asset_id: str, current_time_s: float) -> None:
        self._last_used[asset_id] = current_time_s

    def _get_applicable_logos(self, entity_name: str) -> list[str]:
        """Identifica logotipos oficiales aplicables como overlays."""
        low = entity_name.lower()
        logos = []
        if "imss" in low or "seguro social" in low or "hospital" in low or "tarjetón" in low:
            logos.append("logo_imss_official")
        if "sntss" in low or "sindicato" in low or "congreso" in low:
            logos.append("logo_sntss_official")
        if "cfcrl" in low or "conciliación" in low or "registro laboral" in low:
            logos.append("logo_cfcrl_official")
        return logos

    def _infer_scene_type(self, asset: AssetItem, ent: DetectedEntity) -> str:
        if asset.category == "buildings":
            return "real_building"
        if asset.category == "documents":
            return "document_cover"
        if asset.category == "payroll":
            return "payroll_visual"
        if asset.category == "union":
            return "organization_context"
        return "topic_image"
