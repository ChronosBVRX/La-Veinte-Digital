# REGRESSION GUARDRAILS — LA VEINTE DIGITAL

> **Matriz Canónica de Comportamientos Protegidos, Contratos, Pruebas y Riesgos**  
> **Fecha de corte:** 2026-09-05  
> **Baseline protegido:** `d90ab2bbc2f4b648cb8ed0bed1801902cb9976da`  
> **Regla de oro:** Cero regresiones no autorizadas. Un test existente es una especificación ejecutable.

---

## 1. Matriz de Comportamientos Protegidos

| Dominio | Comportamiento protegido | Fuente de verdad | Implementación | Dependencias | Prueba automática | Smoke manual | Riesgo |
|---|---|---|---|---|---|---|---|
| **Autenticación** | Sesión persistente con cookies PKCE SSR, protección de rutas privadas, redirección a `/login`. | Supabase Auth (`auth.users`) | `src/proxy.ts`, `src/app/(auth)/*`, `src/lib/services/auth.ts` | `@supabase/ssr`, cookies de navegación | `src/features/account/__tests__/` (Unit), `e2e/smoke/auth-authenticated.spec.ts`, `e2e/smoke/auth-public.spec.ts` | Iniciar sesión, recargar `/profile`, verificar persistencia y logout | Crítico |
| **Cuenta / GDPR** | Eliminación completa de cuenta y datos del usuario vía RPC atómica `delete_my_account()`. | Supabase `profiles` + `auth.users` | `/eliminar-cuenta`, `deleteAccountAction` | RPC `delete_my_account()`, `profiles` | `AUTOMATED COVERAGE GAP` (test E2E destructive reservado para staging) | Visitar `/eliminar-cuenta`, verificar confirmación modal y re-autenticación | Alto |
| **Perfil Laboral** | Persistencia de categoría, adscripción, jornada y matrícula. Sincronización entre local y Supabase. | Supabase `profiles` + `payroll_contexts` | `src/features/profile/*`, `src/shared/services/local-storage.ts` | `/api/worker-context`, RPC `confirm_manual_worker_profile` | `src/shared/server/worker-profile/__tests__/`, `src/features/profile/__tests__/`, `e2e/smoke/profile.spec.ts` | Modificar categoría en `/profile/mi-informacion-laboral`, verificar guardado | Alto |
| **Tarjetón IMSS (Extracción)** | Extracción 100% cliente de PDF (texto nativo PDF.js o Tesseract OCR). Ningún archivo sensible se sube al server. | PDF original en memoria cliente | `src/features/tarjeton/lib/*`, `src/features/tarjeton/hooks/useTarjetonImporter.ts` | `pdfjs-dist`, `tesseract.js` | `src/features/tarjeton/__tests__/tarjeton-parsers.test.ts`, `src/features/tarjeton/__tests__/ocr-detection.test.ts` | Subir PDF de tarjetón en `/profile/mi-informacion-laboral`, validar lectura sin error de red | Crítico |
| **Tarjetón IMSS (Balance)** | Parser geométrico de columnas paralelas con soporte CFDI gravado/exento y tolerancia de códigos sin romper balance $P - D = N$. | PDF original analizado | `src/features/tarjeton/lib/imss-concept-table-parser.ts`, `imss-layout-regions.ts` | Contrato `src/shared/contracts/payslip-concept.ts` | `src/features/tarjeton-guia/__tests__/payslip-concepts-tolerance.test.ts`, `src/features/tarjeton-guia/__tests__/canonical-analysis-lifecycle.test.ts` | Verificar que un recibo con conceptos no catalogados cuadre centavo a centavo | Crítico |
| **Tarjetón IMSS (Vencimiento)** | Extracción de fecha "POR VENCER" en formato DDMMYYYY, persistencia en ISO YYYY-MM-DD y display DD/MM/YYYY. | Texto PDF del tarjetón | `src/features/tarjeton/lib/imss-concept-table-parser.ts`, `src/features/vacations/lib/*` | Contrato `ConfirmTarjetonRequest` | `src/features/vacations/__tests__/tarjeton-simulator-integration.test.ts`, commit `0ca2295` | Cargar tarjetón con vencimiento `15082026`, verificar fecha `15/08/2026` en pantalla | Alto |
| **Guía del Tarjetón** | Documento guardado como fuente canónica; auto-sincronización de conceptos quincenales sin re-analizar si el hash coincide. | `la_veinte_payslip_analyses` en localStorage | `src/features/tarjeton-guia/components/GuiaHome.tsx`, `MiQuincenaPage.tsx` | `saved-payslip-repository.ts`, `payslip-analysis-store.ts` | `src/features/tarjeton-guia/__tests__/saved-document-pipeline.test.ts`, `e2e/guia.spec.ts` | Navegar a `/guia`, revisar desglose quincenal, verificar botón reintentar análisis | Alto |
| **Calculadoras (Prefill)** | Prerrelleno normativo aislado sin importar lógica de nómina directamente en las calculadoras (política cerrada). | Supabase `profiles` + `payroll_contexts` | `src/features/calculators/hooks/useCalculatorPrefill.ts`, `/api/calculator-prefill` | Contrato `src/shared/contracts/calculator-prefill.ts` | `src/features/nomina/__tests__/calculator-prefill.test.ts`, `src/features/calculators/__tests__/calculators.test.ts` | Abrir calculadora de Aguinaldo, comprobar que carga sueldo sugerido sin reescribir si ya está editado | Alto |
| **Calculadoras (2ª Julio / Fondo)** | **GOLDEN BEHAVIOR:** Integración estricta de Concepto 011 (Ayuda para Renta) + Concepto 002 (Sueldo Base) conforme al CCT. | CCT Sección XX SNTSS | `src/features/calculators/lib/segundaJulio.ts`, `src/shared/lib/fondo-ahorro.ts` | Componentes `SegundaJulioCalculator`, `SegundaJulioProporcionalCalculator` | `src/features/calculators/__tests__/calculators.test.ts` (líneas 120-195), `src/features/nomina/__tests__/calculator-prefill.test.ts` | Abrir 2ª de Julio, ingresar 002 y 011; verificar que la suma base integra ambos conceptos | Crítico |
| **Vacaciones (Elegibilidad)** | Separación de elegibilidad por antigüedad de la certeza de calendario; bloqueo de selección de rol si derecho no generado. | `vacation_profile_data`, `payroll_contexts` | `src/features/vacations/lib/*`, `VacationWizard.tsx` | Contratos de vacaciones | `src/features/vacations/__tests__/advisor-and-roles.test.ts`, `src/features/vacations/__tests__/cuatrimestral-radiation-calc.test.ts` | Iniciar asistente vacacional con menos de 6 meses; verificar advertencia de elegibilidad | Crítico |
| **Vacaciones (Cuatrimestral)** | Cálculo cuatrimestral 029 y 048 según Anexo 1 Procedimiento 1A74-003-025 para personal en áreas de radiaciones/riesgo. | Procedimiento IMSS 1A74-003-025 | `src/features/vacations/lib/cuatrimestral-radiation-calc.ts` | Motor de vacaciones | `src/features/vacations/__tests__/cuatrimestral-radiation-calc.test.ts` | Seleccionar perfil con riesgo radiológico y simular periodo cuatrimestral | Alto |
| **Agenda Laboral (Mobile)** | Clamp responsive y wrapping sin desbordamiento horizontal en viewports estrechos (320, 360, 393, 412 px). | Estado local + agenda | `src/features/agenda-laboral/components/AgendaCard.tsx`, `AgendaManagerPanel.tsx` | CSS variables clamp | `src/features/agenda-laboral/__tests__/agenda-mobile-overflow.test.tsx` | Inspeccionar en DevTools a 320px ancho; verificar ausencia de scroll horizontal | Medio |
| **Barra Informativa Móvil** | La navegación móvil principal vive en el drawer lateral; la superficie inferior aloja `MobileValueBar` (informativa, un mensaje, CTA a rutas reales, dismiss por sesión). Sin bottom nav redundante, sin capa Back nueva, sin loader propio. | Catálogo local + `sessionStorage` | `src/shared/components/app/MobileValueBar.tsx`, `mobileValueItems.ts`, `DashboardShell.tsx` | `--mobile-value-bar-height`, `.keyboard-open`, `mobile-only` | `mobile-value-bar.test.tsx`, `dashboard-shell.test.tsx`, E2E `navigation.spec.ts` (móvil) | En móvil: ver consejo + CTA funcional; abrir drawer y navegar; pulsar Back con drawer abierto (cierra drawer); abrir teclado (barra oculta) | Medio |
| **Generador de Escritos** | Directorio oficial interactivo en modal + alternativa de captura manual de destinatario. Exportación PDF y compartir. | `directorio-destinatarios.ts` + input usuario | `src/features/escritos/components/EscritosForm.tsx`, `DestinatarioResumen.tsx` | `jspdf`, `pdfShareBridge.ts` | `src/features/escritos/__tests__/escritos-recipient-flow.test.tsx`, `e2e/full/escritos-generator.spec.ts` | Crear escrito eligiendo destinatario del directorio, luego probar cambio a manual y exportar PDF | Alto |
| **Visor Unificado** | Visor modal universal (`DocumentViewerModal`) para PDFs e imágenes desde Android Room DB, IndexedDB o Supabase. | Objeto documental con fuente | `src/features/documentos-personales/components/DocumentViewerModal.tsx` | `document-viewer-adapter.ts`, Object URLs | `src/features/documentos-personales/__tests__/unified-viewer.test.tsx`, `viewer-object-url-lifecycle.test.tsx` | Abrir un tarjetón y un escrito guardado; verificar renderizado, zoom y cierre sin leaks de memoria | Alto |
| **Documentos Personales** | Convivencia simultánea de documentos nativos Android y documentos web en la misma lista unificada. | Room DB nativa + IndexedDB web | `src/features/documentos-personales/components/DocumentosPersonales.tsx` | `window.LaVeinteApp.listNativeDocuments`, `tarjeton-blob-storage.ts` | `src/features/documentos-personales/__tests__/documentos-personales.test.tsx` | En Android, listar documentos descargados por portal junto a PDFs web | Alto |
| **Transferir Dispositivo** | Emparejamiento por código QR o token, subida y descarga de archivos temporales mediante Supabase Storage/RPC. | Sesión de transferencia activa | `src/features/transferir/*`, `/transfer` | RPCs `transfer_*`, Web Crypto API | `src/features/transferir/__tests__/transfer.test.ts`, `camera-gate.test.ts` | Escanear QR en `/transfer`, emparejar dos navegadores y transferir un archivo | Medio |
| **Puente Android (Bridge Activo)** | Inyección en document-start de `window.LaVeinteApp`, callbacks asíncronos vía `__laveinteBridgeResult` y URIs `laveinte://bridge/*`. | Código fuente Kotlin | `LaVeinteBridgeInjector.kt`, `InternalWebScreen.kt` | AndroidX WebKit | `src/features/transferir/__tests__/native-bridge.test.ts`, `testPlayDebugUnitTest` | Abrir app Android y validar que `window.LaVeinteApp.isNativeApp()` sea `true` inmediatamente | Crítico |
| **Feedback Nativo Navegación** | Overlay nativo post-splash en navegaciones internas Android (show-delay 180ms, min-visible 300ms, slow 2500ms, watchdog SPA 12s). No afecta web normal, Back canónico PR #66, bridges, WebView persistente ni flavors. | Señales WebView (`onPageStarted/Finished`) + detector SPA document-start | `internal/navigation/*`, cableado mínimo en `InternalWebScreen.kt` | `NavFeedbackControllerTest`, `NavFeedbackEventsTest`, `NavFeedbackDetectorTest` (`testPlayDebugUnitTest`) | Navegar Home→Calculadoras con throttling: overlay + slow + fade; abrir modal y pulsar Back sin loader | Medio |
| **Compartir PDF Nativo** | Protocolo fragmentado en chunks de 64 KB Base64 con verificación SHA-256 para enviar PDFs al selector Android/iOS. | Buffer de PDF local | `src/shared/services/pdfShareBridge.ts`, `LaVeinteBridgeInjector.kt` | `window.laVeintePdfBridge` | `src/shared/services/__tests__/pdfShareBridge.test.ts` | Generar un PDF en escritos dentro del APK Android y pulsar "Compartir" | Alto |
| **Biometría Nativa** | Bloqueo automático a los 5 min, desbloqueo biométrico Face ID/Touch ID/Huella para proteger datos laborales. | Hardware de seguridad nativo | `android-app/.../security/*`, `ios-app/.../Security/*` | `BiometricPrompt` (Android), `LocalAuthentication` (iOS) | `testPlayDebugUnitTest` (Android) | Bloquear la app en el dispositivo, reabrir y desbloquear con huella/FaceID | Alto |
| **Bóveda IMSS Nativa** | Cifrado y almacenamiento de credenciales de portales IMSS mediante AndroidKeyStore (AES-256-GCM) y Keychain iOS. | Keystore del dispositivo | `android-app/.../imss/credentials/*`, `ios-app/.../IMSS/Vault/*` | Android KeyStore / iOS Keychain | `testPlayDebugUnitTest` (Android) | Guardar credenciales de portal en app nativa y verificar que no viajen a ningún servidor externo | Crítico |
| **Portales IMSS (Captura)** | Sesión compartida en background para navegación, login y descarga de PDF de tarjetón y asistencia biométrica. | Portales oficiales IMSS | `android-app/.../imss/portal/*` | TuPerfilSessionController, TarjetonDigitalFlowController | `AUTOMATED COVERAGE GAP` (depende de portales externos vivos) | Ejecutar captura de tarjetón en APK Android contra portal oficial | Alto |
| **Actualizaciones Android** | Sideload OTA con `UpdateManager` y `ApkInstaller` en flavor `direct`; deshabilitado 100% en flavor `play` para Google Play. | Manifest `latest.json` en servidor | `android-app/.../updates/*`, `build.gradle.kts` | Play Store Distribution Policy | `./gradlew :app:validateDistributionPolicyPlayRelease :app:validateDistributionPolicyDirectRelease` | Probar flujo de actualización en APK direct y verificar ausencia en APK play | Crítico |
| **Notificaciones Push** | Registro y sincronización de tokens FCM por usuario autenticado con rate limiting estricto. | Supabase `worker_preferences` | `src/features/push/*`, `/api/push/register` | Firebase Admin SDK | `src/features/push/__tests__/push-rate-limit.test.ts`, `push-authorize.test.ts` | Habilitar notificaciones en perfil y verificar guardado del token | Medio |
| **Chatbot / RAG** | Asistente de consultas SNTSS con reranking normativo, priorización de intención y fundamentación obligatoria. | `vectorstore-data.json` + `catalog.sqlite` | `src/app/api/consulta/route.ts`, `src/features/asistente/lib/*` | OpenAI API / FastAPI opcional | `src/features/asistente/__tests__/rag.test.ts`, `rag-priority.test.ts` | Preguntar "¿Cuántos días de aguinaldo me corresponden?", validar cita de Cláusula CCT | Alto |
| **Simulador de Audiencias** | Simulación interactiva con temporizador, máquina de estados, contexto de caso y evaluación post-audiencia. | Escenarios jurídicos SNTSS | `src/app/api/simulador/route.ts`, `src/features/simulador/*` | Modelo LLM local o OpenAI | `src/features/simulador/__tests__/simulador-timer-statemachine.test.ts`, `simulador-profile-connection.test.tsx` | Realizar una audiencia de faltas, responder y verificar retroalimentación final | Medio |
| **Biblioteca Normativa** | Base de datos SQLite FTS5 de leyes, reglamentos y CCT 2025-2027; toda cita exige documento, versión y página. | `data/normativa/catalog.sqlite` | `src/features/normativa/*`, `/biblioteca-normativa` | `node:sqlite`, FTS5 | `npm run normativa:verify` (94/94 versiones verificadas), suites unitarias en `src/features/normativa/__tests__/` | Ejecutar `npm run normativa:search -- "clausula 47"` y verificar resultado exacto | Crítico |
| **Radio Studio (Editorial)** | **GOBERNANZA GROQ-ONLY:** Todo guion y propuesta en producción es generado exclusivamente por Groq sin fallbacks silenciosos. | Corpus documental + Evidence Pack | `apps/radio-studio/sidecar/src/llm/llm-factory.ts`, `groq-provider.ts` | Groq API (`openai/gpt-oss-120b` / `20b`) | `apps/radio-studio/sidecar/src/__tests__/groq-editorial-governance.test.ts` | Iniciar proyecto en Radio Studio, verificar propuesta generada por Groq | Crítico |
| **Radio Studio (Voces)** | Síntesis TTS obligatoria con Speechify simba-3.0 (5 voces es-MX asignadas deterministamente: Eduardo, Andrea, etc.). | Speechify API | `packages/tts-core/src/speechify-engine.ts`, `speechify-cast.ts` | Speechify Cloud | `packages/tts-core/src/__tests__/` | Sintetizar bloque de prueba en `/casting` de Radio Studio | Alto |
| **Radio Studio (Música)** | Generación musical local con ACE-Step 1.5 en GPU GTX 1650 con `ACESTEP_COMPILE_MODEL=false`. | Modelo local DiT | `tools/ACE-Step-1.5/`, worker sidecar | Python 3.12, PyTorch 2.7.1+cu128 | `apps/radio-studio/sidecar` benchmark | Probar generación de cama musical desde sidecar | Medio |
| **Supabase RLS & RPCs** | Seguridad de fila estricta en cada tabla (`profiles`, `imported_payslips`, etc.). Operaciones de datos agrupadas en RPCs. | Esquema PostgreSQL Supabase | Migraciones en `supabase/migrations/` | PostgreSQL 14.5 RLS | CI `supabase-db` job (check RLS en todas las tablas y prueba funcional `chat_rls.sql`) | Intentar consultar tarjetón de otro usuario con cliente anónimo (debe rebotar) | Crítico |
| **Route Policy (Seguridad)** | Lista blanca exacta de rutas API en `route-policy.ts`. Rutas no listadas devuelven JSON 404. Rutas privadas exigen `requireUser`. | `route-policy.ts` | `src/proxy.ts`, `src/shared/server/routing/route-policy.ts` | Next.js Server Routing | `src/shared/server/routing/__tests__/route-policy.test.ts` | Petición curl a `/api/ruta-fantasma` (debe responder 404 JSON estructurado) | Crítico |

---

## 2. Diagramas de Flujos Críticos de Extremo a Extremo

### Flujo 1: Importación, Extracción y Persistencia de Tarjetón IMSS

```
[Usuario selecciona PDF en /profile/mi-informacion-laboral]
                     │
                     ▼
       [Cliente Web (Navegador)]
       ¿Texto nativo >= 120 chars?
        ├── SI ──> PDF.js extrae texto estructurado
        └── NO ──> Tesseract OCR (/public/vendor/spa.traineddata.gz)
                     │
                     ▼
  [Parser Geométrico (Columnas Paralelas)]
  - Balance exacto: Percepciones - Deducciones = Neto
  - Extracción de conceptos CFDI, vencimiento DDMMYYYY, categoría, jornada
                     │
                     ▼
          [Revisión Humana (Review)]
                     │
                     ▼
     [POST /api/tarjeton/confirm]  <── Solo datos estructurados (NUNCA el PDF)
                     │
                     ▼
   [RPC confirm_imported_payslip (Supabase)]
   - Inserción atómica en:
     * imported_payslips
     * imported_payslip_lines
     * imported_payslip_observations
     * profiles (actualización campos autorizados)
     * payroll_contexts (upsert categoría, jornada, antigüedad, conceptos)
                     │
                     ▼
 [Sincronización Local (syncConfirmedPayslip)]
 - Persiste en IndexedDB (tarjeton-blob-storage)
 - Actualiza la_veinte_payslip_analyses (localStorage)
 - Actualiza nomina_profile (localStorage)
```

---

### Flujo 2: Generador de Escritos Laborales y Compartir Nativo

```
[Usuario en /escritos]
          │
          ├── Selecciona destinatario oficial (Directorio Sección XX)
          └── O activa modo manual (Nombre + Cargo personalizados)
          │
          ▼
[Redacción de Hechos / Asistencia IA CCT]
          │
          ▼
[Generación de PDF en memoria (jspdf)]
          │
          ├── Persistencia local en IndexedDB (la-veinte-blobs)
          │
          ▼
[Acción Compartir / Exportar]
          │
          ├── Si es Web: Descarga directa de archivo .pdf en navegador
          └── Si es App Nativa (Android / iOS):
                    │
                    ▼
          [Protocolo de Chunks 64 KB (pdfShareBridge.ts)]
          - Calcula SHA-256 con Web Crypto API
          - Envía chunks Base64 a window.laVeintePdfBridge
          - Android/iOS reconstruye PDF en caché nativa
          - Abre selector nativo del sistema (Intent.ACTION_SEND / UIActivityViewController)
```

---

### Flujo 3: Comunicación Web ↔ Android Native Bridge

```
[Código JavaScript en Web]
         │
         ▼
Llama método en window.LaVeinteApp (ej: requestCameraPermission(), listNativeDocuments())
         │
         ├── Genera reqId único (ej: "req42")
         ├── Registra callback en window.__pending["req42"]
         └── Cambia window.location.href = "laveinte://bridge/action?req=req42&..."
                     │
                     ▼
 [LaVeinteInternalWebViewClient.shouldOverrideUrlLoading]
 - Detecta esquema "laveinte" y host "bridge"
 - Detiene navegación web (return true)
 - Delega a handleBridgeUrl() -> BridgeHandler
                     │
                     ▼
        [Ejecución Nativa en Kotlin]
 (Consulta Room DB, hardware de cámara, DownloadManager o Keystore)
                     │
                     ▼
 [Respuesta Asíncrona hacia WebView]
 webView.evaluateJavascript("window.__laveinteBridgeResult('req42', JSON_PAYLOAD)")
                     │
                     ▼
 [Función window.__laveinteBridgeResult en JavaScript]
 - Recupera callback de __pending["req42"]
 - Resuelve la Promise original en JavaScript
```

---

## 3. Protocolo Obligatorio para Cambios Futuros

A partir de la entrada en vigor de este baseline, **todo agente** que reciba una solicitud de modificación de código debe cumplir estrictamente con este protocolo antes de editar cualquier archivo:

### 3.1. Change Contract (Definición Previa Obligatoria)

Antes de escribir una sola línea de código, define en tu razonamiento o plan:

```text
REQUESTED DELTA:
¿Qué solicitó exactamente el usuario? (Copiar la necesidad concreta).

ALLOWED SCOPE:
Lista exacta de archivos y módulos estrictamente necesarios para cumplir el delta.

PROTECTED BEHAVIOR:
Qué funcionalidades existentes del mismo módulo o módulos vecinos deben conservarse intactas.

DEPENDENCIES:
Quién consume el código que se va a modificar (Web, Android, iOS, APIs, tests, bridges).

REGRESSION TESTS:
Qué pruebas automáticas demuestran que el comportamiento actual funciona y deben seguir pasando.

OUT OF SCOPE:
Qué cosas NO están autorizadas para modificarse, refactorizarse o "limpiarse" en esta tarea.
```

---

### 3.2. Checklist Pre-Cambio (Pre-Change Regression Check)

```text
[ ] Leí docs/STABLE_BASELINE.md y entiendo el estado aceptado.
[ ] Consulté docs/REGRESSION_GUARDRAILS.md para identificar los riesgos de mi área.
[ ] Entendí exactamente el delta solicitado por el usuario.
[ ] Tengo claro que si el usuario pidió A, la autorización es A (NO es A + B + C).
[ ] Identifiqué las fuentes de verdad involucradas.
[ ] Identifiqué consumidores (Web, Android WebView, iOS WKWebView, bridges).
[ ] Revisé contratos de persistencia (claves de localStorage, esquemas de tablas).
[ ] Ejecuté las pruebas unitarias del módulo ANTES de modificar para validar el baseline.
[ ] No estoy introduciendo una refactorización no solicitada ("No drive-by refactoring").
[ ] Mi solución será el cambio más pequeño compatible con el diseño existente.
```

---

### 3.3. Checklist Post-Cambio (Post-Change Regression Check)

```text
[ ] El requerimiento nuevo funciona según lo solicitado.
[ ] Todos los comportamientos protegidos del módulo siguen funcionando.
[ ] No desapareció ninguna capacidad anterior ni se degradaron fallbacks.
[ ] No cambiaron contratos públicos ni internos de forma incidental.
[ ] No cambiaron claves de localStorage, IndexedDB ni nombres de tablas.
[ ] No cambiaron bridges nativos ni firmas de funciones expuestas.
[ ] No se debilitaron aserciones ni se comentaron pruebas para forzar builds verdes.
[ ] `npm run typecheck` pasa sin errores de TypeScript.
[ ] `npm run lint` pasa sin errores de ESLint.
[ ] `npm test` pasa sin regresiones en las suites existentes.
[ ] `npm run build` compila la aplicación web exitosamente.
[ ] Pruebas de Android (`testPlayDebugUnitTest`) pasan si el área nativa fue tocada.
[ ] `git diff` contiene EXCLUSIVAMENTE los cambios autorizados para el delta solicitado.
```

---

### 3.4. Reglas Permanentes de Conducta

1. **NO DRIVE-BY REFACTORING:**  
   Si estás modificando el archivo `A.ts` y notas que `B.ts` o `C.ts` podrían verse "más limpios", "más modernos" o "mejor estructurados": **NO LOS TOQUES**. Repórtalo como observación o deuda técnica en un comentario de respuesta. Tu PR / commit debe contener únicamente el delta autorizado.

2. **PROHIBICIÓN DE ELIMINAR COMPATIBILIDAD:**  
   No retires adaptadores, redirecciones, compatibilidad hacia atrás ni métodos de bridge "porque la nueva forma ya funciona". Primero debe verificarse si existen versiones instaladas de Android, iOS o datos locales de usuarios que dependan de ellos.

3. **CAMBIOS DE UI NO AUTORIZAN CAMBIOS DE DOMINIO:**  
   Una petición como *"Haz este botón más grande"* o *"Cambia el color de la tarjeta"* **BAJO NINGUNA CIRCUNSTANCIA** autoriza alterar fórmulas de cálculo, lógica de persistencia, endpoints de API ni políticas de seguridad.

4. **EFECTOS DE MODAL NUNCA DEPENDEN DE CALLBACKS INESTABLES:**  
   Los efectos de inicialización y manejo de foco de componentes Modal (y equivalentes: `BottomSheet`, sheets, portals con autofocus) no deben depender de callbacks cuya identidad pueda variar durante renders del contenido. Un render de un formulario dentro de un modal nunca debe provocar una reinicialización del autofocus ni hacer perder el foco al campo activo — en móvil esto cierra el teclado virtual. Patrón canónico: leer el cierre siempre vigente vía `useRef` (`onCloseRef.current()` en Escape/listeners) y dejar el ciclo de vida del efecto bajo control exclusivo de `open`. Pruebas que lo protegen: `src/shared/components/ui/__tests__/Modal.test.tsx` ("keeps focus…", "Escape calls the latest…") y `src/features/agenda-laboral/__tests__/commitment-form.test.tsx` ("mantiene el foco al escribir de corrido…").
