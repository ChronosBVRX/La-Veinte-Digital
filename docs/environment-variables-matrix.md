# 🛡️ Matriz de Variables de Entorno de Producción — La Veinte Digital

**Fecha:** 2026-09-10  
**Herramienta de validación preflight:** `scripts/preflight-env.ts`  
**Pruebas unitarias de validación:** `src/shared/server/__tests__/preflight-env.test.ts` (12/12 PASS)  
**Estatus:** APROBADA / PRODUCTION PREFLIGHT READY  

---

## 1. Matriz de Variables de Entorno

| Variable | Requerida en Prod | Expuesta al cliente | Propósito | Formato / Validación |
| :--- | :---: | :---: | :--- | :--- |
| **`NEXT_PUBLIC_SUPABASE_URL`** | **Sí** | **Sí** (Navegador) | URL base del proyecto Supabase para autenticación y llamadas RPC/REST. | URL válida que debe comenzar estrictamente con `https://`. No debe contener valores placeholder ni nombres de host de ejemplo (`example.supabase.co`). |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | **Sí** | **Sí** (Navegador) | Clave pública anónima de Supabase sujeta a Row Level Security (RLS). | Token JWT válido (`header.payload.signature`) con longitud >= 20 caracteres. No debe contener valores placeholder. |
| **`SUPABASE_SERVICE_ROLE_KEY`** | **Sí** | **NO** (Solo Servidor) | Acceso administrativo server-side para operaciones en segundo plano (limpieza de tokens push huérfanos, workers de campañas, auditoría interna). | Token JWT válido con longitud >= 20 caracteres. **NUNCA debe ser idéntico a `ANON_KEY`** ni comenzar con `NEXT_PUBLIC_`. |
| **`OPENAI_API_KEY`** | **Sí** | **NO** (Solo Servidor) | Clave de API de OpenAI para el asistente conversacional laboral (`/api/consulta`) y generación de embeddings. | Cadena válida que inicia típicamente con `sk-` y longitud >= 20 caracteres. No debe ser placeholder ni estar vacía. |
| **`CRON_SECRET`** | Recomendada | **NO** (Solo Servidor) | Token secreto para autorizar las invocaciones programadas en los endpoints `/api/cron/agenda-reminders` y `/api/cron/push-campaigns`. | Cadena criptográfica aleatoria de longitud >= 16 caracteres. |
| **`FIREBASE_SERVICE_ACCOUNT_JSON`**| Condicional (Push) | **NO** (Solo Servidor) | Credencial de la cuenta de servicio de Google Cloud / Firebase para el envío de notificaciones push móviles mediante FCM. | JSON válido parseable que contiene obligatoriamente las claves `project_id`, `private_key` y `client_email`. |
| **`BOT_API_URL`** | Opcional | **NO** (Solo Servidor) | URL del servicio FastAPI/Python alternativo para RAG extendido. | URL HTTP/HTTPS válida. |
| **`BOT_API_SHARED_SECRET`** | Condicional (si hay BOT_API_URL) | **NO** (Solo Servidor) | Secreto compartido enviado en el encabezado `X-Bot-Secret` hacia el contenedor de FastAPI. | Cadena no vacía, sin placeholders. |
| **`GROQ_API_KEY`** | Condicional (Radio Studio) | **NO** (Solo Servidor / Sidecar) | Clave de acceso a la API de Groq para generación de guiones y verificación con LLMs rápidos y de escritura. | Cadena no vacía sin placeholders. |
| **`SPEECHIFY_API_KEY`** | Condicional (Radio Studio) | **NO** (Solo Servidor / Sidecar) | Clave de autenticación server-side para síntesis de voz simba-3.0 en la nube. | Cadena no vacía sin placeholders. |

---

## 2. Detección y Prevención de Placeholders

El script `scripts/preflight-env.ts` analiza cada variable contra expresiones regulares que detectan valores temporales o de prueba comunes:
- `placeholder` / `placeholder-*`
- `your-*` / `your-key-here`
- `example` / `example.com`
- `dummy`
- `changeme`
- `todo`
- `xxx`

Ante la presencia de cualquiera de estos patrones en variables requeridas de producción, el script de preflight emite un error con código de salida 1, previniendo despliegues fallidos o vulnerables.
