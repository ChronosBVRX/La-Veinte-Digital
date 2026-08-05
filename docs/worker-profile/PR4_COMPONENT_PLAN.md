# PR4 — Plan de componentes (sin implementar)

> Arquitectura de componentes propuesta. NO es código. Sin UI todavía.
> Se implementará en PR4-B (FASE implementación de UI).

## Principios

1. Componentes atómicos en `src/shared/components/ui/` (ya existen: Button, Input, Select, Card, LoadingSpinner).
2. Componentes del centro laboral en `src/features/profile/components/worker/` (nuevo feature).
3. Reutilizar `TarjetonImporter` y `ProfileForm` existentes (con adaptaciones).
4. Sin dependencias nuevas de UI. Solo React + CSS inline (variables de tema).

## Árbol de componentes

```
src/features/profile/components/worker/
│
├── WorkerProfileCenter.tsx        ← página principal del centro
│     (renderiza según onboardingState)
│
├── onboarding/
│   ├── OnboardingWizard.tsx       ← wizard principal (orquestador de pasos)
│   ├── WelcomeStep.tsx            ← paso 1: bienvenida
│   ├── ModeChoiceStep.tsx         ← paso 2: básico / configurar
│   ├── MethodChoiceStep.tsx       ← paso 3: manual / tarjetón
│   ├── ManualCaptureStep.tsx      ← paso 4a: captura manual
│   ├── TarjetonImportStep.tsx     ← paso 4b: importación (wrapper de TarjetonImporter)
│   ├── ReviewStep.tsx             ← paso 5: revisión de datos
│   ├── ConsentStep.tsx            ← paso 6: consentimiento
│   ├── ConfirmStep.tsx            ← paso 7: confirmación
│   └── SummaryStep.tsx            ← paso 8: resumen
│
├── configured/
│   ├── ProfileQualityCard.tsx     ← tarjeta de calidad (% + conteos + recomendaciones)
│   ├── ProfileFieldsList.tsx      ← lista de campos con fuente y "¿por qué?"
│   ├── ProfileFieldRow.tsx        ← fila individual de campo
│   ├── ProfileHistoryList.tsx     ← lista de eventos
│   ├── ProfileHistoryItem.tsx     ← evento individual
│   ├── ChangeMethodDialog.tsx     ← diálogo para cambiar manual/tarjetón
│   ├── DeleteWorkerDataSection.tsx ← sección de borrado con confirmación BORRAR
│   └── AccountDeleteNote.tsx      ← nota de eliminación de cuenta (separada, futura)
│
└── basic/
    └── BasicModeCard.tsx          ← tarjeta de invitación "Configurar mi perfil"
```

## Props y dependencias

### WorkerProfileCenter
- **Estado:** recibe `onboardingState` del servidor (page.tsx llama `WorkerProfileService.getCurrentProfile()`).
- **Renderizado condicional:**
  - `unconfigured` → `OnboardingWizard`
  - `basic` → `BasicModeCard`
  - `configured` → `ProfileQualityCard` + `ProfileFieldsList` + `ProfileHistoryList` + acciones
- **Sin estado local** de datos del perfil (el servidor es la fuente de verdad).

### OnboardingWizard
- **Props:** `returnTo?: string`.
- **Estado interno:** paso actual (1-8), draft de `WorkerProfileDraft`, `error?: string`, `loading: boolean`.
- **Dependencias:** `WorkerProfileService` (servidor), `useTarjetonImporter` (cliente).
- **Flujo:** avance condicional según elecciones (paso 2 "básico" → fin; paso 3 "manual" → 4a; "tarjetón" → 4b).
- **Navegación:** barra de progreso, botones ←/→, salto al paso 1 "Saltar → básico".

### ManualCaptureStep
- **Props:** `draft: WorkerProfileDraft`, `onChange(draft)`, `requirements: FieldRequirement[]`.
- **Precarga:** desde `draft` (edición de datos existentes), o vacío (primera configuración).
- **Validación:** cliente (longitudes, enums, formato fecha) + servidor (RPC).
- **Reutiliza:** `Input`, `SearchableSelect`.
- **Campos:** categoría (SearchableSelect), antigüedad (Input date), jornada (radio group), adscripción (Input), matrícula (Input).
- **Cada campo muestra:** label, tooltip "¿Por qué lo necesito?", fuente actual (si existe).

### TarjetonImportStep
- **Wrapper de `TarjetonImporter`:**
  - Recibe `profile` como snapshot (para diferencias).
  - Al completar extracción → avanza al paso 5 (ReviewStep).
  - El PDF se queda en el navegador (el importador existente ya lo garantiza).

### ReviewStep
- **Props:** `parsed: ParsedImssTarjeton | WorkerProfileDraft`, `previousFields?: WorkerProfile`.
- **Muestra:** campos con fuente, diferencias contra el perfil actual, botones editar/excluir.
- **Checkboxes para autorizar actualización de perfil** (si viene de tarjetón, reutiliza el patrón de `Differences`).

### ConsentStep
- **Props:** `onAccept(boolean)`.
- **Contenido:** texto de privacidad (PR4_COPY_DECK.md), checkbox sin preselección.
- **Deshabilitación:** botón "Siguiente" solo si el checkbox está marcado.

### ConfirmStep
- **Props:** `summary: { fields, sources }`.
- **Acción:** `await service.confirmManualProfile(...)` o `confirmPayslipProfile(...)`.
- **Estados:** loading (spinner), error (mensaje funcional + reintentar), success (avanza).

### SummaryStep
- **Props:** `profile: WorkerProfile`, `quality: ProfileQuality`, `returnTo?`.
- **Contenido:** calidad, herramientas beneficiadas, botones de navegación.

### Componentes del centro (configured)

Todos consumen datos del servidor (page.tsx). Sin escritura local.

- **ProfileQualityCard:** recibe `ProfileQuality`. Renderiza barra de progreso + conteos + recomendaciones.
- **ProfileFieldsList:** recibe `WorkerProfile` + `FieldRequirement[]`. Renderiza `ProfileFieldRow` por campo.
- **ProfileFieldRow:** campo, valor, fuente (con ícono de color), explicación "¿Por qué?", acciones (editar si es captura manual, o "actualizar desde tarjetón").
- **ProfileHistoryList:** recibe `WorkerDataEvent[]`. Orden descendente. Renderiza `ProfileHistoryItem`.
- **ProfileHistoryItem:** evento con fecha relativa ("hace 8 días"), icono por prioridad, texto descriptivo.
- **ChangeMethodDialog:** modal con radio buttons manual/tarjetón. Llama `changeWorkerProfileMode`.
- **DeleteWorkerDataSection:** sección con descripción, botón danger, confirmación escribiendo BORRAR. Llama `deleteWorkerData`.

### BasicModeCard
- **Contenido:** texto de invitación, botón "Configurar mi perfil laboral". Sin estado.

## Reutilización de componentes existentes

| Componente existente | Uso nuevo |
|---------------------|-----------|
| `Button` (shared/ui) | Todas las acciones |
| `Input` (shared/ui) | Campos del wizard |
| `SearchableSelect` (shared/ui) | Categoría |
| `Card` (shared/ui) | Contenedores de sección |
| `LoadingSpinner` (shared/ui) | Estados de carga |
| `TarjetonImporter` (tarjeton) | En `TarjetonImportStep` |
| `ProfileForm` (profile) | **Solo datos personales** (name, phone, avatar). **NO se reutiliza para datos laborales.** |
| `Differences` (tarjeton) | En `ReviewStep` para diferencias tarjetón vs perfil |

## Dependencias del servicio

Todos los componentes de escritura delegan en **Server Actions explícitas** (`"use server"`). Ningún Client Component llama al `WorkerProfileService` directamente para escrituras.

Flujo:

```
Client Component
  → Server Action ("use server")
    → WorkerProfileService
      → RPC de dominio
```

La lectura inicial puede ocurrir en `page.tsx` como Server Component.

**Server actions planeadas** (sin implementar todavía):

| Server Action | Parámetros | Servicio |
|--------------|-----------|----------|
| `chooseBasicModeAction()` | — | `WorkerProfileService.chooseBasicMode()` |
| `confirmManualProfileAction(input)` | `ConfirmedWorkerProfileUpdate` (sin userId) | `WorkerProfileService.confirmManualProfile(input)` |
| `confirmPayslipProfileAction(input)` | `ConfirmedWorkerProfileUpdate` (sin userId) | `WorkerProfileService.confirmPayslipProfile(input)` |
| `changeWorkerProfileModeAction(mode)` | `WorkerProfileMode` | `WorkerProfileService.changeWorkerProfileMode(mode)` |
| `deleteWorkerDataAction(confirmation)` | `{ confirmation: string }` (debe ser "BORRAR") | `WorkerProfileService.deleteWorkerData()` |
| `grantWorkerConsentAction(purpose, version)` | `ConsentPurpose, string` | `WorkerProfileService.grantConsent(purpose, version)` |
| `revokeWorkerConsentAction(purpose)` | `ConsentPurpose` | `WorkerProfileService.revokeConsent(purpose)` |

Reglas de las server actions:
- No aceptan `userId`.
- Validan la entrada en servidor antes de delegar al servicio.
- Devuelven `{ success: true } | { error: string }` con mensajes funcionales.
- Nunca devuelven SQL, UUID, RLS ni errores PostgreSQL.

## Separación Perfil Personal / Perfil Laboral

**ProfileForm** queda exclusivamente para datos personales: `full_name`, `phone`, `avatar_url`. **No se reutiliza para guardar información laboral.**

El wizard laboral:
- Utiliza `WorkerProfileDraft` (dominio).
- Usa componentes propios (`src/features/profile/components/worker/`).
- Usa validadores propios del dominio.
- **Nunca escribe `profiles`** con datos laborales.
- **Nunca llama acciones de `ProfileForm`.**

Los componentes del Centro no importan acciones de `ProfileForm` ni escriben directamente en `profiles`. Esta restricción se verificará con un test de arquitectura planeado (similar a `architecture.test.ts` del PR3).

## Estados de loading y error (todos los componentes)

| Estado | UI |
|--------|----|
| Cargando datos del centro | Skeleton o spinner centrado |
| Error de lectura (red, BD) | Mensaje funcional + botón "Reintentar" |
| Confirmando (guardando) | Spinner en el botón + "Guardando..." |
| Error de confirmación | Mensaje funcional (no SQL) + botón "Reintentar" o "Volver" |
| Éxito | Animación sutil (✓ verde) + transición a la siguiente pantalla |
| Sesión expirada | Redirect a /login |
