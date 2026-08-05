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

## 4. Estados del perfil

| Estado | Vista en el Centro | Acciones disponibles |
|--------|-------------------|---------------------|
| `unconfigured` | Wizard paso 1 (bienvenida) | Comenzar / Saltar |
| `basic` | Panel: "Estás en modo básico." Botón: "Configurar mi perfil laboral." | Configurar (lleva al wizard paso 2) |
| `configured/manual` | Centro completo: calidad, fuentes, historial, acciones | Cambiar método, actualizar, borrar datos |
| `configured/payslip` | Centro completo + badge tarjetón + confianza alta | Importar nuevo tarjetón, cambiar a manual, actualizar, borrar datos |

## 5. Textos completos para usuarios noveles

> Ver `PR4_COPY_DECK.md`. Principios: una decisión por pantalla, lenguaje sin tecnicismos (sin RPC, JSON, parser, persistencia), explicación antes de pedir cada dato, botones con acciones concretas, confirmaciones visibles.

## 6. Aviso simplificado de privacidad (borrador)

Revisión legal obligatoria antes de lanzamiento.

> Ver `PR4_COPY_DECK.md` §Aviso.

## 7. Comportamiento de `returnTo`

- Parámetro query opcional: `?returnTo=/calculadoras/aguinaldo`.
- Validado contra `isSafeInternalReturnPath` (lista blanca, rechaza externos/javascript/protocol-relative).
- En el wizard paso 8, el botón secundario lo usa si es válido; si no, lleva a `/`.
- Si `returnTo` no es válido, se ignora silenciosamente (se usa `/` por defecto).
- Se conserva a través de los pasos del wizard (pasa como prop).

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

## 10. Accesibilidad

- **Focus:** orden lógico de tabulación. El primer campo recibe auto-focus al avanzar.
- **Labels:** cada input tiene `<label>` asociado vía `htmlFor` (o implícito). Lectores de pantalla anuncian el propósito.
- **Teclado:** navegación completa con Tab/Enter/Escape. Los botones de opción (○) se seleccionan con Enter/Flechas.
- **Lectores de pantalla:** anuncian progreso ("Paso 3 de 8"), errores asociados al campo vía `aria-describedby`, cambios de estado visibles.
- **Contraste:** respeta variables CSS del tema (--primary, --fg sobre --bg). Sin texto gris claro sobre gris claro.
- **Errores asociados a campos:** cada campo con error tiene `aria-invalid="true"` y un mensaje accesible vía `aria-describedby` o `role="alert"` inline.

## 11. Casos límite

| Caso | Comportamiento |
|------|---------------|
| **Abandonar wizard** | El usuario puede cerrar o navegar a otra ruta. El draft en cliente se descarta (no se persiste nada). Vuelve a `unconfigured` o al estado previo. |
| **Sesión expirada** | El proxy redirige a login. Si ocurre en medio de una operación (RPC), el servicio lanza `WorkerProfileUnauthorizedError` → UI muestra "Tu sesión caducó. Inicia sesión de nuevo." |
| **RPC no disponible** | `WorkerProfileUnavailableError` → UI muestra "El perfil laboral no está disponible en este momento. Inténtalo más tarde." |
| **Tarjetón ilegible** | El importador muestra "El archivo no parece ser un tarjetón del IMSS." con botón para volver al paso 4 y reintentar. |
| **Datos parciales** | En la revisión, los campos no detectados aparecen vacíos con fuente "No detectado". El usuario decide si capturarlos o excluirlos. |
| **Consentimiento rechazado** | El checkbox no se marca → el botón "Confirmar" está deshabilitado. Si el usuario retrocede sin confirmar, no se guarda nada. |
| **returnTo inválido** | Se usa `/` como fallback. No se muestra error al usuario (es una guarda de seguridad, no un problema de usuario). |
| **Modo básico repetido** | `chooseBasicMode` es idempotente: si ya está en `basic`, la RPC hace `return` sin error. La UI muestra el panel de configuración opcional. |
