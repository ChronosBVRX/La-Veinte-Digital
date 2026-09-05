# Arquitectura de La Veinte Digital

> **Documento de Arquitectura Canónica**  
> **Fecha de corte:** 2026-09-05 — Stable Baseline (`d90ab2bbc2f4b648cb8ed0bed1801902cb9976da`)  
> **Plataformas:** Web (Next.js 16), Android (Kotlin / Compose), iOS (Swift / SwiftUI), Desktop (Tauri / Vite)

---

## 1. Visión General del Sistema

La Veinte Digital es un ecosistema multiplataforma full-stack que sirve a la comunidad de trabajadores del IMSS agilizados por la Sección XX del SNTSS. El sistema proporciona herramientas laborales de alta precisión (cálculo de prestaciones, auditoría quincenal de tarjetones, generador de escritos fundamentados en el CCT, agenda laboral, simulador disciplinario) y producción automatizada de contenidos normativos.

---

## 2. Diagrama de Arquitectura Global

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENTES / PLATAFORMAS                                  │
│                                                                                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │   Navegador Web      │  │  App Android (APK)   │  │   App iOS (SwiftUI)          │  │
│  │  Chrome, Safari, PWA │  │  Kotlin + Compose    │  │   iOS 16+, WKWebView         │  │
│  │  Desktop & Mobile    │  │  Flavors: play/direct│  │   FaceID / Keychain          │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────────────┬───────────────┘  │
│             │                         │                             │                  │
│             │                         ▼                             ▼                  │
│             │             [Puente Nativo / Bridges]     [Puente Nativo WKUserScript]   │
│             │             - window.LaVeinteApp          - window.LaVeinteApp           │
│             │             - laveinte://bridge/*         - laveinte:// scheme           │
│             │             - laVeintePdfBridge (64KB)    - WKScriptMessageHandler       │
│             │                         │                             │                  │
│             └─────────────────────────┼─────────────────────────────┘                  │
│                                       ▼                                                │
│                 ┌───────────────────────────────────────────┐                          │
│                 │   Next.js 16.2.12 App Router (Turbopack)  │                          │
│                 │   - Proxy Middleware (src/proxy.ts)       │                          │
│                 │   - Server Components (RSC)               │                          │
│                 │   - Client Components (CSR - React 19.2.4)│                          │
│                 │   - Route Policy (route-policy.ts)        │                          │
│                 │   - 20 Rutas API Internas (REST)          │                          │
│                 └─────────────────────┬─────────────────────┘                          │
└───────────────────────────────────────┼────────────────────────────────────────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
┌─────────────────────────┐┌─────────────────────────┐┌─────────────────────────┐
│        Supabase         ││     Servicios IA Cloud   ││    Radio Studio Desktop │
│ - Auth (SSR PKCE)       ││ - OpenAI API:           ││ (apps/radio-studio)     │
│ - PostgreSQL 14.5       ││   gpt-4o-mini + ada-002 ││ - Tauri v2 + Sidecar     │
│ - Row Level Security    ││ - Groq API (Radio LLM): ││ - Groq-only Governance   │
│ - RPCs Transaccionales  ││   gpt-oss-120b / 20b    ││ - Speechify Cloud TTS    │
│ - Storage de Archivos   ││ - Speechify API (TTS):  ││ - ACE-Step 1.5 (DiT local│
│ - Realtime / Triggers   ││   simba-3.0 (5 voces)   ││   música en GPU GTX 1650)│
└─────────────────────────┘└─────────────────────────┘└─────────────────────────┘
```

---

## 3. Topología de Directorios y Fronteras

El código fuente sigue reglas de encapsulamiento estrictas declaradas en `AGENTS.md`:

```text
src/
├── app/                       # ÚNICAMENTE páginas (page.tsx), layouts y API routes
│   ├── (auth)/                # Rutas públicas (login, register, recuperar, callback)
│   ├── (dashboard)/           # Rutas privadas protegidas por proxy.ts
│   │   ├── guia/              # Análisis de Quincena y Guía del Tarjetón IMSS
│   │   ├── profile/           # Mi información laboral (subida canónica de tarjetones)
│   │   ├── calculadoras/      # Calculadoras de prestaciones laborales
│   │   ├── vacaciones/        # Asesor y planificador de vacaciones CCT
│   │   ├── escritos/          # Generador de escritos fundamentados
│   │   ├── documentos-personales/ # Visor universal de documentos
│   │   ├── simulador/         # Simulador interactivo de audiencias
│   │   ├── biblioteca-normativa/ # Explorador de leyes y CCT
│   │   ├── tarjeton/          # REDIRECT PERMANENTE -> /profile/mi-informacion-laboral
│   │   └── nomina/perfil/     # REDIRECT PERMANENTE -> /profile/mi-informacion-laboral
│   └── api/                   # 20 endpoints REST registrados en route-policy.ts
│
├── features/                  # Módulos de dominio aislados (prohibido importar cruzado)
│   ├── asistente/             # RAG de consultas normativas y acompañamiento
│   ├── calculadoras/          # 6 calculadoras laborales con contrato de prefill
│   ├── calendario/            # Catálogo de descansos obligatorios 2024-2030
│   ├── catalogo/              # Catálogo de adscripciones IMSS
│   ├── documentos-personales/ # Adaptadores de documentos y DocumentViewerModal
│   ├── escritos/              # Formularios, directorio oficial, generador PDF
│   ├── nomina/                # Motor de nómina, proyecciones, tabulador
│   ├── normativa/             # SQLite FTS5, búsqueda semántica y citas
│   ├── profile/               # Gestión de información laboral y perfil
│   ├── push/                  # Registro de tokens FCM y notificaciones
│   ├── simulador/             # Máquina de estados de audiencia disciplinaria
│   ├── simulador-nomina/      # Simulador en vivo con 4 escenarios de entrada
│   ├── tarjeton/              # Parsers puros, OCR vendor local, confirmación
│   ├── tarjeton-guia/         # Pipeline canónico de análisis y visualización
│   ├── transferir/            # Emparejamiento por QR y transferencia P2P
│   └── vacaciones/            # Motor de elegibilidad, roles y cálculo cuatrimestral
│
├── shared/                    # Código compartido por múltiples features
│   ├── components/ui/         # Primitivas UI obligatorias (Button, Input, Card, Modal)
│   ├── contracts/             # Contratos TypeScript entre módulos
│   ├── services/              # Almacenamiento local (localStorage, IndexedDB)
│   └── lib/                   # Utilidades puras y formateadores de moneda/fecha
│
├── lib/                       # INFRAESTRUCTURA (Supabase client/server y tipos)
└── proxy.ts                   # Auth middleware oficial (función proxy)
```

---

## 4. Flujos de Datos Canónicos

### 4.1. Tarjetón IMSS y Análisis Quincenal
1. **Entrada:** El trabajador sube su tarjetón PDF en `/profile/mi-informacion-laboral`.
2. **Extracción en cliente:** `PDF.js` extrae texto nativo. Si contiene menos de 120 caracteres legibles, se activa automáticamente `Tesseract.js` usando el modelo local `public/vendor/spa.traineddata.gz`.
3. **Parsing Geométrico:** `imss-concept-table-parser.ts` procesa columnas paralelas, discriminando percepciones y deducciones, calculando totales y cuadrando el neto exacto.
4. **Confirmación:** El usuario revisa en pantalla y pulsa confirmar. Se envía un payload estructurado a `POST /api/tarjeton/confirm` (el archivo PDF nunca sale del dispositivo).
5. **Persistencia Atómica:** La RPC `confirm_imported_payslip` inserta en `imported_payslips`, `imported_payslip_lines`, `imported_payslip_observations` y actualiza `payroll_contexts` en una sola transacción PostgreSQL.
6. **Caché Canónica:** El resultado se guarda en `la_veinte_payslip_analyses` en `localStorage` (indexado por SHA-256) y el PDF completo se guarda en `IndexedDB` (`tarjeton-blob-storage.ts`).
7. **Consumo en Guía:** `/guia` y `/guia/mi-quincena` leen el análisis canónico directamente sin re-procesar.

### 4.2. Prerrelleno Normativo de Calculadoras
1. La calculadora cliente solicita datos mediante `useCalculatorPrefill(calculatorId, date)`.
2. Invoca internamente `GET /api/calculator-prefill`.
3. El servicio del servidor (`build-calculator-prefill.ts`) consulta `profiles` y `payroll_contexts`, resuelve la categoría en el tabulador vigente y calcula la proyección salarial.
4. Aplica la lista cerrada de la política (`calculator-prefill-policy.ts`) y retorna solo los campos permitidos.
5. El hook cliente `usePrefillFields` rellena **exclusivamente campos vacíos**. Si el usuario editó un campo a mano, no se sobrescribe jamás.

### 4.3. Segunda de Julio / Fondo de Ahorro (Golden Behavior)
- Conforme al CCT de la Sección XX del SNTSS, la base de cálculo integra obligatoriamente:
  $$\text{Base Fondo Ahorro} = \text{Concepto 002 (Sueldo Base)} + \text{Concepto 011 (Ayuda para Renta)}$$
- Implementado en `src/features/calculators/lib/segundaJulio.ts` y `src/shared/lib/fondo-ahorro.ts`.
- Protegido contra regresiones por pruebas unitarias específicas en `src/features/calculators/__tests__/calculators.test.ts`.

### 4.4. Generación de Escritos y Compartir Nativo
1. En `/escritos`, el trabajador elige un destinatario oficial del directorio modal o captura un destinatario manual.
2. La IA asiste en la argumentación basada en cláusulas CCT.
3. Se genera un archivo PDF localmente en el navegador mediante `jspdf`.
4. El escrito se persiste en `IndexedDB`.
5. Si se ejecuta dentro del APK de Android o la app de iOS, `pdfShareBridge.ts` fragmenta el archivo en bloques de 64 KB Base64 con verificación de hash SHA-256 y lo entrega a través de `window.laVeintePdfBridge` para abrir el diálogo nativo de compartir (`Intent.ACTION_SEND` / `UIActivityViewController`).

### 4.5. Visor Unificado de Documentos
- Componente central: `DocumentViewerModal.tsx`.
- Desacoplado de la procedencia del documento:
  - Documentos nativos descargados por los portales oficiales en Android se recuperan vía `window.LaVeinteApp.readNativeDocument(localPath)`.
  - Recibos web y escritos se recuperan desde `IndexedDB`.
  - Documentos sincronizados en la nube se descargan desde Supabase Storage.
- Revocación automática de Object URLs en el desmontaje para evitar fugas de memoria.

---

## 5. Arquitectura de las Aplicaciones Nativas

### 5.1. Shell Android (`android-app/`)
- **Lenguaje y UI:** Kotlin 2.0.21 con Jetpack Compose (BOM 2024.09.03) y Material 3.
- **SDKs:** `compileSdk = 36`, `targetSdk = 36`, `minSdk = 29`. Java 17.
- **Flavors:**
  - `play`: Para publicación en Google Play. Sin actualizador OTA, sin permiso `REQUEST_INSTALL_PACKAGES`.
  - `direct`: Canal sideload para distribución directa. Incorpora `UpdateManager`, verificación SHA-256 de APK e instalación vía `PackageInstaller`.
- **WebView Persistente:** Carga `https://la-veinte-digital.vercel.app` con allowlist estricta de dominios autorizados.
- **Inyección del Bridge:** `LaVeinteBridgeInjector.kt` inyecta `window.LaVeinteApp` en el evento Document Start mediante `WebViewCompat.addDocumentStartJavaScript`, eliminando condiciones de carrera en la hidratación de Next.js.
- **Bóveda IMSS:** Cifrado seguro de credenciales con `AndroidKeyStore` (claves no exportables AES-256-GCM) y almacenamiento local en `Room DB` + `DataStore`.

### 5.2. Shell iOS (`ios-app/`)
- **Lenguaje y UI:** Swift 5.9 con SwiftUI.
- **Generador de Proyecto:** XcodeGen a través de `project.yml`, target de despliegue iOS 16.0+.
- **Bridge WKWebView:** Inyección de `window.LaVeinteApp` con `WKUserScript` y recepción de mensajes con `WKScriptMessageHandler` (`laveinte`).
- **Seguridad:** Autenticación biométrica con Face ID y Touch ID vía `LocalAuthentication`. Cifrado en Keychain de iOS con `CryptoKit`.
- **Sin Actualizador OTA:** Diferencia intencional respecto a Android sideload. Las actualizaciones de iOS se canalizan exclusivamente por App Store y TestFlight.

---

## 6. AI Radio Studio (`apps/radio-studio/`)

- Monorepo de escritorio gestionado con Tauri v2 y Vite.
- **Gobernanza Editorial Groq-Only:** Todo contenido editorial (escaletas, propuestas, guiones y reparaciones) es generado en producción exclusivamente por Groq (`GroqLLMProvider`) utilizando los modelos `openai/gpt-oss-120b` y `openai/gpt-oss-20b`. Si la clave de Groq no está disponible, el sistema lanza `GroqUnavailableError` y no degrada silenciosamente a modelos locales ni código determinista.
- **Voces:** Motor de síntesis Speechify simba-3.0 en la nube (casting fijo de 5 voces es-MX).
- **Música:** Motor local ACE-Step 1.5 en `tools/ACE-Step-1.5` con DiT turbo (`ACESTEP_COMPILE_MODEL=false` obligatorio para estabilidad en GTX 1650).

---

## 7. Arquitectura de Seguridad y Acceso

1. **Proxy Middleware (`src/proxy.ts`):** Evalúa cookies de sesión de Supabase en cada solicitud HTTP. Páginas no autenticadas son redirigidas a `/login`.
2. **Route Policy (`src/shared/server/routing/route-policy.ts`):** Lista blanca exhaustiva de rutas. Toda ruta que comience con `/api/` y no esté explícitamente listada devuelve `JSON 404`.
3. **Autorización Definitiva en Handlers:** Todo handler de API privada ejecuta `requireUser()` internamente. No confía exclusivamente en el middleware.
4. **Seguridad en Base de Datos:** RLS (Row Level Security) activo en todas las tablas de PostgreSQL en Supabase. Las operaciones compuestas son transaccionales mediante RPCs con `SECURITY DEFINER`.

---

## 8. Estrategia de Pruebas y CI/CD

El repositorio cuenta con una batería integral de verificación automatizada:

1. **TypeScript Check:** `npm run typecheck` (`tsc --noEmit`).
2. **Linter:** `npm run lint` (ESLint flat config con 0 errores permitidos).
3. **Pruebas Unitarias Web:** `npm test` (Vitest, 145 archivos de prueba, >1480 tests pasando).
4. **Pruebas de Integración:** `npm run test:integration` (Vitest con infraestructura de catálogo y LLM).
5. **Pruebas End-to-End (E2E):** `npm run e2e` / `npm run e2e:smoke` (Playwright con proyectos desktop, mobile y public).
6. **Pruebas Unitarias Android:** `./gradlew :app:testPlayDebugUnitTest :app:testDirectDebugUnitTest`.
7. **Verificación de Políticas de Distribución:** `./gradlew :app:validateDistributionPolicyPlayRelease :app:validateDistributionPolicyDirectRelease`.
8. **Compilación de Producción:** `npm run build` (Next.js Turbopack).
9. **Pipelines CI en GitHub Actions:**
   - `ci.yml`: Validación frontend completa (typecheck, lint, unit tests, build), comprobación RLS en Supabase y verificación de sintaxis Python.
   - `release-gate.yml`: Compuerta de producción para Android (AAB, APKs, lint release, compliance 16 KB page-size).
   - `android-build.yml` / `ios-build.yml`: Compilación de artefactos nativos.
