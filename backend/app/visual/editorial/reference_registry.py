"""Registro de Procedencia y Trazabilidad de Referencias del Mundo Real.

Almacena hechos verificados, fuentes oficiales consultadas, metadatos de licencia
y características visuales extraídas antes de componer cualquier asset.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class ReferenceSource:
    url: str
    title: str
    source_type: str  # official, institutional, wikimedia, secondary
    license: str      # official, public-domain, creative-commons, reference-only, unknown
    attribution: str = ""
    author: str = ""


@dataclass
class ReferenceItem:
    id: str
    entity: str
    type: str  # organization, document, building, law, event, payslip, medical, workplace
    research_date: str
    sources: list[dict[str, Any]]
    verified_characteristics: dict[str, Any]
    status: str = "verified"  # verified, unverified, rejected
    stale_after: str | None = None
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ReferenceItem":
        return cls(
            id=data["id"],
            entity=data["entity"],
            type=data["type"],
            research_date=data["research_date"],
            sources=data.get("sources", []),
            verified_characteristics=data.get("verified_characteristics", {}),
            status=data.get("status", "verified"),
            stale_after=data.get("stale_after"),
            notes=data.get("notes", ""),
        )


class ReferenceRegistry:
    """Gestiona el catálogo persistente de referencias investigadas."""

    def __init__(self, registry_path: Path | str | None = None) -> None:
        if registry_path is None:
            # Por defecto busca assets/editorial/reference-registry.json en el repo
            root = Path(__file__).resolve().parents[4]
            self.path = root / "assets" / "editorial" / "reference-registry.json"
        else:
            self.path = Path(registry_path)
        self._items: dict[str, ReferenceItem] = {}
        self.load()

    def load(self) -> None:
        if not self.path.exists():
            self._items = {}
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            entries = data.get("references", data) if isinstance(data, dict) else data
            if isinstance(entries, list):
                self._items = {it["id"]: ReferenceItem.from_dict(it) for it in entries if "id" in it}
            elif isinstance(entries, dict):
                self._items = {k: ReferenceItem.from_dict(v if "id" in v else {**v, "id": k}) for k, v in entries.items()}
        except Exception:
            self._items = {}

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        out = {
            "registry_version": "lv-reference-v1",
            "count": len(self._items),
            "references": [it.to_dict() for it in self._items.values()],
        }
        self.path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    def get(self, ref_id: str) -> ReferenceItem | None:
        return self._items.get(ref_id)

    def find_by_entity(self, entity_name: str) -> list[ReferenceItem]:
        low = entity_name.lower()
        return [it for it in self._items.values() if low in it.entity.lower() or it.entity.lower() in low]

    def register(self, item: ReferenceItem) -> None:
        self._items[item.id] = item
        self.save()

    def all(self) -> list[ReferenceItem]:
        return list(self._items.values())
