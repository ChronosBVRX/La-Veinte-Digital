# GUÍA DE DESPLIEGUE Y PROTOCOLO DE ROLLBACK (ROLLOUT / ROLLBACK)
## Panel de Administración Editorial y Notificaciones Push — La Veinte Digital

> **Fecha:** 6 de septiembre de 2026  
> **Rama:** `feat/admin-panel`  
> **Baseline protegido:** `d90ab2bbc2f4b648cb8ed0bed1801902cb9976da` / `7cd9a69`  
> **Área:** Administración (`/admin/*`), Bandeja de Trabajadores (`/avisos/*`), Campañas Push y Cron.

---

## 1. Requisitos Previos y Variables de Entorno

Antes de promover los cambios a producción (Vercel) o ejecutar el workflow de GitHub Actions, asegúrese de tener configuradas las siguientes variables de entorno:

| Variable | Destino | Propósito | Crítica |
|---|---|---|---|
| `CRON_SECRET` | Vercel & GitHub Secrets | Token compartido para autorizar ejecuciones del endpoint `/api/cron/push-campaigns`. Debe ser una cadena aleatoria de alta entropía (mínimo 32 caracteres). | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Server-Only | Clave de servicio para leasing atómico del worker de campañas push, snapshotting, limpieza de tokens inválidos y métricas administrativas agregadas. | Sí |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Vercel Server-Only | Credenciales de servicio de Google Cloud / Firebase para el transporte HTTP v1 de FCM hacia la app Android. | Sí |
| `PUSH_ADMIN_ALLOWED_EMAILS` | Vercel Server-Only | Lista separada por comas de correos con permisos para operar campañas push y herramientas administrativas (`admin@laveinte.digital,...`). | Sí |
| `NEXT_PUBLIC_CANONICAL_ORIGIN` | Vercel | Origen canónico de la aplicación (`https://la-veinte-digital.vercel.app`). Si no está fijado, el sistema usa este valor por defecto para validar URLs de destino. | Recomendada |

---

## 2. Paso a Paso para el Despliegue (Rollout)

### Paso 1: Migración en Base de Datos (Supabase)
Ejecutar la migración SQL en Supabase (vía Supabase CLI o panel SQL):
```bash
supabase db push
# O aplicar el contenido del archivo:
# supabase/migrations/20260906140000_admin_announcements_campaigns.sql
```
**Efecto:**
- Crea las 7 tablas del panel (`announcements`, `announcement_reads`, `notification_preferences`, `push_campaigns`, `push_campaign_deliveries`, `admin_audit_log`, `notification_job_runs`).
- Crea la secuencia de IDs de notificación Android: `push_campaign_notification_id_seq` (iniciando en 1000).
- Crea la función transaccional `archive_announcement_atomic`.
- Habilita RLS estricto en todas las tablas nuevas con políticas para administradores y aislamiento por usuario.

### Paso 2: Despliegue de Código (Vercel)
Fusionar la rama `feat/admin-panel` en `main` tras revisión de PR:
- Vercel ejecutará automáticamente `prebuild` (`scripts/copy-vendor.mjs`), `next build` y desplegará la nueva versión.

### Paso 3: Configuración del Cron en GitHub Actions
En el repositorio de GitHub:
1. Ir a **Settings > Secrets and variables > Actions**.
2. Agregar el secreto de repositorio:
   - Nombre: `CRON_SECRET`
   - Valor: Mismo valor configurado en el proyecto de Vercel.
3. El archivo `.github/workflows/push-campaigns-cron.yml` se ejecutará cada 15 minutos (`*/15 * * * *`).

---

## 3. Lista de Verificación en Staging / Producción

Una vez desplegado:

1. **Acceso al Panel:**
   - Iniciar sesión con una cuenta listada en `PUSH_ADMIN_ALLOWED_EMAILS` o con rol `admin` en `profiles`.
   - Navegar a `/admin`. Comprobar que el enlace "Administración" aparece en la barra lateral con el icono `ShieldCheck`.
   - Verificar que las tarjetas de métricas cargan sin errores.
2. **Acceso Denegado a No Administradores:**
   - Iniciar sesión con una cuenta de usuario normal.
   - Navegar a `/admin`. Debe redirigir de inmediato a `/` (cero acceso a vistas o datos de administración).
3. **Flujo de Aviso y Bandeja:**
   - En `/admin/avisos/nuevo`, crear un aviso de prueba con título y cuerpo.
   - Marcar "Mostrar en bandeja institucional". Guardar como borrador (`DRAFT`).
   - Publicar el aviso.
   - Desde la cuenta de usuario normal, abrir `/avisos`. El aviso debe aparecer visible. Al abrirlo, se marca como leído automáticamente (comprobar badge "Nuevo" que se apaga).
4. **Validación de la Barra Móvil y Filtro Normativo:**
   - En `/admin/avisos/nuevo`, crear un tip con fuente normativa (`source_document: "CCT 2025-2027"`, `source_reference: "Cláusula 10"`) y activar "Mostrar en barra inferior".
   - Sin haberlo revisado editorialmente, abrir `/admin/barra`. Comprobar que el badge indica: `Requiere revisión editorial de normativa` y NO se encuentra "Al aire en barra".
   - Al revisarlo y registrar la revisión, comprobar que pasa a ser elegible.
5. **Prueba Push a Dispositivo Propio (`SELF`):**
   - Ir a `/admin/campanas/nueva`.
   - Seleccionar audiencia **"Dispositivo propio del administrador (Prueba SELF)"**.
   - Ingresar título y mensaje.
   - Despachar. Verificar recepción en el teléfono Android de prueba y comprobar en `/admin/campanas/[id]` que el estado es `COMPLETED` con 1 entrega aceptada.
6. **Campañas Masivas Seguras (`ALL`):**
   - Solo tras validar con `SELF`, despachar a audiencia general.
   - El worker particiona automáticamente en lotes de máximo 500 tokens para cumplir con el límite estricto de Firebase `sendEachForMulticast`.
7. **Latido del Cron:**
   - Enviar una petición curl de prueba al cron:
     ```bash
     curl -s -X POST https://la-veinte-digital.vercel.app/api/cron/push-campaigns \
       -H "Authorization: Bearer <CRON_SECRET>"
     ```
   - Debe retornar HTTP 200 con `{ ok: true, scheduledPublished, campaignsProcessed }`.
   - Comprobar que en `/admin` se actualiza la tarjeta del Cron con estado `COMPLETED` y hora reciente.

---

## 4. Protocolo de Rollback (Reversión)

Si surge algún problema crítico en producción:

### Nivel 1: Reversión Rápida de Frontend (Vercel)
1. En el panel de Vercel > Deployments, seleccionar el deployment inmediatamente anterior a la fusión de `feat/admin-panel` y presionar **Instant Rollback**.
2. **Impacto:** Cero tiempo de inactividad. La aplicación vuelve a la versión estable previa (`7cd9a69`).
3. El frontend anterior simplemente no consulta las tablas nuevas. La base de datos puede permanecer con las tablas nuevas creadas sin causar ningún conflicto ni degradación a usuarios existentes.

### Nivel 2: Pausar Campañas Activas
Si se necesita detener de emergencia el envío de notificaciones push:
- En `/admin/campanas/[id]`, presionar el botón **Pausar Campaña** o **Cancelar Campaña**.
- El worker transaccional liberará los leases o cancelará las entregas pendientes inmediatamente.

### Nivel 3: Desactivar el Cron
Si se desea detener la ejecución periódica del cron:
- En GitHub Actions > Actions > `push-campaigns-cron`, presionar **Disable workflow**.
- O bien, rotar la variable `CRON_SECRET` en Vercel para que cualquier invocación externa retorne HTTP 401 Unauthorized sin procesar nada.

### Nivel 4: Reversión Completa de Base de Datos (Solo en caso necesario)
Las tablas y funciones creadas son completamente independientes y no alteran ninguna columna de tablas preexistentes (`profiles`, `push_devices`, etc.).
Si se requiere eliminar la infraestructura agregada por la migración:
```sql
BEGIN;
DROP TABLE IF EXISTS public.push_campaign_deliveries CASCADE;
DROP TABLE IF EXISTS public.push_campaigns CASCADE;
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.announcement_reads CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.admin_audit_log CASCADE;
DROP TABLE IF EXISTS public.notification_job_runs CASCADE;
DROP SEQUENCE IF EXISTS public.push_campaign_notification_id_seq;
DROP FUNCTION IF EXISTS public.archive_announcement_atomic(uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.is_admin_user();
COMMIT;
```
*(Nota: No ejecute este script a menos que esté seguro de descartar todos los avisos y campañas creados durante el periodo de prueba).*
