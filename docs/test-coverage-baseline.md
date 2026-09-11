# 🛡️ Línea Base y Puerta de Cobertura de Pruebas — La Veinte Digital

> **Fecha de captura:** 2026-09-10  
> **Motor de cobertura:** Vitest v4.1.11 con `@vitest/coverage-v8`  
> **Comando de verificación:** `npm run test:coverage`  
> **Archivo de configuración:** `vitest.coverage.config.ts`

---

## 1. Resumen Ejecutivo

La suite de pruebas para la lógica de negocio crítica de **La Veinte Digital** establece una línea base de cobertura verificada y ejecutable sobre las 4 áreas nodales del sistema:

1. **`src/features/tarjeton/lib/`**: Parsers geométricos de tarjetón IMSS, sanitizadores PII, validadores de totales y algoritmos de reconstrucción de antigüedad.
2. **`src/features/calculators/lib/`**: Fórmulas laborales de CCT (aguinaldo, prima vacacional, cláusula 97, tiempo extra, préstamos sindicales, segunda quincena de julio).
3. **`src/shared/server/worker-context-builder.ts`**: Hidratación canónica del perfil laboral del trabajador, resolución de exposición radiológica y verificación de identidad.
4. **`src/features/normativa/core/`**: Normalización tipográfica, hashing criptográfico de fuentes y consistencia del catálogo documental.

---

## 2. Métricas Globales de Cobertura y Puerta CI (Thresholds)

| Dimensión | Cobertura Actual | Umbral Mínimo Exigido (CI Gate) | Estado | Margen de Seguridad |
| :--- | :---: | :---: | :---: | :---: |
| **Sentencias (Statements)** | **76.83%** | **75.00%** | ✅ APROBADO | +1.83% |
| **Ramas (Branches)** | **66.64%** | **65.00%** | ✅ APROBADO | +1.64% |
| **Funciones (Functions)** | **84.45%** | **80.00%** | ✅ APROBADO | +4.45% |
| **Líneas (Lines)** | **79.47%** | **75.00%** | ✅ APROBADO | +4.47% |

*Todos los umbrales están configurados con política `fail-closed`: cualquier regresión que degrade la cobertura por debajo de los umbrales detendrá inmediatamente el pipeline de integración continua.*

---

## 3. Desglose Detallado por Módulo

### A. Módulo `tarjeton/lib` (Procesamiento del Tarjetón IMSS)
- **Total Módulo:** 76.84% Stmts | 68.93% Branch | 88.95% Funcs | 79.37% Lines

| Archivo | % Stmts | % Branch | % Funcs | % Lines | Estado / Aspectos Clave |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `confirm-mark.ts` | **100%** | **100%** | **100%** | **100%** | Validación estricta de marcas de confirmación |
| `template-detector.ts` | **100%** | **100%** | **100%** | **100%** | Detección geométrica del formato IMSS |
| `layout-regions.ts` | 97.36% | 88.88% | 100% | 97.10% | Segmentación de coordenadas visuales |
| `observations-parser.ts`| 96.15% | 85.29% | 100% | 98.75% | Parsing de notas, licencias y observaciones |
| `validations.ts` | 93.54% | 73.17% | 83.33% | 96.42% | Balance estricto de percepciones y deducciones |
| `positioned-text.ts` | 93.33% | 100% | 83.33% | 92.30% | Normalización de glifos y espaciado |
| `seniority-parser.ts` | 90.38% | 71.87% | 100% | 100% | Antigüedad (años, quincenas, días) |
| `safe-values.ts` | 88.80% | 82.96% | 100% | 87.90% | Rango seguro y límites numéricos |
| `tarjeton-parser.ts` | 87.64% | 77.61% | 100% | 87.89% | Orquestador principal de extracción |
| `money-parser.ts` | 86.66% | 86.66% | 100% | 100% | Parsing y redondeo de importes a 2 decimales |
| `imss-date-parser.ts` | 82.24% | 77.50% | 100% | 89.47% | Parseo de fechas DDMMYYYY y formato mexicano |
| `sanitize-sensitive-fields.ts` | 87.87% | 80.00% | 100% | 92.00% | Purga profunda de PII (RFC, CURP, NSS, cuentas) |
| `reconstruction.ts` | 76.40% | 64.28% | 83.33% | 76.81% | Reconstrucción de fecha de ingreso |
| `table-parser.ts` | 73.18% | 65.27% | 92.85% | 73.78% | Alineación de filas de percepciones/deducciones |
| `profile-parser.ts` | 67.54% | 49.00% | 100% | 71.87% | Extracción de categoría y adscripción |

### B. Módulo `calculators/lib` (Fórmulas Laborales Contractuales)
- **Total Módulo:** 75.45% Stmts | 46.33% Branch | 79.41% Funcs | 77.83% Lines

| Archivo | % Stmts | % Branch | % Funcs | % Lines | Cobertura de Fórmulas |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `clausula97.ts` | **100%** | **100%** | **100%** | **100%** | Prima vacacional contractual IMSS |
| `segundaJulio.ts` | 94.11% | 100% | 80.00% | 92.85% | Bono de 2da quincena de julio |
| `money.ts` | 90.90% | 100% | 66.66% | 87.50% | Redondeo monetario de precisión laboral |
| `tiempoExtra.ts` | 86.95% | 82.08% | 91.66% | 87.30% | Horas extras dobles y triples CCT |
| `aguinaldo.ts` | 85.29% | 52.63% | 100% | 84.84% | Aguinaldo ordinario y proporcional |
| `prestamos.ts` | 53.08% | 21.01% | 63.63% | 58.82% | Capacidad de crédito y tabla de amortización |

### C. Módulo `shared/server` (Contexto Laboral y Aislamiento)
- **Total Módulo:** 80.85% Stmts | 75.41% Branch | 90.00% Funcs | 85.15% Lines

| Archivo | % Stmts | % Branch | % Funcs | % Lines | Propósito de Aislamiento |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `worker-context-builder.ts` | 80.85% | 75.41% | 90.00% | 85.15% | Ensamblado canónico de datos de perfil, exposición radiológica y verificación de identidad |

### D. Módulo `normativa/core` (Consistencia Documental)
- **Total Módulo:** 72.85% Stmts | 47.22% Branch | 54.54% Funcs | 75.00% Lines

| Archivo | % Stmts | % Branch | % Funcs | % Lines | Propósito |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `normalize.ts` | **100%** | **100%** | **100%** | **100%** | Normalización tipográfica de citas y textos |
| `hashing.ts` | 63.15% | 33.33% | 55.55% | 66.66% | Hashing SHA-256 e integridad documental |
| `manifest.ts` | 45.45% | 31.57% | 14.28% | 50.00% | Generación de manifiestos |

---

## 4. Rutas Críticas al 100% de Cobertura

Las siguientes funciones y módulos neurálgicos cuentan con cobertura completa (100% en sentencias, ramas y líneas):
1. **`clausula97.ts`**: Cálculo del factor de prima vacacional por año de antigüedad según el Contrato Colectivo de Trabajo IMSS.
2. **`template-detector.ts`**: Detección determinista y rechazo instantáneo de documentos que no corresponden a un tarjetón de pagos IMSS.
3. **`confirm-mark.ts`**: Verificación inmutable del consentimiento explícito del trabajador.
4. **`normalize.ts`**: Normalización tipográfica de caracteres acentuados, eñes y caracteres especiales de leyes y contratos.

---

## 5. Casos de Borde No Cubiertos Identificados y Justificación

1. **`prestamos.ts` (líneas 65-81, 92, 99)**:
   - *Causa*: Ramas de validación de plazos extremos mayores a 72 quincenas y categorías especiales sin capacidad de descuento.
   - *Impacto*: Bajo; las calculadoras de préstamos en el frontend limitan los selectores de quincenas al rango legal de 1 a 48.
2. **`pdfjs-client.ts` y `render-pdf-page.ts`**:
   - *Causa*: 0% en pruebas Node.js porque dependen de `window.document`, canvas HTML5 y worker threads de PDF.js del navegador.
   - *Mitigación*: Se prueban exhaustivamente en la suite E2E de Playwright (`e2e/full/tarjeton.spec.ts`).
3. **`manifest.ts` (líneas 50-71)**:
   - *Causa*: Funciones de volcado CLI a disco usadas en scripts administrativos fuera del runtime web.

---

## 6. Configuración de la Puerta en CI

El script `test:coverage` ha sido incorporado al flujo de validación mediante `package.json` y `vitest.coverage.config.ts`.
Cualquier modificación futura que reduzca la cobertura por debajo de:
- **75% en Sentencias**
- **65% en Ramas**
- **80% en Funciones**
- **75% en Líneas**

resultará en la falla automática e inmediata del pipeline.
