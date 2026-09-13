"""Motor Visual Editorial Basado en Referencias Reales — La Veinte Radio.

Integra análisis de contenido, detección de entidades del mundo laboral e
institucional, investigación jerárquica de fuentes oficiales, registro de
procedencia, catálogo y resolución de assets, y composición programática de
escenas (gráficos, portadas, B-roll e identidades institucionales).
"""
from __future__ import annotations

from .entity_detector import EntityDetector, DetectedEntity
from .reference_research import ReferenceResearcher, ResearchReport
from .reference_registry import ReferenceRegistry, ReferenceItem
from .asset_registry import AssetRegistry, AssetItem
from .asset_resolver import AssetResolver, ResolvedAsset
from .visual_editorial_planner import VisualEditorialPlanner, VisualPlan
from .charts import ProgrammaticChartRenderer
from .scene_composer import SceneComposer

__all__ = [
    "EntityDetector",
    "DetectedEntity",
    "ReferenceResearcher",
    "ResearchReport",
    "ReferenceRegistry",
    "ReferenceItem",
    "AssetRegistry",
    "AssetItem",
    "AssetResolver",
    "ResolvedAsset",
    "VisualEditorialPlanner",
    "VisualPlan",
    "ProgrammaticChartRenderer",
    "SceneComposer",
]
