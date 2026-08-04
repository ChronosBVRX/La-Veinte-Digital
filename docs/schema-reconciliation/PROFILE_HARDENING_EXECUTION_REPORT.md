# Reporte de Ejecución — Hardening de Perfiles en Producción

> **Estado: ÉXITO.** Producción protegida; hardening aplicado y COMMIT confirmado.

## 1. Fecha y hora

- Aplicación remota: 2026-08-04, ~11:35 (hora local), vía Management API (`supabase db query --linked`).
- Confirmación read-only posterior: 2026-08-04.

## 2. Backups creados

Antes de cualquier cambio se crearon y verificaron dos respaldos locales (fuera del repo):

| Archivo | Alcance | Tamaño |
|---------|---------|--------|
| schema | esquema `public` (tablas, funciones, vistas, políticas, grants, triggers) | ~78 KB |
| data | datos de todas las tablas | ~52 KB |

Verificación: ambos archivos existen y no están vacíos. Ubicación segura: carpeta temporal del sistema. No se agregan al repositorio ni se exponen rutas.

## 3. Intentos de ejecución

| Intento | Resultado | Detalle |
|---------|-----------|---------|
| 1 | Falló (rollback implícito) | `syntax error at or near RAISE`: el `RAISE NOTICE` final estaba fuera de un bloque `DO` y la Management API no lo acepta como SQL plano. |
| 2 | Falló (rollback implícito) | `verification failed: anon still has DML`: el `REVOKE` solo cubría INSERT/UPDATE pero `anon` también tenía DELETE y TRUNCATE. La verificación abortó la transacción. |
| 3 | **ÉXITO (COMMIT)** | Devuelto `rows: []` sin error ⇒ transacción confirmada. Todos los bloques de verificación internos pasaron. |

Los intentos 1 y 2 abortaron de forma controlada dentro de su transacción, por lo que no dejaron cambios parciales.

## 4. Cambios finales del SQL (coincidentes con lo ejecutado)

El archivo `apply-profile-hardening-remote.sql` modificado en el working tree coincide exactamente con el tercer intento:

1. `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM anon, authenticated;` (ampliado para cubrir todo DML).
2. Verificaciones posteriores ampliadas para incluir `TRUNCATE` en `profiles` y `limited_profiles`.
3. `RAISE NOTICE` final envuelto en un bloque `DO $$ ... $$`.

## 5. Grants de tabla (post-hardening)

`public.profiles`:

| Rol | Privileges |
|-----|-----------|
| anon | SELECT, REFERENCES, TRIGGER |
| authenticated | SELECT, REFERENCES, TRIGGER |

**Sin INSERT/UPDATE/DELETE/TRUNCATE a nivel de tabla.** El INSERT/UPDATE ahora es solo por columna.

`public.limited_profiles`:

| Rol | Privileges |
|-----|-----------|
| anon | — (vacío) |
| authenticated | — (vacío) |

Revocado por completo de anon y authenticated.

## 6. Grants por columna (post-hardening)

`public.profiles` — `authenticated`:

- **INSERT (8 campos):** id, full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url.
- **UPDATE (7 editables):** full_name, matricula, adscripcion, categoria, antiguedad, phone, avatar_url.
- **role / created_at / updated_at / is_online:** solo SELECT + REFERENCES. Sin INSERT ni UPDATE.
- **SELECT:** en todas las columnas.

`anon`: SELECT + REFERENCES en todas las columnas; **sin INSERT ni UPDATE**.

El contrato coincide con `EditableProfileFields` (7 campos editables) y con la inmutabilidad de `id`, `role`, `created_at` (explotada por el guard trigger). `updated_at` no requiere grant directo porque lo setea el trigger.

## 7. Políticas RLS (post-hardening)

`public.profiles`:

| Ops | Política | USING / WITH CHECK |
|-----|----------|--------------------|
| INSERT | Users can insert own profile | `WITH CHECK (auth.uid() = id AND role = 'user')` — endurecida para obligar role 'user'. |
| SELECT | Users can read own profile | `USING (auth.uid() = id)` |
| UPDATE | Users can update own profile | `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)` |

## 8. Trigger guard

- Función: `public.guard_profile_protected_fields()` — SECURITY INVOKER, `search_path` fijado a `pg_catalog, public`; execute revocado de PUBLIC/anon/authenticated.
- Trigger: `guard_profile_protected_fields` (BEFORE INSERT OR UPDATE FOR EACH ROW) — creado y verificado.
- Comportamiento: en INSERT valida `id = auth.uid()` y `role = 'user'`; en UPDATE hace inmutables `id`, `role`, `created_at` y actualiza `updated_at`.

## 9. Estado de limited_profiles

Sin grants para anon/authenticated. Queda la tabla intacta (no se eliminó) pero inaccesible a roles de cliente. El RLS y las funciones sensibles no fueron tocados.

## 10. Datos — roles existentes

Estado previo y posterior idéntico: 2 perfiles, todos `role = 'user'`. Sin nulos ni valores inesperados. **No se cambió el role de ningún usuario.**

## 11. Validaciones locales

- `npm run build`: compilación y TypeScript OK.
- `eslint .`: 0 errores, 5 warnings preexistentes (deps de `useCallback` en calculadoras).
- `npx vitest run`: 414/414 pasan.

## 12. Smoke tests — PENDIENTES (manuales, navegador vs producción)

Aún NO ejecutados. Ver sección de lista en la documentación del plan.

## 13. Confirmaciones

- No hubo `deploy`.
- No hubo `git push`.
- No hubo `migration repair`.
- No hubo eliminación de tablas sociales (chat/foro permanecen en la base).
- No se modificó `rls_auto_enable`.
- No se modificó `handle_new_user`.
- No se ejecutaron escrituras remotas fuera del tercer intento de hardening.

## 14. Riesgos restantes

- La cadena `rls_auto_enable` remota sigue presente; al crear tablas futuras puede ser relevante según política corporativa (documentado aparte, no modificado).
- Las tablas sociales siguen en la base hasta confirmar que el nuevo frontend no las consulta.
- Los grants por columna dependen de que la app escriba únicamente los 7 campos editables; cualquier campo adicional requerirá grant.