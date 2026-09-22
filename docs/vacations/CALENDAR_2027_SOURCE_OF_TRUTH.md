# Calendario de Roles Vacacionales 2027

## Decisión

Para el año 2027, la fuente de verdad del sistema es:

> Tabla de Roles Vacacionales para Otorgamiento Año 2027, Dirección de
> Administración / Unidad de Personal IMSS y Secretaría de Trabajo del Comité
> Ejecutivo Nacional del SNTSS.

La captura canónica vive en:

`src/features/vacations/data/calendar-2027.ts`

## Reglas de implementación

- Las fechas se capturaron literalmente de la tabla oficial.
- La fecha de término depende del rol y de la cantidad de días a disfrutar.
- No se calculan los términos mediante fines de semana, festivos ni días hábiles.
- La observación `A`/`B` se conserva literalmente y no equivale por sí misma
  a una marca de continuidad, inclusión o pago.
- Los roles con observación `B` sólo contienen valores oficiales para 7–10 días.
  El sistema debe bloquear cualquier otra duración; nunca debe inventarla.
- Los roles 23 y 24 cruzan correctamente a enero de 2028.
- Los datos almacenados previamente en Supabase para 2027 no sustituyen esta
  fuente. Los calendarios de otros años conservan el flujo administrativo actual.

## Advertencia para futuros cambios

**NO regenerar o sustituir el calendario 2027 mediante cálculos automáticos.**
Las fechas fueron capturadas de la tabla oficial proporcionada para 2027.

Antes de modificar esta fuente, debe existir un documento oficial posterior,
trazabilidad de la sustitución y pruebas de regresión equivalentes.
