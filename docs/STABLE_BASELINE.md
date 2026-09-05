# STABLE BASELINE — LA VEINTE DIGITAL

> **Documento Canónico de Gobernanza y Preservación Funcional**  
> **Fecha de declaración documental:** 2026-09-05  
> **Estado del repositorio:** Baseline Funcional Estable Aceptado  
> **Política:** Preservación estricta del comportamiento existente. Cero regresiones no autorizadas.

---

## 1. Declaración Formal del Baseline

```text
Repositorio:                     ChronosBVRX/La-Veinte-Digital
Rama:                            main
Stable baseline commit:          d90ab2bbc2f4b648cb8ed0bed1801902cb9976da
Tree SHA:                        267ea495aa773f01410759478ed412c174413f3c
Fecha de declaración:            2026-09-05
Working tree inicial observado:  Limpio (git status --short vacío)
```

> [!IMPORTANT]
> **Definición de "Stable":**  
> **Stable NO significa "libre de cualquier defecto".**  
> **Stable significa "estado funcional aceptado cuya conducta existente se preserva hasta que un cambio sea expresamente autorizado".**

A partir de este commit, el proyecto concluye formalmente su etapa de reconstrucción y entra en la fase permanente de **ESTABILIZACIÓN + PULIDO INCREMENTAL**. Todo comportamiento existente en este baseline debe considerarse **comportamiento protegido** y no puede eliminarse, cambiarse, simplificarse, sustituirse o degradarse salvo autorización explícita del usuario.

---

## 2. Stack Tecnológico del Baseline

| Capa / Componente | Tecnología | Versión Observada | Notas de Arquitectura |
|-------------------|------------|-------------------|-----------------------|
| Framework Web | Next.js (App Router, Turbopack) | `16.2.12` | Middleware en `src/proxy.ts` (función `proxy`). ESLint flat config (`eslint.config.mjs`). |
| Biblioteca UI | React | `19.2.4` | Componentes cliente (`"use client"`) y servidor (RSC). Formularios con `useActionState`. |
| Lenguaje Principal | TypeScript | `^5` | Resolución `bundler`. Typecheck estricto vía `npm run typecheck`. |
| Estilos | CSS Variables + Inline Styles | N/A | Variables `--bg`, `--fg`, `--primary`, `--card`, `--accent` en `globals.css`. **Tailwind NO se usa en componentes**. |
| Pruebas Unitarias / Integración | Vitest | `^4.1.10` | 145 suites de pruebas, 1,488 tests pasando. Configuración unitaria e integración (`vitest.integration.config.ts`). |
| Pruebas End-to-End | Playwright | `^1.62.1` | Proyectos: `chromium-desktop`, `chromium-mobile`, `firefox-desktop`, `chromium-public`, `setup`. |
| Base de Datos & Auth | Supabase SSR / Supabase JS | `@supabase/ssr ^0.12.3`, `@supabase/supabase-js ^2.111.0` | PostgreSQL 14.5, Auth SSR con cookies PKCE, RLS habilitado en todas las tablas públicas, RPCs transaccionales. |
| Extracción Tarjetón | PDF.js + Tesseract OCR | `pdfjs-dist 6.1.200`, `tesseract.js 7.0.0` | **100% en el cliente (navegador)**. Binarios en `public/vendor/` generados por `scripts/copy-vendor.mjs`. |
| Shell Nativo Android | Kotlin / Jetpack Compose | Kotlin `2.0.21`, AGP `8.10.0`, Compose BOM `2024.09.03` | `compileSdk 36`, `targetSdk 36`, `minSdk 29`, `versionCode 203`, `versionName 1.1.3`. Java 17. Room 2.6.1, DataStore 1.1.1, Biometric 1.1.0. |
| Shell Nativo iOS | Swift / SwiftUI | Swift `5.9`, iOS `16.0+` | Generador XcodeGen (`ios-app/project.yml`), bundle ID `com.laveintedigital.app`, WKWebView persistente, LocalAuthentication. |
| Estudio de Audio / Desktop | Tauri / Vite / React | Tauri v2, Vite, Node.js | `apps/radio-studio` (monorepo). Sidecar HTTP en puerto `3977`. |
| Proveedor LLM Estudio | Groq API | `GroqLLMProvider` | Modelos: `openai/gpt-oss-120b` (writer), `openai/gpt-oss-20b` (fast). Gobernanza editorial Groq-only en producción. |
| Motor TTS Estudio | Speechify API | Simba-3.0 (`es-MX`) | Voces: Eduardo, Andrea, Javier, Rodrigo, Valeria. Caché por bloque y worker desacoplado. |
| Música Local Estudio | ACE-Step 1.5 | `tools/ACE-Step-1.5` | DiT `acestep-v15-turbo`, API HTTP en `127.0.0.1:8001`. `ACESTEP_COMPILE_MODEL=false`. |
| Notificaciones Push | Firebase Admin / FCM | `firebase-admin ^13.10.0` | Registro en `/api/push/register`, envío seguro desde servidor. |

---

## 3. Aplicaciones y Plataformas Existentes

El repositorio no es un simple sitio web: es un ecosistema multiplataforma coordinado:

1. **Plataforma Web (Next.js 16 App Router)**:
   - Directorio: `src/`
   - Dominio productivo: `https://la-veinte-digital.vercel.app`
   - Rutas públicas y privadas protegidas por `src/proxy.ts`
   - Clasificación de API routes exhaustiva y estricta en `src/shared/server/routing/route-policy.ts` (rutas no listadas devuelven JSON 404).

2. **Aplicación Nativa Android (`android-app/`)**:
   - Shell nativo Kotlin + Jetpack Compose que embebe la aplicación web en un `WebView` de alto rendimiento.
   - Flavors de compilación:
     - `play`: Cumple 100% políticas de Google Play Store (`SELF_UPDATE_ENABLED=false`, sin `REQUEST_INSTALL_PACKAGES`, sin actualizador automático).
     - `direct`: Canal sideload con actualizador OTA integrado (`SELF_UPDATE_ENABLED=true`, `UpdateManager`, `ApkInstaller`).
   - Bóveda de credenciales IMSS cifrada con `AndroidKeyStore` (AES-256-GCM) + Room DB.
   - Descarga automatizada de tarjetones y registros biométricos desde portales IMSS (Tu Perfil y Tarjetón Digital).
   - Inyección de puente JavaScript en documento de inicio (`WebViewCompat.addDocumentStartJavaScript`).

3. **Aplicación Nativa iOS (`ios-app/`)**:
   - Shell nativo SwiftUI generado con XcodeGen (`ios-app/project.yml`), target iOS 16.0+.
   - Embebe la aplicación web mediante `WKWebView` persistente.
   - Inyección de puente `window.LaVeinteApp` vía `WKUserScript` y recepción de mensajes con `WKScriptMessageHandler` (nombre `laveinte`).
   - Autenticación biométrica con Face ID / Touch ID vía `LocalAuthentication`.
   - Cifrado seguro de credenciales con Keychain + CryptoKit (AES-GCM).
   - Sin actualizador OTA (diferencia intencional respecto a Android sideload; actualizaciones por App Store).

4. **AI Radio Studio (`apps/radio-studio/`)**:
   - Aplicación de escritorio multiplataforma empaquetada con Tauri.
   - Producción automatizada de radio y podcasts laborales para la Sección XX del SNTSS.
   - Generación de guiones normativos basada estrictamente en Evidence Pack (normativa verificada).
   - Gobernanza editorial Groq-only sin degradación silenciosa.

---

## 4. Módulos Funcionales del Baseline

Todos los módulos listados a continuación se encuentran actualmente funcionales y protegidos:

### 4.1. Autenticación y Cuentas
- Autenticación SSR con cookies PKCE vía Supabase.
- Rutas públicas: `/login`, `/register`, `/recuperar-password`, `/restablecer-password`, `/callback`.
- Flujo de eliminación de cuenta GDPR/Store compliant: `/eliminar-cuenta` con RPC `delete_my_account()`.
- Proxy de seguridad `src/proxy.ts` que valida cookies de sesión en cada request antes de renderizar rutas protegidas.

### 4.2. Guía del Tarjetón y Tarjetón IMSS
- **Página principal de análisis:** `/guia`, `/guia/mi-quincena`, `/guia/tarjeton`.
- **Carga de tarjetón:** `/profile/mi-informacion-laboral` (sección "Subir tarjetón IMSS"). Rutas históricas `/tarjeton` y `/nomina/perfil` son redirecciones permanentes a `/profile/mi-informacion-laboral`.
- **Extracción cliente-side:** Pure functions en `src/features/tarjeton/lib/` que procesan PDF.js en el navegador. Ningún PDF de tarjetón se sube jamás al servidor.
- **Tolerancia y balance geométrico:** Parser geométrico de columnas paralelas que soporta conceptos CFDI gravados y exentos, con balance exacto $Total Percepciones - Total Deducciones = Neto$.
- **Almacén canónico de análisis:** `la_veinte_payslip_analyses` en localStorage, versionado por hash inmutable del documento y versión del parser (`CURRENT_PARSER_VERSION = "2026.09.v1"`).
- **Repositorio unificado de documentos guardados:** `saved-payslip-repository.ts` consulta tanto Room DB nativa en Android (`window.LaVeinteApp.listNativeDocuments()`) como IndexedDB en web (`tarjeton-blob-storage.ts`).
- **Persistencia en Supabase:** Endpoint `POST /api/tarjeton/confirm` invoca la RPC transaccional `confirm_imported_payslip` para guardar cabecera, líneas, observaciones y actualizar `payroll_contexts`.

### 4.3. Calculadoras Laborales IMSS
- Ubicación: `/calculadoras` (Aguinaldo, Cláusula 97, Préstamos, Segunda de Julio, Segunda de Julio Proporcional, Tiempo Extra).
- **Prerrelleno normativo:** `useCalculatorPrefill` consume `GET /api/calculator-prefill` sin importar lógica de `nomina` directamente en los componentes cliente. Aplica política cerrada por calculadora.
- **GOLDEN BEHAVIOR PROTEGIDO — Segunda de Julio / Fondo de Ahorro:**
  - La fórmula del Fondo de Ahorro incorpora **Concepto 011** (Ayuda para Renta) además del **Concepto 002** (Sueldo Base), conforme al CCT vigente de la Sección XX del SNTSS.
  - Implementación en `src/features/calculators/lib/segundaJulio.ts` y `src/shared/lib/fondo-ahorro.ts`.
  - **Pruebas de regresión que lo protegen:**
    - `src/features/calculators/__tests__/calculators.test.ts`
    - `src/features/nomina/__tests__/calculator-prefill.test.ts`
  - **PROHIBIDO:** Volver a una fórmula que sólo compute el Concepto 002.

### 4.4. Vacaciones y Calendario Anual
- Ubicación: `/vacaciones`.
- Separación estricta entre **elegibilidad** (antigüedad, derecho generado) y **certeza de calendario**.
- Incorporación de marcas reales de asistencia y separación de conceptos de continuidad.
- Bloqueo de selección de roles por fecha de generación del derecho.
- Enlace dinámico con fecha de vencimiento extraída del tarjetón (formato DDMMYYYY persistido como ISO YYYY-MM-DD y formateado como DD/MM/YYYY).
- Cálculo cuatrimestral de conceptos 029 y 048 conforme al Anexo 1 del Procedimiento 1A74-003-025.
- Asesor económico y planificación anual 2026-2027.

### 4.5. Generador de Escritos Laborales (PSD)
- Ubicación: `/escritos`.
- Directorio oficial de destinatarios de la Sección XX interactivo en modal (`DestinatarioResumen.tsx`, `EscritosForm.tsx`).
- Soporte alterno intacto para captura de destinatario en modo manual.
- Asistencia por IA para redacción y fundamentación basada en cláusulas CCT.
- Exportación directa a PDF vía `jspdf` y renderizado tipográfico profesional.
- Persistencia local en IndexedDB y migración transparente de claves históricas (`escritos_guardados`).
- Compatibilidad completa con puente nativo para compartir vía selector del sistema (`shareNativeDocument` / `share`).

### 4.6. Documentos Personales y Visor Unificado
- Ubicación: `/documentos-personales`.
- Componente `DocumentViewerModal.tsx` con soporte universal para:
  - Documentos nativos descargados por Android (`source: "native"` vía `readNativeDocument(localPath)`).
  - Recibos y escritos web almacenados en IndexedDB (`source: "indexeddb"` vía `getTarjetonPdfBlob(key)` o blob adapter).
  - Documentos remotos Supabase (`source: "supabase"`).
- Controles de zoom, rotación, descarga, impresión y compartición.
- Gestión segura del ciclo de vida de Object URLs (`URL.revokeObjectURL`) protegida por pruebas en `viewer-object-url-lifecycle.test.tsx`.

### 4.7. Asistente IA (Chatbot SNTSS)
- Ubicación: `/asistente`, endpoint `POST /api/consulta`.
- Motor RAG con reranking y priorización normativa por intención de consulta (`src/features/asistente/lib/retrieval-sources.ts`).
- Guardrails estrictos de citas: La IA nunca inventa cláusulas; toda afirmación debe remitir a fuentes documentales del corpus.
- Backend primario Next.js + OpenAI (`gpt-4o-mini` / `text-embedding-ada-002`) con soporte para backend secundario Python FastAPI si está configurado.

### 4.8. Simulador de Audiencias Disciplinarias
- Ubicación: `/simulador`, endpoint `POST /api/simulador`.
- Escenarios: Faltas injustificadas, presunto maltrato, incumplimiento de funciones, extravío de insumos, retardos frecuentes, violación de confidencialidad.
- Integración en vivo con modelo `qwen3.8-27b` con capping de contexto, preservación de borrador, temporizador con máquina de estados y análisis post-audiencia.

### 4.9. Biblioteca Normativa
- Ubicación: `/biblioteca-normativa`, CLI `npm run normativa:*`.
- Catálogo SQLite FTS5 en `data/normativa/catalog.sqlite`.
- Corpus oficial con 82 fuentes en `resources/normativa/bootstrap-sources.yaml`, 88 documentos locales con SHA-256 inmutable, 94 versiones verificadas, 22,270 chunks y 22,270 citas estructuradas.
- Contrato Colectivo de Trabajo 2025-2027 (vigente hasta 2027-10-15). Tabulador Base vigente (expira 2026-10-15). Estatutos SNTSS edición octubre 2022. Leyes de la Cámara de Diputados (LFT, LSS, INFONAVIT, etc.) y NOMs vigentes en PLATIICA.

### 4.10. AI Radio Studio
- Ubicación: `apps/radio-studio/`.
- Monorepo con `@la-veinte/radio-core` y `@la-veinte/tts-core`.
- Sidecar HTTP en puerto `3977`.
- Generación de guiones gobernada exclusivamente por Groq (`GroqLLMProvider`), sin degradación silenciosa a local o determinista.
- Síntesis de voz con Speechify simba-3.0 (casting determinista de 5 voces es-MX).
- Generación musical con ACE-Step 1.5 local (GTX 1650 Tier 1, `ACESTEP_COMPILE_MODEL=false`).
- Empaquetado ejecutable con Tauri v2 y MinGW en Windows.

---

## 5. Fuentes de Verdad (Sources of Truth)

Para evitar que agentes futuros confundan capas de caché o compatibilidad con fuentes primarias, se establece la jerarquía oficial:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FUENTES DE VERDAD PRIMARIAS                     │
├──────────────────────────┬─────────────────────────────────────────────┤
│ Dominio                  │ Fuente Canónica                             │
├──────────────────────────┼─────────────────────────────────────────────┤
│ Datos de Usuario & Auth  │ Supabase Auth (`auth.users`) + `profiles`   │
│ Contexto Laboral Remoto  │ Supabase `payroll_contexts`                 │
│ Tarjetón PDF Original    │ Documento PDF local (Room DB o IndexedDB)   │
│ Análisis de Tarjetón     │ `la_veinte_payslip_analyses` (localStorage) │
│ Perfil Laboral Local     │ `nomina_profile` (localStorage)             │
│ Documentos Escritos      │ IndexedDB (`la-veinte-blobs`) + `escritos`  │
│ Normativa y CCT          │ `data/normativa/catalog.sqlite`             │
│ Credenciales IMSS        │ AndroidKeyStore + DataStore / iOS Keychain  │
│ Configuración de Rutas   │ `src/shared/server/routing/route-policy.ts` │
└──────────────────────────┴─────────────────────────────────────────────┘
```

### Clasificación de Datos en el Sistema

1. **SOURCE OF TRUTH**:
   - Documento PDF original importado o descargado.
   - Registro en Supabase `profiles` y `payroll_contexts` tras confirmación autorizada.
   - Manifiesto `resources/normativa/bootstrap-sources.yaml` y catálogo SQLite local.
   - Bóveda nativa de credenciales IMSS en el dispositivo del usuario.

2. **CACHE**:
   - `nomina_profile` en localStorage (hidrata interfaces antes de consultar la red).
   - `la_veinte_payslip_analyses` en localStorage (evita re-analizar PDFs ya procesados).
   - Chunks de audio sintetizados en `data/tts/cache/`.

3. **DERIVED DATA**:
   - Prerrelleno de calculadoras (`/api/calculator-prefill` computa salarios basados en `profiles` + `payroll_contexts` + tabulador).
   - Proyecciones de nómina (`nomina_projections` en localStorage).
   - Fórmulas de liquidación o vacaciones generadas dinámicamente.

4. **FALLBACK / COMPATIBILITY LAYER**:
   - Detección de plataforma por User-Agent cuando el bridge nativo `window.LaVeinteApp` aún no ha terminado de inyectarse.
   - Redirecciones `/tarjeton` y `/nomina/perfil` hacia `/profile/mi-informacion-laboral`.
   - Recuperación de claves históricas de escritos en localStorage (`escritos_guardados`).

---

## 6. Contratos de Compatibilidad Críticos

### 6.1. Contrato Web ↔ Nativo (`window.LaVeinteApp`)
Definido en `src/types/global.d.ts` e inyectado por `android-app` (`LaVeinteBridgeInjector.kt`) e `ios-app` (`LaVeinteBridge.swift`):

- **Métodos obligatorios:**
  - `isNativeApp(): boolean`
  - `appPlatform(): "android" | "ios"`
  - `appVersion(): string`
  - `sdkVersion(): number`
  - `packageName(): string`
  - `hasBiometrics(): boolean`
  - `isBiometricsEnabled(): boolean`
  - `openExternal(url: string): void`
  - `pickPdf(acceptHint?: string): void`
  - `share(title?: string, text?: string): void`
  - `haptic(): void`
  - `log(message: string): void`
  - `onAuthenticated(): void`
  - `onLoggedOut(): void`
  - `openOfficialPayslips(): void`
  - `openBiometrics(): void`
  - `hasImssCredentials(portalId: string): boolean`
  - `checkForUpdate(): void`
  - `requestCameraPermission(): Promise<{ granted: boolean; permanentlyDenied?: boolean }>`
  - `requestNotificationsPermission(): void`
  - `listNativeDocuments(): Promise<NativeDocumentMeta[]>`
  - `readNativeDocument(localPath: string): Promise<NativeDocumentContent | null>`
  - `deleteNativeDocument(localPath: string): Promise<boolean>`
  - `deleteNativeDocumentById(documentId: number, expectedLocalPath?: string): Promise<{ ok: boolean; reason?: string }>`
  - `getFcmToken(): Promise<{ token: string }>`
  - `getPendingPrintDoc(): Promise<{ localPath: string } | null>`
  - `clearPendingPrintDoc(): void`
  - `shareNativeDocument(localPath: string, title?: string): void`
  - `sendPdfShareMessage(msg: string | Record<string, unknown>): boolean`
  - `openAppSettings(): void`
- **Evento de inicialización:** `laveinte:native-ready` disparado en `window`.
- **Canal de retorno asíncrono:** `window.__laveinteBridgeResult(reqId, payload)`.
- **Canal de PDF fragmentado:** `window.laVeintePdfBridge` con bloques de 64 KB y validación SHA-256.

### 6.2. Contrato de Persistencia Local (Storage Keys)
**PROHIBIDO RENOMBRAR O ELIMINAR SIN MIGRACIÓN:**
- `nomina_profile`: Perfil laboral del trabajador.
- `nomina_payslips`: Recibos de pago en caché local.
- `nomina_projections`: Proyecciones calculadas.
- `nomina_consent`: Estado del consentimiento legal.
- `la_veinte_payslip_analyses`: Almacén indexado de análisis de tarjetón por hash.
- `escritos_guardados` / `escritos_guardados_migrated_to`: Escritos y su tracking de migración.

### 6.3. Contrato de Rutas y Route Policy
Todas las rutas de API deben estar clasificadas en `src/shared/server/routing/route-policy.ts`. Toda ruta no registrada responde `JSON 404` por diseño de seguridad.

---

## 7. Pruebas como Especificación Ejecutable

Las suites de prueba existentes constituyen la **especificación ejecutable del sistema**. Un agente futuro tiene estrictamente prohibido:
- Eliminar una prueba porque falla tras un cambio de código.
- Debilitar aserciones o relajar márgenes de tolerancia sin autorización.
- Modificar fixtures de tarjetón o casos golden normativos.
- Comentar (`//`) o saltar (`test.skip`) pruebas para forzar builds verdes.

**Un test que deja de pasar es una regresión hasta demostrar lo contrario.**

---

## 8. Funcionalidades que NO están muertas

Un agente futuro no debe asumir que las siguientes piezas están en desuso:
1. **Redirecciones `/tarjeton` y `/nomina/perfil`**: Preservan bookmarks externos y enlaces internos.
2. **Puentes nativos con promesas y callbacks (`laveinte://bridge/*`)**: Son el canal activo de comunicación con Android.
3. **Flavors `play` y `direct` en Android**: Representan los dos canales oficiales de distribución.
4. **Almacenamiento en IndexedDB de blobs de tarjetón**: Es la persistencia local primaria en navegadores web.
5. **OCR de respaldo con Tesseract.js**: Entra en acción de forma transparente cuando el PDF del tarjetón es una imagen escaneada con menos de 120 caracteres de texto nativo.
6. **Integración con portales oficiales IMSS**: Automatización nativa de Tu Perfil y Tarjetón Digital para la descarga directa de recibos por los trabajadores.
