# Reglas normativas — Representación Sindical XXI

Fecha de consulta de todas las fuentes: **2026-09-14**.
Motor en `src/features/representacion/lib/` + `normative.ts` (cada regla cita
fuente, cláusula, versión y vigencia). La UI muestra el fundamento sin
hardcodear lógica.

## Maternidad — CCT IMSS-SNTSS 2025-2027, Cláusula 77

- 90 días naturales de descanso con salario íntegro desde la expedición/inicio
  de la incapacidad. Día inicial = día 1.
- Implementación (reproduce el Excel operativo `E7=90+B7-1, F7=E7+1`):
  `incapacityEnd = start + 89`, `returnToWork = end + 1`,
  `lactationStart = returnToWork`, `lactationEnd = returnToWork + 364`.
- Ejemplo: inicio 2026-01-01 → fin 2026-03-31 (90 días inclusivos).
- Texto obligatorio: "Cálculo administrativo orientativo basado en fecha de
  incapacidad registrada." Nunca presentarlo como incapacidad emitida.

## Lactancia — CCT 2025-2027, Cláusula 77

- 365 días naturales desde la reanudación (`F7+365-1` del Excel).
- Caso operativo verificado: inicio 15/05/2026 → fin 14/05/2027.
- Desglose mensual calendario (conteo como el Excel de referencia).
- Días laborables solo como información secundaria, nunca como plazo.
- Modalidades por jornada (requiere revisión editorial si el CCT se actualiza):
  - 8h: reducción de 1 hora o dos descansos de 30 min.
  - ≤6.5h: descanso de 30 min — "Modalidad sujeta a acuerdo con el Instituto."
  - Acumulada (diurna/nocturna): modalidad específica — sujeta a acuerdo.
- No sustituir "previo acuerdo" por aprobación automática.

## Pasajes — Cláusula 103 + Procedimiento 1A32-A03-008

- 026: compensación fija para personal con funciones extramuros.
- 027: compensación por pasajes conforme a Cl. 103 y Reglamento.
- El sistema pre-valida, prepara, guarda expediente, exporta PDF y registra
  resultado. NO dictamina, NO autoriza, NO inventa número de control SIAP
  (vacío = "pendiente"), NO simula firmas.
- Formatos: 026 (1 pág.) y 027 `1A32-009-010` (2 págs.; la 2ª conserva el aviso
  de privacidad institucional del IMSS).

## Licencias — Procedimiento 1A74-003-034, formato 1A74-009-036

- Captura única → Excel (.xlsx, sin macros) + oficio Word.
- Rangos solo como clasificación visual: con goce / sin goce 1-3 / 4-60 / 61-365.
- Prórroga + licencias anteriores, motivo indispensable (sin diagnóstico),
  comprobantes, control de adeudos ("Pendiente de certificación" hasta
  confirmación del representante).
- El software genera y controla la solicitud; no la concede.

## Lockers — Cláusulas 67/68 (fundamento general)

- La Cl. 68 exige mobiliario adecuado y seguro. NO crea un criterio de
  prioridad para repartir lockers.
- Orden operativo por defecto: fecha de solicitud ascendente; `priority_override`
  administrativo permitido solo con motivo auditado.
- Constraints DB: un activo por locker; un activo por trabajador salvo override.
- Liberar = `released_at` + motivo; historial permanente.

## Fuentes en el corpus local

- CCT 2025-2027 y procedimientos 1A32-A03-008 / 1A74-003-034 están en
  `resources/normativa/bootstrap-sources.yaml` (válido; imss.gob.mx con WAF —
  no hacer refresh masivo).
- Documentos D:\ aportados: ver `SOURCE-INVENTORY.md` (referencia operativa).
- Macros del XLSM: solo `Imprimir` (2 copias, olevba 2026-09-14). Sin lógica de
  cálculo en VBA; todo reproducido en TypeScript con tests.
