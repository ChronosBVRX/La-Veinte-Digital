/**
 * Registro canónico de fuentes oficiales y laborales.
 * Única fuente de verdad para atribución en toda la app (web + Android docs).
 * No duplica catálogos: la normativa RAG local conserva sus copias, pero la
 * procedencia visible al usuario sale siempre de aquí.
 */

export type SourceCategory =
  | "gubernamental"
  | "institucional-imss"
  | "legislativa"
  | "laboral-cct"
  | "sindical"
  | "editorial-propia"

export type SourceStatus = "activo" | "sustituido" | "historico"

export interface GovernmentSource {
  id: string
  titulo: string
  emisor: string
  categoria: SourceCategory
  url: string
  documento: string
  vigencia: string
  ultimaVerificacion: string
  usadaEn: string[]
  esGubernamental: boolean
  estado: SourceStatus
}

export const INDEPENDENCE_NOTICE_SHORT =
  "La Veinte Digital es una herramienta independiente para trabajadores. No es una aplicación oficial del Instituto Mexicano del Seguro Social (IMSS), no pertenece al IMSS ni al Gobierno de México y no representa a ninguna entidad gubernamental o partido político."

export const INDEPENDENCE_NOTICE_INFO =
  "La información laboral, normativa y gubernamental se ofrece con fines informativos y de orientación. No sustituye las publicaciones oficiales ni constituye asesoría legal, médica o administrativa."

export const EXTERNAL_PORTAL_NOTICE =
  "Cuando La Veinte Digital abre un portal oficial, dicho portal pertenece y es operado por la institución indicada. La Veinte Digital únicamente facilita su acceso y no expide, valida ni sustituye documentos, trámites o resoluciones oficiales."

export const GOVERNMENT_SOURCES: GovernmentSource[] = [
  {
    id: "imss-portal",
    titulo: "Instituto Mexicano del Seguro Social",
    emisor: "Instituto Mexicano del Seguro Social (IMSS)",
    categoria: "institucional-imss",
    url: "https://www.imss.gob.mx/",
    documento: "Portal institucional del IMSS",
    vigencia: "Permanente (portal vivo)",
    ultimaVerificacion: "2026-09-06",
    usadaEn: ["informacion-y-fuentes", "portales externos", "tarjetón"],
    esGubernamental: false,
    estado: "activo",
  },
  {
    id: "gobmx-imss",
    titulo: "Gobierno de México — IMSS",
    emisor: "Gobierno de México",
    categoria: "gubernamental",
    url: "https://www.gob.mx/imss",
    documento: "Página institucional del IMSS en gob.mx",
    vigencia: "Permanente (portal vivo)",
    ultimaVerificacion: "2026-09-06",
    usadaEn: ["informacion-y-fuentes", "portales externos"],
    esGubernamental: true,
    estado: "activo",
  },
  {
    id: "dof",
    titulo: "Diario Oficial de la Federación",
    emisor: "Secretaría de Gobernación — DOF",
    categoria: "gubernamental",
    url: "https://www.dof.gob.mx/",
    documento: "Publicaciones oficiales federales",
    vigencia: "Permanente (portal vivo)",
    ultimaVerificacion: "2026-09-06",
    usadaEn: ["informacion-y-fuentes", "asistente", "escritos"],
    esGubernamental: true,
    estado: "activo",
  },
  {
    id: "diputados-leyes",
    titulo: "Cámara de Diputados — Leyes Federales",
    emisor: "Cámara de Diputados del H. Congreso de la Unión",
    categoria: "legislativa",
    url: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
    documento: "Biblioteca de leyes federales",
    vigencia: "Permanente (portal vivo)",
    ultimaVerificacion: "2026-09-06",
    usadaEn: ["informacion-y-fuentes", "asistente", "calculadoras"],
    esGubernamental: true,
    estado: "activo",
  },
  {
    id: "lft",
    titulo: "Ley Federal del Trabajo",
    emisor: "Cámara de Diputados del H. Congreso de la Unión",
    categoria: "legislativa",
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf",
    documento: "LFT (compilación vigente de Cámara de Diputados)",
    vigencia: "Según compilación oficial vigente",
    ultimaVerificacion: "2026-09-06",
    usadaEn: ["informacion-y-fuentes", "asistente", "calculadoras", "escritos"],
    esGubernamental: true,
    estado: "activo",
  },
  {
    id: "lss",
    titulo: "Ley del Seguro Social",
    emisor: "Cámara de Diputados del H. Congreso de la Unión",
    categoria: "legislativa",
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LSS.pdf",
    documento: "LSS (compilación vigente de Cámara de Diputados)",
    vigencia: "Según compilación oficial vigente",
    ultimaVerificacion: "2026-09-06",
    usadaEn: ["informacion-y-fuentes", "asistente", "calculadoras"],
    esGubernamental: true,
    estado: "activo",
  },
  {
    id: "cct-imss-sntss-2025-2027",
    titulo: "Contrato Colectivo de Trabajo IMSS–SNTSS 2025–2027",
    emisor: "IMSS y Sindicato Nacional de Trabajadores del Seguro Social",
    categoria: "laboral-cct",
    url: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    documento: "CCT IMSS–SNTSS 2025–2027 (vigente hasta 2027-10-15)",
    vigencia: "2025-10-16 a 2027-10-15",
    ultimaVerificacion: "2026-09-06",
    usadaEn: ["informacion-y-fuentes", "asistente", "calculadoras", "escritos", "agenda"],
    esGubernamental: false,
    estado: "activo",
  },
]

export function getSourceById(id: string): GovernmentSource | undefined {
  return GOVERNMENT_SOURCES.find((s) => s.id === id)
}

export const SOURCES_LAST_UPDATED = "2026-09-06"
