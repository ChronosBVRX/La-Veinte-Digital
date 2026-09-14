# Testing — Representación Sindical XXI

## Unitarios (Vitest, 32 tests)

```
npx vitest run src/features/representacion/__tests__
```

| Archivo | Cubre |
|---|---|
| `maternity.test.ts` (6) | 90 días exactos, cambio de mes/año, bisiesto 29-feb, febrero, rechazo de fecha |
| `lactation.test.ts` (5) | 365 días, caso 15/05/2026→14/05/2027, bisiesto, cambio de año, modalidades y acuerdo |
| `lockers.test.ts` (7) | normalización, disponible/activa, mantenimiento/bloqueo, doble-activo y override, orden de espera |
| `passages.test.ts` (4) | validación 026/027, campos diferenciados, PDF generados |
| `licencias.test.ts` (7) | con goce, rangos 1-3/4-60/61-365, prórroga, Excel+Word generados, folios |
| `validation-audit.test.ts` (3) | Zod worker/licencia, sanitización de auditoría |

## Documentos

Generados con datos ficticios en los tests de arriba. Verificación manual:
abrir XLSX/DOCX/PDF, comprobar valores en su lugar, 027 con 2 páginas,
impresión A4/Carta.

## E2E (Playwright)

`e2e/union-representacion.spec.ts`: usuario común redirigido fuera de
`/representacion` (protección por URL directa); estructura de páginas del
módulo; specs autenticados (representante) se ejecutan con `E2E_UNION_*`
cuando hay entorno sembrado.

## Importador lockers

```
npm run import:union-lockers -- --source "<ruta local>" --dry-run
```

Solo reporte local en `.local-private/delegacion-xxi/` (gitignored). `--apply`
no inserta conflictos silenciosamente.

## Baseline del repo

- `npm run typecheck` ✅ (pasa; igual que baseline).
- `npm run lint` — baseline con 46 errores preexistentes (`any`, efectos);
  el módulo nuevo no añade errores (cero `any`, casts vía `unknown`).
- `npm test` (suite completa) — ver reporte final para comparación.
- `npm run build` — debe pasar antes de integrar.
