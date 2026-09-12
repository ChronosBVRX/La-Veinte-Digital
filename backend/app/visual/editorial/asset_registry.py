"""Catálogo y Registro de Assets Editoriales para La Veinte Radio.

Clasifica assets estrictamente en tres tipos:
- official: Logos y símbolos oficiales de uso informativo permitido (SVG/PNG transparente).
- reference_based: Ilustraciones y fondos creados tras investigar hechos reales verificables.
- generic: Escenas contextuales sin atribución a un edificio o entidad específica.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class AssetItem:
    id: str
    file: str  # Ruta relativa desde assets/editorial/
    type: str  # official, reference_based, generic
    entity: str
    category: str  # organizations, logos, buildings, documents, payroll, medical, workplace, union
    tags: list[str] = field(default_factory=list)
    orientation: list[str] = field(default_factory=lambda: ["16:9", "9:16"])
    based_on_verified_references: bool = False
    reference_ids: list[str] = field(default_factory=list)
    style_version: str = "lv-editorial-v1"
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AssetItem":
        return cls(
            id=data["id"],
            file=data["file"],
            type=data.get("type", "generic"),
            entity=data.get("entity", ""),
            category=data.get("category", "workplace"),
            tags=data.get("tags", []),
            orientation=data.get("orientation", ["16:9", "9:16"]),
            based_on_verified_references=data.get("based_on_verified_references", False),
            reference_ids=data.get("reference_ids", []),
            style_version=data.get("style_version", "lv-editorial-v1"),
            meta=data.get("meta", {}),
        )


class AssetRegistry:
    """Gestiona los assets registrados y sus metadatos de procedencia."""

    def __init__(self, registry_path: Path | str | None = None) -> None:
        if registry_path is None:
            root = Path(__file__).resolve().parents[4]
            self.path = root / "assets" / "editorial" / "asset-registry.json"
        else:
            self.path = Path(registry_path)
        self._items: dict[str, AssetItem] = {}
        self.load()

    def load(self) -> None:
        if not self.path.exists():
            self._items = {}
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            entries = data.get("assets", data) if isinstance(data, dict) else data
            if isinstance(entries, list):
                self._items = {it["id"]: AssetItem.from_dict(it) for it in entries if "id" in it}
            elif isinstance(entries, dict):
                self._items = {k: AssetItem.from_dict(v if "id" in v else {**v, "id": k}) for k, v in entries.items()}
        except Exception:
            self._items = {}

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        out = {
            "registry_version": "lv-assets-v1",
            "count": len(self._items),
            "assets": [it.to_dict() for it in self._items.values()],
        }
        self.path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    def get(self, asset_id: str) -> AssetItem | None:
        return self._items.get(asset_id)

    def find_by_entity(self, entity_name: str, orientation: str | None = None) -> list[AssetItem]:
        low = entity_name.lower()
        results = []
        for it in self._items.values():
            if low in it.entity.lower() or it.entity.lower() in low or any(low in t.lower() for t in it.tags):
                if orientation is None or orientation in it.orientation:
                    results.append(it)
        return results

    def find_by_category(self, category: str, orientation: str | None = None) -> list[AssetItem]:
        results = []
        for it in self._items.values():
            if it.category == category:
                if orientation is None or orientation in it.orientation:
                    results.append(it)
        return results

    def register(self, item: AssetItem) -> None:
        self._items[item.id] = item
        self.save()

    def all(self) -> list[AssetItem]:
        return list(self._items.values())
