# PR2 — Plan de backfill

> Diseño del backfill idempotente de los campos laborales legacy de `profiles`
> hacia `payroll_contexts`. NO es SQL ejecutable todavía.

## 1. Fuentes y destinos

| Origen (profiles) | Destino (payroll_contexts) | Fuente a registrar |
|-------------------|---------------------------|--------------------|
| `matricula` | `matricula` | `manual` (legacy, no hay evidencia de origen) |
| `adscripcion` | `adscripcion` | `manual` |
| `categoria` | `category_name` | `manual` (a menos que exista tarjetón) |
| `antiguedad` (texto) | `effective_seniority_date` (DATE) | **no directo** — ver §4 |

`shift`, `source_*` para jornada/contratación: sin fuente en `profiles` → `NULL` (no se inventan).

## 2. Reglas conservadoras

1. **No sobrescribir un valor más confiable.** Si `payroll_contexts.category_name` ya existe (por tarjetón confirmado), NO se pisa con `profiles.categoria`. El orden de confianza es: `payslip_confirmed` (de tarjetón) > `calculated` (derivado) > `manual` (captura) > legacy de profiles.
2. **No inventar `payslip_confirmed`.** Un valor que solo vino de `profiles` (sin `imported_payslips` que lo respalden) se marca `manual`.
3. **Legacy desconocido → `manual` o `inferred` según evidencia.** Sin evidencia de origen → `manual`. Si hay un tarjetón confirmado cuyo `employee_data` coincide con el valor → `payslip_confirmed`.
4. **Conflictos documentados, no resueltos silenciosamente.** Si `profiles.categoria` ≠ `payroll_contexts.category_name` existente, se **registra una fila en un log de conflictos** (tabla `backfill_conflicts` o un evento documental) y NO se sobrescribe; se conserva el valor de mayor confianza.

## 3. Casos contemplados

### 3.1 Usuario con `payroll_contexts` existente
- Rellenar solo columnas vacías (`COALESCE`) con valores legacy de profiles.
- No pisar columnas ya pobladas.

### 3.2 Usuario sin `payroll_contexts`
- Crear fila con `user_id`, valores de profiles, `source_*='manual'`, `updated_at=now()`.
- `ON CONFLICT (user_id) DO NOTHING` → idempotente.

### 3.3 Usuario con tarjetón confirmado
- `payroll_contexts.category_name` ya poblado por RPC → se respeta (confianza mayor).
- Si además `profiles.categoria` difiere, documentar conflicto.

### 3.4 Datos contradictorios
- `profiles.categoria` ≠ `payroll_contexts.category_name`: conservar el de `payroll_contexts` (mayor confianza), documentar.

### 3.5 Categoría en profiles pero otra en payroll_contexts
- Igual que §3.4.

### 3.6 Antigüedad textual que no pueda convertirse a fecha
- `profiles.antiguedad` es texto libre (`"18 años 3 meses"`). La conversión a `effective_seniority_date` (DATE) requiere un parser.
- Si el parseo falla o produce fecha no razonable → dejar `effective_seniority_date` en NULL y documentar.
- NO se fabrica una fecha. La antigüedad textual puede quedar como dato informativo en `profiles` (legacy) hasta PR9.

### 3.7 Filas parcialmente llenas
- Rellenar solo los campos vacíos; nunca `NULL` sobre un valor existente.

### 3.8 Ejecución repetida
- Idempotente: segunda corrida no cambia nada (COALESCE + ON CONFLICT DO NOTHING + no re-marcar fuentes ya seteadas).

## 4. Parsing de antigüedad (opcional, conservador)

- Parseador acotado: patrones `N años`, `N años M meses`, `N años M meses D días`, `N meses`, etc.
- Si el parser produce una fecha, marcarla `calculated` (derivada), **no** `manual` ni `payslip_confirmed`.
- Si no, NULL + documentación.

## 5. Tabla de conflictos (propuesta)

```
backfill_conflicts
- id            bigint identity PK
- user_id       uuid NOT NULL
- field         text NOT NULL
- legacy_value  text
- kept_value    text
- reason        text NOT NULL
- created_at    timestamptz NOT NULL DEFAULT now()
```
- Solo la escribe el backfill (admin/service_role). No expuesta a authenticated.
- Al eliminar cuenta: cascade por user_id (o limpieza periódica).

## 6. Orden de ejecución (dentro de la migración, en una transacción)

1. Crear tablas nuevas + columnas nuevas + policies + grants.
2. Ejecutar backfill de `worker_preferences` (crear fila `unconfigured` para todo `auth.users` existente sin fila).
3. Ejecutar backfill de `payroll_contexts` (casos §3).
4. Registrar conflictos en `backfill_conflicts`.
5. (Opcional) migrar consentimientos legacy `consent_given` → `worker_consents` con `version = consent_version ?? '1.0'`, `accepted_source='tarjeton'` cuando `consent_given=true`.
6. Insertar eventos `profile_created` / `mode_changed` informativos para usuarios ya configurados (solo si procede; no fabricar historial falso de más).

## 7. Validación del backfill

- Consultas de verificación: recuento de filas creadas, columnas pobladas, conflictos registrados.
- Prueba de idempotencia: ejecutar dos veces, resultados idénticos.
