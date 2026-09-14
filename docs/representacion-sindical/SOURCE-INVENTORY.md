# Inventario de fuentes D:\ — Representación Sindical XXI

> SIN datos personales. Solo estructura y uso. Los originales NUNCA se
> modifican, mueven, renombran ni versionan. Análisis 2026-09-14.

| Archivo | Uso en el módulo |
|---|---|
| `CÁLCULO INCAPACIDAD MATERNIDAD 1 AÑO.xlsx` (1 hoja `CÁLCULO MATERNIDAD`; fórmulas `E7=90+B7-1`, `F7=E7+1`, `H7=F7+365-1`) | Referencia del cálculo de maternidad/lactancia. Lógica reproducida en `lib/maternity.ts` + tests. |
| `CONTEO DE LACTANCIA ENF. GRAL. ANA JAZMIN RAMIREZ.xlsx` (conteo mensual + `SUM`, inicio→fin 365) | Referencia del conteo mensual de lactancia. Desglose reproducido en `lib/lactation.ts`. |
| `CONTEO DE LACTANCIA CECILIA ABAD GARCIA.xlsx` (conteo + hoja `Hoja2` con registro de visitantes) | Solo se usa el conteo (caso 15/05/2026→14/05/2027). La hoja de visitantes con PII NO se migra ni se reproduce. |
| `Copia de Copia de Copia de LOKER 2025.xlsx` (Hoja1 ~1259 filas: matrícula/nombre/plaza/turno/categoría/horario/#locker/estado; Hoja2 estadísticas; Hoja3 ~17 filas de espera con antigüedad; Hoja4 números) | Fuente histórica para migración de lockers. Importador `scripts/import-union-lockers.mjs` (dry-run/apply, reporte local, conflictos a revisión, sin sobrescritura silenciosa). Duplicados detectados (mismo locker y misma matrícula repetidos). |
| `Formato concepto 026-1.pdf` (1 pág., escaneado, sin texto extraíble) | Plantilla visual de pasaje 026. Recreate fiel con pdf-lib (dictamen en blanco). |
| `Formato concepto 027 aviso priv.pdf` (2 págs.: solicitud `1A32-009-010` + aviso de privacidad IMSS 26/03/2025) | Plantilla de pasaje 027. PDF de 2 págs. con aviso conservado. |
| `LICENCIA XXI SIN GOSE … .xlsm` (hojas `Generador` con celdas editables + fórmulas `CONCATENATE/TEXT/DATE/IF`, y `Licencia` formato `1A74-009-036` con ~23 fórmulas que referencian al Generador; área de impresión `A1:T58`; VBA: solo macro `Imprimir`, olevba) | Referencia del Excel de licencia. Captura única → ExcelJS (.xlsx sin macros) + Word. VBA sin lógica de negocio. |
| `ACUSE LICENCIA DELEGACION XIV … .docx` (oficio con encabezado SNTSS/Sección XX, fecha, destinatario Jefe de Personal HGR No.1, cuerpo con tipo/trabajador/motivo/periodo/turno, lema, firma Secretario del Interior XXI; defecto: cuerpo dice "Delegación XIV" pero el membrete es XXI) | Referencia del oficio. Plantilla sanitizada y parametrizada (delegación de configuración, default XXI corrige el defecto). |
| `General_Hgr 1_ (2).xlsx` (~2321 filas de padrón general) y `CONTEO …` adicionales | Solo referencia de estructura. NO se importan automáticamente (PII). El padrón del módulo se captura por representante. |

Archivos de trabajo locales (con posible PII) van a `.local-private/delegacion-xxi/`
(gitignored). En git solo fixtures ficticios (`00000001`, "Trabajadora Ejemplo Uno").
