/**
 * Directorio Oficial Canónico de Destinatarios Sindicales
 * SNTSS Sección XX Michoacán (Periodo 2026–2032)
 *
 * Fuente canónica: Directorio Oficial del Comité Ejecutivo Seccional XX Michoacán
 * Ruta documental: src/features/escritos/data/comite-seccional.ts
 * Fecha de corte documental: 16 de abril de 2026
 *
 * ALCANCE ESTRICTO AUTORIZADO PARA PRESETS:
 * 1. Secretario General y Titular del Comité Ejecutivo Seccional XX.
 * 2. Titulares de las Secretarías Seccionales.
 * 3. Presidentes de las Comisiones Estatutarias Seccionales.
 * 4. Representantes Titulares de las Subcomisiones Mixtas Paritarias.
 * 5. Integrantes oficiales de Comités Delegacionales (sujeto a catálogo oficial).
 * 6. Destinatario Manual.
 *
 * NO SE INCLUYEN: Directores de Hospital, Jefes de Personal, Recursos Humanos,
 * Jefaturas de Servicio, funcionarios genéricos IMSS ni cargos auxiliares/secretarios de comisiones.
 * La Veinte Digital
 */

export type DestinatarioCategoria =
  | "comite_ejecutivo"
  | "secretarias"
  | "comisiones"
  | "subcomisiones"
  | "comites_delegacionales"
  | "manual"

export interface TrazaFuenteDestinatario {
  documentoOrigen: string
  rutaODocumentoUrl: string
  fechaConsulta: string
  periodoConfirmado: string
  organo: string
  nombre: string
  cargo: string
  nivelVerificacion: "OFICIAL_CONFIRMADO" | "PENDIENTE_DELEGACIONAL" | "MANUAL"
}

export interface DestinatarioItem {
  id: string
  nombre: string
  cargo: string
  organo: string
  categoria: DestinatarioCategoria
  periodo: string
  fuente: string
  trazabilidad: TrazaFuenteDestinatario
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
    descripcion: "Dirigencia General Seccional XX Michoacán",
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
    descripcion: "Presidencias de las comisiones seccionales estatutarias",
  },
  subcomisiones: {
    key: "subcomisiones",
    titulo: "Subcomisiones Mixtas Paritarias",
    icono: "🤝",
    descripcion: "Representantes sindicales titulares ante comisiones paritarias IMSS-SNTSS",
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
export const DOCUMENTO_CANONICO_SECCION_XX = "Directorio Oficial del Comité Ejecutivo Seccional XX Michoacán (Edición 16/abril/2026)"
export const RUTA_CANONICA_SECCION_XX = "src/features/escritos/data/comite-seccional.ts"
export const FECHA_CONSULTA_SECCION_XX = "2026-04-16"
export const PERIODO_OFICIAL_SECCION_XX = "2026–2032"

function makeTraza(organo: string, nombre: string, cargo: string): TrazaFuenteDestinatario {
  return {
    documentoOrigen: DOCUMENTO_CANONICO_SECCION_XX,
    rutaODocumentoUrl: RUTA_CANONICA_SECCION_XX,
    fechaConsulta: FECHA_CONSULTA_SECCION_XX,
    periodoConfirmado: PERIODO_OFICIAL_SECCION_XX,
    organo,
    nombre,
    cargo,
    nivelVerificacion: "OFICIAL_CONFIRMADO",
  }
}

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
    trazabilidad: makeTraza("Comité Ejecutivo Seccional XX Michoacán", "Dr. Simbad Solorio Vargas", "Secretario General"),
  },

  // 2. Titulares de Secretarías Seccionales
  {
    id: "sec_interior_propaganda",
    nombre: "M.N.F. Christian Javier Ruiz Pérez",
    cargo: "Secretario del Interior y Propaganda",
    organo: "Secretaría del Interior y Propaganda",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría del Interior y Propaganda", "M.N.F. Christian Javier Ruiz Pérez", "Secretario del Interior y Propaganda"),
  },
  {
    id: "sec_conflictos",
    nombre: "T.B.E.M. Luis Arturo Gallegos Ortiz",
    cargo: "Secretario de Conflictos",
    organo: "Secretaría de Conflictos",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Conflictos", "T.B.E.M. Luis Arturo Gallegos Ortiz", "Secretario de Conflictos"),
  },
  {
    id: "sec_trabajo",
    nombre: "A.U.O. Sergio A. González González",
    cargo: "Secretario de Trabajo",
    organo: "Secretaría de Trabajo",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Trabajo", "A.U.O. Sergio A. González González", "Secretario de Trabajo"),
  },
  {
    id: "sec_exterior",
    nombre: "O.A. Jorge Heredia Bucio",
    cargo: "Secretario del Exterior",
    organo: "Secretaría del Exterior",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría del Exterior", "O.A. Jorge Heredia Bucio", "Secretario del Exterior"),
  },
  {
    id: "sec_tesoreria",
    nombre: "T.R. Hector Daniel Espino Bautista",
    cargo: "Tesorero Seccional",
    organo: "Tesorería",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Tesorería", "T.R. Hector Daniel Espino Bautista", "Tesorero Seccional"),
  },
  {
    id: "sec_prevision_social",
    nombre: "M.F. Laura Paulina Franco Córdova",
    cargo: "Secretaria de Previsión Social",
    organo: "Secretaría de Previsión Social",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Previsión Social", "M.F. Laura Paulina Franco Córdova", "Secretaria de Previsión Social"),
  },
  {
    id: "sec_igualdad_sustantiva",
    nombre: "C.S.T. Heidy Tapia Rojas",
    cargo: "Secretaria de Igualdad Sustantiva",
    organo: "Secretaría de Igualdad Sustantiva",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Igualdad Sustantiva", "C.S.T. Heidy Tapia Rojas", "Secretaria de Igualdad Sustantiva"),
  },
  {
    id: "sec_asuntos_tecnicos",
    nombre: "Cont. Gabriela Avalos Lagunas",
    cargo: "Secretaria de Asuntos Técnicos",
    organo: "Secretaría de Asuntos Técnicos",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Asuntos Técnicos", "Cont. Gabriela Avalos Lagunas", "Secretaria de Asuntos Técnicos"),
  },
  {
    id: "sec_actas_acuerdos",
    nombre: "E.J.P. Martha Martínez Oregel",
    cargo: "Secretaria de Actas y Acuerdos",
    organo: "Secretaría de Actas y Acuerdos",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Actas y Acuerdos", "E.J.P. Martha Martínez Oregel", "Secretaria de Actas y Acuerdos"),
  },
  {
    id: "sec_prensa",
    nombre: "M.F. Denisse Andrade Duran",
    cargo: "Secretaria de Prensa",
    organo: "Secretaría de Prensa",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Prensa", "M.F. Denisse Andrade Duran", "Secretaria de Prensa"),
  },
  {
    id: "sec_puestos_perifericos",
    nombre: "C.S.T. Mario Alberto Rodríguez Arreola",
    cargo: "Secretario de Puestos Periféricos",
    organo: "Secretaría de Puestos Periféricos",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Puestos Periféricos", "C.S.T. Mario Alberto Rodríguez Arreola", "Secretario de Puestos Periféricos"),
  },
  {
    id: "sec_admision_cambios",
    nombre: "M.G. Josefina Ríos Álvarez",
    cargo: "Secretaria de Admisión y Cambios",
    organo: "Secretaría de Admisión y Cambios",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Admisión y Cambios", "M.G. Josefina Ríos Álvarez", "Secretaria de Admisión y Cambios"),
  },
  {
    id: "sec_capacitacion_adiestramiento",
    nombre: "M.G. Mayra Romero Martínez",
    cargo: "Secretaria de Capacitación y Adiestramiento",
    organo: "Secretaría de Capacitación y Adiestramiento",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Capacitación y Adiestramiento", "M.G. Mayra Romero Martínez", "Secretaria de Capacitación y Adiestramiento"),
  },
  {
    id: "sec_calidad_modernizacion",
    nombre: "A.E.G. Héctor Guillermo Valdés Rodríguez",
    cargo: "Secretario de Calidad y Modernización",
    organo: "Secretaría de Calidad y Modernización",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Calidad y Modernización", "A.E.G. Héctor Guillermo Valdés Rodríguez", "Secretario de Calidad y Modernización"),
  },
  {
    id: "sec_accion_social",
    nombre: "E.J.P. Judith Jacobo Peña",
    cargo: "Secretaria de Acción Social",
    organo: "Secretaría de Acción Social",
    categoria: "secretarias",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Secretaría de Acción Social", "E.J.P. Judith Jacobo Peña", "Secretaria de Acción Social"),
  },

  // 3. Presidentes de Comisiones Estatutarias
  {
    id: "com_honor_justicia_pres",
    nombre: "O.A. Jesús Alejandro Reyes Román",
    cargo: "Presidente",
    organo: "Comisión de Honor y Justicia",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Comisión de Honor y Justicia", "O.A. Jesús Alejandro Reyes Román", "Presidente"),
  },
  {
    id: "com_vigilancia_pres",
    nombre: "Q.C. Salvador Núñez Mejía",
    cargo: "Presidente",
    organo: "Comisión de Vigilancia",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Comisión de Vigilancia", "Q.C. Salvador Núñez Mejía", "Presidente"),
  },
  {
    id: "com_fomento_seg_social_pres",
    nombre: "A.E.G. Gabriela Pérez Valdovinos",
    cargo: "Presidenta",
    organo: "Comisión de Fomento a la Seguridad Social",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Comisión de Fomento a la Seguridad Social", "A.E.G. Gabriela Pérez Valdovinos", "Presidenta"),
  },
  {
    id: "com_hacienda_pres",
    nombre: "A.U.O. Maria Isidra González Arreola",
    cargo: "Presidenta",
    organo: "Comisión de Hacienda",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Comisión de Hacienda", "A.U.O. Maria Isidra González Arreola", "Presidenta"),
  },
  {
    id: "com_deportes_pres",
    nombre: "M.F. Alejandro Leyva Ponce de León",
    cargo: "Presidente",
    organo: "Comisión de Deportes",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Comisión de Deportes", "M.F. Alejandro Leyva Ponce de León", "Presidente"),
  },
  {
    id: "com_accion_politica_pres",
    nombre: "M.F. Janeth González Álvarez",
    cargo: "Presidenta",
    organo: "Comisión de Acción Política",
    categoria: "comisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Comisión de Acción Política", "M.F. Janeth González Álvarez", "Presidenta"),
  },

  // 4. Representantes Titulares ante Subcomisiones Mixtas Paritarias
  {
    id: "subcom_becas",
    nombre: "T.F. Abril Soledad Narez Moreno",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Becas",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Becas", "T.F. Abril Soledad Narez Moreno", "Representante Sindical Titular"),
  },
  {
    id: "subcom_bolsa_trabajo",
    nombre: "M.N.F. Carlos Báez Ambriz",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Bolsa de Trabajo",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Bolsa de Trabajo", "M.N.F. Carlos Báez Ambriz", "Representante Sindical Titular"),
  },
  {
    id: "subcom_puestos_confianza_b",
    nombre: "A.E.G. Daniel Alejandro Sáenz Zaragoza",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Puestos de Confianza B",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Puestos de Confianza B", "A.E.G. Daniel Alejandro Sáenz Zaragoza", "Representante Sindical Titular"),
  },
  {
    id: "subcom_capacitacion_adiestramiento",
    nombre: "M.G. Dina Isabel Rivera Sosa",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Capacitación y Adiestramiento",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Capacitación y Adiestramiento", "M.G. Dina Isabel Rivera Sosa", "Representante Sindical Titular"),
  },
  {
    id: "subcom_seguridad_higiene",
    nombre: "M.N.F. Agustín López Hernández",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Seguridad e Higiene",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Seguridad e Higiene", "M.N.F. Agustín López Hernández", "Representante Sindical Titular"),
  },
  {
    id: "subcom_disciplinaria",
    nombre: "A.E.G. Juan de Dios Olivera Vigil",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta Disciplinaria",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta Disciplinaria", "A.E.G. Juan de Dios Olivera Vigil", "Representante Sindical Titular"),
  },
  {
    id: "subcom_escalafon",
    nombre: "E.E. Anilu García Pérez",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Escalafón",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Escalafón", "E.E. Anilu García Pérez", "Representante Sindical Titular"),
  },
  {
    id: "subcom_proteccion_salario",
    nombre: "A.L. Suri Sadai Muñoz Takami",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta Paritaria de Protección al Salario",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta Paritaria de Protección al Salario", "A.L. Suri Sadai Muñoz Takami", "Representante Sindical Titular"),
  },
  {
    id: "subcom_pasajes",
    nombre: "E.G.C. Maria Eugenia Peñaloza Almazán",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Pasajes",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Pasajes", "E.G.C. Maria Eugenia Peñaloza Almazán", "Representante Sindical Titular"),
  },
  {
    id: "subcom_ropa_uniformes",
    nombre: "Q.C. Miguel Cerda Avalos",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Ropa de Trabajo y Uniformes",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Ropa de Trabajo y Uniformes", "Q.C. Miguel Cerda Avalos", "Representante Sindical Titular"),
  },
  {
    id: "subcom_cambios_rama",
    nombre: "E.G. Jorge Alberto Matías Sánchez",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Selec. RRHH para Cambios de Rama",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Selec. RRHH para Cambios de Rama", "E.G. Jorge Alberto Matías Sánchez", "Representante Sindical Titular"),
  },
  {
    id: "subcom_tiendas",
    nombre: "A.L. Ma. Fernanda Madrigal Valencia",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Tiendas",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Tiendas", "A.L. Ma. Fernanda Madrigal Valencia", "Representante Sindical Titular"),
  },
  {
    id: "subcom_plantillas",
    nombre: "M.F. Blanca Nely Holanda Albarrán",
    cargo: "Representante Sindical Titular",
    organo: "Subcomisión Mixta de Revisión de Plantillas",
    categoria: "subcomisiones",
    periodo: PERIODO_OFICIAL_SECCION_XX,
    fuente: FUENTE_OFICIAL_SECCION_XX,
    trazabilidad: makeTraza("Subcomisión Mixta de Revisión de Plantillas", "M.F. Blanca Nely Holanda Albarrán", "Representante Sindical Titular"),
  },
]

/**
 * Normaliza cadenas de texto para búsqueda tolerante (sin acentos ni mayúsculas).
 */
function normalizarTextoBusqueda(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

/**
 * Función de búsqueda accesible y tolerante para el directorio.
 * Permite buscar por nombre, cargo, órgano, iniciales o abreviaturas sin distinción de acentos.
 */
export function buscarDestinatarios(termino: string): DestinatarioItem[] {
  const q = normalizarTextoBusqueda(termino)
  if (!q) return DIRECTORIO_DESTINATARIOS

  return DIRECTORIO_DESTINATARIOS.filter((item) => {
    const matchNombre = normalizarTextoBusqueda(item.nombre).includes(q)
    const matchCargo = normalizarTextoBusqueda(item.cargo).includes(q)
    const matchOrgano = normalizarTextoBusqueda(item.organo).includes(q)
    return matchNombre || matchCargo || matchOrgano
  })
}

/**
 * Encuentra un destinatario predefinido por ID o por coincidencia normalizada cargo/nombre.
 */
export function findDestinatario(idOrCargo: string, nombre?: string): DestinatarioItem | undefined {
  if (!idOrCargo) return undefined
  const porId = DIRECTORIO_DESTINATARIOS.find((d) => d.id === idOrCargo)
  if (porId) return porId

  const cargoNorm = normalizarTextoBusqueda(idOrCargo)
  const nombreNorm = nombre ? normalizarTextoBusqueda(nombre) : ""

  return DIRECTORIO_DESTINATARIOS.find((d) => {
    const dCargoNorm = normalizarTextoBusqueda(d.cargo)
    const dOrganoNorm = normalizarTextoBusqueda(d.organo)
    const matchCargo = dCargoNorm === cargoNorm || dOrganoNorm === cargoNorm
    if (!matchCargo) return false
    if (!nombreNorm) return true
    return normalizarTextoBusqueda(d.nombre) === nombreNorm
  })
}
