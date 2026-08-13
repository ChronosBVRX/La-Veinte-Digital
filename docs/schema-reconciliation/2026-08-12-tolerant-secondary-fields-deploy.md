# Deploy — Persistencia tolerante del tarjetón (2026-08-12)

> **Estado: ÉXITO.** Migración aplicada a producción y código desplegado en Vercel.

## Resumen

Corrige el fallo "el tarjetón se lee correctamente pero no se guarda": un
campo opcional mal leído (observaciones con `units` fuera de SMALLINT,
`initialCharge` gigante por artifacts del PDF, fechas auxiliares inválidas,
confianzas con muchos decimales) provocaba rollback completo de la
transacción de confirmación.

Regla aplicada: **un dato secundario inválido se normaliza a NULL/undefined
con warning; los datos críticos (importes de conceptos y totales) mantienen
validación estricta.**

## Cambios

### Base de datos (remota)

- Archivo: `supabase/migrations/20260812183000_tolerant_secondary_fields.sql`
- Aplicado vía `supabase db query --linked -f <archivo>` (mismo patrón que el
  hardening de perfiles de 2026-08-04). Resultado: `rows: []` sin error
  (transacción confirmada).
- Objetos nuevos/reemplazados:
  - `public.safe_numeric_cast(TEXT)` — cast NUMERIC que devuelve NULL ante
    texto no numérico.
  - `public.confirm_imported_payslip_v1` — conversiones defensivas para
    year/month/half, certificationDate, workdayHours, fecha efectiva de
    antigüedad, totales auxiliares y observaciones (amount, units,
    initialCharge → NULL + warning). Conceptos y totales: `invalid_payload:
    line amount out of range` si exceden 100M.
- Verificación read-only posterior: `safe_numeric_cast` existe y `v1`
  contiene `safe_numeric_cast`, `v_obs_clean` y `obs_insert_failed`.

### Código (Vercel)

- Deploy: `dpl_GfXfXwVA98gv9UeWukGcxWpePSXM` → `https://la20.com.mx`
- Sanitización en cliente (`useTarjetonImporter`) y servidor
  (`confirmTarjetonService`) con `requestId`, logs técnicos no sensibles y
  mapeo de `obs_insert_failed`/`line_insert_failed` → `persistence_failed`
  (línea, campo y valor en el log).
- Verificación POST `/api/tarjeton/confirm` sin auth → 401; `/api/health` → 200.

## Deriva del ledger

El ledger remoto NO registra esta migración (patrón existente: 015-017,
20260804*, 20260810*, 20260812* tampoco están registradas aunque su
contenido ya estaba aplicado). El contenido remoto está al día; el
`supabase_migrations.schema_migrations` sigue desfasado. No se ejecutó
`db push` ni `migration repair` para evitar re-ejecutar migraciones cuyo
contenido ya existe remotamente.

**Actualización 2026-08-13**: se registraron las 22 migraciones locales
(`001`–`017` + `20260804*` + `20260810*` + `20260812*`) en
`supabase_migrations.schema_migrations` vía INSERT idempotente
(`ON CONFLICT (version) DO NOTHING`), marcándolas como aplicadas sin
re-ejecutar contenido. Con esto `db push` ya no intenta re-aplicar
migraciones locales cuyo contenido ya está en el esquema.

**Limpieza forum/chat (2026-08-13)**: el chat social y el foro están
retirados. Se eliminaron de producción las tablas `forum_categories`,
`forum_posts`, `forum_comments`, `chat_rooms`, `chat_participants`,
`chat_messages`, `chat_room_invitations` y las funciones `is_chat_*`
(migración `20260813000000_drop_retired_chat_forum`, idempotente). Se
conserva `ai_chat_history` (asistente IA, activo). Se regeneró
`src/lib/supabase/types.ts` (sin forum/chat, incluye `mexico_date` y
`confirm_imported_payslip_v1`). Se eliminaron del ledger las entradas
huérfanas `20260727231656` (forum), `20260727231703` (chat) y
`20260727231842` (chat seed); se conservan `20260727231648`,
`20260727233904`, `20260728003305`, `20260728003432` (profiles/catálogo,
aún presentes).

## Rollback

- Código: redeploy del commit anterior con `vercel --prod`.
- BD: reemplazar `confirm_imported_payslip_v1` con la definición 017
  (backup: `remote-v1-backup-20260812.json`, carpeta temporal local) y
  `DROP FUNCTION public.safe_numeric_cast(TEXT)`.
