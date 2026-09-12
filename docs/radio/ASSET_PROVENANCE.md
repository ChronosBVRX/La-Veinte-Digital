# Trazabilidad de Assets y Procedencia — La Veinte Radio

**Versión:** 1.0.0 (2026-09-11)  
**Propósito:** Definir el estándar de procedencia, licenciamiento y salvaguardas de atribución para todos los activos visuales del sistema.

---

## 1. Clasificación Tripartita Obligatoria de Assets

Todo asset registrado en `assets/editorial/asset-registry.json` debe pertenecer a una de las siguientes tres categorías:

### 1. `official` (Recurso Oficial Permitido)
* **Definición:** Logotipo, símbolo o identificador oficial obtenido de fuentes públicas de acceso abierto del Estado mexicano o kits institucionales.
* **Uso:** Estrictamente informativo, educativo y contextual.
* **Integración:** Vectorial SVG o PNG transparente de alta resolución.
* **Regla de oro:** **NUNCA modificado, deformado o redibujado por IA.** Se superpone limpio en su relación de aspecto original.

### 2. `reference_based` (Ilustración Basada en Referencia Real)
* **Definición:** Ilustración editorial o render original creado después de investigar y documentar hechos físicos y arquitectónicos verificados de una entidad real.
* **Trazabilidad:** Cada asset de este tipo **debe apuntar obligatoriamente a uno o más `reference_ids` válidos** en `reference-registry.json`.
* **Ejemplo:** La portada del CCT 2025–2027 o la fachada del Hospital General Regional No. 1 Charo.

### 3. `generic` (Entorno Contextual Sin Atribución Concreta)
* **Definición:** Escena médica, hospitalaria o administrativa que ambienta la temática sin vincularse a una unidad hospitalaria específica.
* **Salvaguarda anti-falsa atribución:** Si el guion menciona una clínica no verificada (ej. "UMF 999"), el sistema puede usar un asset genérico pero **jamás debe etiquetarlo falsamente como si fuera esa unidad concreta**.

---

## 2. Esquema de Metadatos de Procedencia

### Esquema en `reference-registry.json`
```json
{
  "id": "imss_official_identity",
  "entity": "IMSS",
  "type": "organization",
  "research_date": "2026-09-11",
  "sources": [
    {
      "url": "https://www.imss.gob.mx/",
      "title": "Portal Oficial del IMSS",
      "source_type": "official",
      "license": "official"
    },
    {
      "url": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Logotipo_del_IMSS.svg",
      "title": "Logotipo vectorial oficial",
      "source_type": "wikimedia",
      "license": "public-domain"
    }
  ],
  "verified_characteristics": {
    "primary_color": "#0B4F37",
    "secondary_color": "#BC955C",
    "emblem": "Águila protectora materna y siglas IMSS"
  },
  "status": "verified"
}
```

### Esquema en `asset-registry.json`
```json
{
  "id": "cct_2025_2027_cover_asset",
  "file": "documents/cct_2025_2027_cover.webp",
  "type": "reference_based",
  "entity": "Contrato Colectivo de Trabajo",
  "category": "documents",
  "tags": ["CCT", "2025-2027", "IMSS", "SNTSS"],
  "orientation": ["16:9"],
  "based_on_verified_references": true,
  "reference_ids": ["cct_imss_sntss_2025_2027"],
  "style_version": "lv-editorial-v1"
}
```

---

## 3. Salvaguardas y Cumplimiento Legal

1. **Sin Afiliación:** La Veinte Radio es un espacio informativo independiente de análisis para los trabajadores. La exhibición de logotipos oficiales es contextual y no implica que el programa sea un canal oficial o patrocinado por el IMSS, el SNTSS o dependencias gubernamentales.
2. **Prohibición de Licencias Desconocidas:** Ningún archivo proveniente de fuentes de terceros con licencia `unknown` puede ser empaquetado directamente en el repositorio. Debe usarse únicamente para abstraer hechos visuales y generar una ilustración original.
3. **Integridad Tipográfica:** Todo texto legal o número de nómina crítico es dibujado mediante motores de tipografía digital exactos, garantizando nitidez absoluta y ausencia de caracteres deformados.
