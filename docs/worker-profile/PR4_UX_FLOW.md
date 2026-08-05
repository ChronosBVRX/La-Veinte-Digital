# PR4 — Flujo UX del onboarding y centro laboral

> Documento de diseño. NO es código. Sin UI todavía.

## 1. Flujo post-registro

```
Registro (email+password)
│
├→ Pantalla de elección
│   ┌────────────────────────────────────────────┐
│   │  ¡Tu cuenta está lista!                    │
│   │                                            │
│   │  ¿Cómo quieres usar La Veinte Digital?     │
│   │                                            │
│   │  ○ Usar modo básico                        │
│   │    Capturaré lo necesario en cada           │
│   │    herramienta. No guardaré datos           │
│   │    laborales.                               │
│   │                                            │
│   │  ○ Configurar mi perfil laboral            │
│   │    Podré capturar mis datos manualmente     │
│   │    o importar un tarjetón.                  │
│   │                                            │
│   │  ┌─────────────────────────────────┐       │
│   │  │ Tus datos laborales son          │       │
│   │  │ opcionales. Si decides agregarlos│       │
│   │  │ se usarán para completar         │       │
│   │  │ calculadoras, simulaciones y más.│       │
│   │  │ Podrás borrarlos cuando quieras. │       │
│   │  │                                  │       │
│   │  │ El tarjetón se procesa en tu     │       │
│   │  │ dispositivo y no se guarda.      │       │
│   │  └─────────────────────────────────┘       │
│   │                                            │
│   │       [Continuar]                          │
│   └────────────────────────────────────────────┘
│
├→ Modo básico: onboarding_state='basic', redirect a "/"
│   (no se crea worker_preferences laboral)
│
└→ Configurar perfil
    ├→ Elegir método (manual / tarjetón)
    │
    ├→ Captura manual: wizard 3 pasos
    │   1. Datos básicos (categoría, antigüedad)
    │   2. Datos opcionales (adscripción, matrícula)
    │   3. Revisión + consentimiento + confirmar
    │
    └→ Importar tarjetón: flujo existente reutilizado
        1. Seleccionar PDF
        2. Procesar (PDF.js + OCR local)
        3. Revisar campos extraídos
        4. Editar / excluir campos
        5. Consentimiento de almacenamiento
        6. Confirmar y guardar
```

## 2. Ruta única

```
/profile/mi-informacion-laboral
```

Alias corto: `/profile/datos-laborales` redirige a la ruta principal.

Control de acceso:
- Requiere autenticación (protegida por proxy).
- renderizado condicional según `onboarding_state`:
  - `unconfigured` → wizard de bienvenida.
  - `basic` → panel de activación opcional.
  - `configured/{manual,payslip}` → centro completo.

## 3. Wizard de 8 pasos

### Paso 1 — Bienvenida

```
┌──────────────────────────────────┐
│  👋  Hola                        │
│                                  │
│  Vamos a configurar tu perfil.   │
│  Esto te ayudará a completar     │
│  automáticamente calculadoras,   │
│  simulaciones y vacaciones.      │
│                                  │
│  Tardarás menos de 2 minutos.    │
│                                  │
│           [Comenzar]              │
│                                  │
│  [Saltar · Usar modo básico]     │
└──────────────────────────────────┘
```

### Paso 2 — Elección básico / configurar

```
┌──────────────────────────────────┐
│  ¿Cómo quieres usar la           │
│  plataforma?                     │
│                                  │
│  ○ Usar modo básico              │
│    No necesito guardar datos     │
│    laborales. Capturaré lo       │
│    necesario en cada herramienta.│
│                                  │
│  ○ Configurar mi perfil          │
│    Podré capturar mis datos      │
│    manualmente o importar        │
│    un tarjetón.                  │
│                                  │
│  Ninguna opción viene            │
│  preseleccionada.                │
│                                  │
│  [←]                       [→]  │
└──────────────────────────────────┘
```

### Paso 3 — Manual / tarjetón

```
┌──────────────────────────────────┐
│  ¿Cómo prefieres configurar?     │
│                                  │
│  ○ Capturar manualmente          │
│    Llenaré los datos que         │
│    conozca. Puedo completar      │
│    el resto después.             │
│                                  │
│  ○ Importar mi tarjetón          │
│    Selecciono el PDF de mi       │
│    último recibo. El archivo     │
│    se procesa en mi dispositivo  │
│    y no se guarda.               │
│                                  │
│  Ninguna opción viene            │
│  preseleccionada.                │
│                                  │
│  [←]                       [→]  │
└──────────────────────────────────┘
```

### Paso 4 — Captura o importación

**Captura manual:**

```
┌──────────────────────────────────┐
│  Datos básicos                   │
│                                  │
│  Categoría                       │
│  Ej: TÉCNICO RADIÓLOGO 80        │
│  [          buscar...        ▼]  │
│  ¿Por qué? Se usa para aguinaldo,│
│  prima vacacional, nómina y      │
│  simulador.                      │
│                                  │
│  Antigüedad                      │
│  Fecha de ingreso al IMSS        │
│  [dd/mm/aaaa               ]     │
│  ¿Por qué? Se usa para           │
│  vacaciones, prima vacacional    │
│  y nómina.                       │
│                                  │
│  Jornada (horas al día)          │
│  ○ 6h    ○ 6.5h    ● 8h   ○ 12h │
│                                  │
│  [←]    [Continuar con opcionales│
│          o saltar]      [→]      │
└──────────────────────────────────┘
```

**Importar tarjetón:** reutiliza `TarjetonImporter` existente. El usuario ve el dropzone, el progreso de extracción (PDF.js/OCR), y la revisión con diferencias contra el perfil actual.

### Paso 5 — Revisión

```
┌──────────────────────────────────┐
│  Revisa tus datos                │
│                                  │
│  Categoría                       │
│  TÉCNICO RADIÓLOGO               │
│  ✓ Confirmado desde tarjetón     │
│  [Editar]  [Excluir]             │
│                                  │
│  Antigüedad                      │
│  18 años                         │
│  ✏ Capturado manualmente         │
│  [Editar]  [Excluir]             │
│                                  │
│  Matrícula                       │
│  12345678                        │
│  ✓ Confirmado desde tarjetón     │
│  [Editar]  [Excluir]             │
│                                  │
│  [←]                    [→]     │
└──────────────────────────────────┘
```

### Paso 6 — Consentimiento

```
┌──────────────────────────────────┐
│  Antes de guardar                │
│                                  │
│  Tus datos laborales se          │
│  utilizarán para completar       │
│  calculadoras, simulaciones de   │
│  nómina y vacaciones, preparar   │
│  escritos y personalizar las     │
│  herramientas que utilices.      │
│                                  │
│  Si importaste un tarjetón, el   │
│  archivo se procesó en tu        │
│  dispositivo y no se guardó.     │
│                                  │
│  Podrás modificar o borrar tus   │
│  datos en cualquier momento      │
│  desde Mi perfil → Mi            │
│  información laboral.            │
│                                  │
│  ☐ Quiero guardar mi información │
│    laboral.                      │
│                                  │
│  Consulta el Aviso de Privacidad.│
│                                  │
│  [←]                    [→]     │
└──────────────────────────────────┘
```

### Paso 7 — Confirmación

```
┌──────────────────────────────────┐
│  ¿Confirmas estos datos?         │
│                                  │
│  Categoría: TÉCNICO RADIÓLOGO    │
│  Antigüedad: 18 años             │
│  Jornada: 8 horas                │
│  Adscripción: HGZ 32             │
│  Matrícula: 12345678             │
│                                  │
│  [←]    [Confirmar y guardar]    │
└──────────────────────────────────┘
```

### Paso 8 — Resumen

```
┌──────────────────────────────────┐
│  ✓  Perfil configurado           │
│                                  │
│  📊 Calidad del perfil: alta     │
│     8 datos confirmados          │
│     0 datos pendientes           │
│                                  │
│  🔧 Herramientas listas:         │
│     Aguinaldo, Prima vacacional, │
│     Nómina, Tiempo extra         │
│                                  │
│  📋 Tus datos se guardaron.      │
│     Puedes modificarlos desde    │
│     Mi perfil → Mi información   │
│     laboral.                     │
│                                  │
│  [Ir al inicio]                  │
│  [Volver a la herramienta]       │
└──────────────────────────────────┘
```

## 4. Flujo definitivo (consentimiento antes de persistir)

Regla: **seleccionar un método o un PDF no otorga consentimiento. Ningún dato laboral se guarda antes de confirmar explícitamente la casilla de consentimiento.**

```
Bienvenida (paso 1)
  → elegir modo (paso 2)
    → elegir método (paso 3)
      → captura o importación local (paso 4)
        → revisión (paso 5)
          → consentimiento (paso 6)
            → confirmación de guardado (paso 7)
              → resumen (paso 8)
```

En cada paso antes del paso 6 (consentimiento):
- No se persiste ningún dato laboral.
- No se crea `worker_consents` ni `payroll_contexts`.
- El draft del wizard existe solo en memoria del navegador (ver §12).
- Si el usuario abandona o cierra, no queda nada guardado.

El consentimiento (paso 6):
- La casilla no viene marcada.
- Al marcar, el botón "Siguiente" (paso 7) se habilita.
- No marcar no impide retroceder ni elegir modo básico.
- Modo básico **no requiere consentimiento** porque no guarda datos laborales.

## 5. Server actions explícitas

El flujo de escritura es:

```
Client Component
  → Server Action explícita ("use server")
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

**Reglas:**
- No aceptan `userId` (el servicio lo obtiene de la sesión).
- Validan la entrada en servidor antes de delegar al servicio.
- Devuelven resultados discriminados: `{ success: true } | { error: string }`. El mensaje de error es funcional, nunca SQL/UUID/RLS.
- La Server Action llama exclusivamente al método del `WorkerProfileService`.
- El servicio es el único que llama a la RPC de dominio.
- Ningún Client Component llama al servicio directamente para escrituras.

## 6. Estados del perfil

| Estado | Vista en el Centro | Acciones disponibles |
|--------|-------------------|---------------------|
| `unconfigured` | Wizard paso 1 (bienvenida) | Comenzar / Saltar |
| `basic` | Panel: "Estás en modo básico." Botón: "Configurar mi perfil laboral." | Configurar (lleva al wizard paso 2) |
| `configured/manual` | Centro completo: calidad, fuentes, historial, acciones | Cambiar método, actualizar, borrar datos |
| `configured/payslip` | Centro completo + badge tarjetón + confianza alta | Importar nuevo tarjetón, cambiar a manual, actualizar, borrar datos |

## 7. Textos completos para usuarios noveles

> Ver `PR4_COPY_DECK.md`. Principios: una decisión por pantalla, lenguaje sin tecnicismos...

## 8. Aviso simplificado de privacidad (borrador)

Revisión legal obligatoria antes de lanzamiento.

> Ver `PR4_COPY_DECK.md` §Aviso.

## 9. Comportamiento de `returnTo`

- Parámetro query opcional: `?returnTo=/calculadoras/aguinaldo`.
- Se recibe en la página servidor (`page.tsx`).
- Se valida mediante `isSafeInternalReturnPath()` (lista blanca; rechaza externos, javascript:, protocol-relative y rutas no listadas).
- Si es inválido, se transforma en `undefined` (fallback silencioso).
- **Nunca se utiliza directamente en `window.location`.**
- El valor validado (o `undefined`) se entrega al cliente ya sanitizado.
- La navegación de retorno se ejecuta mediante `router.push` solo al valor validado.
- Se conserva a través de los pasos del wizard como prop.

## 8. Experiencia móvil

- **Una decisión por pantalla:** cada paso tiene un propósito único. El usuario avanza o retrocede, nunca se le satura.
- **Botones grandes:** mínimo 44px de altura, separación generosa, área táctil suficiente.
- **Progreso:** barra superior con pasos (1/8, 2/8, …). Visible en todo momento. El paso actual resaltado.
- **Navegación atrás:** botón "←" en cada paso (excepto paso 1). El paso 1 permite "Saltar → modo básico".
- **Estados de carga:** spinner durante importación de tarjetón (progresivo: % de procesamiento). Spinner durante confirmación (guardando...). Sin pantalla en blanco.
- **Estados de error:** mensaje funcional (no SQL) + botón de reintento. Si es crítico (sesión expirada), redirigir a login. Si el tarjetón no es válido, volver al paso 4.

## 9. Centro ya configurado

```
┌──────────────────────────────────────────────┐
│  Mi información laboral                      │
│                                              │
│  📊 Perfil configurado mediante tarjetón      │
│     Última actualización: hace 8 días         │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ Calidad del perfil                       ││
│  │ ██████████████████████░░  82%            ││
│  │ 8 confirmados · 2 manuales · 1 pendiente ││
│  │ Para mejorar: jornada                     ││
│  └──────────────────────────────────────────┘│
│                                              │
│  Tus datos                                   │
│  ┌──────────────────────────────────────────┐│
│  │ Categoría   TÉCNICO RADIÓLOGO     ✓      ││
│  │              Confirmada desde tarjetón    ││
│  │              ¿Por qué? Aguinaldo, prima,  ││
│  │              nómina, simulador            ││
│  │ Antigüedad  18 años                 ✏    ││
│  │              Capturada manualmente        ││
│  │              ¿Por qué? Vacaciones, prima  ││
│  │              vacacional, nómina           ││
│  │ Jornada     6 horas                 ✏    ││
│  │              Capturada manualmente        ││
│  └──────────────────────────────────────────┘│
│                                              │
│  📋 Historial                                │
│  ┌──────────────────────────────────────────┐│
│  │ Hace 8 días  Importaste un tarjetón      ││
│  │ Hace 2 meses Cambiaste categoría          ││
│  │ Hace 3 meses Perfil creado               ││
│  └──────────────────────────────────────────┘│
│                                              │
│  Acciones                                    │
│  [Cambiar método]                            │
│  [Actualizar datos]                          │
│  [Borrar mis datos laborales]                │
│  ────────────────────────────────────────────│
│  [Eliminar mi cuenta]                        │
│  ⚠ Esta acción es independiente y elimina    │
│    el acceso a la plataforma.               │
└──────────────────────────────────────────────┘
```

## 12. Accesibilidad

- **Focus:** orden lógico de tabulación. Al cambiar de paso, mover focus al título principal del paso.
- **Labels:** cada input tiene `<label>` asociado vía `htmlFor` (o implícito). Lectores de pantalla anuncian el propósito.
- **Teclado:** navegación completa con Tab/Enter/Escape. Los selectores de modo deben ser `<fieldset>` + `<input type="radio">` reales (radio group), no `<div>` con onClick.
- **Lectores de pantalla:**
  - Anuncian progreso ("Paso 3 de 8") con texto accesible.
  - Anuncian errores y éxito mediante `aria-live="polite"` o `role="status"`.
  - Errores asociados al campo vía `aria-describedby`.
- **Contraste:** respeta variables CSS del tema (--primary, --fg sobre --bg). Sin texto gris claro sobre gris claro.
- **Errores asociados a campos:** `aria-invalid="true"` + mensaje accesible vía `aria-describedby`.
- **Diálogo de borrado:** focus trap dentro del diálogo; al cerrar, el focus retorna al botón que lo abrió.
- **No depender solo del color:** las fuentes ("✓ Confirmado desde tarjetón", "✏ Manual") deben incluir texto o icono semántico, nunca solo color. La prioridad de eventos (info/important/critical) no debe depender únicamente de color.

## 13. Estado del wizard y política de drafts

- Mientras no haya confirmación (paso 7), **el draft permanece solo en memoria del navegador** (estado React).
- **Por defecto NO se persiste el draft en `localStorage` ni `sessionStorage`.**
- Recargar la página o cerrar la pestaña elimina el draft (sin confirmación de abandono necesaria porque no hay datos sensibles persistidos).
- **Antes de abandonar con cambios:** si el usuario intenta navegar a otra ruta o cerrar y el draft contiene datos capturados, se muestra una advertencia (usando `window.onbeforeunload` o el evento `routeChangeStart` de Next).
- **Después de guardar (paso 7 exitoso):** se limpia TODO el estado temporal:
  - Draft del wizard.
  - Referencias al archivo PDF.
  - Texto extraído del PDF.
  - `WorkerProfileDraft` en memoria.
- **Nunca se guarda** en `localStorage`/`sessionStorage`: PDF, base64, texto completo extraído, borradores sensibles, archivos temporales del tarjetón.
- La limpieza de memoria de archivo la maneja `useTarjetonImporter.reset()`.

## 14. Casos límite

| Caso | Comportamiento |
|------|---------------|
| **Abandonar wizard** | Si hay cambios, advertencia antes de salir. El draft se descarta (no persistido). Vuelve a `unconfigured` o al estado previo. |
| **Sesión expirada** | El proxy redirige a login. Si ocurre en medio de una operación (RPC), el servicio lanza `WorkerProfileUnauthorizedError` → UI muestra "Tu sesión caducó. Inicia sesión de nuevo." |
| **RPC no disponible** | `WorkerProfileUnavailableError` → UI muestra "El perfil laboral no está disponible en este momento. Inténtalo más tarde." |
| **Tarjetón ilegible** | El importador muestra "El archivo no parece ser un tarjetón del IMSS." con botón para volver al paso 4 y reintentar. |
| **Datos parciales** | En la revisión, los campos no detectados aparecen vacíos con fuente "No detectado". El usuario decide si capturarlos o excluirlos. |
| **Consentimiento rechazado** | El checkbox no se marca → el botón del paso 7 no es accesible (se salta el paso 6). Si el usuario retrocede desde el paso 6 sin marcar, no se guarda nada. No se crea `worker_consents` ni `payroll_contexts`. |
| **returnTo inválido** | Se recibe en servidor, se valida con `isSafeInternalReturnPath()`, se transforma en `undefined` si es inválido. El cliente recibe `undefined` y usa `/` como fallback. |
| **Modo básico repetido** | `chooseBasicMode` es idempotente. La UI muestra el panel de configuración opcional. |
| **Cancelar después de procesar PDF** | El tarjetón se procesó en el navegador pero NO se envió al servidor. No hay llamada a persistencia. Al cancelar, el estado del importador se resetea. |
| **PDF no aparece en solicitudes de red** | El archivo nunca se envía al servidor. Solo se transmite `source_hash` + datos estructurados en `POST /api/tarjeton/confirm`. |
| **Excluir campo del payload** | Al excluir un campo en la revisión, NO se incluye en `ConfirmedWorkerProfileUpdate` ni en los sources enviados a la RPC. |
| **Recargar durante el wizard** | El draft se pierde (solo en memoria). El usuario vuelve al paso 1. Sin datos guardados. |
