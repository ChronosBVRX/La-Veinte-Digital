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
