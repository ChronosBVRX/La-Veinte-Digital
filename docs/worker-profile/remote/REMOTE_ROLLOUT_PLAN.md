# Remote rollout — orden operativo y condiciones NO-GO

## Prerrequisitos
- CI verde en main.
- Working tree limpio.
- Desarrollo local completo (migraciones, pruebas, integración) OK.
- Acceso a Supabase dashboard (project `ragktminwduiggvaoeix`).
- Acceso a Vercel dashboard (project `la-veinte-digital`).

## Estado pre-aplicación (verificado 2026-08-05)
- profiles: 2 filas.
- payroll_contexts: 0 filas, 15 columnas (original).
- imported_payslips: 0 filas.
- worker_preferences / worker_consents / worker_data_events: **no existen**.
- Columnas nuevas de payroll_contexts: **no existen**.
- RPCs de dominio: **no existen**.
- rls_auto_enable: presente (event trigger remoto).
- Hardening de profiles: aplicado.
- employment_type: sin datos existentes.

## Orden operativo

| Paso | Descripción | Responsable | Verificación |
|------|-------------|-------------|-------------|
| 1 | Backup de esquema (`supabase db dump --linked --schema public`) | Operador | Archivo > 0 bytes |
| 2 | Backup de datos (`supabase db dump --linked --data-only --use-copy`) | Operador | Archivo > 0 bytes |
| 3 | Preflight read-only (`docs/worker-profile/remote/verify-worker-profile-persistence.sql` ejecutado contra remoto) | Operador | 0 errores |
| 4 | Aplicar SQL remoto (`docs/worker-profile/remote/apply-worker-profile-persistence.sql`) | Operador | COMMIT exitoso |
| 5 | Verificación read-only (`verify-worker-profile-persistence.sql`) | Operador | Todas las ASSERT pasan |
| 6 | Smoke tests API (login, register, profile, `/api/health`) | Operador | 200/201 OK |
| 7 | Deploy frontend (Vercel) | Operador | Build OK |
| 8 | Smoke tests navegador (REMOTE_SMOKE_TESTS.md) | Operador | 20/20 |
| 9 | Observación (logs, errores, métricas) | Operador | 1h sin incidencias |
| 10 | Rollback si aplica (`docs/worker-profile/remote/rollback-worker-profile-persistence.sql`) | Operador | Solo si NO-GO |

## Condiciones NO-GO (interrumpir si ocurre)

- Backup incompleto (archivo vacío o no generado).
- Precondición fallida (cualquier ASSERT en el SQL de aplicación).
- Grants de profiles no coinciden con el hardening documentado.
- RLS distinta de lo esperado en payroll_contexts.
- Funciones con colisión (nombre ya existe con firma diferente).
- Valores de employment_type no contemplados (datos existentes que rompan el backfill).
- Backfill con conflictos no sanitizados (más de 0 en conflictos con datos reales).
- CI no verde en el PR documental.
- Working tree sucio al momento de ejecutar.
- Cualquier error PostgreSQL no controlado durante la aplicación.

## Notas finales
- Sin migration repair, sin db push, sin db reset --linked.
- El SQL de aplicación es autónomo (BEGIN/COMMIT).
- El rollback distingue "antes de uso" (DROP seguro) de "después de uso" (soft-disable).
- Las tablas sociales (chat, foro) permanecen en producción hasta su eliminación diferida.
