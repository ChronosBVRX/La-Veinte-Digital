# Motor Visual Editorial de La Veinte Radio

**Versión:** 1.0.0 (2026-09-11)  
**Módulo:** `backend/app/visual/editorial/`  
**Objetivo:** Proporcionar dirección visual inteligente e informada por referencias reales del mundo laboral e institucional.

---

## 1. Diagrama de Arquitectura

```text
               GUION (script.json)
                        │
                        ▼
            AUDIO MASTER & SMARTMIXER (master.wav)
                        │
                        ▼
       ALIGNMENT CANÓNICO (timeline-alignment.json)
         [Única autoridad temporal inmutable]
                        │
                        ▼
     DETECCIÓN DE ENTIDADES (entity_detector.py)
         [20 categorías: org, doc, ley, cl, concepto, stat, etc.]
                        │
                        ▼
    INVESTIGACIÓN JERÁRQUICA (reference_research.py)
         [Niveles 1-4: gob.mx, dof, sntss, cfcrl, commons]
                        │
                        ▼
   REGISTRO DE PROCEDENCIA (reference-registry.json)
                        │
                        ▼
     PLANIFICADOR EDITORIAL (visual_editorial_planner.py)
         [Divide turnos en beats visuales sin alterar startMs/endMs]
                        │
                        ▼
    RESOLUTOR DE ASSETS (asset_resolver.py / asset-registry.json)
         [Coincidencia exacta -> referencia -> categoría -> genérico -> locutor]
                        │
                        ▼
   COMPOSITOR MULTICAPA (scene_composer.py + charts.py)
         [Fondo B-roll + Gráficos exactos Pillow + Overlays oficiales]
                        │
                        ▼
      RENDERER MULTIFORMATO (renderer.py / project_renderer.py)
         ├── Preview (854x480 @ 30fps)
         ├── Video 16:9 (1920x1080 @ 30fps)
         └── Video 9:16 (1080x1920 @ 30fps)
```

---

## 2. Componentes Clave

### `EntityDetector` (`entity_detector.py`)
* Analiza el texto de cada turno mediante expresiones regulares y diccionarios normativos.
* Extrae organizaciones (`IMSS`, `SNTSS`, `CFCRL`), leyes (`LFT`, `LSS`), artículos (`399 Bis`, `400 Bis`), cláusulas (`63 Bis`, `157`), conceptos del tarjetón (`002`, `011`) y porcentajes financieros (`8.55%`, `2.9%`, `3.9%`, `1.75%`).

### `ReferenceResearcher` (`reference_research.py`)
* Consulta y valida características visuales reales (colores oficiales, arquitectura, tipografía de portadas).
* Genera el reporte auditable `data/projects/<id>/reference-research.json` detallando fuentes consultadas y estado de licencias.

### `AssetResolver` (`asset_resolver.py`)
* Resuelve qué visual mostrar aplicando la jerarquía estricta de 5 pasos.
* Implementa `repetitionPenalty` (intervalo mínimo de 45-60s) para evitar fatiga visual por reutilización reiterada de un mismo edificio o documento.
* Salvaguarda contra falsa atribución: no bautiza un hospital genérico con el nombre de una clínica no verificada.

### `ProgrammaticChartRenderer` (`charts.py`)
* Renderizado 100% determinista con Pillow (cero IA generativa).
* Genera:
  * Desglose del incremento porcentual (`stat_breakdown_855`).
  * Comparativa legal LFT (`comparison_lft_revision`).
  * Simulación numérica de nómina en tarjetón (`payroll_sim_tarjeton`).
  * Línea de tiempo de la ruta de retiro Cl. 157 (`retirement_timeline_cct157`).

### `SceneComposer` (`scene_composer.py`)
* Ensambla el fondo editorial con viñeta y ajuste de contraste.
* Superpone logotipos oficiales (IMSS, SNTSS, CFCRL) como capas vectoriales/PNG nítidas en su proporción nativa sin deformaciones.
* Garantiza el cumplimiento estricto de las zonas seguras (`[70, 200, 940, 1450]` en 9:16).
