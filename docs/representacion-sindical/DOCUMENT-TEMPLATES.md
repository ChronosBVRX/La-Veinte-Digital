# Plantillas de documentos — Representación Sindical XXI

Todas se generan en runtime Vercel con dependencias Node puras (sin Office,
sin LibreOffice, sin Python, sin binarios, sin rutas D:\ en producción).

## Pasajes (Plantillas Oficiales PDF + Overlay Declarativo)

- `services/passage-pdf.ts` rellena los formatos oficiales utilizando **plantillas PDF maestras originales** recuperadas de Supabase Storage (`union-private`), versionadas en `union_document_templates` y verificadas mediante hash criptográfico SHA-256 antes de cada generación.
- **Formato 026 (1 pág.):** Basado en el escaneo oficial de la oficina sindical (`D:\Formato concepto 026-1.pdf`), normalizado a tamaño Carta (612 x 792 pt) preservando el 100% del documento escaneado (tablas, tipografía de origen, logotipos institucionales IMSS/SNTSS y marca de escaneo original). Campos superpuestos: OOAD, fecha (día, mes, año), número de control, datos del trabajador (apellidos, nombre, matrícula, categoría, adscripción), funciones extramuros y periodo de traslado.
- **Formato 027 `1A32-009-010` (2 págs.):** Basado en el documento oficial vectorial (`D:\Formato concepto 027 aviso priv.pdf`), conservando sus 2 páginas íntegras:
  - **Página 1:** Solicitud formal con OOAD, fecha, número de control, datos del trabajador, horario discontinuo (casillas Sí / No con marca "X" en negrita), domicilios particulares y de adscripción con desglose institucional (calle, colonia, CP, municipio, estado) y teléfono.
  - **Página 2:** Aviso de Privacidad oficial completo del IMSS (fundamento normativo 7.1.2.3 / Cláusula 103 / 1A32-A03-008, derechos ARCO, fecha 26 de marzo 2025) **preservado intacto**, insertando únicamente el nombre mecanografiado del trabajador centrado sobre la línea de firma y dejando libre el espacio superior para la firma autógrafa.
- **Seguridad e Integridad:**
  - Si una delegación no cuenta con una plantilla oficial activa o si el hash del binario almacenado no coincide con el registro criptográfico, el sistema falla controladamente (`404 / 500`) sin generar documentos apócrifos ni degradar silenciosamente.
  - No se generan firmas digitales simuladas ni leyendas artificiales ("Pendiente de dictamen").
  - El folio del expediente (ej. `XXI-2026-PAS-000123`) se incluye en el nombre del archivo descargado (`pasaje-026-<folio>.pdf`, `pasaje-027-<folio>.pdf`), no sobre las celdas del formulario.
  - Se eliminó la reconstrucción visual manual (`PDFDocument.create`, dibujo de líneas y rectángulos por coordenadas estáticas).

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
