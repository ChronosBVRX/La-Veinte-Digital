# Parity Report — apply SQL vs migration

| Objeto canónico | En apply SQL | Adaptación | Razón | Equivalencia |
|----------------|:---:|-----------|-------|:---:|
| worker_preferences (tabla + constraints + RLS + policies + grants) | ✅ | Sin cambios | Idéntico a migración | ✅ |
| payroll_contexts (columnas + CHECK + grants) | ✅ | grant SELECT añadido (necesario en prod) | Local no lo tenía; prod necesita SELECT para RLS | ✅ |
| worker_consents (tabla + RLS + policies + grants) | ✅ | Sin cambios | Idéntico | ✅ |
| worker_data_events (tabla + RLS + policies + grants) | ✅ | Sin cambios | Idéntico | ✅ |
| _insert_worker_event | ✅ | Sin cambios | Idéntico (incluye validación de metadata) | ✅ |
| choose_basic_mode | ✅ | Sin cambios | Idéntico (incluye eventos) | ✅ |
| confirm_manual_worker_profile | ✅ | Sin cambios | Idéntico (validación de payload, consentimiento, evento) | ✅ |
| confirm_payslip_worker_profile | ✅ | Sin cambios | Idéntico (validación, metadata de extracción, evento) | ✅ |
| change_worker_profile_mode | ✅ | Sin cambios | Idéntico | ✅ |
| delete_worker_data | ✅ | Sin cambios | Idéntico (borrado atómico + evento) | ✅ |
| grant_worker_consent | ✅ | Sin cambios | Idéntico (accepted_source fijado por RPC) | ✅ |
| revoke_worker_consent | ✅ | Sin cambios | Idéntico | ✅ |
| get_effective_consent | ✅ | Sin cambios | Idéntico | ✅ |
| backfill_worker_profile | ✅ | Sin cambios | Idéntico (idempotente) | ✅ |
| PRECONDICIONES ASSERT | ✅ | NUEVO (no en migración) | Seguridad pre-aplicación | ✅ |
| VERIFICACIONES POST-APLICACIÓN | ✅ | NUEVO (no en migración) | Verificación posterior | ✅ |
| BEGIN/COMMIT | ✅ | NUEVO (no en migración) | Transacción explícita para SQL remoto | ✅ |
| employment_type deuda | ✅ | Sin cambios | Documentada, sin modificar CHECK | ✅ |

## Resultado
- **10/10 funciones incluidas** ✅
- **0 placeholders, 0 omitted, 0 TODO** ✅  
- **938 líneas, autónomo** ✅
- **Aplicado contra BD local limpia: exitoso** ✅
- **verify SQL: todos los ASSERT pasan** ✅
- **worker_profile_pr2.sql: pasa** ✅
- **profile_security.sql: pasa** ✅

## Audit del GRANT SELECT en payroll_contexts

### Estado en producción (pre-migración)
- `authenticated`: REFERENCES, TRIGGER, TRUNCATE (SIN SELECT directo de tabla).
- Las policies RLS existen (SELECT/INSERT/UPDATE/DELETE con `user_id = auth.uid()`) pero sin grant de tabla no se pueden ejecutar.
- `build-calculator-prefill.ts` lee `payroll_contexts` como authenticated — el grant SELECT debe existir en producción vía deriva remota.

### Adaptación para el apply SQL
- Se añade `GRANT SELECT ON public.payroll_contexts TO authenticated`.
- La RLS SELECT (`user_id = auth.uid()`) ya existe desde la migración 003. El grant habilita el acceso, la policy restringe por fila.
- `authenticated` solo puede leer su propia fila (RLS).
- `anon` no recibe SELECT (sin cambios).
- NO se conceden grants de INSERT/UPDATE/DELETE de tabla para authenticated.
- NO se conceden grants de escritura sobre las columnas nuevas.
- `WorkerProfileService.getCurrentProfile()` necesita este SELECT para leer `payroll_contexts` en `getCurrentProfile()`.

### Verificación (local)
- apply SQL ejecutado → `SELECT` de tabla + RLS por usuario funcional.
- `worker_profile_pr2.sql` pasa (Test 2 verifica SELECT como authenticated).
- `profile_security.sql` pasa 15/15.
- Stack local y remoto coinciden en grants resultantes.

## Resultado de prueba autónoma local

```bash
# 1. Reset limpio (aplica migración canónica)
supabase db reset

# 2. Simular esquema pre-PR2: eliminar objetos worker
psql -U postgres -d postgres -c "
  DROP FUNCTION IF EXISTS public.backfill_worker_profile() CASCADE;
  DROP TABLE IF EXISTS public.worker_data_events CASCADE;
  DROP TABLE IF EXISTS public.worker_consents CASCADE;
  DROP TABLE IF EXISTS public.worker_preferences CASCADE;
  ALTER TABLE public.payroll_contexts DROP COLUMN IF EXISTS matricula CASCADE;
  REVOKE SELECT ON public.payroll_contexts FROM authenticated;
"

# 3. Aplicar SQL remoto autónomo
psql -v ON_ERROR_STOP=1 < apply-worker-profile-persistence.sql
# → NOTICE: Worker profile persistence applied and verified.

# 4. Verificar
psql -v ON_ERROR_STOP=1 < verify-worker-profile-persistence.sql
# → OK (todos los ASSERT pasan)

# 5. Pruebas SQL funcionales
docker exec -i supabase_db psql -v ON_ERROR_STOP=1 < worker_profile_pr2.sql
# → OK (idempotente, 2 corridas)
docker exec -i supabase_db psql -v ON_ERROR_STOP=1 < profile_security.sql
# → OK (15/15)
```

