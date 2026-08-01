# Calculadoras laborales

Módulo de calculadoras informativas de prestaciones, dentro de `src/features/calculators/`.

## Calculadoras y fórmulas

Todas las operaciones viven en funciones de dominio puras en `src/features/calculators/lib/` y están separadas de la interfaz. Los importes se redondean solo para la visualización final a dos decimales (`formatCurrency`, `Intl.NumberFormat` es-MX).

### 1. Aguinaldo (`lib/aguinaldo.ts`, ruta `/calculadoras/aguinaldo`)

| Concepto | Cómo obtenerlo |
|----------|----------------|
| 002 | Importe quincenal del concepto 002 (nómina) |
| 011 | Importe quincenal del concepto 011 (nómina) |

```text
base = 002 + 011
aguinaldoTotal = base × 7.490956567109524
anticipoEnero047 = total ÷ 6
anticipoAgosto043 = total ÷ 3
restoDiciembre049 = total ÷ 2
```

### 2. Segunda de julio (`lib/segundaJulio.ts`, ruta `/calculadoras/segunda-julio`)

```text
base = 002 + 011
resultado = (base ÷ 15) × 46
```

### 3. Segunda de julio proporcional 08/02 (`lib/segundaJulio.ts`, ruta `/calculadoras/segunda-julio-proporcional`)

```text
base = 002 + 011
importeCompleto = (base ÷ 15) × 46
resultado = importeCompleto × (días laborados ÷ 360)
```

Días laborados: entero entre 1 y 360 (base anual de 360 días de la aplicación fuente).

### 4. Tiempo extra (`lib/tiempoExtra.ts`, ruta `/calculadoras/tiempo-extra`)

```text
suma = 002 + 011 + 020 + Adicional 1 + Adicional 2 + 050
horasOrdinarias = jornada (6 | 6.5 | 8 | 12) × 15
valorHora = suma ÷ horasOrdinarias
pago = valorHora × 2 × horasExtra
```

Jornadas soportadas: `JORNADAS = [6, 6.5, 8, 12]`. El concepto adicional 1
corresponde al 023 o 063 del tarjetón.

**Aclaración sobre la fórmula corregida:** la implementación de referencia parecía
dividir entre las horas extra y multiplicar posteriormente por las mismas, anulando
su efecto. Esta plataforma utiliza la fórmula corregida en la que el valor por hora
se multiplica por las horas trabajadas. El comportamiento legado se conserva como
función técnica `calculateTiempoExtraLegacy` (nunca como resultado principal).

### 5. Cláusula 97 (`lib/clausula97.ts`, ruta `/calculadoras/clausula-97`)

```text
baseQuincenal = 002 + 011
1 mes = base × 2 | 2 meses = base × 4 | 3 meses = base × 6 | 4 meses = base × 8
```

Dos quincenas por mes. No se agregan intereses, descuentos ni plazos.

### 6. Préstamos por categoría (`lib/prestamos.ts`, ruta `/calculadoras/prestamos`)

Consume `src/features/calculators/data/prestamos_categoria.json` (117 categorías). El mapper tipado `mapJsonToPrestamoRecord` centraliza la traducción de las claves originales del tabulador:

```text
Cláusula 97 de 1 mes = SMTAB + concepto 011
Cláusula 97 de 2 meses = base × 2
Cláusula 97 de 3 meses = base × 3
Concepto 160 = base × 10 %
Automóvil = SMI × 24
Enganche = SMI × 15
Mediano plazo = SMI × 35
Hipotecario = SMI × 75
```

Si el JSON incluye los valores precalculados, se comparan contra el cálculo y, en desarrollo, se emite una advertencia si la diferencia supera $0.10; el valor original no se sobrescribe.

## Actualizar el tabulador

1. Reemplaza `src/features/calculators/data/prestamos_categoria.json` por el archivo nuevo (misma estructura de claves).
2. Ejecuta `npm test` — el test `el tabulador real tiene 117 registros y claves consistentes` valida que existan `SMTAB+11` y `C97 1 MES` por registro.
3. Revisa la consola en desarrollo por advertencias de diferencia > $0.10.

## Prerrelleno normativo (prefill)

Al abrir una calculadora, los valores salariales se prerrellenan desde el perfil
del trabajador y el tabulador vigente vía la API interna autenticada
`GET /api/calculator-prefill` (política cerrada por calculadora; el 022 nunca
se integra a una base y las horas extra nunca se prerrellenan). Los campos
editados nunca se sobrescriben. El prerrelleno se alimenta del contexto de
nómina (`payroll_contexts`) y de los tarjetones IMSS confirmados en `/tarjeton`.
Detalle: `docs/CALCULATOR_PREFILL.md`.

## Pruebas

```bash
npm test        # vitest run (incluye src/features/calculators/__tests__/calculators.test.ts)
npm run lint
npm run build
```

## Procedencia de las fórmulas

Las fórmulas fueron reconstruidas a partir del comportamiento y del código compilado de una aplicación de referencia. Deben verificarse contra la normativa, contrato colectivo y tabuladores vigentes antes de utilizarse para decisiones laborales o financieras.

## Seguridad y privacidad

- Los cálculos se ejecutan localmente en el cliente; ningún importe se envía a servidores externos.
- El prerrelleno consulta la API interna autenticada (`/api/calculator-prefill`), que solo devuelve los campos de la política cerrada; nunca contraseñas, RFC/CURP/NSS ni folios.
- No se registran salarios en consola de producción (solo advertencias de consistencia del tabulador en desarrollo).
- No hay historial ni almacenamiento de resultados.
