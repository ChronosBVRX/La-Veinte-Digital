# PR2 — Plan de rollback

> El rollback de una migración aditiva NO es un simple `DROP` cuando ya hay
> datos en producción. Este documento separa los escenarios.

## 1. Principio general

La migración PR2 es **aditiva**: no modifica columnas existentes de `profiles`,
no renombra `payroll_contexts`, no elimina nada preexistente. Por tanto, el
rollback depende de **cuánto se haya usado** el esquema nuevo.

## 2. Escenario A — Rollback antes de uso (sin datos nuevos)

Condición: la migración se revirtió antes de que el servicio central escribiera
datos en `matricula/adscripcion/shift/source_*`, `worker_preferences`,
`worker_consents` o `worker_data_events`.

**Acción:**
- `DROP TABLE worker_data_events, worker_consents, worker_preferences;` (+ `backfill_conflicts` si se conservó)
- `ALTER TABLE payroll_contexts DROP COLUMN matricula, adscripcion, shift, source_*;`
- `DROP FUNCTION backfill_worker_profile(), grant_worker_consent(), revoke_worker_consent(), get_effective_consent(), _insert_worker_event(), choose_basic_mode(), confirm_manual_worker_profile(), confirm_payslip_worker_profile(), change_worker_profile_mode(), delete_worker_data();`

**Pérdida:** ninguna (sin datos nuevos). **Solo es aplicable si se verifica previamente que no hay datos** en esas columnas/tablas (consulta de recuento); en caso contrario, no ejecutar el DROP.

## 3. Escenario B — Rollback después de uso (con datos nuevos)

Condición: el servicio ya escribió datos en el esquema nuevo (usuarios capturaron,
importaron, aceptaron consentimiento o generaron eventos).

**Acción NO suficiente:** `DROP` de columnas/tablas — perdería datos reales del
usuario y rompería el servicio en ejecución.

**Estrategia correcta:**
1. **Desactivar la feature (soft-disable)** antes que borrar:
   - El servicio central deja de escribir; los lectores vuelven al fallback legacy
     (`profiles.matricula/adscripcion/categoria/antiguedad`).
   - Las RPC de consentimiento/eventos devuelven error controlado o se revocan.
2. **Conservar datos** en las tablas nuevas (no borrarlas).
3. **Restaurar lectores legacy:**
   - `build-calculator-prefill` vuelve a leer `profiles` para los 4 campos.
   - `EscritosGenerator`, `TodayCard`, dashboard y nómina usan `profiles` de nuevo.
4. **Mantener columnas/tablas** como dormidas durante el periodo de observación.
5. Solo tras confirmar estabilidad, decidir:
   - Volver a activar (re-aplicar PR2), o
   - Limpieza ordenada **solo con respaldo y plan de exportación previos**: archivar eventos/consents y datos laborales nuevos, luego `DROP`.

**Pérdida:** controlada; los datos laborales nuevos permanecen archivados, no destruidos.

> **Regla:** nunca se borran columnas o tablas con datos sin respaldo y plan de exportación.

## 4. Escenario C — Desactivación de feature (sin tocar datos)

Usado cuando el problema es funcional, no de datos.

- Flag de feature (`app_settings` o variable de entorno server) apaga el centro
  "Mi información laboral".
- Lectores usan fallback legacy.
- Tablas/columnas permanecen intactas.
- Sin pérdida. Reversible activando el flag.

## 5. Conservación de datos

- `worker_data_events`: append-only; no se borra salvo limpieza explícita.
- `worker_consents`: evidencia legal; no se borra salvo eliminación de cuenta
  (cascade) o requerimiento legal justificado.
- `backfill_conflicts`: log de auditoría; se conserva.

## 6. Restauración de lectores legacy (independiente del esquema)

La estrategia de los PR (7 = migrar lectores, 8 = eliminar escrituras paralelas,
9 = retirar legacy) permite que en cualquier punto intermedio los lectores
sigan funcionando contra `profiles`:

- PR2 (solo esquema aditivo): lectores legacy intactos, cero impacto.
- PR3+ (servicio): lectores legacy todavía funcionan (fallback).
- PR7 (migrar lectores): tras migrar, los lectores usan el perfil laboral; el
  rollback de PR7 revierte a `profiles` sin pérdida.

## 7. Orden de rollback si se requiere tras PR7

1. Revertir PR7 (lectores → legacy).
2. Soft-disable del servicio (PR3).
3. Conservar datos nuevos.
4. Decidir sobre tablas (mantener dormidas o limpiar con export).

## 8. Garantía

- Cualquier PR de la secuencia (2-9) es revertible de forma independiente.
- La migración aditiva nunca destruye datos existentes ni rompe el login.
- `db reset --linked` y `migration repair` quedan **prohibidos**; cualquier
  reversión real de PR2 en remoto pasa por SQL controlado con backup previo.
