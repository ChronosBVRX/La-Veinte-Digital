# Prerrelleno Normativo de Calculadoras

Sistema aislado de prerrelleno para las calculadoras IMSS. Cuando un
trabajador abre una calculadora, se cargan de forma automática los valores
salariales que ya se conocen de su perfil y del tabulador vigente — **sin tocar
ninguna fórmula de cálculo**.

## Objetivos y restricciones

1. **Aislamiento**: las calculadoras no importan código de la feature
   `nomina`. Todo el prerrelleno viaja por el contrato compartido
   (`src/shared/contracts/calculator-prefill.ts`) y por la API interna
   `GET /api/calculator-prefill`.
2. **Fórmulas intocadas**: los archivos en
   `src/features/calculators/lib/{aguinaldo,clausula97,segundaJulio,tiempoExtra,prestamos,money}.ts`
   no se modifican; solo cambia la capa de prerrelleno de los componentes.
3. **Nunca sobrescribir al usuario**: un campo editado no se reescribe. El
   prerrelleno se aplica una sola vez por respuesta y solo a campos vacíos; el
   botón "Restaurar valores sugeridos" reaplica los valores explícitamente.
4. **Lista cerrada de campos**: la política por calculadora
   (`src/features/nomina/lib/calculator-prefill-policy.ts`) define qué campos
   se entregan. Nada fuera de esa lista sale del servidor.
5. **El 022 es una prestación anual**: nunca se integra en una base. En
   Cláusula 97 se muestra como información independiente; en el resto de
   calculadoras no aparece.
6. **Las horas extra siempre se capturan a mano**: nunca se prerrellenan.
7. **Solo fuentes reales**: montos (050, 023, 063) y días laborados solo se
   prerrellenan con evidencia confirmada (tarjetón/payroll_contexts). Si no
   hay evidencia, la respuesta lo declara en `missingFacts`/`warnings` y la
   calculadora sigue siendo usable.
8. **Consentimiento explícito**: los datos provenientes del tarjetón
   (`payroll_contexts`) solo se usan si el trabajador otorgó el
   consentimiento (`payroll_contexts.consent_given = true`). Sin él, el
   prerrelleno usa únicamente el perfil básico (categoría/antigüedad
   registradas manualmente) y la respuesta incluye el warning
   "Los datos de tu tarjetón aún no se usan…". El consentimiento se otorga
   al confirmar un tarjetón, al aceptar el opt-in de nómina o al guardar el
   perfil laboral (servicio `src/shared/services/payroll-consent.ts`).

## Arquitectura

```
Calculadora (CSR)                       Server (nomina)
─────────────────                       ─────────────────
useCalculatorPrefill(calculatorId,date)
  └─> GET /api/calculator-prefill  ──> buildCalculatorPrefill()
  ────────────────────────────────>     ├─ profiles + payroll_contexts
                                        ├─ resolveCategory (tabulador + fecha)
                                        ├─ antigüedad (contexto > texto perfil)
                                        ├─ calculateProjection (motor existente)
                                        └─ buildCalculatorPrefillResponse()
  <─ contrato CalculatorPrefillResponse ─ política cerrada por calculadora

usePrefillFields(data)
  ├─ aplica solo a campos vacíos (una vez por generatedAt)
  ├─ marca dirty los campos editados
  └─ restore() reaplica los valores sugeridos
```

## Módulos

| Módulo | Ruta | Responsabilidad |
|---|---|---|
| Contrato | `src/shared/contracts/calculator-prefill.ts` | Tipos + validadores (`isCalculatorPrefillResponse`) |
| Política | `src/features/nomina/lib/calculator-prefill-policy.ts` | Lista cerrada por calculadora |
| Builder | `src/features/nomina/lib/calculator-prefill-builder.ts` | Arma la respuesta filtrada (puro, sin DB) |
| Servicio | `src/features/nomina/services/build-calculator-prefill.ts` | Lee DB, resuelve categoría/antigüedad, corre el motor |
| API | `src/app/api/calculator-prefill/route.ts` | Endpoint interno autenticado |
| Cliente | `src/features/calculators/services/calculator-prefill-client.ts` | Fetch tipado contra la API |
| Hook de datos | `src/features/calculators/hooks/useCalculatorPrefill.ts` | Estado data/loading/error/reload |
| Hook de campos | `src/features/calculators/hooks/usePrefillFields.ts` | Aplicación única + dirty + restore |
| Indicador | `src/features/calculators/components/PrefillStatus.tsx` | Estado visual del prerrelleno |

## Campos del contrato

| Campo | Tipo | Fuente |
|---|---|---|
| `categoryId` / `categoryName` | string | Perfil + tabulador |
| `concepto002` / `concepto011` | number | Tabulador (reglas 002/011 del motor) |
| `concepto020` | number | Motor, solo si incluido y con monto |
| `concepto022` | number | Solo Cláusula 97, como información |
| `concepto050` | number | Tarjetón confirmado, o motor si ya está calculado |
| `concepto054` | number | Motor, solo si la evidencia de exposición existe |
| `concepto023` / `concepto063` | number | Solo con evidencia confirmada en tarjetón |
| `workdayHours` | number | Derivada de la categoría (tiempo-extra) |
| `seniorityYears` / `effectiveSeniorityDate` | number / string | Cláusula 97 y 2ª julio proporcional |
| `daysWorkedInAnnualPeriod` | number | Solo 2ª julio proporcional, con fuente real (`last_payslip` = días del tarjetón confirmado más reciente) |

Cada campo lleva `source`, `confidence`, `effectiveAt`, `editable`,
`ruleVersion` y `legalReference` para trazabilidad.

## Integración en una calculadora

```tsx
const prefill = useCalculatorPrefill("aguinaldo", targetDate)

const prefillFields = usePrefillFields({
  fields,                    // { c002, c011 }
  setField,
  fieldMap: { c002: "concepto002", c011: "concepto011" },
  data: prefill.data,
  formatValue: (key, value) => key === "workdayHours" ? String(value) : formatSuggestedValue(value),
})
```

- `<PrefillStatus data loading error />` informa del origen de los valores.
- En la selección de categoría, llamar `prefillFields.markDirty(...)` para que
  el prerrelleno no pise lo capturado.
- El botón "Restaurar valores sugeridos" aparece solo con
  `prefillFields.hasSuggestions`.

## Base de datos

Tabla `payroll_contexts` (migración `supabase/migrations/003_payroll_contexts.sql`):
una fila por usuario con categoría resuelta, antigüedad efectiva, jornada,
condiciones ocupacionales, evidencia de conceptos recurrentes y el
consentimiento (`consent_given`, `consent_given_at`, añadidos en
`006_profiles_lifecycle.sql`). RLS: solo el propietario lee/escribe su fila.
Si no existe fila, el servicio degrada a `profiles` (categoría + antigüedad
textual) sin romper la calculadora.

El gating de consentimiento vive en `buildCalculatorPrefill`:
`contextProfile = contextRow?.consent_given === true ? contextRow : null`.
Con `consent_given = false`, ni categoría/jornada/antigüedad del tarjetón, ni
`daysWorkedInAnnualPeriod` se entregan al prerrelleno (solo el perfil manual).

La fila se **escribe al confirmar un tarjetón**: el RPC
`confirm_imported_payslip` (migración `004_imported_payslips.sql`) hace upsert
del contexto (categoría, jornada solo si es 6/6.5/8/12, antigüedad efectiva,
merge de 050/023/063 y hecho `concept_054_on_payslip`) dentro de la misma
transacción que persiste el recibo. El `ON CONFLICT DO UPDATE` del RPC **no
toca `consent_given`**: el consentimiento se otorga desde el cliente con
`grantPayrollConsent()` (`src/shared/services/payroll-consent.ts`, upsert de
`consent_given: true` + fecha) y se revoca con `revokePayrollConsent()`.

Además, el servicio lee el **tarjetón confirmado más reciente**
(`imported_payslips.payroll_totals.daysWorkedInYear`) para proveer
`daysWorkedInAnnualPeriod` con `source: "last_payslip"` — solo cuando el
consentimiento está otorgado.

## Pruebas

```bash
npx vitest run src/shared/contracts/__tests__/calculator-prefill-contract.test.ts  # validador del contrato (14)
npx vitest run src/features/nomina/__tests__/calculator-prefill.test.ts            # reglas del builder (23)
npx vitest run                                                                    # suite completa
```

Casos críticos cubiertos: 022 nunca integrado en tiempo-extra, horas extra
nunca prerrellenadas, 050/023/063 solo con evidencia, categoría ambigua sin
valores salariales, días laborados solo con fuente real, IDs anteriores del
tabulador (legacy), respuestas válidas contra el validador del contrato.

## Límites conocidos

- El prerrelleno de `daysWorkedInAnnualPeriod` depende de que exista un
  tarjetón confirmado; sin él, el campo queda vacío (declarado en
  `missingFacts`) y la calculadora sigue siendo usable.
- La API es de solo lectura; el prerrelleno se degrada elegantemente si el
  contexto aún no existe.
