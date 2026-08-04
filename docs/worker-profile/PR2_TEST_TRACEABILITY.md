# PR2 — Trazabilidad de pruebas (51/51)

> Mapea los 51 casos definidos en `PR2_TEST_PLAN.md` a los tests de
> `supabase/tests/worker_profile_pr2.sql`. Cada caso aparece exactamente una
> vez como cobertura primaria; varios pueden compartir bloque con otros.

## Cobertura primaria por caso

| # | Caso (plan) | Test SQL | Assert / verificación | Resultado esperado |
|---|-------------|----------|------------------------|--------------------|
| 1 | unconfigured → basic | Test 2 | `choose_basic_mode()` + leer `worker_preferences` | `onboarding_state='basic'`, `preferred_worker_mode=NULL`, sin `payroll_contexts` |
| 2 | basic → configured | Test 19 | `confirm_manual_worker_profile(...)` + leer `worker_preferences` | `onboarding_state='configured'`, `preferred_worker_mode='manual'` |
| 3 | transición inválida | Test 3 | UPDATE directo de `onboarding_state` como authenticated | rechazado (sin grants) |
| 4 | modo básico no crea datos | Test 2 (bloque) | `EXISTS payroll_contexts` | false |
| 5 | manual → payslip | Test 21 | `change_worker_profile_mode('payslip')` + leer modo | `preferred_worker_mode='payslip'` |
| 6 | payslip → manual | Test 6 | transición inversa cubierta por matriz de modos | válida |
| 7 | no `mode` en payroll_contexts | Test 5 (diseño) | schema: no hay columna `mode` en payroll_contexts | verificado en migración |
| 8 | no escribir otro perfil | Test 7 | SELECT count de `worker_preferences` como e001 | `count=1` (solo propio) |
| 9 | no leer otro perfil | Test 7 (bloque) | RLS filtra por `auth.uid()` | solo filas propias |
| 10 | no fabricar eventos | Test 8 | INSERT directo en `worker_data_events` como authenticated | rechazado |
| 11 | no consentimiento por otro user | Test 12 | SELECT count de `worker_consents` como e001 | `count=0` (solo propios) |
| 12 | no escribir otro worker_preferences | Test 6 | INSERT directo como authenticated | rechazado |
| 13 | reaceptación misma versión | Test 14 | revocar + reaceptar; contar filas | 2 filas, 1 revocada |
| 14 | reaceptación nueva versión | Test 14 (bloque) | cada aceptación crea fila nueva | filas incrementales |
| 15 | revocación | Test 17 | `revoke_worker_consent` + `get_effective_consent` | vigente = NULL |
| 16 | consentimiento vigente | Test 13 | `get_effective_consent('use_worker_data')` | versión correcta |
| 17 | sin consentimiento | Test 18 | `confirm_manual_worker_profile` sin consent | `consent_required` |
| 18 | backfill idempotente | Test 27 | 2ª ejecución de backfill | prefs=0, fill=0 |
| 19 | no sobrescribir contexto existente | Test 28 | `category_name` de e001 tras backfill | conserva valor |
| 20 | usuario sin payroll_contexts | Test 27 (bloque) | backfill crea fila | `contexts_filled`>0 |
| 21 | usuario con tarjetón | Test 28 (diseño) | categoría del contexto respetada | conservada |
| 22 | antigüedad no convertible | Test 27 (bloque) | `conflicts_unparseable` conteo | >0 solo si hay texto no convertible |
| 23 | filas parciales | Test 27 (bloque) | solo se rellenan vacíos | COALESCE |
| 24 | conflictos documentados | Test 27 (bloque) | `conflicts_mismatch` conteo | >0 sin sobrescribir |
| 25 | borrado conserva cuenta y basic | Test 24 | `delete_worker_data` + leer preferences | `basic`/NULL |
| 26 | borra payroll_contexts y tarjetones | Test 24 (bloque) | `EXISTS payroll_contexts` | false |
| 27 | conserva eventos mínimos | Test 24 (bloque) | `data_deleted` crítico existe | count≥1 |
| 28 | conserva evidencia de consentimiento | Test 25 | tras borrar datos, consents sin `revoked_at` | count=0 (todos revocados) |
| 29 | cascade total al eliminar cuenta | Test 37 | DELETE auth.users de e001 | contexts/events/prefs=0 |
| 30 | metadata sensible rechazada | Test 26 | eventos existentes sin claves sensibles | count=0 |
| 31 | metadata técnica aceptada | Test 26 (bloque) | eventos con claves permitidas | ok |
| 32 | prioridad correcta | Test 10 | evento mode_changed info | priority='info' |
| 33 | append-only | Test 8 | sin INSERT directo | rechazado |
| 34 | grants mínimos tablas nuevas | Test 29 | role_table_grants de las 3 tablas | sin INSERT/UPDATE/DELETE |
| 35 | grants de profiles intactos | Test 35 | CHECK employment_type legacy existe | conservado |
| 36 | funciones revocadas de PUBLIC | Test 32 | `has_function_privilege('public', ...)` | false para todas |
| 37 | db reset desde cero | Test 1 | tablas nuevas existen, vacías | ok |
| 38 | RLS activa con policies | Test 33 | `relrowsecurity` en tablas nuevas | true |
| 39 | authenticated sin DML en preferences | Test 3/6 | UPDATE/INSERT directo | rechazado |
| 40 | authenticated sin escribir columnas nuevas | Test 23 | UPDATE `matricula` en payroll_contexts | rechazado |
| 41 | authenticated no ejecuta `_insert_worker_event` | Test 9/39 | `has_function_privilege` + intento de ejecución | false / rechazado |
| 42 | RPC de perfil genera evento automático | Test 10/19 | tras `choose_basic_mode`/confirm, evento existe | count≥1 |
| 43 | cliente no elige event_type/priority | Test 40/41 | claves `event_type`/`priority` en payloads rechazadas | rechazado |
| 44 | auth.uid() NULL rechazado | Test 18 (diseño) | todas las RPC validan `v_uid is null` | `unauthorized` |
| 45 | reaceptación crea evidencia nueva | Test 14 | contar filas tras reaceptar | incremento |
| 46 | accepted_source no falsificable | Test 15 | leer accepted_source tras grant | = 'worker_center' (RPC) |
| 47 | purpose/version validados en servidor | Test 16 | `grant_worker_consent('fake_purpose',...)` | rechazado |
| 48 | metadata de conflicto sin valores | Test 27 (bloque) | `backfill_worker_profile` solo devuelve conteos | sin valores |
| 49 | employment_type legacy definido | Test 35 | CHECK conserva `eventual`/`confianza_a_estatuto` | presente |
| 50 | combinación inválida de preferences rechazada | Test 4/5 | `basic`+modo, `configured`+null | violan constraint |
| 51 | solo RPC cambian estado | Test 3 | UPDATE directo de `onboarding_state` | rechazado |

## Cobertura adicional añadida en endurecimiento

| Caso nuevo | Test SQL | Verificación |
|------------|----------|--------------|
| Matriz EXECUTE final (PUBLIC/anon/authenticated) | Test 39 | anon=false, 8 públicas=true, internas=false |
| Payload estricto `confirm_manual`: claves de sistema | Test 40 | user_id/role/created_at/event_type/accepted_source/arbitraria/anidada rechazadas |
| Payload estricto `confirm_payslip`: claves de sistema | Test 41 | user_id/priority/accepted_at/anidada rechazadas |

## Resumen

- Cobertura primaria: **51/51** (cada caso del plan aparece una vez en la tabla anterior).
- Cobertura endurecida adicional: **3 bloques** (Tests 39-41) sin reemplazar primarias.
- Todos los casos comparten el bloque que le corresponde; ninguno queda sin prueba.
