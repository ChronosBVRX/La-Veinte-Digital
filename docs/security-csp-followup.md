# 🛡️ Auditoría de Seguridad HTTP y Content Security Policy (CSP) — La Veinte Digital

> **Fecha de auditoría:** 2026-09-10  
> **Ámbito:** `next.config.ts`, `src/proxy.ts`, `src/shared/server/routing/route-policy.ts`  
> **Estado:** PRODUCCIÓN HARDENED (Fail-Closed)

---

## 1. Matriz de Cabeceras HTTP de Seguridad

Todas las respuestas servidas por la aplicación incorporan las siguientes cabeceras endurecidas en `next.config.ts`:

| Cabecera HTTP | Valor Configurado | Justificación y Propósito de Seguridad |
| :--- | :--- | :--- |
| **`Content-Security-Policy`** | *Directivas detalladas en Sección 2* | Mitigación integral contra Cross-Site Scripting (XSS), data injection y clickjacking. |
| **`X-Content-Type-Options`** | `nosniff` | Impide que los navegadores intenten adivinar (MIME-sniffing) el tipo de contenido fuera del declarado. |
| **`X-Frame-Options`** | `DENY` | Bloquea totalmente el incrustado de la aplicación en `<iframe>` de terceros (anti-clickjacking). |
| **`Referrer-Policy`** | `strict-origin-when-cross-origin` | Envía el origen completo solo en navegación HTTPS del mismo sitio; en cross-origin solo envía el hostname sin rutas ni query params. |
| **`Permissions-Policy`** | `camera=(self), microphone=(self), geolocation=(), payment=(), usb=()` | Deshabilita explícitamente geolocalización, pagos y USB. Restringe cámara (escáner QR) y micrófono al origen propio. |
| **`Strict-Transport-Security`** | `max-age=31536000; includeSubDomains` | Fuerza comunicación HTTPS durante 1 año y protege todos los subdominios del aplicativo. |
| **`X-Powered-By`** | *Deshabilitado (`poweredByHeader: false`)* | Elimina la divulgación del framework (`Next.js`) en encabezados de respuesta. |

---

## 2. Directivas de Content Security Policy (CSP)

### Configuración Activa

```http
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https://<supabase-instance>.supabase.co https://tessdata.projectnaptha.com https://cdn.jsdelivr.net;
worker-src 'self' blob: https://cdn.jsdelivr.net;
frame-src https://www.facebook.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

---

## 3. Excepciones Técnicas y Justificaciones

| Directiva | Excepción | Justificación Técnica Obligatoria |
| :--- | :--- | :--- |
| `style-src` | `'unsafe-inline'` | **Arquitectura de diseño institucional**: Conforme a la Regla 4 de `AGENTS.md`, la aplicación utiliza estilos en línea con variables CSS (`style={{}}`) y no clases Tailwind en componentes. Prohibir `unsafe-inline` en estilos rompería toda la UI. |
| `script-src` | `'unsafe-inline'` | Requerido por el runtime de hidratación de Next.js SSR / App Router y bundles de inicialización de clientes de Supabase. |
| `script-src` | **`'unsafe-eval'` AUSENTE** | ✅ **Hardened**: No se autoriza `unsafe-eval` en producción. La evaluación dinámica de cadenas está estrictamente bloqueada. |
| `img-src` | `data: blob:` | Generación local de códigos QR para credenciales digitales sindicales, renderizado de previsualizaciones PDF en canvas HTML5 y avatares dinámicos. |
| `worker-src` | `blob: https://cdn.jsdelivr.net` | Carga de web workers de PDF.js y Tesseract.js (OCR en el navegador) ejecutados localmente en el dispositivo del trabajador sin enviar archivos al servidor (Regla 11). |
| `connect-src` | `https://*.supabase.co` | Conexión HTTPS y WebSockets (WSS) con la base de datos Supabase, API REST de autenticación y sincronización de sesiones. |
| `connect-src` | `https://tessdata.projectnaptha.com https://cdn.jsdelivr.net` | Fallback CDN de sólo lectura en caso de que el archivo `spa.traineddata.gz` requiera descarga secundaria si el archivo local empaquetado en `/vendor/` se corrompe. |
| `frame-src` | `https://www.facebook.com` | Incrustación del widget oficial de noticias sindicales de la Sección XX en el portal informativo público. |
| `object-src` | `'none'` | Bloquea totalmente plugins heredados inseguros como Flash, Java o lectores de PDF embebidos vía `<object>`/`<embed>`. |

---

## 4. Política de Enrutamiento y Proxy de Autenticación (`src/proxy.ts`)

La clasificación de rutas se gobierna de forma centralizada y determinista en `src/shared/server/routing/route-policy.ts`:

1. **Rutas Públicas Explícitas (`PUBLIC_PAGE_PATHS`)**:
   - `/login`, `/register`, `/recuperar-password`, `/restablecer-password`, `/health`, `/transfer`
   - Páginas de transparencia y legales: `/privacidad`, `/terminos`, `/soporte`, `/acerca-de`, `/informacion-y-fuentes`, `/eliminar-cuenta`
2. **APIs Públicas Controladas (`API_ACCESS`)**:
   - `/api/health`
   - `/api/calendario`
   - `/api/announcements/bar`
   - `/api/cron/agenda-reminders` (protegido por token CRON)
   - `/api/cron/push-campaigns` (protegido por token CRON)
3. **APIs Autenticadas (`authenticated-api`)**:
   - `/api/worker-context`, `/api/tarjeton/confirm`, `/api/tarjeton/select`, `/api/tarjeton/delete`, `/api/calculator-prefill`, `/api/consulta`, etc.
   - Peticiones sin sesión válida retornan inmediatamente `401 Unauthorized` en JSON con `Cache-Control: no-store`.
4. **Rutas Desconocidas (`unknown-api`)**:
   - Cualquier ruta bajo `/api/` no registrada formalmente en `route-policy.ts` retorna inmediatamente `404 Not Found` en JSON: `{ "error": "No encontrado", "code": "not_found" }`, evitando la exposición de stack traces o rutas internas.
5. **Páginas Protegidas (`protected-page`)**:
   - Todas las demás rutas de la aplicación requieren sesión Supabase activa; en su ausencia, el middleware redirige a `/login`.
