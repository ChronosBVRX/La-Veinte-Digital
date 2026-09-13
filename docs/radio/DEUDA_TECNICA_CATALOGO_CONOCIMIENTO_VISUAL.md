# 📋 Registro de Deuda Técnica: Catálogo Declarativo de Conocimiento Visual

**Estado:** REGISTRADO (NO IMPLEMENTAR HASTA AUTORIZACIÓN POSTERIOR)  
**Módulo Afectado:** `backend/app/visual/editorial/visual_editorial_planner.py`  
**Fecha de Registro:** 2026-09-12  
**Prioridad:** Media (Deuda de desacoplamiento arquitectónico post-estabilización V3)

---

## 1. Contexto y Diagnóstico Actual

En la versión **Documental V3 (Anti-Karaoke)** se completó la des-sobreajustación del motor:
- Se eliminaron las reglas basadas en frases narrativas particulares del episodio (ej. `"diez mil pesos"`, `"respuesta corta es no"`, `"descalificar el acuerdo"`).
- Se eliminó la asociación arbitraria `"descalificar el acuerdo" -> HGR1 Charo`.
- Se introdujeron extractores semánticos generales en `EntityDetector` (artículos, cláusulas, conceptos, montos en moneda, porcentajes).
- Se validó la generalización en 3 fixtures independientes (`d5f1fc16`, `vacaciones_imss`, `accidente_trabajo`).

Sin embargo, en el código de producción de `visual_editorial_planner.py` (`_determine_turn_visual` y `_extract_editorial_text`), aún existen **condicionales imperativos específicos de dominio laboral IMSS/SNTSS**:
1. Cifra ponderada global (`8.55%` -> `stat_breakdown_855`).
2. Artículos específicos de leyes federales (`399 Bis`, `400 Bis` LFT -> `lft_document_399bis`, `lft_document_400bis`, `comparison_lft_revision`).
3. Cláusulas contractuales (`Cláusula 157 CCT` -> `cct_clause_157`, `retirement_timeline_cct157`).
4. Conceptos de nómina (`Concepto 02`, `Concepto 11` -> `tarjeton_detail_c02`, `tarjeton_detail_c11`).
5. Vínculos a activos de portada específicos (`cct_2025_2027_cover_asset`, `sntss_congress_hall_asset`, `hgr1_charo_exterior_asset`).

Aunque estos condicionales ya no dependen de frases arbitrarias y están respaldados por `EntityDetector`, el hecho de que estén codificados en `if/elif` dentro de `visual_editorial_planner.py` mezcla **la lógica de orquestación editorial visual** con **el conocimiento de dominio normativo**.

---

## 2. Solución Arquitectónica Futura

La meta arquitectónica es convertir a `VisualEditorialPlanner` en un **motor genérico y agnóstico al dominio**, trasladando todas las reglas de asignación a un **Catálogo Declarativo de Conocimiento Visual** (ej. `assets/editorial/visual-knowledge-catalog.json` o YAML).

### Esquema Propuesto del Catálogo Declarativo:

```json
{
  "version": "1.0.0",
  "rules": [
    {
      "id": "cct_clause_157_retirement",
      "match": {
        "entity_category": "clause",
        "attributes": { "clause": "157" },
        "context_keywords": ["retiro", "aportaci", "previsi", "fondo"]
      },
      "visual_function": "EVIDENCIA",
      "scene_type": "document_cover",
      "component": {
        "type": "chart",
        "id": "cct_clause_157"
      },
      "max_appearances_per_episode": 2,
      "editorial_text": {
        "headline": "Contrato Colectivo de Trabajo",
        "subheadline": "Cláusula 157 · Aportaciones de Retiro",
        "display_text": "Cláusula 157 CCT"
      },
      "overlay_logos": ["logo_imss_official", "logo_sntss_official"]
    },
    {
      "id": "lft_art_399bis_annual_revision",
      "match": {
        "entity_category": "law",
        "attributes": { "article": "399 Bis" }
      },
      "visual_function": "EVIDENCIA",
      "scene_type": "document_cover",
      "component": {
        "type": "chart",
        "id": "lft_document_399bis"
      },
      "max_appearances_per_episode": 2,
      "editorial_text": {
        "headline": "Ley Federal del Trabajo",
        "subheadline": "Art. 399 Bis · Revisión Salarial Anual",
        "display_text": "Art. 399 Bis LFT"
      },
      "overlay_logos": ["logo_imss_official"]
    },
    {
      "id": "payroll_sim_generic",
      "match": {
        "intent": "simulation",
        "has_currency_or_payroll": true
      },
      "visual_function": "EXPLICACION",
      "scene_type": "payroll_visual",
      "component": {
        "type": "chart",
        "id": "payroll_sim_tarjeton"
      },
      "max_appearances_per_episode": 2,
      "editorial_text": {
        "headline_template": "Simulación Salarial IMSS",
        "subheadline_template": "Base de Referencia: {detected_amount}",
        "display_text_template": "{detected_amount}"
      },
      "overlay_logos": []
    }
  ]
}
```

---

## 3. Rol del `VisualEditorialPlanner` Refactorizado

Con esta migración futura:
1. `VisualEditorialPlanner` solo se encargará de:
   - Dividir turnos en beats según duración y ritmo de voz.
   - Invocar a `EntityDetector`.
   - Evaluar las reglas del catálogo declarativo contra las entidades e intenciones detectadas.
   - Gestionar `EditorialMemory` (penalizaciones por repetición, balances entre familias visuales, control de rachas).
   - Aplicar el puente temporal continuo para evitar pausas en negro.
2. Añadir nuevas leyes, cláusulas o conceptos sindicales **no requerirá modificar código Python**, únicamente añadir entradas al catálogo declarativo.

---

## 4. Salvaguardas Obligatorias para la Migración Futura

Cuando se autorice la ejecución de esta refactorización:
1. **Regla de Cero Regresiones:** El episodio canónico `d5f1fc16` y los 3 fixtures de generalización (`test_visual_generalization.py`) deberán producir exactamente los mismos visual beats y el mismo visual mix (100.0%).
2. **Gates en Verde:** Los 61 tests unitarios de `backend/tests/unit` deberán pasar al 100%.
3. **Ninguna Modificación Actual:** Este documento es exclusivamente declarativo y de registro técnico. No debe implementarse en la sesión actual.
