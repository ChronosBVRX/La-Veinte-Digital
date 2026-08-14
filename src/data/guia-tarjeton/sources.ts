import type { OfficialSource } from "@/features/tarjeton-guia/lib/types"

/**
 * Registro de fuentes oficiales de la Guía de mi Tarjetón.
 *
 * Política documental: solo se citan fuentes institucionales del IMSS
 * (imss.gob.mx / rh.imss.gob.mx / reposipot.imss.gob.mx) y legislación
 * oficial externa (DOF, SAT, SCJN) cuando corresponde. El "Manual de
 * orientación al tarjetón 2023" NO es una publicación oficial del IMSS
 * y no aparece aquí ni como fuente, bibliografía ni fundamento.
 *
 * `verifiedAt` solo se registra cuando la fuente se corroboró contra el
 * documento institucional; si aún falta confirmar URL o vigencia, la fuente
 * queda sin `verifiedAt` hasta verificarse.
 */
export const guideSources: OfficialSource[] = [
  {
    id: "cct-2025-2027",
    institution: "IMSS",
    type: "CCT",
    title: "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
    validity: "16 oct 2025 – 15 oct 2027",
    officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "rit-cct-2025-2027",
    institution: "IMSS",
    type: "RIT",
    title: "Reglamento Interior de Trabajo (inserción del CCT IMSS-SNTSS 2025-2027)",
    officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "norma-1000-001-020",
    institution: "IMSS",
    type: "NORMA_IMSS",
    documentCode: "1000-001-020",
    title: "Norma para la aplicación de los conceptos asociados a la categoría, puesto y/o servicio de las y los trabajadores del Instituto Mexicano del Seguro Social",
    verifiedAt: "2026-08-13",
  },
  {
    id: "proc-1a74-003-031",
    institution: "IMSS",
    type: "PROCEDIMIENTO_IMSS",
    documentCode: "1A74-003-031",
    title: "Procedimiento para la autorización y control del tiempo extraordinario",
    officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/procedimientos/1A74-003-031.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "proc-1a74-003-030",
    institution: "IMSS",
    type: "PROCEDIMIENTO_IMSS",
    documentCode: "1A74-003-030",
    title: "Procedimiento para el catálogo de plazas, adscripción, claves departamentales, categoría y características de plazas (SIAP)",
  },
  {
    id: "proc-1a74-a03-027",
    institution: "IMSS",
    type: "PROCEDIMIENTO_IMSS",
    documentCode: "1A74-A03-027",
    title: "Procedimiento para el acreditamiento en cuenta, forma de pago y datos bancarios de los trabajadores",
    officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/procedimientos/1A74-A03-027.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "proc-1a14-003-010",
    institution: "IMSS",
    type: "PROCEDIMIENTO_IMSS",
    documentCode: "1A14-003-010",
    title: "Procedimiento para el descuento de créditos INFONAVIT en nómina (RH2000/SIAP)",
    officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/procedimientos/1A14-003-010.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "proc-6b11-003-008",
    institution: "IMSS",
    type: "PROCEDIMIENTO_IMSS",
    documentCode: "6B11-003-008",
    title: "Procedimiento para la definición de SIAP, nómina, percepciones y deducciones, y productos SIAP",
    officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/procedimientos/6B11-003-008_0.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "tabulador-base-2025-2026",
    institution: "IMSS",
    type: "TABULADOR",
    title: "Tabulador de Sueldos para Personal de Base IMSS-SNTSS (CCT 2025-2027)",
    validity: "16 oct 2025 – 15 oct 2026",
    verifiedAt: "2026-08-13",
  },
  {
    id: "portal-tarjeton-digital",
    institution: "IMSS",
    type: "PORTAL_IMSS",
    title: "Tarjetón Digital — portal de consulta del recibo de pago",
    officialUrl: "https://rh.imss.gob.mx/Personal/TarjetonDigital/",
    verifiedAt: "2026-08-13",
  },
  {
    id: "proc-1a72-003-005",
    institution: "IMSS",
    type: "PROCEDIMIENTO_IMSS",
    documentCode: "1A72-003-005",
    title: "Procedimiento para el otorgamiento y control de préstamos para el fomento de la habitación de los trabajadores (Enganche E.S.M.I., crédito hipotecario, ayudas y préstamos a mediano plazo)",
    officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/procedimientos/1A72-003-005.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "proc-6c10-b03-002",
    institution: "IMSS",
    type: "PROCEDIMIENTO_IMSS",
    documentCode: "6C10-B03-002",
    title: "Procedimiento para la contratación de seguros de inmuebles con crédito hipotecario de los trabajadores del IMSS",
    officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/procedimientos/6C10-B03-002.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "fovi-shf",
    institution: "CNBV",
    type: "INFORMACION_INSTITUCIONAL",
    title: "Descripción del sector de banca de desarrollo — Fideicomiso FOVI (banca hipotecaria) y transferencia a la SHF (2002)",
    officialUrl: "https://www.cnbv.gob.mx/SECTORES-SUPERVISADOS/BANCA-DE-DESARROLLO/Descripcion-del-Sector/Documents/Descripcion%20FOVI.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "infonavit-reglamento-inscripcion",
    institution: "INFONAVIT",
    type: "REGLAMENTO",
    title: "Reglamento de Inscripción, Pago de Aportaciones y Entero de Descuentos al INFONAVIT",
    officialUrl: "https://portalmx.infonavit.org.mx/wps/wcm/connect/507b98bc-bcdc-4d3f-b62d-7abba676e00b/iv.%2BReglamento%2Bde%2BInscripci%C3%B3n%2C%2BPago%2Bde%2BAportaciones%2By%2BEntero%2Bde%2BDescuentos%2Bal%2BInfonavit.pdf?MOD=AJPERES",
    verifiedAt: "2026-08-13",
  },
  {
    id: "imss-informe-2015-2016-c10",
    institution: "IMSS",
    type: "INFORME",
    title: "Informe IMSS 2015-2016, Capítulo X — Convenio IMSS-SNTSS del 14 de octubre de 2005 y Fondo para el Cumplimiento de Obligaciones Laborales",
    officialUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/informes/20152016/14-Cap10.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "fonacot-comunicado",
    institution: "FONACOT",
    type: "COMUNICADO",
    title: "FONACOT — Sistema Institucional de Afiliación y crédito con descuento vía nómina",
    officialUrl: "https://www.fonacot.gob.mx/SaladePrensa/Paginas/Comunicados.aspx?idc=513",
    verifiedAt: "2026-08-13",
  },
  {
    id: "ley-isr",
    institution: "DOF",
    type: "LEY",
    title: "Ley del Impuesto sobre la Renta (LISR)",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf",
    verifiedAt: "2026-08-13",
  },
  {
    id: "ley-federal-trabajo",
    institution: "DOF",
    type: "LEY",
    title: "Ley Federal del Trabajo (LFT)",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf",
    verifiedAt: "2026-08-13",
  },
]

/** Devuelve una fuente oficial por id; null si no existe. */
export function getSourceById(id: string): OfficialSource | null {
  return guideSources.find((s) => s.id === id) ?? null
}
