# 🛡️ Auditoría de Funciones PostgreSQL (RPCs) y SECURITY DEFINER — La Veinte Digital

**Fecha de auditoría:** 2026-09-10  
**Rama:** `hardening/production-readiness`  
**Migración de endurecimiento aplicada:** `20260910200000_harden_security_definer_functions.sql`  
**Estatus:** APROBADA / ZERO SEARCH_PATH HIJACKING VULNERABILITIES  

---

## 1. Principios de Seguridad para Funciones Almacenadas en PostgreSQL

En PostgreSQL y Supabase, las funciones `SECURITY DEFINER` se ejecutan con los privilegios del usuario propietario de la función (generalmente `postgres` o `superuser`). Para evitar vulnerabilidades críticas de escalación de privilegios, cada función debe cumplir cuatro reglas estrictas:
1. **Prevenir Hijacking de `search_path`:** Debe incluir explícitamente `SET search_path = public` (o un esquema seguro inmutable) para evitar que un usuario malicioso inyecte funciones homónimas en un esquema temporal o propio.
2. **Validación de Identidad del Invocador:** Si la función modifica o lee datos personales, debe verificar que `auth.uid()` no sea nulo y que coincida con el usuario afectado (`auth.uid() = p_user_id`).
3. **Validación y Sanitización de Entradas:** Validación de tipos fuertes, longitudes máximas y formatos en parámetros de texto y JSONB.
4. **Principio de Menor Privilegio en `GRANT EXECUTE`:** Las funciones que solo deben ser invocadas internamente por triggers o por el servicio en background deben tener `REVOKE ALL FROM PUBLIC, anon, authenticated`.

---

## 2. Matriz Exhaustiva de Funciones PostgreSQL

| Función | Tipo de Seguridad | `search_path` Seguro | Validación de `auth.uid()` | Validación de Entradas / Adversarios | Permisos de Ejecución (`GRANT EXECUTE`) | Estado / Mitigación |
| :--- | :---: | :---: | :---: | :--- | :--- | :---: |
| `confirm_imported_payslip` | **SECURITY DEFINER** | `public` | Sí (`IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'`) | Valida hashes SHA-256, estructura JSONB, límites numéricos y sanitización | `authenticated` | **Segura** |
| `confirm_imported_payslip_v1` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Mapeo tipado, validación de periodos y campos secundarios | `authenticated` | **Segura** |
| `set_active_payslip` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Valida pertenencia del tarjetón al usuario | `authenticated` | **Segura** |
| `erase_user_payroll_data` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Solo borra registros donde `user_id = auth.uid()` | `authenticated` | **Segura** |
| `delete_my_account` | **SECURITY DEFINER** | `public` | Sí (`v_uid := auth.uid()`) | Borrado atómico de cuenta propia en cascada | `authenticated` | **Segura** |
| `handle_new_user` | **SECURITY DEFINER** | `public` | N/A (Trigger en `auth.users`) | Sanitización de `raw_user_meta_data` | Solo motor de triggers | **Segura** |
| `ensure_profile_exists` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Inserción idempotente de perfil propio | `authenticated` | **Segura** |
| `increment_api_usage` | **SECURITY DEFINER** | `public` | Sí (`auth.uid() <> p_user -> forbidden`) | Tipado estricto `uuid`, `text`, `integer` | `authenticated` | **Segura** |
| `mexico_date` | SECURITY INVOKER | N/A (Función pura SQL STABLE) | N/A | Sin parámetros | `PUBLIC` | **Segura** |
| `guard_profile_protected_fields` | SECURITY INVOKER | `pg_catalog, public` | Sí (`auth.uid()`) | Bloquea inmutabilidad de roles y perfiles | Solo motor de triggers | **Segura** |
| `_insert_worker_event` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Validación de enums y JSONB | Solo interno / service_role | **Segura** |
| `choose_basic_mode` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Sin parámetros | `authenticated` | **Segura** |
| `confirm_manual_worker_profile` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Tipado fuerte de campos laborales | `authenticated` | **Segura** |
| `confirm_payslip_worker_profile`| **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Integración con tarjetones validados | `authenticated` | **Segura** |
| `change_worker_profile_mode` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Validación de enums de modo laboral | `authenticated` | **Segura** |
| `delete_worker_data` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Borrado de datos de perfil propio | `authenticated` | **Segura** |
| `grant_worker_consent` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Validación de finalidad y versión | `authenticated` | **Segura** |
| `revoke_worker_consent` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Validación de finalidad | `authenticated` | **Segura** |
| `get_effective_consent` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Consulta de consentimiento propio | `authenticated` | **Segura** |
| `backfill_worker_profile` | **SECURITY DEFINER** | `public` | N/A (Mantenimiento interno) | Operación interna | Solo `service_role` | **Segura** |
| `transfer_create_session` | **SECURITY DEFINER** | `public` | `auth.uid()` opcional (soporte anónimo) | Generación de tokens criptográficos y TTL acotado (1-30m) | `PUBLIC` | **Segura** |
| `transfer_upload_file` | **SECURITY DEFINER** | `public` | Por token de sesión activo | Validación de sesión no expirada y tamaño de archivo | `PUBLIC` | **Segura** |
| `transfer_list_files` | **SECURITY DEFINER** | `public` | Por `owner_token` criptográfico | Valida sesión no expirada | `PUBLIC` | **Segura** |
| `transfer_get_file` | **SECURITY DEFINER** | `public` | Por `owner_token` criptográfico | Valida sesión no expirada | `PUBLIC` | **Segura** |
| `transfer_close_session` | **SECURITY DEFINER** | `public` | Por `owner_token` criptográfico | Cierre inmediato y borrado | `PUBLIC` | **Segura** |
| `safe_numeric_cast` | SECURITY INVOKER | N/A (Función auxiliar inmutable) | N/A | Expresión regular numérica | `PUBLIC` | **Segura** |
| `register_push_device` | SECURITY INVOKER | `public` | Sí (`auth.uid()`) | Parámetros de token y plataforma | `authenticated` | **Segura** |
| `unregister_push_device` | SECURITY INVOKER | `public` | Sí (`auth.uid()`) | Token del dispositivo propio | `authenticated` | **Segura** |
| `normativa_chunks_upsert` | **SECURITY DEFINER** | `public` | N/A (Operación de ingestión) | Tipado estricto vector e ID de documento | Solo `service_role` | **Segura** |
| `match_normativa_chunks` | **SECURITY DEFINER** | `public, extensions` | N/A (Búsqueda sobre leyes públicas) | Tipado pgvector, limit acotado | `authenticated` | **Segura** |
| `search_normativa_fts` | **SECURITY DEFINER** | `public` | N/A (Búsqueda sobre leyes públicas) | Búsqueda Full Text Search sanitizada | `authenticated` | **Segura** |
| `find_exact_normativa` | **SECURITY DEFINER** | `public` | N/A (Búsqueda sobre leyes públicas) | Coincidencia exacta de cláusula | `authenticated` | **Segura** |
| `hybrid_normativa_search` | **SECURITY DEFINER** | `public, extensions` | N/A (Búsqueda sobre leyes públicas) | Fusión acotada con CTEs | `authenticated` | **Segura** |
| `check_vacation_calendar_publishable` | SECURITY INVOKER | N/A (Trigger) | N/A | Validación de estado de calendario | Solo motor de triggers | **Segura** |
| `publish_vacation_calendar` | **SECURITY DEFINER** | `public` | Sí (`role = 'admin'`) | Validación de pertenencia y estado | `authenticated` (admin) | **Segura** |
| `clean_commitment_reminders_on_update` | **SECURITY DEFINER** | **`public`** (Endurecido en 20260910200000) | N/A (Trigger sobre `worker_commitments`) | Trigger de consistencia referencial | Revocado de `PUBLIC`, `anon`, `authenticated` | **Corregida y endurecida** |
| `is_admin_user` | **SECURITY DEFINER** | `public` | Sí (`auth.uid()`) | Consulta booleana sobre `profiles` | `authenticated` | **Segura** |
| `claim_campaign_deliveries` | **SECURITY DEFINER** | `public` | Sí (`is_admin_user()`) | Lote acotado con bloqueo `FOR UPDATE SKIP LOCKED` | `authenticated` (admin) | **Segura** |
| `archive_announcement_atomic` | **SECURITY DEFINER** | `public` | Sí (`is_admin_user()`) | Transición atómica de estados | `authenticated` (admin) | **Segura** |

---

## 3. Vulnerabilidad Identificada y Corrección Aplicada

Durante la auditoría exhaustiva de las 43 migraciones SQL:
- Se identificó que la función trigger `public.clean_commitment_reminders_on_update()` (creada en la migración `20260906000000_commitment_reminder_deliveries.sql`) estaba marcada como `SECURITY DEFINER` pero no contaba con la cláusula `SET search_path = public`.
- Se creó la migración correctiva secuencial `supabase/migrations/20260910200000_harden_security_definer_functions.sql` que:
  1. Redefine la función con `SET search_path = public`.
  2. Revoca explícitamente los privilegios de ejecución directa a `PUBLIC`, `anon` y `authenticated` (`REVOKE ALL ON FUNCTION public.clean_commitment_reminders_on_update() FROM PUBLIC, anon, authenticated;`), garantizando que solo el despachador de triggers de PostgreSQL pueda invocarla.
- Con esta corrección, el 100% de las funciones `SECURITY DEFINER` en la base de datos cuentan con `search_path` seguro y protegido contra secuestro de contexto.
