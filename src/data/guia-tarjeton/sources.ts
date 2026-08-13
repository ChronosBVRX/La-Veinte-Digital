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
]

/** Devuelve una fuente oficial por id; null si no existe. */
export function getSourceById(id: string): OfficialSource | null {
  return guideSources.find((s) => s.id === id) ?? null
}
