# AGENT_GUIDE — Guía de mi Tarjetón

## Regla de oro

Este directorio es un **índice provisional** (campos, códigos y temas del tarjetón) para que un agente de código pueda explorar el dominio sin abrir el PDF original.

**No es autoridad normativa.** No se cita ni como fuente, bibliografía ni fundamento el "Manual de orientación al tarjetón de pago del trabajador del IMSS — 2023" (documento NO oficial del IMSS). Las únicas fuentes citables son oficiales: CCT IMSS-SNTSS vigente (2025-2027) y su RIT, normas y procedimientos del IMSS (imss.gob.mx), tabuladores oficiales y legislación aplicable.

## Prioridad de fuentes

Cuando implementes lógica en La Veinte Digital usa esta prioridad:

1. Reglas/calculadoras/motores ya validados y vigentes del repositorio.
2. Fuentes oficiales verificadas: CCT IMSS-SNTSS vigente, normas/procedimientos del IMSS, tabulador oficial (registrados en `src/data/guia-tarjeton/sources.ts`).
3. Este paquete como índice provisional de descubrimiento únicamente.

Nunca sobrescribas una regla vigente del proyecto con una fórmula o cantidad de una fuente no oficial. Nunca afirmes una cláusula, artículo o numeral que no hayas confirmado en un documento oficial: usa `pending_verification`.

## Antes de implementar la guía

Lee, como mínimo:

- `docs/guia-tarjeton/README.md`
- `docs/guia-tarjeton/01-estructura-tarjeton.md`
- `docs/guia-tarjeton/02-datos-trabajador.md`
- `docs/guia-tarjeton/03-percepciones.md`
- `docs/guia-tarjeton/04-deducciones.md`
- `docs/guia-tarjeton/05-mensajes-observaciones.md`

Para descubrir campos y códigos usa `src/data/guia-tarjeton/concepts.ts` y `fields.ts`.

## Qué contiene el paquete

- Índice provisional de claves de percepciones y deducciones.
- Los 77 campos/elementos numerados.
- Las 5 secciones del recibo.
- Tabla de marcas de ocupación de plaza.
- Matriz de incidencias de conceptos 032/033.
- Marcas de continuidad de vacaciones.
- Registro de fuentes oficiales (`sources.ts`) con estados de verificación.
- Semillas de relaciones y microlecciones.

## Cómo usar `concepts.ts`

`concepts.ts` sirve como catálogo y material educativo. Cada concepto tiene:

- `code`
- `name`
- `kind`
- `catalog.detail`
- `requiresCurrentValidation`

`catalog.detail` conserva bloques de la fuente provisional cuando existe explicación específica.

No conviertas automáticamente `catalog.detail` en copy final para usuarios. Crea tres capas:

1. **Fácil**: lenguaje humano y corto.
2. **Detallado**: comportamiento, incidencias, relaciones y qué revisar.
3. **Fundamento**: fuentes oficiales verificadas y estado de verificación (usar `sources.ts` + `verification`).

## Cantidades y porcentajes

Cualquier cantidad fija o porcentaje de fuentes provisionales es `reference-only` hasta validarse contra la fuente oficial vigente, y nunca se presenta en la UI como regla vigente. El contenido curado en `features/tarjeton-guia/data/*` es descriptivo-educativo; los cálculos reales viven en los motores del repositorio.

## Errores o rarezas de la fuente

El índice provisional puede contener erratas. Reglas:

1. No las "corrijas" por intuición.
2. Revisa si La Veinte ya tiene un cálculo vigente.
3. Si no existe, marca la regla como `pending_verification`.
4. No inventes citas normativas para respaldar un valor.

## Integración recomendada en la UI

La guía consulta `concepts`, `fields`, `sections` y `relations` como capa de conocimiento. Los valores reales de un usuario provienen del parser/tarjetón de La Veinte, nunca de estos archivos.

La explicación y el valor real son responsabilidades separadas.

## Política de afirmaciones

No afirmar "te pagaron mal" porque un concepto no aparezca. La guía puede decir:

- "Este concepto no aparece en esta quincena."
- "Conviene revisar la incidencia y el periodo en que se generó."
- "La información disponible no permite determinar por sí sola si existe un error."

## Política documental (obligatoria)

- Solo se citan fuentes institucionales del IMSS (imss.gob.mx / rh.imss.gob.mx / reposipot.imss.gob.mx), el CCT IMSS-SNTSS vigente y legislación externa (DOF/SAT/SCJN) cuando es necesaria.
- Cada entrada curada lleva `verification`: `verified` (asociación a documento oficial confirmada), `partially_verified` (documento identificado, referencia específica pendiente) o `pending_verification`.
- Si no hay fuente oficial suficiente, se deja `pending_verification`. No se inventan cláusulas, artículos ni numerales.

## Actualización futura

Cuando se obtenga normativa oficial más reciente:

- actualiza el registro en `sources.ts` (URL, vigencia, `verifiedAt`);
- actualiza `verification` de las entradas afectadas;
- registra notas de vigencia cuando la arquitectura lo permita;
- conserva el índice provisional para trazabilidad histórica.