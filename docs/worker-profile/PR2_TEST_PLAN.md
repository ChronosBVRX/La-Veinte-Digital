# PR2 — Plan de pruebas SQL

> Casos planeados para `supabase/tests/` (pgTAP o DO-blocks con RAISE), que
> se implementarán en PR2. Este documento define los casos, no el SQL.

## 1. Onboarding

1. **unconfigured → basic:** crear `worker_preferences` con `onboarding_state='unconfigured'`; al elegir modo básico, `onboarding_state='basic'`, `preferred_worker_mode=NULL`, y **no** se crea `payroll_contexts`.
2. **basic → configured:** transición válida; al configurar, `onboarding_state='configured'`, `preferred_worker_mode` se fija.
3. **Transición inválida:** `configured → unconfigured` rechazada (check + validación de dominio).
4. **Modo básico no crea datos laborales:** tras `basic`, `payroll_contexts` no existe para el usuario.

## 2. Modo de perfil

5. **manual → payslip:** `preferred_worker_mode` cambia y se emite `mode_changed`.
6. **payslip → manual:** válido; tarjetones se conservan (no se borran al pasar a manual).
7. **Modo no básico dentro del perfil:** `payroll_contexts` no tiene columna `mode` (la preferencia vive en `worker_preferences`).

## 3. Aislamiento por usuario

8. **No escribir otro perfil:** usuario A no puede INSERT/UPDATE `payroll_contexts` o `worker_preferences` de B (RLS `user_id = auth.uid()`).
9. **No leer otro perfil:** SELECT de A no ve filas de B.
10. **No fabricar eventos:** `authenticated` no puede INSERT directo en `worker_data_events` (sin grant/policy). Solo vía RPC.
11. **No aceptar consentimiento por otro user:** `upsert_consent` usa `auth.uid()`; intentar otra cuenta no persiste.
12. **No escribir otro `worker_preferences`:** RLS impide.

## 4. Consentimiento

13. **Reaceptación de misma versión:** tras revocar, aceptar de nuevo limpia `revoked_at` y actualiza `accepted_at` (misma fila o nueva según decisión).
14. **Reaceptación de nueva versión:** nueva fila `(user_id, purpose, version)`.
15. **Revocación:** `revoked_at` seteado; `get_effective_consent` deja de devolverlo.
16. **Consentimiento vigente:** devuelve la fila activa más reciente por purpose.
17. **Sin consentimiento:** `get_effective_consent` devuelve NULL; el prefill NO usa contexto del tarjetón.

## 5. Backfill

18. **Idempotencia:** ejecutar backfill dos veces produce el mismo estado (sin duplicar, sin sobrescribir).
19. **Usuario con payroll_contexts existente:** no se pisan valores poblados.
20. **Usuario sin payroll_contexts:** se crea fila con `source_*='manual'`.
21. **Usuario con tarjetón:** `category_name` existente se respeta.
22. **Antigüedad textual no convertible:** `effective_seniority_date` queda NULL; se documenta.
23. **Filas parciales:** solo se rellenan vacíos.
24. **Conflictos:** se registran en `backfill_conflicts`, no se sobrescriben.

## 6. Borrado laboral

25. **Conserva cuenta y onboarding basic:** `erase_user_payroll_data` + transición a `onboarding_state='basic'`; `auth.users` y `profiles.id` siguen existiendo.
26. **Elimina payroll_contexts y tarjetones:** tras borrado, no hay fila laboral ni imported_payslips.
27. **Conserva eventos mínimos:** `data_deleted` (critical) queda; eventos de importación previos se eliminan o conservan según política.
28. **Conserva evidencia de consentimiento:** `worker_consents` no se borra al borrar datos laborales (revoked_at se fija).

## 7. Eliminación de cuenta

29. **Cascade total:** al eliminar `auth.users` (o `profiles`), se borran `worker_preferences`, `worker_consents`, `worker_data_events`, `payroll_contexts`, `imported_payslips`.

## 8. Eventos

30. **Metadata sensible rechazada:** `insert_worker_event` rechaza metadata con `oldValue/newValue/salary/matricula/adscripcion/categoria` y claves fuera de allowlist.
31. **Metadata técnica aceptada:** `modeFrom/modeTo/extractionMethod/confidence/period/consentVersion` aceptados.
32. **Prioridad correcta:** `data_deleted=critical`, `tarjeton_imported=important`, `mode_changed=info`.
33. **Append-only:** sin UPDATE/DELETE directo para authenticated; el RPC solo INSERT.

## 9. Grants mínimos

34. **authenticated no tiene DML de tabla en events/consents:** verificable en `information_schema.role_table_grants`.
35. **No se ampliaron grants de profiles:** `authenticated` en `profiles` sigue solo SELECT (tabla) + column-level de personales.
36. **Funciones revocadas de PUBLIC:** `proacl` no incluye PUBLIC para `upsert_consent/get_effective_consent/insert_worker_event/backfill_worker_profile`.

## 10. Reset desde cero

37. **db reset aplica todas las migraciones** (incluida la nueva timestamp) sin errores ni advertencias de dependencia.
38. **RLS activa con policies:** para tablas nuevas, `rls` habilitada y `pg_policies` con las policies esperadas (relevante por `rls_auto_enable` remoto).

## 11. Formato de implementación

- Pruebas SQL en `supabase/tests/worker_profile_pr2.sql` con DO-blocks que
  `RAISE EXCEPTION` al fallar (patrón de `profile_security.sql`), idempotentes
  (limpieza previa de usuarios sintéticos).
- Usuarios sintéticos en `auth.users` con IDs fijos `00...00c0xx`, limpieza al inicio.
- Sin modificar el esquema dentro del test.
- `profile_security.sql` existente debe seguir pasando (no se altera).
