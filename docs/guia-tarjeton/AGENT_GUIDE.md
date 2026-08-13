# AGENT_GUIDE — Guía de mi Tarjetón

## Regla de oro

Este directorio convierte a texto y datos estructurados el **Manual de orientación al tarjetón de pago del trabajador del IMSS — 2023** para que un agente de código que no pueda leer PDF pueda utilizarlo.

**No es una fuente de reglas vigentes por sí sola.** Es una fuente educativa/documental fechada en 2023.

## Prioridad de fuentes

Cuando implementes lógica en La Veinte Digital usa esta prioridad:

1. Reglas/calculadoras/motores ya validados y vigentes del repositorio.
2. Normativa vigente incorporada al proyecto y explícitamente identificada como actual.
3. Este paquete del Manual 2023 como explicación, nomenclatura, estructura y referencia histórica/documental.

Nunca sobrescribas una regla vigente del proyecto con una fórmula o cantidad del manual solamente porque aparece aquí.

## Antes de implementar la guía

Lee, como mínimo:

- `docs/guia-tarjeton/README.md`
- `docs/guia-tarjeton/01-estructura-tarjeton.md`
- `docs/guia-tarjeton/02-datos-trabajador.md`
- `docs/guia-tarjeton/03-percepciones.md`
- `docs/guia-tarjeton/04-deducciones.md`
- `docs/guia-tarjeton/05-mensajes-observaciones.md`

Para una consulta exhaustiva usa `docs/guia-tarjeton/manual-imss-2023-completo.md` o `src/data/guia-tarjeton/manual-pages.json`.

## Qué contiene el paquete

- Catálogo completo de claves de percepciones mostradas en el manual.
- Catálogo completo de claves de deducciones mostradas en el manual.
- Los 77 campos/elementos numerados por el manual.
- Las 5 secciones del recibo.
- Texto fuente por página.
- Tabla de marcas de ocupación de plaza.
- Matriz de incidencias de conceptos 032/033.
- Marcas de continuidad de vacaciones.
- Fórmulas del manual separadas y marcadas como **NO EJECUTABLES SIN VALIDACIÓN**.
- Semillas de relaciones y microlecciones.

## Cómo usar `concepts.ts`

`concepts.ts` sirve como catálogo y material educativo. Cada concepto tiene:

- `code`
- `name`
- `kind`
- `manual2023.detail`
- `requiresCurrentValidation`

`manual2023.detail` conserva bloques del manual cuando existe explicación específica.

No conviertas automáticamente `manual2023.detail` en copy final para usuarios. Crea tres capas:

1. **Fácil**: lenguaje humano y corto.
2. **Detallado**: comportamiento, incidencias, relaciones y qué revisar.
3. **Fundamento**: citas normativas y fuente.

## Fórmulas

Todas las fórmulas del manual están en:

`src/data/guia-tarjeton/formulas-manual-2023.ts`

Se encuentran deliberadamente separadas de `concepts.ts` para impedir que se conviertan accidentalmente en lógica productiva.

Nunca importes ese archivo desde el motor de nómina.

Solo puede usarse para:

- mostrar una explicación histórica/documental claramente etiquetada;
- comparar contra una regla vigente;
- ayudar a localizar qué regla necesita verificación.

## Cantidades y porcentajes

Hay cantidades fijas y porcentajes fechados en el manual. Ejemplos incluyen ayudas, bonificaciones, fondo de ahorro y porcentajes de ciertos conceptos.

Trátalos como `reference-only` hasta validar con la fuente vigente.

## Errores o rarezas de la fuente

El PDF contiene erratas de redacción y algunas fórmulas con precedencia matemática ambigua. El paquete no intenta "arreglarlas" silenciosamente.

Cuando una fórmula parezca extraña:

1. No la corrijas por intuición.
2. Revisa si La Veinte ya tiene un cálculo vigente.
3. Si no existe, marca la regla como pendiente de validación normativa.
4. Mantén la fuente original disponible para auditoría.

## Integración recomendada en la UI

La guía debe consultar `concepts`, `fields`, `sections` y `relations` como capa de conocimiento. Los valores reales de un usuario deben provenir del parser/tarjetón de La Veinte, nunca de estos archivos.

Ejemplo conceptual:

```ts
const help = getGuideConcept('033')
const payrollValue = parsedPayslip.perceptions.find(p => p.code === '033')
```

La explicación y el valor real son responsabilidades separadas.

## Política de afirmaciones

No afirmar "te pagaron mal" porque un concepto no aparezca. La guía puede decir:

- "Este concepto no aparece en esta quincena."
- "Conviene revisar la incidencia y el periodo en que se generó."
- "La información disponible no permite determinar por sí sola si existe un error."

## Actualización futura

Cuando se obtenga normativa más reciente:

- no borres la fuente 2023;
- agrega una fuente nueva;
- actualiza la capa vigente;
- conserva `manual-imss-2023` para trazabilidad;
- registra `validFrom`, `validTo` o notas de vigencia cuando la arquitectura lo permita.
