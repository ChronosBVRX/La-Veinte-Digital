# Paquete de conocimiento — Guía de mi Tarjetón

Este paquete fue preparado para que un agente de código pueda trabajar con el contenido del **Manual de orientación al tarjetón de pago del trabajador del IMSS — 2023** sin necesidad de abrir el PDF original.

## Contenido

### Documentación legible por agentes

- `AGENT_GUIDE.md` — reglas de uso y prioridad de fuentes.
- `manual-imss-2023-completo.md` — transcripción completa, organizada por página.
- `01-estructura-tarjeton.md` — presentación, objetivo y estructura.
- `02-datos-trabajador.md` — receptor y campos laborales.
- `03-percepciones.md` — catálogo y explicaciones de percepciones.
- `04-deducciones.md` — catálogo y explicaciones de deducciones.
- `05-mensajes-observaciones.md` — Mensajes y Observaciones.
- `06-consulta-conservacion.md` — consulta, biométricos y conservación.
- `07-creditos-y-fuente.md` — autoría y fuentes declaradas.

### Datos estructurados

- `concepts.ts` / `concepts.json` — 60 percepciones/entradas de percepción y 66 deducciones del catálogo del manual.
- `fields.ts` / `fields.json` — 77 campos/elementos numerados.
- `sections.ts` — 5 secciones principales.
- `tables.ts` — marcas de ocupación, incidencias 032/033 y continuidad vacacional.
- `relations.ts` — relaciones educativas respaldadas por el manual.
- `lessons.ts` — semillas de rutas educativas.
- `sources.ts` — procedencia y estado de fuentes.
- `formulas-manual-2023.ts` — fórmulas aisladas y marcadas para validación.
- `manual-pages.json` — texto fuente por cada una de las 41 páginas.

## Importante

Este paquete **no actualiza** el manual a 2026 ni sustituye normativa vigente. Conserva lo que la fuente 2023 sostiene. Para reglas productivas, La Veinte Digital debe preferir su normativa y motores actuales.

## Instrucción corta para tu agente

```text
Antes de continuar con “Guía de mi Tarjetón”, lee íntegramente:

docs/guia-tarjeton/AGENT_GUIDE.md
docs/guia-tarjeton/README.md

Después utiliza docs/guia-tarjeton/ y src/data/guia-tarjeton/ como la versión legible y estructurada del Manual de orientación al tarjetón de pago del trabajador del IMSS — 2023.

No necesitas leer el PDF original.

El Manual 2023 es una fuente educativa y de referencia. Para cálculos, porcentajes, cantidades y reglas vigentes, revisa primero las reglas, simuladores, tablas y normativa más reciente que ya existan en el repositorio.

Continúa con la implementación completa de la Guía de mi Tarjetón indicada en mi instrucción anterior. No entregues solo un análisis: implementa, integra, prueba y corrige.
```
