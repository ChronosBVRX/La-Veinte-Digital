# Normativa de reglas de dinero — Motor de nómina IMSS

> Reglas normativas del motor de proyección de nómina (`src/features/nomina/`).
> Cada regla declara `verificationStatus` y `confidence` en su resultado; esta
> documentación describe la fuente normativa de cada concepto.

Vigencias (ver `src/features/nomina/data/vigencias.ts`):

- CCT 2025-2027: desde 2025-10-16 hasta 2027-10-15.
- `NORMA_1000_001_020` (deducciones, expediente del trabajador).
- `PROC_1A74_003_031` (tiempo extra, límites 9 h/semana y 20 h/quincena).
- `PROC_1A74_003_024` (fondo de ahorro 055, base 002).
- Apéndice F, Tabla 07 (072) y Apéndice H, Tabla 67 (083).

`effectiveFrom: "2025-01-01"` expresa ausencia de evidencia de inicio posterior, no una fecha inventada.

## Tabla de reglas

| Cód. | Nombre | Fórmula | Base / dependencias | Elegibilidad | Repercusiones | Fuente | Referencia | Vigencia | verificationStatus |
|------|--------|---------|---------------------|--------------|---------------|--------|------------|----------|--------------------|
| 002 | Sueldo Tabular | Valor del tarjetón / tabulador | — (raíz) | siempre | 011, 02, 012, 013, 020, 022, 023, 050, 054, 055, 057, 058, 061, 062, 063, 072, 078, 083, 107 (weight 1.25) | CCT / tarjetón | — | CCT vigente | contract_verified |
| 011 | Ayuda de Renta (Cl. 63 Bis b) | 002 × 0.8215 (82.15%) o `conceptoTabular011` del catálogo | 002 | siempre | 022, 107 (1.25) | CCT | Cláusula 63 Bis, inciso b | CCT vigente | contract_verified |
| 02 | Cuota IMSS | 15.86% de la base | 002 | siempre | — | CCT | — | CCT vigente | contract_verified |
| 012 | Cesantía y Vejez (IMSS) | 15% | 002, 029 (SMI) | siempre | 030, 037, 107 (1.25) | CCT | — | CCT vigente | contract_verified |
| 013 | Retiro / Infonavit | 20% | 002, 029 (SMI) | siempre | 022, 030, 032, 037, 043, 047, 049, 107 (1.25) | CCT | — | CCT vigente | contract_verified |
| 020 | Ayuda de despensa | $250 quincenal | 002, 029 (SMI) | siempre | 030, 037, 107 | CCT | — | CCT vigente | contract_verified |
| 022 | Ayuda de Renta por Antigüedad (Cl. 63 Bis c) | Derecho anual = (base ÷ 15) × días según tabla; base resuelta por repercusiones | 002 + 011 + 013 + 057 + 058 + 061 | antigüedad ≥ 5 años (tabla `CLAUSE_63_BIS_C_DAYS`: 60 días a 5 años, +3 por año hasta 75, +9 hasta 150, +6 hasta 270) | — | CCT | Cláusula 63 Bis, inciso c | CCT vigente | contract_verified |
| 050 | Salario mínimo (SMI) | Reconstruido del tarjetón; sin evidencia de fórmula completa | 002, 029/048 (grupo SMI) | pendiente | 020, 022, 023, 050, 062, 063, 107 | — | — | CCT vigente | **pending_validation** |
| 051 | Fondo de vivienda | 20% | 002 | siempre | — | CCT | — | CCT vigente | contract_verified |
| 054 | Seguro de retiro (IMSS) | 20% | 002, 029 (SMI) | siempre | 030, 037, 107 | CCT | — | CCT vigente | contract_verified |
| 055 | Fondo de Ahorro | (002 ÷ 15 × 46) × (unidades ÷ 360); base = 002 (excluye 011) | 002 | 2ª quincena de julio (régimen ordinario); Estatuto Confianza A aparte | — | Procedimiento | 1A74-003-024 + Cláusula 144 CCT | CCT vigente | regulation_verified |
| 057 | Riesgo de trabajo (IMSS) | 16.5% | 002, 029 (SMI) | siempre | 022, 030, 032, 037, 043, 047, 049, 107 (1.25) | CCT | — | CCT vigente | contract_verified |
| 058 | Cesantía y Vejez adicional | 31% | 002, 029 (SMI) | siempre | 022, 030, 032, 037, 043, 047, 049, 107 (1.25) | CCT | — | CCT vigente | contract_verified |
| 061 | Infonavit | 10% | 002, 029 (SMI) | siempre | 022, 030, 032, 037, 043, 047, 049, 107 (1.25) | CCT | — | CCT vigente | contract_verified |
| 062 | Ayuda para Libros Médicos | 20% | 002, 029 (SMI) | personal médico | 030, 107 | CCT | — | CCT vigente | contract_verified |
| 063 | Ayuda de renta (parte no recurrente) | % sobre base | 002, 029 (SMI) | según cláusula | 030, 037, 107 | CCT | — | CCT vigente | contract_verified |
| 072 | Ayuda para Libros no Médicos | % institucional por categoría (Apéndice F, Tabla 07): 5% técnico radiólogo/trabajadora social/nutrición; 15% psicólogo, químico clínico, biólogo | 002, 029 (SMI) | categoría autorizada; SIN default: categoría no listada → 0 + `requires_confirmation` | 107/108/111/152/155/164 (grupo, ver PENDING_VALIDATION) | Apéndice del CCT | Apéndice F, Tabla 07 | CCT vigente | institutional_catalog_verified |
| 078 | — | 10% | 002 | siempre | — | CCT | — | CCT vigente | contract_verified |
| 083 | Sobresueldo por Investigación y Docencia | % institucional por categoría (Apéndice H, Tabla 67): 3% psicólogo clínico; 5% nutrición/trabajo social/puericultura-educadora | 002 | categoría autorizada; SIN default: categoría no listada → 0 + `requires_confirmation` | — | Apéndice del CCT | Apéndice H, Tabla 67 | CCT vigente | institutional_catalog_verified |
| 107/108/111/152 | Prima vacacional / compensaciones | Base = grupo 002, 011-019, 057, 058 (weight 1.25) + 020, 022, 023, 050, 062, 063 (weight 1) | grupo SMI | según cláusula | — | CCT | Cláusula 107 | CCT vigente | contract_verified (matriz) |

## Resolución de categorías (072 y 083)

Estricta, en orden: `categoryId` estable → `categoryCode` → nombre normalizado EXACTO
(sin acentos/mayúsculas/dobles espacios) → alias documentado. **No hay coincidencia
parcial ni porcentaje por defecto**: categoría desconocida → `percentage: null` y
`requires_confirmation: true` (ver `src/features/nomina/data/institutional-percentage-tables.ts`).
Las tablas usan nombres y `categoryIds` estables del catálogo
(`src/shared/data/catalogo-categorias.json`).

## Fondo de Ahorro (055) — núcleo compartido

- Régimen ordinario: base = sueldo tabular (002), **excluye 011** (proc. 1A74-003-024).
- Valor diario = 002 ÷ 15; importe completo = valor diario × 46 (Cl. 144 CCT);
  importe real = completo × (unidades ÷ 360).
- Sin unidades confirmadas → supuesto de año completo (360) con
  `requires_confirmation` y warning explícito.
- Implementación única en `src/shared/lib/fondo-ahorro.ts` (la usan el motor y la
  calculadora de segunda de julio; **no duplicar**).

## PENDING_VALIDATION

Elementos sin evidencia documental en el repo; se presentan con advertencia y
requieren confirmación humana:

- 050 (SMI): fórmula completa sin evidencia; grupo SMI y base se reconstruyen del tarjetón.
- 022: componente quincenal (anual ÷ 24) es estimación de referencia, no mecanismo de pago verificado.
- 055: unidades computables no confirmadas (supuesto 360).
- Repercusiones sin evidencia individual: 035 y 129/155/164/175/177 (Norma 1000-001-020),
  y 072 → 107/108/111/152/155/164 (grupo de compensaciones [072, 083, 020, 050, 112]).
- Aguinaldo (calculadora): factor 7.490956567109524 marcado `app_reconstructed`;
  alternativa documentada Cláusula 107 (factor 6) como comparación, `pending_validation`.

## Fuentes

- `src/data/guia-tarjeton/sources.ts` (documentos oficiales citados).
- El manual IMSS 2023 en `docs/guia-tarjeton/manual-imss-2023-completo.md` es
  transcripción NO oficial; no sustituye documentos oficiales.
- Matriz de repercusión: `src/features/nomina/data/repercussion-matrix.ts` (v2),
  cada relación con `sourceDocument` + `sourceReference`.
