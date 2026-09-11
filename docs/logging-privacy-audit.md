# 🔒 Auditoría de Registro, Privacidad y Sanitización de Datos — La Veinte Digital

> **Fecha de auditoría:** 2026-09-10  
> **Ámbito:** `src/features/tarjeton/lib/sanitize-sensitive-fields.ts`, `src/features/tarjeton/services/confirm-tarjeton.ts`, `src/app/api/consulta/route.ts`, `next.config.ts`, `src/features/transferir/`  
> **Estado:** PRODUCCIÓN AUDITADA (Cero PII en logs, sanitización determinista)

---

## 1. Principios de Privacidad Inmutable

Conforme a las reglas de gobernanza del repositorio (`AGENTS.md`, Reglas 11 y 12):
1. **Tratamiento Local de Documentos**: Los archivos PDF de tarjetones IMSS se procesan **exclusivamente en el navegador** (PDF.js + Tesseract.js). **El PDF original nunca se envía al servidor.**
2. **Purga Previa de Datos Sensibles**: Antes de cualquier invocación RPC o API, el objeto estructurado es filtrado mediante `stripSensitiveFields`.
3. **Imposibilidad de Reversión**: El folio fiscal original se descarta y sólo se conserva `fiscalFolioHash` (SHA-256 criptográfico) con fines exclusivos de deduplicación e idempotencia.

---

## 2. Inventario de Campos Sensibles Purgados (`sanitize-sensitive-fields.ts`)

Los siguientes campos son identificados y eliminados de forma recursiva del payload antes de abandonar el navegador del usuario:

| Campo / Clave Sensible | Normalización Regex | Tratamiento en Cliente | Tratamiento en Servidor / DB |
| :--- | :--- | :---: | :---: |
| **RFC** (`rfc`, `norfc`) | Purgado de espacios/guiones | Eliminado del payload | Rechazado en RPC si intentara enviarse |
| **CURP** (`curp`) | Purgado de espacios/guiones | Eliminado del payload | Rechazado en RPC si intentara enviarse |
| **NSS** (`nss`) | Purgado de espacios/guiones | Eliminado del payload | Rechazado en RPC si intentara enviarse |
| **Cuenta Bancaria / CLABE** (`cuenta`, `cuentabancaria`, `bancaria`, `banco`) | Purgado de espacios/guiones | Eliminado del payload | No admitido en el esquema |
| **Folio Fiscal en Claro** (`foliofiscal`) | Purgado de espacios/guiones | Convertido a SHA-256 (`fiscalFolioHash`) y eliminado | Solo se almacena el hash SHA-256 de 64 caracteres |
| **Códigos QR y Sellos Digitales** (`qr`, `codigoqr`, `sello`, `sellodigital`, `cadenas`, `cadenaoriginal`) | Purgado de espacios/guiones | Eliminado del payload | No admitido en el esquema |

---

## 3. Auditoría de Registros de Consola y Servidor

### A. Endpoint `/api/tarjeton/confirm` (`confirm-tarjeton.ts`)
- **Registro de depuración técnica (`console.info`)**:
  - Exclusivamente registra: `requestId`, conteo de percepciones (`earnings`), conteo de deducciones (`deductions`), observaciones (`observations`), totales numéricos agrupados, método de extracción (`native_text` o `ocr`), nivel de confianza global (`globalConfidence`) y etiqueta del periodo quincenal (`1A-ENE-2026`).
  - **Garantía auditada**: Nombres, matrícula, RFC, CURP, cuentas bancarias y NSS nunca son incluidos en los logs del servidor.

### B. Asistente Virtual `/api/consulta` (`route.ts`)
- **Función de observabilidad (`logObservability`)**:
  - Exclusivamente registra métricas agregadas: `requestId`, `userId`, `commit`, backend RAG (`pgvector`), conteo de tokens de entrada/salida, tiempos de latencia milimétrica (`embMs`, `retMs`, `llmMs`) y proveedor LLM (`GroqLLMProvider`).
  - **Garantía auditada**: Las consultas del usuario, respuestas generadas y fragmentos de texto normativo citados no se imprimen en los logs de producción.

### C. Módulo de Transferencia de Documentos (`PrintSendPanel.tsx`)
- Se audited y sanitizó el flujo de lectura de códigos QR. El token efímero y el texto completo decodificado fueron removidos de las llamadas `console.log` para evitar la fuga de credenciales de transferencia en WebViews o consolas de depuración.

---

## 4. Supresión Automatizada de Logs en Producción (`next.config.ts`)

Se incorporó la optimización de compilador:

```ts
compiler: {
  removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
}
```

- En el entorno de producción (`NODE_ENV === "production"`), el compilador de Next.js elimina automáticamente todas las invocaciones `console.log` y `console.info` de los paquetes empaquetados para el cliente.
- Únicamente `console.error` y `console.warn` se conservan para diagnósticos críticos de fallas no recuperables, garantizando una superficie de divulgación nula.
