# 🚀 Manual Operativo y de Despliegue: Oracle Cloud Infrastructure (OCI)

> **Documento de Operaciones de Producción**  
> **Host Canónico:** `https://la20.com.mx`  
> **API de Base de Datos / Auth:** `https://supabase.la20.com.mx`  
> **Fecha de Migración:** 2026-09-30  
> **Estado:** 100% ACTIVO Y OPERATIVO EN OCI VPS

---

## 1. Topología del Servidor OCI

La infraestructura de producción está desplegada en una instancia **Oracle Cloud Always Free (Ampere A1 ARM64)** con las siguientes especificaciones:
- **CPU / RAM:** 4 OCPUs ARM64 / 24 GB RAM.
- **Directorio de la Aplicación:** `/opt/laveinte-app/`
- **Reverse Proxy:** Caddy v2 con soporte HTTP/3, TLS 1.3 automático (Let's Encrypt / ZeroSSL) y compresión Zstandard/Gzip.
- **Contenedores Docker:**
  - `laveinte-web`: Imagen basada en `node:22-alpine` ejecutando Next.js Standalone en `http://127.0.0.1:3000`.
  - Stack Supabase: PostgreSQL 14.5 + PostgREST + GoTrue Auth + Realtime + Storage.

---

## 2. Flujo Automatizado de Despliegue Web (`deploy:oci`)

Cualquier cambio de frontend o API backend en Next.js se despliega al servidor de OCI mediante un único comando:

```bash
npm run deploy:oci
```

### ¿Qué hace `npm run deploy:oci` internamente? (`scripts/deploy-oci-web.mjs`)
1. **Compilación Standalone:** Ejecuta `npm run build` o verifica `.next/standalone`.
2. **Staging Limpio:** Ensambla en `.next/deploy-staging/` el código compilado (`server.js`), las dependencias mínimas de producción (`node_modules`), los activos estáticos (`.next/static`) y los recursos públicos (`public/`).
3. **Generación de Configuración Docker:** Incluye `Dockerfile.web` y genera `docker-compose.yml` optimizado con healthchecks periódicos.
4. **Empaquetado Comprimido:** Genera `deploy-web.tar.gz`.
5. **Sanitización de Variables:** Prepara `/opt/laveinte-app/.env` a partir de `.env.production.local`.
6. **Transferencia Segura:** Sube el bundle y las variables vía SCP utilizando la llave SSH del servidor.
7. **Despliegue Cero-Downtime:** En el VPS extrae los archivos, compila la imagen Docker nativa ARM64 (`docker compose build web`), reinicia el contenedor (`docker compose up -d web`) y valida el endpoint `http://127.0.0.1:3000/api/health`.

---

## 3. Variables de Entorno de Producción

El archivo fuente de verdad en local para producción es `.env.production.local` (excluido de Git).
En el servidor VPS reside en `/opt/laveinte-app/.env` con permisos estrictos `chmod 600`.

### Variables Críticas Verificadas:
- `NEXT_PUBLIC_SUPABASE_URL=https://supabase.la20.com.mx`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Token JWT público sujeto a políticas RLS.
- `SUPABASE_SERVICE_ROLE_KEY`: Token administrativo exclusivo del servidor.
- `OPENAI_API_KEY`: Para el asistente laboral normativo y embeddings.
- `CRON_SECRET`: Token para autorización Bearer de tareas programadas.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Credencial para envío de notificaciones push vía FCM.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Llave de Cloudflare Turnstile anti-bot.

---

## 4. Tareas Programadas (Crons Nativos en Linux)

Los crons se ejecutan de forma **100% nativa e independiente** en el cron del sistema operativo Linux en el VPS:

### Script Ejecutor:
`/opt/laveinte-app/scripts/run-cron.sh` (o `scripts/run-cron.sh` en el repo).

### Configuración en Crontab del VPS (`crontab -e` o `/etc/crontab`):
```cron
# Recordatorios de agenda laboral (Diario a las 08:00 AM hora México)
0 14 * * * /opt/laveinte-app/scripts/run-cron.sh agenda-reminders >> /var/log/laveinte-crons.log 2>&1

# Procesamiento de campañas push en cola (Cada 10 minutos)
*/10 * * * * /opt/laveinte-app/scripts/run-cron.sh push-campaigns >> /var/log/laveinte-crons.log 2>&1
```

### Verificación de Ejecución:
Los resultados y códigos HTTP quedan registrados en tiempo real en:
- Archivo local del VPS: `/var/log/laveinte-crons.log`
- Tabla en base de datos: `notification_job_runs` (consultable desde Supabase)

---

## 5. Base de Datos y Storage (Supabase en OCI)

- **PostgreSQL 14.5:** 65 tablas activas con RLS y más de 100 funciones RPC transaccionales.
- **Buckets de Storage:**
  - `android-releases`: Almacenamiento de binarios APK de distribución directa.
  - `union-private`: Archivos protegidos de representación sindical (importaciones de padrón, actas, expedientes).

### Aplicación de Migraciones Futuras:
Cualquier nueva migración SQL en `supabase/migrations/` se aplica directamente en la base de datos de OCI ejecutando:
```bash
# Vía cliente psql conectado a la IP del VPS o consola de Supabase Studio local
psql "postgresql://postgres:<PASSWORD>@supabase.la20.com.mx:5432/postgres" -f supabase/migrations/<nueva_migracion>.sql
```

---

## 6. Procedimiento de Rollback en OCI

Si un despliegue presenta incidencias en producción:

1. **Reversión Inmediata de Contenedor:**
   ```bash
   ssh -i ~/.ssh/oci_key_3 opc@159.54.146.146
   cd /opt/laveinte-app
   # Desplegar imagen previa o reiniciar
   docker compose restart web
   ```
2. **Re-despliegue de un Commit Anterior:**
   ```bash
   git checkout <COMMIT_STABLE>
   npm run deploy:oci
   git checkout main
   ```

---

## 8. Diagnóstico y Resolución de Problemas

### SSH Time Out (Puerto 22 bloqueado):
Si la conexión SSH al VPS falla por tiempo de espera:
1. Entra a la consola web de **Oracle Cloud Infrastructure (OCI)** -> *Compute* -> *Instances*.
2. Selecciona la instancia -> haz clic en la **Virtual Cloud Network (VCN)** asignada.
3. Ve a **Security Lists** -> *Default Security List*.
4. Revisa las **Ingress Rules**: Asegúrate de que existe una regla para el puerto `22` (SSH) con tu IP pública actual o `0.0.0.0/0`.
5. Comprueba en la máquina local:
   ```powershell
   Test-NetConnection -ComputerName 159.54.146.146 -Port 22
   ```

### Ver Logs del Contenedor Web en Vivo:
```bash
docker logs -f --tail 100 laveinte-web
```

### Ver Logs de Caddy:
```bash
journalctl -u caddy -f --no-pager
```
