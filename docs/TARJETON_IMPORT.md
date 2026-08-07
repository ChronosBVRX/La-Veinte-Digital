# Importación de Tarjetón IMSS

Módulo `src/features/tarjeton/`: el trabajador sube el PDF de su recibo de pago
del IMSS, el sistema lo extrae **100% en su navegador**, él revisa cada campo y
solo entonces se persiste el resultado estructurado en Supabase. El PDF nunca
sale del dispositivo.

## Flujo

```
/ tarjeton (RSC: snapshot del perfil)
  └─ TarjetonImporter (CSR) ── useTarjetonImporter
       idle ──subir PDF──▶ reading
         ├─ PDF.js texto nativo  → ¿>= 120 chars? ─┐
         └─ Tesseract OCR (fallback, con progreso) ─┴─▶ parseImssTarjeton
       reading ──parseado──▶ review (Revisión humana campo por campo)
       review ──Confirmar──▶ POST /api/tarjeton/confirm ──▶ RPC confirm_imported_payslip
       confirming ──éxito──▶ done (ImportSuccess)
```

Límites: máximo 10 MB y 4 páginas. Firma `%PDF-` obligatoria. Si el texto
nativo del PDF tiene menos de 120 caracteres se asume escaneado y se corre OCR
(Tesseract español, worker local en `public/vendor/`, fallback a CDN).

## Orquestador (`lib/imss-tarjeton-parser.ts`)

`parseImssTarjeton({ items, pageCount, hashText? })` une piezas puras:

| Pieza | Archivo | Qué extrae |
|---|---|---|
| Perfil | `lib/imss-profile-parser.ts` | NSS, CURP, RFC, matrícula, nombre, adscripción, categoría, unidades, crédito. `readLabelValue` usa la etiqueta **más larga** de la línea (p. ej. "CLAVE DE CATEGORIA/PUESTO" > "CATEGORIA/PUESTO") |
| Conceptos | `lib/imss-concept-table-parser.ts` | Tablas de percepciones/deducciones (`^(\d{3}) +descripción +monto$`), descripciones multilínea, totales por etiqueta |
| Observaciones | `lib/imss-observations-parser.ts` | Periodo de pago, unidades, número de control, cargo inicial, notas |
| Sanitización | `lib/sanitize-sensitive-fields.ts` | RFC/CURP/NSS/cuenta/QR/sellos/folios fiscales: se descartan o enmascaran. `fiscalFolioHash` no es sensible |
| Confianza | `lib/confidence.ts` | Puntaje por campo (método de extracción, `requiresReview`) |
| Validación | `lib/validations.ts` | Totales (tolerancia 0.05), cordura 002/011, fechas, días |
| PDF | `lib/pdfjs-client.ts` + `lib/extract-native-pdf.ts` | Lectura nativa (PDF.js 6, `loadingTask.destroy()`) |
| OCR | `lib/render-pdf-page.ts` + `lib/run-ocr-fallback.ts` | Render (scale 2, escala de grises) + Tesseract 7 con `blocks: true` |

El resultado (`ParsedImssTarjeton`, `schemaVersion: "1.0"`) alimenta la
revisión; los campos sensibles se muestran enmascarados.

## Persistencia (`POST /api/tarjeton/confirm`)

Solo el **resultado estructurado** (`ConfirmTarjetonRequest` de
`src/shared/contracts/tarjeton-import.ts`) viaja por la red, junto con el
SHA-256 del PDF como llave de deduplicación.

El RPC `confirm_imported_payslip` (`supabase/migrations/004_imported_payslips.sql`)
hace todo en una transacción:

1. Valida el contrato en servidor (schemaVersion, tipo, método, confianza,
   límite de 80 líneas/observaciones).
2. Recalcula totales con tolerancia 0.05; si no cuadran y el usuario no lo
   reconoció → `totals_mismatch`.
3. Si la matrícula del tarjetón difiere del perfil y no se autorizó el cambio
   → `matricula_mismatch`.
4. `UNIQUE(user_id, source_hash)` → respuesta `{ duplicate: true }` sin error.
5. Inserta cabecera + líneas + observaciones en `imported_payslips*`.
6. Actualiza `profiles` **solo** con los campos autorizados en
   `profileUpdates` (full_name, matricula, adscripcion, categoria,
   antiguedad — nunca teléfono).
7. Upsert de `payroll_contexts`: categoría, jornada solo si es 6/6.5/8/12,
   antigüedad efectiva, merge de recurrentes 050/023/063 y hecho
   `concept_054_on_payslip`.

Respuesta: `{ id, duplicate, profileUpdated, payrollContextUpdated }`.
Errores HTTP: 401 / 400 (`invalid_payload`, `template_not_detected`) / 422
(`totals_mismatch`, `matricula_mismatch`, `duplicate`, `limits_exceeded`) / 500.

## Sync local (`services/payslip-sync.ts`)

Tras confirmar, `syncConfirmedPayslip` persiste en localStorage el recibo
(`imported_payslips` local) y el perfil actualizado (categoría, fecha de
ingreso, antigüedad mostrada si `fortnights === 0`, recurrentes y hecho 054).
`useNomina` lo recoge al montar (`initState` + `hydrate`), así que la
proyección ya ve los datos del tarjetón sin migraciones adicionales.

## Privacidad

- El PDF se lee con PDF.js/OCR en el navegador; nunca se sube al servidor.
- No se persisten RFC, CURP, NSS, cuenta bancaria, QR ni sellos digitales.
- El folio fiscal se guarda solo como hash (SHA-256).
- Los campos sensibles se muestran enmascarados en la revisión.

## Pruebas

```bash
npx vitest run src/features/tarjeton/__tests__/tarjeton-parsers.test.ts  # parsers + orquestador (16)
npx vitest run src/features/tarjeton/__tests__/confirm-tarjeton.test.ts   # servicio de confirmación (6)
npx vitest run                                                             # suite completa
```

Los fixtures de prueba son ficticios (no contienen datos reales de ningún
trabajador).

## Integraciones

- **Prefill de calculadoras**: `build-calculator-prefill.ts` lee el último
  tarjetón confirmado (`imported_payslips.payroll_totals.daysWorkedInYear`)
  para `daysWorkedInAnnualPeriod` con `source: "last_payslip"`.
- **Tiempo Extra**: la jornada de 6 horas está soportada
  (`JORNADAS = [6, 6.5, 8, 12]`); el RPC solo acepta esos valores en
  `workday_hours`.
- **Navegación**: link "Mi Tarjetón" en la Sidebar; CTAs en Calculadoras y
  Nómina apuntan a `/tarjeton`.

## Riesgos abiertos conocidos

1. **Idempotencia de la deduplicación en DB**
   - La base de datos impide duplicados mediante `UNIQUE(user_id, source_hash)`
     en `imported_payslips`.
   - El cliente no bloquea el botón de confirmar hasta recibir respuesta; si
     el usuario hace doble clic o hay una reconexión lenta, pueden enviarse
     dos requests casi simultáneos. El test de concurrencia en
     `confirm-tarjeton.test.ts` simula este escenario y espera que el segundo
     request devuelva `duplicate`.
   - Riesgo real: una carrera concurrente entre dos transacciones puede hacer
     que ambas pasen el `SELECT` inicial y luego una reciba una violación
     `unique_violation` en lugar de la respuesta normalizada `duplicate: true`.
     El servicio (`confirm-tarjeton.ts`) ya mapea ese error al código
     `duplicate`, pero la respuesta no incluye el `id` existente.
   - Mitigación actual: `requestRef` en `useTarjetonImporter` previene el
     reenvío mientras `status === "confirming"`. Mejora futura: capturar
     `unique_violation` dentro del RPC y devolver la fila existente como
     respuesta `duplicate: true`.

2. **Comportamiento de rechazo parcial en la UI**
   - `parseImssTarjeton` ahora devuelve `reviewMode: "rejected"` cuando el
     detector de plantilla falla o faltan datos críticos. En ese modo la UI
     muestra el mensaje de error y no permite continuar.
   - Si `reviewMode` es `"full"` o `"critical_fields"`, el flujo de revisión
     obliga al usuario a confirmar cada concepto, pero aún no distingue
     visualmente entre "campos críticos" y "campos secundarios": todos se
     presentan en la misma lista. Esto puede hacer que un campo de baja
     confianza pase desapercibido si el usuario confirma sin leer.
   - Mitigación actual: `autoConfirmable` nunca es `true` cuando
     `criticalFieldConfidence < 1`, y `reviewMode` obliga a revisión
     completa en esos casos.

3. **Fecha de referencia opcional de antigüedad**
   - `TarjetonSeniority.referenceDate` y
     `EmployeePayrollProfile.displayedSeniorityAtLastPayslip.referenceDate`
     son opcionales para soportar datos antiguos o parsers que no logren
     reconstruir el periodo.
   - Si falta, `payslip-sync.ts` usa `parsed.document.periodRaw` como fallback.
   - `useNomina` y `TodayCard` verifican la existencia de `referenceDate`
     antes de reconstruir la antigüedad; si falta, el cálculo de antigüedad
     evolucionada se omite silenciosamente hasta que llegue un tarjetón con
     fecha de referencia completa.
