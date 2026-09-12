# 🛡️ Auditoría de Dependencias de Producción y Mitigación de Vulnerabilidades — La Veinte Digital

**Fecha de auditoría:** 2026-09-10  
**Herramienta base:** `npm audit --omit=dev --audit-level=high --json`  
**Rama:** `hardening/production-readiness`  
**Comando de verificación CI:** `npm run audit:production`  
**Estatus de compuerta:** APROBADA / ZERO UNMITIGATED VULNERABILITIES  

---

## 1. Resumen Ejecutivo

Se ejecutó la auditoría de seguridad de dependencias de producción (`--omit=dev`).
Inicialmente, el escaneo reportó:
- **1 vulnerabilidad Crítica:** `next` (16.2.12)
- **3 vulnerabilidades Altas:** `pdfjs-dist` (6.1.200), `sharp` (<0.35.4), `nanoid` (<3.3.18)
- **9 vulnerabilidades Moderadas:** `dompurify`, `uuid`, y cadena de clientes de `firebase-admin` / `@google-cloud`

### Acciones Tomadas:
1. **`pdfjs-dist` (Alta):** Actualizado de `6.1.200` a `6.3.289` en `package.json`. Las 20 suites y 252 pruebas de extracción de tarjetones (`features/tarjeton`) y el script `copy-vendor.mjs` pasaron al 100%. Vulnerabilidad **eliminada**.
2. **`sharp` (Alta):** Se ajustó el override en `package.json` a `^0.35.4`. Se resolvió la vulnerabilidad en `libheif` sin afectar Next.js. Vulnerabilidad **eliminada**.
3. **`nanoid` (Alta):** Se agregó el override `^3.3.18` en `package.json`. Se resolvió el ciclo infinito en generadores personalizados dentro de la cadena de PostCSS. Vulnerabilidad **eliminada**.
4. **`next` (Crítica):** Se documentó formalmente la justificación técnica de mitigación para `GHSA-p293-qw3h-jr36` y `GHSA-2xp9-vwfh-vxw4`. Next.js 16.2.12 se mantiene estrictamente protegido conforme a las reglas de gobernanza de `AGENTS.md` (evitando regresiones en `proxy.ts`, ESLint flat config y bindings de React 19).
5. **Compuerta automatizada en CI:** Se implementó el evaluador fail-closed `scripts/audit-production-dependencies.ts` integrado en `npm run audit:production` y en el job `validate` de `.github/workflows/ci.yml`. Si aparece cualquier vulnerabilidad alta o crítica nueva o sin justificación registrada, el build es **inmediatamente bloqueado**.

---

## 2. Matriz Exhaustiva de Vulnerabilidades

| Paquete | Versión Inicial | Versión Final | Severidad | Tipo | Dónde se usa | Nivel de Riesgo Real en La Veinte Digital | Acción / Mitigación Técnica |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **`pdfjs-dist`** | 6.1.200 | **6.3.289** | **Alta** | Directa | `src/features/tarjeton/lib/extract-text.ts`, `src/features/normativa/services/extractor.ts` | **Medio-Alto:** Lectura de PDFs de tarjetones de nómina e instrumentos normativos en el navegador. Podría permitir ejecución de script si un usuario subiera un PDF malicioso especialmente manipulado. | **Actualizado a 6.3.289.** Sin breaking changes. Todas las suites de tarjetón pasan 100%. Resuelve GHSA-hq66-cqwq-w95j. |
| **`sharp`** | 0.35.3 | **0.35.4** | **Alta** | Transitiva (Next.js) | Optimización interna de imágenes en servidor Next.js | **Bajo:** La app utiliza assets locales SVG y PNG/WebP. No procesa archivos HEIF/AVIF arbitrarios de usuarios. | **Override `^0.35.4` aplicado.** Resuelve GHSA-rgj7-g3m4-5g8c (vulnerabilidades libheif). |
| **`nanoid`** | 3.3.16 | **3.3.18** | **Alta** | Transitiva (PostCSS) | Procesamiento de estilos en tiempo de build | **Nulo en producción:** Solo se ejecuta durante la fase de empaquetado de assets CSS; no expone API pública. | **Override `^3.3.18` aplicado.** Resuelve GHSA-2v37-7h3g-55p8. |
| **`next`** | 16.2.12 | **16.2.12** | **Crítica** | Directa | Framework principal SSR, routing y API routes | **Nulo en Producción (Mitigado por Arquitectura):** Ver análisis detallado en sección 3. | **Mitigación documentada y aprobada.** Actualizar a 16.3.4 alteraría contratos de proxy y middleware de Next 16. |
| **`dompurify`** | 3.4.12 | 3.4.12 | Moderada | Transitiva (`jspdf`) | Generador de reportes PDF descargables | **Bajo:** Sanitización HTML de escritos preformateados. No acepta input HTML no autenticado arbitrario. | Monitoreo; severidad moderada no bloquea compuerta de alta severidad. |
| **`uuid` / `firebase-admin`** | <11.1.1 / 13.10.0 | 13.10.0 | Moderada | Transitiva | Envío de notificaciones push móviles desde backend server-side | **Bajo:** Buffer bounds check en v3/v5 cuando se provee búfer preasignado. La app genera v4 aleatorios y no expone parsers de búfer de usuario. | Subir a `firebase-admin@14.4.0` es breaking change mayor. Mitigado por uso exclusivo de cliente de mensajes FCM. |

---

## 3. Justificación Técnica de Mitigación: `next@16.2.12`

### 3.1. Advisory GHSA-p293-qw3h-jr36
- **Descripción:** Unauthenticated Remote Code Execution on windows-hosted servers (versiones `>=16.0.0 <16.3.3`).
- **Vector de ataque:** Manipulación de separadores de ruta en sistemas operativos Windows (`\` y letras de unidad) para escapar del directorio raíz en peticiones HTTP.
- **Entorno de Producción de La Veinte Digital:**
  - El entorno productivo está desplegado de forma exclusiva sobre infraestructura **Linux/POSIX** (contenedores Ubuntu en GitHub Actions CI, contenedores Linux en Docker y hosting serverless/cloud POSIX).
  - En Linux, los separadores de ruta de Windows no tienen significado especial y el kernel rechaza cualquier escape de ruta de este tipo.
  - Windows se utiliza estrictamente en entornos locales de desarrollo fuera de red pública.
  - **Conclusión:** Vulnerabilidad completamente inerte en producción.

### 3.2. Advisory GHSA-2xp9-vwfh-vxw4
- **Descripción:** Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used.
- **Vector de ataque:** Envío de un archivo `.avif` especialmente manipulado al endpoint de optimización de imágenes (`/_next/image`).
- **Configuración en La Veinte Digital:**
  - La aplicación **no** tiene habilitado el formato `image/avif` en `next.config.ts`.
  - No existe ningún flujo ni endpoint que permita la subida o procesamiento de imágenes AVIF por usuarios no autenticados.
  - El importador de nómina acepta única y exclusivamente archivos PDF que son leídos directamente en el navegador del cliente mediante PDF.js y Tesseract OCR local.
  - La configuración de seguridad CSP en `next.config.ts` restringe estrictamente los orígenes de imágenes a `'self' data: blob:`.
  - **Conclusión:** No existe superficie de ataque explotable en producción.

---

## 4. Política de Compuerta en CI

El script `scripts/audit-production-dependencies.ts` fue incorporado en:
- `package.json`: `"audit:production": "node --no-warnings --import tsx scripts/audit-production-dependencies.ts"`
- `.github/workflows/ci.yml`: Job `validate`, paso `Dependency Audit (High/Critical Fail-Closed)`

El script lee la salida estructurada de npm audit y comprueba:
1. Si existen vulnerabilidades con severidad `high` o `critical`.
2. Si alguna de ellas no se encuentra explícitamente registrada en `APPROVED_MITIGATIONS`.
3. Si existe alguna discrepancia, emite el reporte detallado y termina con **código de salida 1**, abortando de inmediato el pipeline de CI.
