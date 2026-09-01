/**
 * Directorio Oficial Canónico de Destinatarios Sindicales
 * SNTSS Sección XX Michoacán (Periodo 2026–2032)
 *
 * Fuente oficial: Comité Ejecutivo Seccional XX Michoacán SNTSS
 * NO inventar nombres, cargos ni dependencias.
 * La Veinte Digital
 */

export type DestinatarioCategoria =
  | "comite_ejecutivo"
  | "secretarias"
  | "comisiones"
  | "subcomisiones"
  | "comites_delegacionales"
  | "manual"

export interface DestinatarioItem {
  id: string
  nombre: string
  cargo: string
  organo: string
  categoria: DestinatarioCategoria
  periodo?: string
  fuente?: string
}

export interface CategoriaDestinatarioDef {
  key: DestinatarioCategoria
  titulo: string
  icono: string
  descripcion: string
}

export const CATEGORIAS_DESTINATARIOS: Record<DestinatarioCategoria, CategoriaDestinatarioDef> = {
  comite_ejecutivo: {
    key: "comite_ejecutivo",
    titulo: "Comité Ejecutivo Seccional",
    icono: "🏛️",
    descripcion: "Dirigencia Seccional XX Michoacán",
  },
  secretarias: {
    key: "secretarias",
    titulo: "Secretarías Seccionales",
    icono: "💼",
    descripcion: "Titulares de las distintas carteras sindicales seccionales",
  },
  comisiones: {
    key: "comisiones",
    titulo: "Comisiones Estatutarias",
    icono: "⚖️",
    descripcion: "Comisiones seccionales de vigilancia, justicia, hacienda y acción social",
  },
  subcomisiones: {
    key: "subcomisiones",
    titulo: "Representaciones en Subcomisiones Mixtas",
    icono: "🤝",
    descripcion: "Representantes sindicales ante comisiones paritarias IMSS-SNTSS",
  },
  comites_delegacionales: {
    key: "comites_delegacionales",
    titulo: "Comités Delegacionales",
    icono: "👥",
    descripcion: "Representación sindical en unidades médicas y centros de trabajo",
  },
  manual: {
    key: "manual",
    titulo: "Destinatario Manual / Externo",
    icono: "✍️",
    descripcion: "Escribe directamente el cargo y nombre del destinatario",
  },
}

export const VALOR_DESTINO_MANUAL = "__MANUAL__"
export const FUENTE_OFICIAL_SECCION_XX = "Comité Ejecutivo Seccional XX Michoacán SNTSS (2026–2032)"
export const PERIODO_OFICIAL_SECCION_XX = "2026–2032"

export const DIRECTORIO_DESTINATARIOS: DestinatarioItem[] = [
  // 1. Comité Ejecutivo Seccional (Dirigencia General)
  {
    id: "ces_secretaria_general",
    nombre: "Dr. Simbad Solorio Vargas",
    cargo: "Secretario General",
    organo: "Comité Ejecutivo Seccional XX Michoacán",
    categoria: "comite_ejecutivo",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },

  // 2. Secretarías Seccionales
  {
    id: "sec_interior_propaganda",
    nombre: "M.N.F. Christian Javier Ruiz Pérez",
    cargo: "Secretario del Interior y Propaganda",
    organo: "Secretaría del Interior y Propaganda",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_conflictos",
    nombre: "T.B.E.M. Luis Arturo Gallegos Ortiz",
    cargo: "Secretario de Conflictos",
    organo: "Secretaría de Conflictos",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_trabajo",
    nombre: "A.U.O. Sergio A. González González",
    cargo: "Secretario de Trabajo",
    organo: "Secretaría de Trabajo",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_exterior",
    nombre: "O.A. Jorge Heredia Bucio",
    cargo: "Secretario del Exterior",
    organo: "Secretaría del Exterior",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_tesoreria",
    nombre: "T.R. Hector Daniel Espino Bautista",
    cargo: "Tesorero Seccional",
    organo: "Tesorería",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_prevision_social",
    nombre: "M.F. Laura Paulina Franco Córdova",
    cargo: "Secretaria de Previsión Social",
    organo: "Secretaría de Previsión Social",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_igualdad_sustantiva",
    nombre: "C.S.T. Heidy Tapia Rojas",
    cargo: "Secretaria de Igualdad Sustantiva",
    organo: "Secretaría de Igualdad Sustantiva",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_asuntos_tecnicos",
    nombre: "Cont. Gabriela Avalos Lagunas",
    cargo: "Secretaria de Asuntos Técnicos",
    organo: "Secretaría de Asuntos Técnicos",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_actas_acuerdos",
    nombre: "E.J.P. Martha Martínez Oregel",
    cargo: "Secretaria de Actas y Acuerdos",
    organo: "Secretaría de Actas y Acuerdos",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_prensa",
    nombre: "M.F. Denisse Andrade Duran",
    cargo: "Secretaria de Prensa",
    organo: "Secretaría de Prensa",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_puestos_perifericos",
    nombre: "C.S.T. Mario Alberto Rodríguez Arreola",
    cargo: "Secretario de Puestos Periféricos",
    organo: "Secretaría de Puestos Periféricos",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_admision_cambios",
    nombre: "M.G. Josefina Ríos Álvarez",
    cargo: "Secretaria de Admisión y Cambios",
    organo: "Secretaría de Admisión y Cambios",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_capacitacion_adiestramiento",
    nombre: "M.G. Mayra Romero Martínez",
    cargo: "Secretaria de Capacitación y Adiestramiento",
    organo: "Secretaría de Capacitación y Adiestramiento",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_calidad_modernizacion",
    nombre: "A.E.G. Héctor Guillermo Valdés Rodríguez",
    cargo: "Secretario de Calidad y Modernización",
    organo: "Secretaría de Calidad y Modernización",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "sec_accion_social",
    nombre: "E.J.P. Judith Jacobo Peña",
    cargo: "Secretaria de Acción Social",
    organo: "Secretaría de Acción Social",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },

  // 3. Comisiones Estatutarias
  {
    id: "com_honor_justicia_pres",
    nombre: "O.A. Jesús Alejandro Reyes Román",
    cargo: "Presidente",
    organo: "Comisión de Honor y Justicia",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_honor_justicia_sec1",
    nombre: "A.M. Talia Millán Medina",
    cargo: "Secretaria",
    organo: "Comisión de Honor y Justicia",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_honor_justicia_sec2",
    nombre: "E.G. Miguel Ángel Ramos Merino",
    cargo: "Secretario",
    organo: "Comisión de Honor y Justicia",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_vigilancia_pres",
    nombre: "Q.C. Salvador Núñez Mejía",
    cargo: "Presidente",
    organo: "Comisión de Vigilancia",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_vigilancia_sec1",
    nombre: "E.G. Benita Méndez Sosa",
    cargo: "Secretario",
    organo: "Comisión de Vigilancia",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_vigilancia_sec2",
    nombre: "E.G.C. María de los Ángeles Vega Cuellar",
    cargo: "Secretaria",
    organo: "Comisión de Vigilancia",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_fomento_seg_social_pres",
    nombre: "A.E.G. Gabriela Pérez Valdovinos",
    cargo: "Presidenta",
    organo: "Comisión de Fomento a la Seguridad Social",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_fomento_seg_social_sec1",
    nombre: "E.G.C. Liliana Ríos Fraga",
    cargo: "Secretaria",
    organo: "Comisión de Fomento a la Seguridad Social",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_fomento_seg_social_sec2",
    nombre: "E.G. Mirna Carina Contreras Castañeda",
    cargo: "Secretaria",
    organo: "Comisión de Fomento a la Seguridad Social",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_hacienda_pres",
    nombre: "A.U.O. Maria Isidra González Arreola",
    cargo: "Presidenta",
    organo: "Comisión de Hacienda",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_hacienda_sec1",
    nombre: "A.E.G. Atzua Cecilia Medina Ochoa",
    cargo: "Secretaria",
    organo: "Comisión de Hacienda",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_hacienda_sec2",
    nombre: "A.L.H. Marbella Farfán Ortega",
    cargo: "Secretaria",
    organo: "Comisión de Hacienda",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_deportes_pres",
    nombre: "M.F. Alejandro Leyva Ponce de León",
    cargo: "Presidente",
    organo: "Comisión de Deportes",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_deportes_sec1",
    nombre: "E.G. Diana Alvarado Rosales",
    cargo: "Secretaria",
    organo: "Comisión de Deportes",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_deportes_sec2",
    nombre: "M.N.F. Carlos Alberto Cobarrubias Hernández",
    cargo: "Secretario",
    organo: "Comisión de Deportes",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_accion_politica_pres",
    nombre: "M.F. Janeth González Álvarez",
    cargo: "Presidenta",
    organo: "Comisión de Acción Política",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_accion_politica_sec1",
    nombre: "C.A.M. Yaneth Soto Olvera",
    cargo: "Secretaria",
    organo: "Comisión de Acción Política",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "com_accion_politica_sec2",
    nombre: "M.F. Aida Mendieta Fernández",
    cargo: "Secretaria",
    organo: "Comisión de Acción Política",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },

  // 4. Representantes Sindicales ante las Subcomisiones Mixtas
  {
    id: "subcom_becas",
    nombre: "T.F. Abril Soledad Narez Moreno",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Becas",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_bolsa_trabajo",
    nombre: "M.N.F. Carlos Báez Ambriz",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Bolsa de Trabajo",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_puestos_confianza_b",
    nombre: "A.E.G. Daniel Alejandro Sáenz Zaragoza",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Puestos de Confianza B",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_capacitacion_adiestramiento",
    nombre: "M.G. Dina Isabel Rivera Sosa",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Capacitación y Adiestramiento",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_capacitacion_aux",
    nombre: "E.E. Mario Estrada Hernández",
    cargo: "Auxiliar Sindical",
    organo: "Subcomisión Mixta de Capacitación y Adiestramiento",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_seguridad_higiene",
    nombre: "M.N.F. Agustín López Hernández",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Seguridad e Higiene",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_seguridad_higiene_aux1",
    nombre: "E.F.P. Patricia Guzmán Ramirez",
    cargo: "Auxiliar Sindical",
    organo: "Subcomisión Mixta de Seguridad e Higiene",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_seguridad_higiene_aux2",
    nombre: "E.G. Perla Anahí Jiménez Hernández",
    cargo: "Auxiliar Sindical",
    organo: "Subcomisión Mixta de Seguridad e Higiene",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_disciplinaria",
    nombre: "A.E.G. Juan de Dios Olivera Vigil",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta Disciplinaria",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_escalafon",
    nombre: "E.E. Anilu García Pérez",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Escalafón",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_proteccion_salario",
    nombre: "A.L. Suri Sadai Muñoz Takami",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta Paritaria de Protección al Salario",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_pasajes",
    nombre: "E.G.C. Maria Eugenia Peñaloza Almazán",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Pasajes",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_ropa_uniformes",
    nombre: "Q.C. Miguel Cerda Avalos",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Ropa de Trabajo y Uniformes",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_cambios_rama",
    nombre: "E.G. Jorge Alberto Matías Sánchez",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Selec. RRHH para Cambios de Rama",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_tiendas",
    nombre: "A.L. Ma. Fernanda Madrigal Valencia",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Tiendas",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_plantillas",
    nombre: "M.F. Blanca Nely Holanda Albarrán",
    cargo: "Representante Sindical",
    organo: "Subcomisión Mixta de Revisión de Plantillas",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_plantillas_aux1",
    nombre: "A.U.O. José Roberto Marín Gallegos",
    cargo: "Auxiliar Sindical",
    organo: "Subcomisión Mixta de Revisión de Plantillas",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
  {
    id: "subcom_plantillas_aux2",
    nombre: "E.E. Maria Campos Garcia",
    cargo: "Auxiliar Sindical",
    organo: "Subcomisión Mixta de Revisión de Plantillas",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
  },
]

/**
 * Función de búsqueda accesible y tolerante para el directorio.
 */
export function buscarDestinatarios(termino: string): DestinatarioItem[] {
  const q = termino.toLowerCase().trim()
  if (!q) return DIRECTORIO_DESTINATARIOS

  return DIRECTORIO_DESTINATARIOS.filter((item) => {
    const matchNombre = item.nombre.toLowerCase().includes(q)
    const matchCargo = item.cargo.toLowerCase().includes(q)
    const matchOrgano = item.organo.toLowerCase().includes(q)
    return matchNombre || matchCargo || matchOrgano
  })
}

/**
 * Encuentra un destinatario predefinido por ID o por coincidencia exacta cargo/nombre.
 */
export function findDestinatario(idOrCargo: string, nombre?: string): DestinatarioItem | undefined {
  if (!idOrCargo) return undefined
  const porId = DIRECTORIO_DESTINATARIOS.find((d) => d.id === idOrCargo)
  if (porId) return porId

  return DIRECTORIO_DESTINATARIOS.find(
    (d) =>
      (d.cargo.toLowerCase() === idOrCargo.toLowerCase() || d.organo.toLowerCase() === idOrCargo.toLowerCase()) &&
      (!nombre || d.nombre.toLowerCase() === nombre.toLowerCase())
  )
}
