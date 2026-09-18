# Centro de Administración de Usuarios — Integración y salvaguardas

> **Rama original:** `feat/admin-user-control-center` (base `63a3a2cdccd74467da5c13280efde881136a9a12`)  
> **Integración:** cherry-pick sobre `origin/main` @ `50f6bb1e8112e5bd08b7729b432550ae5597d948` (2026-09-17)  
> **Migración:** `supabase/migrations/20260919040000_admin_user_control_center.sql` (NO aplicada a producción)  
> **Alcance:** gestión administrativa de cuentas (búsqueda, rol de plataforma, suspensión,
> papelera recuperable, cierre de sesiones, diagnóstico, bitácora). Sin cambios en
> autenticación, tarjetones, documentos, navegación nativa ni fórmulas laborales.

---

## 1. Modelo de datos (aditivo)

### `public.user_admin_status`

Una fila por cuenta administrada; **la ausencia de fila equivale a `active`**, por lo que
es compatible con todos los usuarios existentes y no requiere backfill.

| Columna | Tipo | Notas |
|---|---|---|
| `user_id` | uuid PK | FK `auth.users(id) ON DELETE CASCADE` |
| `status` | text | `active` \| `suspended` \| `trashed` |
| `suspension_kind` | text | `temporary` \| `indefinite` (solo suspendido) |
| `suspension_ends_at` | timestamptz | solo suspensión temporal |
| `status_reason` | text | motivo administrativo (≤ 500) |
| `status_changed_at` / `status_changed_by` | timestamptz / uuid | responsable |
| `trashed_at` / `purge_after` | timestamptz | retención de 30 días |
| `sessions_revoked_at` | timestamptz | último cierre de sesiones |
| `auth_sync_at` / `auth_sync_error` | timestamptz / text | sincronización con Supabase Auth |
| `created_at` / `updated_at` | timestamptz | auditoría técnica |

Índices: `(status)` y `(purge_after) WHERE status = 'trashed'`.  
RLS habilitada: **única política** `user_admin_status_select_own` (SELECT de la fila propia);
no hay políticas de escritura. Grants explícitos: `SELECT` a `authenticated` y DML a
`service_role` (el proyecto ya no auto-expone tablas nuevas).

### Auditoría

Se reutiliza `public.admin_audit_log` (append-only, ya existente). Cada escritura inserta su
fila **dentro de la misma transacción** y con `request_id` correlacionable. La UI solo puede
leerla; no existe endpoint alguno de edición o borrado.

Acciones registradas: `user.role_change`, `user.suspend`, `user.reactivate`, `user.trash`,
`user.restore`, `user.purge`, `user.sessions_revoked`, `user.resend_confirmation`,
`user.password_recovery`, `user.action_rejected`, `user.auth_sync_failed`.

---

## 2. Roles y autorización

- **Roles de plataforma:** solo `user` y `admin` (`profiles.role`, constraint existente).
  No se crearon roles nuevos ni permisos granulares.
- **Roles sindicales** (`union_rep` / `union_admin` en `union_members`) son ortogonales y
  **no otorgan** privilegios globales.
- **Operador push heredado** (`PUSH_ADMIN_ALLOWED_EMAILS`) conserva acceso a `/admin/push`
  pero **no** al Centro de Usuarios.
- **Doble validación:**
  1. Cada ruta API usa `requireUser()` + `requirePlatformAdmin()` (sesión real, rol leído
     de `profiles`). Ninguna acepta identificadores de actor desde el navegador.
  2. Las RPC de lectura validan `public.is_admin_user()` **dentro** de la base.
  3. Las RPC de escritura se conceden **exclusivamente a `service_role`** y verifican que
     `p_actor` tenga `role = 'admin'` en la misma transacción.
- **Protecciones de operación:** no autosuspensión, no autoenvío a papelera, no
  autopurga, imposibilidad de degradar/suspender/enviar a papelera/purgar a la última
  cuenta administradora (bloqueo de filas para concurrencia).

### Suspensión verificada en el servidor

- `src/proxy.ts` consulta `user_admin_status` en cada request protegido con la sesión del
  propio usuario (RLS de fila propia):
  - APIs autenticadas → `403 { code: "account_suspended" | "account_trashed" }`.
  - Páginas y Server Actions → redirección a `/cuenta-suspendida` (303 en POST).
- Se refuerza con el **baneo de Supabase Auth** (`auth.admin.updateUserById` con
  `ban_duration`), que impide refrescar tokens e iniciar sesión, y con el cierre de
  refresh tokens al suspender/enviar a papelera.
- Una suspensión temporal vencida se trata como activa (normalización en lectura).
- `signInAction` mapea el error `banned` a un mensaje humano en español.

**Fail-open documentado:** si la lectura de `user_admin_status` falla o lanza (p. ej. la
migración todavía no está aplicada en un entorno), el proxy deja pasar; la plataforma no se
rompe. La capa fuerte sigue siendo el baneo de Auth y las RPC de escritura, que sí fallan
cerrado. Cubierto por pruebas.

---

## 3. API y UI

### Rutas (registradas en `route-policy.ts`, todas `authenticated`)

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/admin/users` | Listado paginado con búsqueda/filtros/orden |
| GET | `/api/admin/users/[id]` | Ficha + actividad |
| POST | `/api/admin/users/[id]/role` | Cambio de rol (plataforma) |
| POST | `/api/admin/users/[id]/union-role` | Alta/baja auditada del rol sindical (`union_rep`/`union_admin`) |
| POST | `/api/admin/users/[id]/suspend` | Suspensión temporal/indefinida |
| POST | `/api/admin/users/[id]/reactivate` | Reactivación |
| POST | `/api/admin/users/[id]/trash` | Envío a papelera (30 días) |
| POST | `/api/admin/users/[id]/restore` | Restauración |
| POST | `/api/admin/users/[id]/sessions/revoke` | Cierre de sesiones |
| POST | `/api/admin/users/[id]/resend-confirmation` | Reenvío oficial |
| POST | `/api/admin/users/[id]/password-recovery` | Recuperación oficial |
| POST | `/api/admin/users/[id]/purge` | Eliminación definitiva (bloqueada por defecto) |
| GET | `/api/admin/audit-log` | Bitácora paginada con filtros |

Todas: sesión obligatoria, autorización de rol en servidor, validación Zod del cuerpo y
query, paginación acotada (1..100), errores JSON consistentes `{ error, code }` con
`Cache-Control: private, no-store`.

### UI

- `/admin` (hub): sección **Gestión de Usuarios** con 8 indicadores reales calculados
  server-side (`admin_user_metrics`) y accesos al centro y a la bitácora. Si el cálculo
  falla no se muestran ceros falsos, sino guiones.
- `/admin/usuarios`: búsqueda (nombre, correo, matrícula), filtros (estado, rol, rango de
  registro), orden, paginación en servidor, tabla en escritorio, tarjetas en móvil, menú
  contextual accesible por teclado, estados de carga/error/vacío/reintento, diálogos con
  motivo obligatorio y confirmación reforzada (checkbox en papelera, correo escrito en
  purga).
- `/admin/usuarios/auditoria`: bitácora paginada con filtros por acción y fechas.
- `/cuenta-suspendida`: aviso público, sin datos internos, con cierre de sesión.

### Representación Sindical desde el Centro de Usuarios (migración `20260919060000`)

- La ficha muestra las membresías sindicales del usuario y permite **asignar o retirar**
  `union_rep` / `union_admin` por delegación, con motivo obligatorio y bitácora
  (`user.union_role_change`).
- **Guardrail intacto:** el rol de plataforma no habilita Representación por sí mismo; el
  acceso se abre solo al crear la membresía explícita (RLS y helpers sindicales sin
  bypass).
- Un `union_rep` ve únicamente los módulos sindicales: "Administración Sindical" es
  exclusiva de `union_admin` y las rutas de importación redirigen a
  `/representacion/acceso-denegado`.
- Una cuenta con `profiles.role='admin'` **y** membresía ve ambos mundos: el shell sindical
  incluye el enlace "Panel de administración" (solo presentación; los permisos no cambian).

### Privacidad

Las fichas exponen **estados y conteos**, nunca contenido: correo, nombre, matrícula,
proveedores de autenticación, fechas y diagnósticos técnicos. La actividad registra solo
eventos operativos (inicio de sesión, importación de tarjetón, uso de herramientas por
ruta/contador, acciones administrativas). No se guardan ni devuelven tokens, contraseñas,
contenido de tarjetones, escritos ni identificaciones. Hay pruebas de no exposición.

---

## 4. Eliminación recuperable

```text
Activa → Enviar a papelera (motivo obligatorio) → retención 30 días → Restaurar o Eliminar definitivamente
```

- La purga física requiere `profiles.role = 'admin'`, cuenta previamente en papelera,
  escribir el correo exacto, motivo, y **`ADMIN_PERMANENT_DELETE_ENABLED="true"` en el
  servidor** (por defecto deshabilitada → `403 purge_disabled`).
- La operación es atómica: replica el contrato de `delete_my_account()` para el objetivo y,
  si existe cualquier referencia FK que comprometa integridad (p. ej. representación
  sindical), revierte todo y responde `blocked_references`. Nunca borra parcialmente.
- Este agente **no ejecutó ni programó ninguna purga** ni aplicó la migración en remoto.

---

## 5. Migración y rollback

- La migración es **aditiva e idempotente** (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE
  FUNCTION`, `DROP POLICY IF EXISTS`) y usa `BEGIN/COMMIT`.
- **Endurecimiento adicional (`20260919050000_admin_user_status_least_privilege.sql`):** el
  proyecto remoto conserva default privileges que otorgan DML a `anon` y `authenticated` en
  tablas nuevas. RLS ya denegaba toda escritura (única política: SELECT de fila propia), pero
  se revocan explícitamente esos privilegios: `anon` sin acceso, `authenticated` solo
  `SELECT`, `service_role` DML completo. Rollback: `GRANT ALL ... TO anon, authenticated`.
- **Rollback documentado:** las rutas, UI y proxy pueden desplegarse sin la migración
  (fail-open en lectura; las RPC responden `admin_backend_unavailable`). Para revertir la
  migración:
  1. `REVOKE`/`DROP FUNCTION` de las 12 funciones `admin_*` y helpers.
  2. `DROP TABLE public.user_admin_status` (no hay datos de negocio en ella; su pérdida solo
     descarta estados administrativos vigentes).
  3. No se modificó ninguna tabla ni política preexistente.
- Validada ejecutando el archivo completo y `supabase/tests/admin_user_control.sql` contra un
  PostgreSQL 16 real en contenedor aislado (15 pruebas SQL, incluida idempotencia).

## 6. Variables de entorno

| Variable | Uso |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor para RPC de escritura y Auth Admin (patrón ya existente). Nunca en cliente. |
| `ADMIN_PERMANENT_DELETE_ENABLED` | `"true"` habilita la purga física. Ausente o distinto = bloqueada. |

---

## 7. Pruebas

- Unitarias/integración: `npm test` (sin las 8 fallas preexistentes de Radio Studio,
  reproducidas idénticas en `origin/main`).
- SQL: `supabase/tests/admin_user_control.sql` (se ejecuta en el job `supabase-db` tras
  aplicar las migraciones).
- Cubren: usuario normal sin acceso, admin limitado sin privilegios, último administrador,
  autosuspensión, suspensión temporal/indefinida/vencida, papelera y retención,
  restauración, cierre de sesiones, purga bloqueada por FK/correo/bandera, auditoría por
  operación e intentos rechazados, RLS de fila propia, privacidad de la ficha, estados de
  la interfaz y navegación por teclado.

## 8. Integración posterior

1. Aplicar la migración tras revisión (no ejecutada por este agente).
2. Verificar que `route-policy.test.ts` (snapshot actualizado con las 12 rutas nuevas) pasa
   junto con el trabajo concurrente.
3. Smoke test sugerido:
   - `/admin` muestra indicadores reales y el acceso al centro.
   - `/admin/usuarios` lista, busca y filtra; abrir ficha no muestra contenido privado.
   - Suspender una cuenta de prueba: recibe aviso humano y la API responde 403.
   - Reactivar y restaurar desde papelera; el intento de purga responde bloqueado.
   - `/admin/usuarios/auditoria` muestra cada operación con su motivo y `request_id`.
4. No se tocó Android/iOS, WebViews, bridges, ni contratos de almacenamiento local.
