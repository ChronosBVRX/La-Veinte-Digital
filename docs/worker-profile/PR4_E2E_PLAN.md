# PR4 — Plan de pruebas E2E y de integración de UI

> Plan de casos para la fase de implementación UI (PR4-B). NO ejecutables todavía.

## Alcance

Pruebas funcionales del onboarding y el centro laboral desde la perspectiva del usuario, contra Supabase local. Usuario sintético autenticado.

## Entorno

- Supabase local con migración `worker_profile_persistence` aplicada.
- Servicio `WorkerProfileService` disponible (PR3 ya mergeado).
- Componentes montados en `/profile/mi-informacion-laboral`.

---

## Suite 1 — Onboarding (unconfigured)

| # | Caso | Pasos | Resultado esperado |
|---|------|-------|--------------------|
| 1 | Ver wizard paso 1 | Usuario nuevo visita el centro | Muestra "¡Tu cuenta está lista!" con botón "Comenzar" y "Usar modo básico" |
| 2 | Saltar a modo básico | Click en "Usar modo básico" desde paso 1 | Redirige a básico; estado = `basic`; no se crean datos laborales |
| 3 | Comenzar wizard | Click en "Comenzar" | Avanza al paso 2 (elección de modo) |
| 4 | Paso 2 sin preselección | Renderizar paso 2 | Ningún radio button viene seleccionado |
| 5 | Elegir modo básico desde paso 2 | Seleccionar "Usar modo básico" + "Continuar" | Estado = `basic`, vista de modo básico |
| 6 | Elegir configurar | Seleccionar "Configurar mi perfil" + "Continuar" | Avanza al paso 3 |
| 7 | Paso 3 sin preselección | Renderizar paso 3 | Ningún radio button seleccionado |
| 8 | Elegir manual | Seleccionar "Capturar manualmente" + "Continuar" | Avanza al paso 4a |
| 9 | Elegir tarjetón | Seleccionar "Importar mi tarjetón" + "Continuar" | Avanza al paso 4b (dropzone) |
| 10 | Navegación atrás | Click en "←" en paso 2 | Vuelve al paso 1 |
| 11 | Navegación atrás en paso 3 | Click en "←" en paso 3 | Vuelve al paso 2 con elección preservada |
| 12 | Barra de progreso | Renderizar wizard | Muestra "Paso N de 8" con barra visual; paso actual resaltado |

---

## Suite 2 — Captura manual

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 13 | Capturar categoría | SearchableSelect con opciones de categorías; valor seleccionado persiste en el draft |
| 14 | Capturar antigüedad | Input tipo date; formato dd/mm/aaaa; valor persiste |
| 15 | Seleccionar jornada | Radio group 6/6.5/8/12; por defecto 8h |
| 16 | Datos opcionales | Click "Continuar con opcionales" → adscripción y matrícula visibles |
| 17 | Saltar opcionales | Click "Saltar" → avanza al paso 5 |
| 18 | Validación de categoría vacía | Error: "Selecciona una categoría de la lista" |
| 19 | Validación de fecha inválida | Error: "Ingresa una fecha válida" |
| 20 | "¿Por qué necesito este dato?" | Tooltip/badge debajo del campo explica uso del dato |
| 21 | Revisión de captura manual | Paso 5 muestra los campos capturados con fuente "✏ Capturado manualmente" |
| 22 | Excluir campo en revisión | Click en [Excluir] → el campo desaparece de la lista confirmada |
| 23 | Editar campo en revisión | Click en [Editar] → input inline para modificar valor |
| 24 | Checkbox de consentimiento | Paso 6: checkbox sin preselección; botón "Siguiente" deshabilitado sin marcar |
| 25 | Confirmar captura manual | Checkbox marcado → "Siguiente" habilitado → paso 7 muestra resumen → "Confirmar y guardar" → RPC exitosa → paso 8 |
| 26 | Error al guardar | Simular fallo de RPC → mensaje funcional "No se pudo guardar tu perfil. Inténtalo de nuevo." + botón reintentar |

---

## Suite 3 — Importación de tarjetón

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 27 | Dropzone acepta PDF | TarjetónImporter renderizado en el paso 4b; acepta archivos PDF |
| 28 | Rechaza no-PDF | Muestra error "El archivo no es un PDF válido" |
| 29 | Extracción exitosa | Procesa PDF → avanza automáticamente al paso 5 con campos extraídos |
| 30 | Extracción fallida | Muestra error funcional; botón reintentar para volver a seleccionar archivo |
| 31 | Revisión con diferencias | Campos extraídos comparados contra perfil actual (si existe); diferencias marcadas |
| 32 | Autorizar actualización | Checkbox por campo para actualizar perfil (categoría, antigüedad, etc.) |
| 33 | Editar concepto | Tabla de conceptos con edición de importes confirmados |
| 34 | Confirmar tarjetón | Botón "Confirmar y guardar" → RPC exitosa → paso 8 con fuente "✓ Confirmado desde tarjetón" |
| 35 | PDF no se envía | Inspeccionar body de POST a /api/tarjeton/confirm: solo contiene source_hash + datos estructurados |

---

## Suite 4 — Centro configurado

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 36 | Modo actual visible | Badge: "Perfil configurado mediante captura manual / tarjetón" |
| 37 | Calidad del perfil | Barra de progreso con %; conteos (confirmados/manuales/pendientes); recomendaciones |
| 38 | Campos y fuentes | Cada campo muestra valor, fuente con ícono de color y "¿Por qué?" |
| 39 | Historial | Lista de eventos orden descendente con fechas relativas |
| 40 | Cambiar método (manual → tarjetón) | Diálogo con radio buttons; al confirmar, modo cambia y se emite evento |
| 41 | Actualizar datos manualmente | Botón "Actualizar datos" → abre wizard paso 4a con precarga |
| 42 | Importar nuevo tarjetón desde centro | Botón "Importar tarjetón" → abre TarjetonImporter |
| 43 | Borrar datos laborales | Sección con descripción + botón danger → escribe BORRAR → datos eliminados, modo basic |
| 44 | Borrar sin confirmación | Click en botón sin escribir BORRAR → no ocurre nada |
| 45 | Eliminar cuenta separada | Sección visualmente separada (divider); botón "Eliminar mi cuenta" existe pero no activo aún |

---

## Suite 5 — Casos límite

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 46 | Abandonar wizard | Navegar a otra ruta en cualquier paso → el draft se descarta, vuelve al estado previo |
| 47 | Sesión expirada en medio de guardado | Proxy redirige a /login; datos no guardados no se persisten |
| 48 | returnTo válido | `?returnTo=/calculadoras/aguinaldo` → paso 8 muestra botón "Volver a Aguinaldo" |
| 49 | returnTo inválido | `?returnTo=https://evil.com` → botón "Volver" muestra "Ir al inicio" |
| 50 | returnTo ruta no listada | `?returnTo=/admin/secreto` → "Ir al inicio" |
| 51 | Modo básico repetido | Click en "Usar modo básico" cuando ya está en basic → idempotente, sin error |
| 52 | Consentimiento rechazado | No marcar checkbox en paso 6 → botón deshabilitado; retroceder no guarda nada |
| 53 | Modo básico → configurar | Desde panel basic, click en "Configurar" → wizard paso 1; se crea perfil al confirmar |

---

## Suite 6 — Accesibilidad

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 54 | Navegación por teclado | Tab circula por todos los controles; Enter activa botones/radios |
| 55 | Escape en wizard | Escape en dialogo de cambiar método lo cierra sin guardar |
| 56 | Labels asociados | Cada input tiene `<label>`; lector de pantalla anuncia el propósito |
| 57 | Errores accesibles | `aria-describedby` asocia mensaje de error al campo que falló |
| 58 | Contraste suficiente | Texto sobre fondo respeta variables de tema; sin contraste bajo |

---

## Suite 7 — Regresión (sin tocar legacy)

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 59 | Login funciona | Usuario existente inicia sesión sin error |
| 60 | Register funciona | Nuevo usuario se registra con email+password; trigger crea profiles |
| 61 | ProfileForm edita datos personales | Guardar nombre/teléfono/avatar funciona (sin cambios en campos laborales) |
| 62 | TarjetonImporter standalone | `/tarjeton` sigue funcionando (no se rompió) |
| 63 | Calculadoras | Aguinaldo con categoría manual sigue calculando |
| 64 | Asistente IA | `/asistente` funciona |
| 65 | Nómina | Wizard de nómina accesible; no se modificó |
| 66 | Vacaciones | Simulador funciona |
