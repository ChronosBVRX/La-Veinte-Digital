# Plantillas de documentos — Representación Sindical XXI

Todas se generan en runtime Vercel con dependencias Node puras (sin Office,
sin LibreOffice, sin Python, sin binarios, sin rutas D:\ en producción).

## Pasajes (pdf-lib)

- `services/passage-pdf.ts` recrea fielmente el formato institucional en carta.
- 026 (1 pág.): OOAD, fecha, control ("pendiente" si no existe), datos del
  trabajador, funciones extramuros, periodo de traslado, firmas (líneas, sin
  firmas digitales), dictamen en blanco con leyenda "Pendiente de dictamen de
  la Subcomisión Mixta de Pasajes", reportes de inclusión/retroactivo, folio
  interno.
- 027 `1A32-009-010` (2 págs.): como 026 + horario discontinuo Sí/No,
  domicilio del trabajador y de adscripción (calle/colonia/CP/municipio/estado),
  teléfono, apercibimiento 15 días; pág. 2 = aviso de privacidad institucional
  (responsable IMSS, datos, fundamento 7.1.2.3/103/1A32-A03-008, ARCO, 26/03/2025).
- Verificación visual: PDFs renderizados desde los originales (scan 026 +
  texto 027) y reproducidos en layout.

## Licencia Excel (ExcelJS, .xlsx sin macros)

- `services/license-excel.ts`. Hoja "Licencia", área de impresión `A1:T58`,
  orientación vertical, ajuste a 1 página de ancho.
- Conserva: encabezados (horario/descansos, Dirección de Administración,
  OOAD, lugar La Goleta Charo, folio, fecha), casillas con/sin goce por rango,
  datos del trabajador, periodo inicio/término día-mes-año, prórroga, total de
  días, teléfono, motivo, comprobante, control de adeudos (130–169, Cl. 97) con
  estado "Pendiente de certificación" por defecto, firmas (solicita /
  certificación / autorización), franja administrativa (función, folio,
  matrícula, acuse, qna.), clave `1A74-009-036` y folio interno.
- VBA original: solo macro `Imprimir` (2 copias) — no se reproduce; impresión
  vía área de impresión + Excel nativo.

## Oficio Word (docxtemplater + pizzip, .docx)

- `services/license-word.ts`. Plantilla mínima en memoria (sin PII en git) +
  render docxtemplater; salida re-serializada como ZIP OOXML válido.
- Estructura sanitizada: SNTSS, sección, comité (de configuración, default
  COMITÉ DELEGACIONAL XXI — corrige el defecto del fuente que decía XIV),
  lugar/fecha, destinatario + cargo editables, cuerpo con tipo CON/SIN GOCE,
  trabajador/matrícula/categoría/motivo/periodo/turno/descansos/total,
  lema institucional, firmante + cargo configurables (líneas, sin firma digital).
- Preview: el Word se descarga tras guardar; el contenido se revisa en la
  pantalla de revisión del wizard antes de generar.

## Pruebas de documentos

Tests con datos ficticios (`MARÍA EJEMPLO PRUEBA`, mat. 00000001):
`passages.test.ts` (PDF con firma %PDF-, 027 más largo por 2ª página) y
`licencias.test.ts` (XLSX/DOCX con firma ZIP PK, comité XXI presente).
Apertura real verificada en la validación visual (LibreOffice solo como
herramienta local, nunca en runtime).
