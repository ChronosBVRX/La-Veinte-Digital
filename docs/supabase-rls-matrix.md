# 🛡️ Matriz de Seguridad y RLS de Supabase — La Veinte Digital

**Fecha de auditoría:** 2026-09-10  
**Rama:** `hardening/production-readiness`  
**Pruebas de aislamiento:**  
- Suite TypeScript: `src/shared/server/__tests__/supabase-isolation.test.ts` (8/8 PASS)  
- Suite PostgreSQL Live: `supabase/tests/user_isolation_rls.sql` (Ejecutada en CI `supabase-db`)  
**Estatus:** APROBADA / ZERO DATA LEAKAGE DETECTED  

---

## 1. Auditoría de Clientes y Variables de Entorno

### 1.1. Uso de `createClient`
- **Cliente de Navegador (`src/lib/supabase/client.ts`):**  
  Utiliza `createBrowserClient` exclusivamente con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Opera bajo las credenciales del usuario autenticado vía cookies PKCE/SSR.
- **Cliente de Servidor (`src/lib/supabase/server.ts`):**  
  Utiliza `createServerClient` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, gestionando cookies con `next/headers`. Respeta todas las directivas de RLS en PostgreSQL bajo el rol `authenticated`.
- **Cliente Administrativo (`service_role`):**  
  Instanciado **únicamente** en servicios server-side y Server Actions aislados:
  - `src/features/push/services/push-admin.ts`
  - `src/features/push/services/campaign-worker.ts`
  - `src/features/agenda-laboral/services/commitment-reminders.ts`
  - `src/app/api/cron/push-campaigns/route.ts`
  - `src/app/(dashboard)/admin/campanas/[id]/page.tsx` (Server Component protegido)
  - `src/app/(dashboard)/admin/campanas/nueva/page.tsx` (Server Component protegido)

### 1.2. Regla Inquebrantable: Secreto de `service_role`
- **Verificación de prefijo:** `SUPABASE_SERVICE_ROLE_KEY` **NUNCA** tiene prefijo `NEXT_PUBLIC_`. El empaquetador de Next.js (Turbopack / Webpack) omite automáticamente cualquier variable que no comience con `NEXT_PUBLIC_` en los bundles de cliente.
- **Auditoría de código cliente:** Cero componentes con directiva `"use client"` importan o reciben la clave de servicio.
- **Inspección de artefactos:** Los bundles estáticos y mapas de compilación no contienen referencias a `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Matriz Exhaustiva de Tablas y Políticas RLS

Todas las 34 tablas activas en el esquema `public` tienen `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` estrictamente configurado. La siguiente matriz detalla los permisos por tabla:

| Tabla | RLS Habilitado | SELECT | INSERT | UPDATE | DELETE | ¿Aislamiento por usuario garantizado? |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| `profiles` | **Sí** | `auth.uid() = id` | `auth.uid() = id AND role = 'user'` | `auth.uid() = id` (columnas personales; trigger bloquea escalación de rol) | Denegado (solo cascade de auth) | **Sí** |
| `payroll_contexts` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | **Sí** |
| `imported_payslips` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | **Sí** |
| `imported_payslip_lines` | **Sí** | Propio (vía `imported_payslips.user_id = auth.uid()`) | Propio (vía `imported_payslips.user_id = auth.uid()`) | Denegado | Denegado (cascade) | **Sí** |
| `imported_payslip_observations` | **Sí** | Propio (vía `imported_payslips.user_id = auth.uid()`) | Propio (vía `imported_payslips.user_id = auth.uid()`) | Denegado | Denegado (cascade) | **Sí** |
| `worker_commitments` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | **Sí** |
| `worker_active_context` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | **Sí** |
| `worker_preferences` | **Sí** | `auth.uid() = user_id` | Denegado (Solo RPC de dominio / service_role) | Denegado (Solo RPC de dominio / service_role) | Denegado | **Sí** |
| `worker_consents` | **Sí** | `auth.uid() = user_id` | Denegado (Solo RPC de dominio) | Denegado | Denegado | **Sí** |
| `worker_data_events` | **Sí** | `auth.uid() = user_id` | Denegado (Append-only interno) | Denegado | Denegado | **Sí** |
| `vacation_profile_data` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | Denegado | **Sí** |
| `vacation_simulations` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | **Sí** |
| `vacation_simulation_events` | **Sí** | Propio (vía `vacation_simulations.user_id = auth.uid()`) | Propio (vía `vacation_simulations.user_id = auth.uid()`) | Denegado | Denegado | **Sí** |
| `vacation_rule_versions` | **Sí** | `true` (Catálogo normativo público) | Solo admin | Solo admin | Solo admin | **N/A** (Datos públicos) |
| `vacation_calendars` | **Sí** | `true` (Catálogo normativo público) | Solo admin | Solo admin | Solo admin | **N/A** (Datos públicos) |
| `vacation_calendar_roles` | **Sí** | `true` (Catálogo normativo público) | Solo admin | Solo admin | Solo admin | **N/A** (Datos públicos) |
| `vacation_mandatory_rest_days`| **Sí** | `true` (Días festivos oficiales CCT) | Solo admin | Solo admin | Solo admin | **N/A** (Datos públicos) |
| `api_usage_log` | **Sí** | `auth.uid() = user_id` | Denegado (Solo RPC `increment_api_usage`) | Denegado | Denegado | **Sí** |
| `ai_chat_history` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | Denegado | Denegado | **Sí** |
| `catalogo_adscripciones` | **Sí** | `true` (Catálogo público de unidades IMSS) | Denegado | Denegado | Denegado | **N/A** (Datos públicos) |
| `android_releases` | **Sí** | `true` (Feed público de versiones de la app) | Solo admin | Solo admin | Solo admin | **N/A** (Datos públicos) |
| `transfer_sessions` | **Sí** | Denegado directo (Solo RPC con token QR y expiración) | Denegado directo | Denegado directo | Denegado directo | **Sí** |
| `transfer_files` | **Sí** | Denegado directo (Solo RPC con token QR y expiración) | Denegado directo | Denegado directo | Denegado directo | **Sí** |
| `normativa_chunks` | **Sí** | `true` (Solo `authenticated`, textos de leyes/CCT) | Denegado a clientes (Solo service_role) | Denegado | Denegado | **N/A** (Datos públicos) |
| `push_devices` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | **Sí** |
| `commitment_reminder_deliveries` | **Sí** | `auth.uid() = user_id` | Denegado a clientes (Solo trigger / background worker) | Denegado | Denegado | **Sí** |
| `announcements` | **Sí** | Trabajador: `status = 'PUBLISHED' AND show_in_inbox = true`; Admin: total | Solo admin | Solo admin | Solo admin | **Sí** |
| `announcement_reads` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id AND aviso publicado` | `auth.uid() = user_id AND aviso publicado` | `auth.uid() = user_id` | **Sí** |
| `notification_preferences` | **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | Denegado | **Sí** |
| `push_campaigns` | **Sí** | Solo admin | Solo admin | Solo admin | Solo admin | **Sí** |
| `push_campaign_deliveries`| **Sí** | Solo admin | Solo admin | Solo admin | Solo admin | **Sí** |
| `admin_audit_log` | **Sí** | Solo admin | Solo admin / trigger | Denegado | Denegado | **Sí** |
| `notification_job_runs` | **Sí** | Solo admin | Solo service_role | Denegado | Denegado | **Sí** |
| `bitacora_entries` (histórico)| **Sí** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | **Sí** |

---

## 3. Pruebas de Aislamiento y No Regresión

1. **Aislamiento Multi-Inquilino Validado:**
   - Usuario anónimo (`anon`) no puede leer ni modificar perfiles, tarjetones, salarios, compromisos de agenda, historial de chat ni dispositivos push.
   - Usuario B recibe 0 registros al intentar leer perfiles o datos de Usuario A.
   - Intentos de UPDATE o DELETE cruzados afectan 0 filas (`row_count = 0`).
   - Intentos de INSERT suplantando identidad (`user_id = Usuario A` desde sesión de Usuario B) lanzan violación de política RLS (`WITH CHECK`).
   - Intentos de auto-promoción a rol `admin` son neutralizados por el trigger inmutable `guard_profile_protected_fields`.
2. **Cumplimiento de CI:**
   - La prueba en vivo `supabase/tests/user_isolation_rls.sql` fue integrada en el job `supabase-db` de `.github/workflows/ci.yml`.
   - La suite unitaria `src/shared/server/__tests__/supabase-isolation.test.ts` corre en cada invocación de `npm test`.
