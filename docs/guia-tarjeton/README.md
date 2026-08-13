# Paquete de conocimiento — Guía de mi Tarjetón

Este paquete es un **índice provisional** para que un agente de código pueda identificar los campos, códigos y temas del tarjetón del IMSS. **No es autoridad normativa**: ninguna cantidad, porcentaje o fundamento citado aquí se presenta como vigente sin respaldo en fuentes oficiales (CCT IMSS-SNTSS vigente, normas y procedimientos del IMSS, legislación aplicable) o en los motores validados del repositorio.

## Contenido

### Documentación legible por agentes

- `AGENT_GUIDE.md` — reglas de uso y jerarquía de fuentes oficiales.
- `manual-imss-2023-completo.md` — transcripción de un documento de referencia NO oficial (solo histórico del índice).
- `01-estructura-tarjeton.md` — presentación, objetivo y estructura.
- `02-datos-trabajador.md` — receptor y campos laborales.
- `03-percepciones.md` — catálogo y explicaciones de percepciones.
- `04-deducciones.md` — catálogo y explicaciones de deducciones.
- `05-mensajes-observaciones.md` — Mensajes y Observaciones.
- `06-consulta-conservacion.md` — consulta, biométricos y conservación.
- `07-creditos-y-fuente.md` — autoría y fuentes declaradas.

### Datos estructurados

- `concepts.ts` — índices provisionales de conceptos de percepción y deducción.
- `fields.ts` — 77 campos/elementos numerados (índice provisional).
- `sections.ts` — 5 secciones principales.
- `tables.ts` — marcas de ocupación, incidencias 032/033 y continuidad vacacional (índice provisional).
- `relations.ts` — relaciones educativas provisionales (estado `pending_verification`).
- `lessons.ts` — semillas de rutas educativas.
- `sources.ts` — registro de fuentes oficiales IMSS/CCT y su estado de verificación.
- Capa editorial curada: `guide-content.ts`, `guide-fields-content.ts`, `guide-lessons.ts`, `guide-tips.ts`, `guide-review-rules.ts`, `guide-calculator-links.ts`.

## Importante

El contenido de la guía en producción (UI, fichas, microlecciones) solo cita fuentes oficiales del IMSS y del CCT vigente, y marca explícitamente el estado de verificación de cada información (`verified`, `partially_verified`, `pending_verification`). Para reglas productivas, La Veinte Digital usa sus motores actuales (nómina, calculadores, vacaciones).

## Instrucción corta para tu agente

```text
Antes de continuar con "Guía de mi Tarjetón", lee íntegramente:

docs/guia-tarjeton/AGENT_GUIDE.md
docs/guia-tarjeton/README.md

utiliza docs/guia-tarjeton/ y src/data/guia-tarjeton/ como índice provisional para descubrir campos, códigos y temas, y valida contra fuentes oficiales (CCT IMSS-SNTSS vigente, normas y procedimientos del IMSS en imss.gob.mx) antes de afirmar cualquier regla.

Regla estricta: no atribuyas información a documentos que no hayas verificado; usa el estado pending_verification cuando la referencia oficial no esté confirmada.

Continúa con el mantenimiento de la Guía de mi Tarjetón indicada en mi instrucción anterior.
```