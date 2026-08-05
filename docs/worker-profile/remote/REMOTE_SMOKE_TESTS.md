# Remote Smoke Tests — Perfil Laboral

> Ejecutar contra producción DESPUÉS de aplicar la migración y desplegar el
> frontend. Cuenta sintética de prueba. No usar datos reales.

## Suite 1 — Autenticación y perfil personal

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 1 | Login con cuenta existente | `/` dashboard carga sin error |
| 2 | Registro nuevo (email sintético) | Cuenta creada, redirige a `/` |
| 3 | Editar perfil personal (nombre, teléfono) | ProfileForm guarda sin error. Campos laborales no aparecen. |
| 4 | Enlace "Datos laborales" visible en /profile | Click lleva a `/profile/mi-informacion-laboral` |

## Suite 2 — Onboarding

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 5 | Usuario nuevo visita `/profile/mi-informacion-laboral` | Muestra wizard paso 1 (bienvenida) |
| 6 | Elegir "Usar modo básico" | Estado `basic`. No se crean datos laborales. |
| 7 | Volver a visitar el centro | Muestra panel "Estás en modo básico" |
| 8 | Configurar perfil → captura manual | Wizard paso 2→3→4 |
| 9 | Capturar categoría, antigüedad, jornada | Paso 4: campos con "¿Por qué?" |
| 10 | Revisar datos | Paso 5: muestra campos capturados |
| 11 | Consentimiento no preseleccionado | Paso 6: checkbox vacío, botón deshabilitado |
| 12 | Marcar consentimiento y confirmar | Perfil guardado, resumen muestra calidad |
| 13 | Recargar y ver estado configured/manual | Centro muestra campos, fuentes, calidad |
| 14 | ProfileForm no muestra campos laborales | Solo nombre y teléfono editables |

## Suite 3 — Cambio de modo y tarjetón

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 15 | Cambiar manual → payslip | Diálogo "Cambiar método" → modo `payslip` |
| 16 | Cambiar payslip → manual | Vuelve a manual, tarjetones conservados como evidencia |
| 17 | Importar tarjetón sintético | Paso 3: elegir tarjetón → paso 4b: seleccionar PDF sintético |
| 18 | Revisar campos extraídos | Muestra campos con fuente "Detectado desde tarjetón" |
| 19 | Excluir campo en revisión | Desmarcar checkbox → campo no aparece en confirmación |
| 20 | Editar campo en revisión | Botón "Editar" → valor corregido en payload |
| 21 | Confirmar con consentimiento no preseleccionado | Checkbox vacío, solo se habilita al marcar |
| 22 | Confirmar guardado | Paso 8: resumen, perfil configured/payslip |

## Suite 4 — Historial, consentimiento y borrado

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 23 | Eventos visibles en el centro | Historial muestra eventos (mode_changed, consent_granted) |
| 24 | Borrar datos laborales | Exige escribir BORRAR. Cuenta permanece. |
| 25 | Tras borrar, estado es basic | Centro muestra panel de modo básico |
| 26 | Volver a configurar perfil | Funciona desde basic |

## Suite 5 — Compatibilidad con features existentes

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 27 | Login funciona | Sesión inicia sin error |
| 28 | Registro funciona (trigger handle_new_user) | Perfil creado automáticamente |
| 29 | Calculadora de aguinaldo funciona | Categoría capturada manualmente calcula |
| 30 | Asistente IA funciona | `/asistente` responde consulta de prueba |
| 31 | `/api/health` responde 200 | JSON `{ status: "ok" }` |
| 32 | `/tarjeton` funciona (importador standalone) | Flujo de importación legacy OK |
| 33 | Vacaciones funciona | Wizard accesible |
| 34 | Nómina funciona | `/nomina` carga sin error |
| 35 | No hay 401/403/500 inesperados en rutas legacy | Dashboard, perfil, calculadoras, escritos OK |

## Suite 6 — Seguridad y datos

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 36 | PDF nunca se envía al servidor | Network tab: solo datos estructurados en POST |
| 37 | `/chat` y `/foro` no existen en frontend | 404 esperado en esas rutas |
| 38 | `worker_data_events` no contiene valores sensibles | Audit via SQL: metadata sin matricula/categoria/salary |

## Rollback de frontend si falla

Si algún smoke test falla (401/403/500 en rutas no esperadas):
1. Revertir deploy de Vercel al último release estable.
2. Mantener migración aplicada (no hace daño sin frontend).
3. Investigar causa.
4. Re-ejecutar solo el paso que falló.
