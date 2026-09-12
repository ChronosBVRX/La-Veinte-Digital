# Protocolo de Investigación de Referencias Visuales — La Veinte Radio

**Versión:** 1.0.0 (2026-09-11)  
**Propósito:** Definir la metodología de investigación documental para asegurar que todo asset represente fielmente la realidad antes de ser producido.

---

## 1. Jerarquía de Fuentes Oficiales

### NIVEL 1 — Fuentes Oficiales Primarias (Máxima Prioridad)
* **Portales del Gobierno de México y Dependencias:**
  * `imss.gob.mx` / `reposipot.imss.gob.mx`: Identidad visual, colores institucionales, procedimientos y CCT oficial.
  * `sntss.org.mx` / `media.sntss.org.mx`: Documentación sindical, estatutos, resoluciones de congresos.
  * `diputados.gob.mx` / `senado.gob.mx`: Textos oficiales vigentes de leyes federales (LFT, LSS, CPEUM).
  * `dof.gob.mx`: Diario Oficial de la Federación (publicaciones, reformas y normas NOM).
  * `centrolaboral.gob.mx`: Centro Federal de Conciliación y Registro Laboral (guías de consulta y convenios).

### NIVEL 2 — Fuentes Institucionales Verificadas
* Biblioteca Normativa local (`resources/normativa/bootstrap-sources.yaml`).
* Acervos documentales históricos y reglamentos internos institucionales.

### NIVEL 3 — Repositorios con Licencia Pública Clara
* **Wikimedia Commons:** Vectores oficiales de dominio público o Creative Commons (CC-BY-SA) de logotipos y símbolos públicos mexicanos.
* **OpenStreetMap:** Contexto geográfico y planimetría de unidades hospitalarias.

### NIVEL 4 — Referencias Secundarias (Exclusivo para Extracción de Hechos)
* Cobertura de prensa y fotografías públicas de inmuebles.
* **Regla estricta:** Una fotografía de internet sirve **únicamente como referencia conceptual** para extraer características físicas (volumetría, número de pisos, color de marquesina). **Nunca se empaqueta directamente la fotografía de terceros sin licencia explícita.**

---

## 2. Hechos Visuales Extraídos por Tipo de Entidad

| Tipo de Entidad | Hechos a Investigar y Registrar | Ejemplo Verificado |
| :--- | :--- | :--- |
| **Organizaciones** | Logotipo vectorial oficial, colores primarios/secundarios, siglas exactas. | IMSS: `#0B4F37` (Verde), `#BC955C` (Dorado), imagotipo oficial águila/madre. |
| **Documentos** | Edición oficial, bienio de vigencia, tipografía de portada, títulos institucionales. | CCT: Bienio 2025–2027, franjas verde y dorada, portada formal. |
| **Leyes** | Número de artículo exacto, redacción jurídica vigente, encabezado de la Cámara. | LFT: Artículos 399 Bis (anual) y 400 Bis (integral con consulta). |
| **Edificios Hospitalarios** | Fachada, volumetría, niveles, marquesina de acceso, letreros de urgencias. | HGR 1 Charo: Edificio blanco contemporáneo de 4 niveles, letrero verde IMSS. |
| **Eventos / Sindicato** | Entorno de asamblea, auditorio, estrado con banderas, pantalla de proyecciones. | Congreso SNTSS: Pantalla con desglose porcentual (8.55% = 2.9% + 3.9% + 1.75%). |
| **Nómina / Tarjetón** | Estructura en 5 áreas, claves numéricas de 3 dígitos (002, 011, 001, 002). | Tarjetón SIAP: Sueldo base 002, Renta 011, ISR 001, Cuota sindical 002. |

---

## 3. Caché e Invalidación de Referencias

* **Edificios e Inmuebles:** Caché de larga duración (TTL > 24 meses).
* **Leyes Federales:** Monitoreadas mediante la fecha de última reforma en Cámara de Diputados.
* **Contratos Colectivos:** Asociados al bienio contractual (ej. CCT 2025–2027 vence el 15 de octubre de 2027).
* **Directorio de Procedencia:** Toda referencia se almacena persistentemente en `assets/editorial/reference-registry.json`.
