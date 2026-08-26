/**
 * Comité Ejecutivo Seccional XX Michoacán · 2026–2032
 * Actualizado: 16/abril/2026
 *
 * Cada destinatario se guarda con el formato "cargo|nombre" para que el
 * resto del generador (previsualización y PDF) sepa separar el cargo del
 * nombre de la persona a quien va dirigido el escrito.
 */
export interface DestinoSeccionalItem {
  value: string
  label: string
}

export interface DestinoSeccionalGroup {
  group: string
  items: DestinoSeccionalItem[]
}

export const VALOR_DESTINO_MANUAL = "__MANUAL__"

export const COMITE_SECCIONAL: DestinoSeccionalGroup[] = [
  {
    group: "Secretarios",
    items: [
      { value: "Secretaría General|Dr. Simbad Solorio Vargas", label: "Secretaría General" },
      { value: "Secretaría de Interior y Propaganda|M.N.F. Christian Javier Ruiz Pérez", label: "Secretaría de Interior y Propaganda" },
      { value: "Secretaría de Conflictos|T.B.E.M. Luis Arturo Gallegos Ortiz", label: "Secretaría de Conflictos" },
      { value: "Secretaría de Trabajo|A.U.O. Sergio A. González González", label: "Secretaría de Trabajo" },
      { value: "Secretaría del Exterior|O.A. Jorge Heredia Bucio", label: "Secretaría del Exterior" },
      { value: "Tesorería|T.R. Hector Daniel Espino Bautista", label: "Tesorero" },
      { value: "Secretaría de Previsión Social|M.F. Laura Paulina Franco Córdova", label: "Secretaría de Previsión Social" },
      { value: "Secretaría de Igualdad Sustantiva|C.S.T. Heidy Tapia Rojas", label: "Secretaría de Igualdad Sustantiva" },
      { value: "Secretaría de Asuntos Técnicos|Cont. Gabriela Avalos Lagunas", label: "Secretaría de Asuntos Técnicos" },
      { value: "Secretaría de Actas y Acuerdos|E.J.P. Martha Martínez Oregel", label: "Secretaría de Actas y Acuerdos" },
      { value: "Secretaría de Prensa|M.F. Denisse Andrade Duran", label: "Secretaría de Prensa" },
      { value: "Secretaría de Puestos Periféricos|C.S.T. Mario Alberto Rodríguez Arreola", label: "Secretaría de Puestos Periféricos" },
      { value: "Secretaría de Admisión y Cambios|M.G. Josefina Ríos Álvarez", label: "Secretaría de Admisión y Cambios" },
      { value: "Secretaría de Capacitación y Adiestramiento|M.G. Mayra Romero Martínez", label: "Secretaría de Capacitación y Adiestramiento" },
      { value: "Secretaría de Calidad y Modernización|A.E.G. Héctor Guillermo Valdés Rodríguez", label: "Secretaría de Calidad y Modernización" },
      { value: "Secretaría de Acción Social|E.J.P. Judith Jacobo Peña", label: "Secretaría de Acción Social" },
    ],
  },
  {
    group: "Comisiones de Honor y Justicia",
    items: [
      { value: "Comisión de Honor y Justicia|O.A. Jesús Alejandro Reyes Román", label: "Honor y Justicia — Presidencia" },
      { value: "Comisión de Honor y Justicia|A.M. Talia Millán Medina", label: "Honor y Justicia — Secretaria" },
      { value: "Comisión de Honor y Justicia|E.G. Miguel Ángel Ramos Merino", label: "Honor y Justicia — Secretario" },
    ],
  },
  {
    group: "Comisiones de Vigilancia",
    items: [
      { value: "Comisión de Vigilancia|Q.C. Salvador Núñez Mejía", label: "Vigilancia — Presidencia" },
      { value: "Comisión de Vigilancia|E.G. Benita Méndez Sosa", label: "Vigilancia — Secretario" },
      { value: "Comisión de Vigilancia|E.G.C. María de los Ángeles Vega Cuellar", label: "Vigilancia — Secretaria" },
    ],
  },
  {
    group: "Comisión de Fomento a la Seguridad Social",
    items: [
      { value: "Comisión de Fomento a la Seguridad Social|A.E.G. Gabriela Pérez Valdovinos", label: "Fomento a la Seg. Social — Presidencia" },
      { value: "Comisión de Fomento a la Seguridad Social|E.G.C. Liliana Ríos Fraga", label: "Fomento a la Seg. Social — Secretaria" },
      { value: "Comisión de Fomento a la Seguridad Social|E.G. Mirna Carina Contreras Castañeda", label: "Fomento a la Seg. Social — Secretaria" },
    ],
  },
  {
    group: "Comisión de Hacienda",
    items: [
      { value: "Comisión de Hacienda|A.U.O. Maria Isidra González Arreola", label: "Hacienda — Presidencia" },
      { value: "Comisión de Hacienda|A.E.G. Atzua Cecilia Medina Ochoa", label: "Hacienda — Secretaria" },
      { value: "Comisión de Hacienda|A.L.H. Marbella Farfán Ortega", label: "Hacienda — Secretaria" },
    ],
  },
  {
    group: "Comisión de Deportes",
    items: [
      { value: "Comisión de Deportes|M.F. Alejandro Leyva Ponce de León", label: "Deportes — Presidencia" },
      { value: "Comisión de Deportes|E.G. Diana Alvarado Rosales", label: "Deportes — Secretaria" },
      { value: "Comisión de Deportes|M.N.F. Carlos Alberto Cobarrubias Hernández", label: "Deportes — Secretario" },
    ],
  },
  {
    group: "Comisión de Acción Política",
    items: [
      { value: "Comisión de Acción Política|M.F. Janeth González Álvarez", label: "Acción Política — Presidencia" },
      { value: "Comisión de Acción Política|C.A.M. Yaneth Soto Olvera", label: "Acción Política — Secretaria" },
      { value: "Comisión de Acción Política|M.F. Aida Mendieta Fernández", label: "Acción Política — Secretaria" },
    ],
  },
  {
    group: "Representantes Sindicales ante las Subcomisiones Mixtas",
    items: [
      { value: "Subcomisión Mixta de Becas|T.F. Abril Soledad Narez Moreno", label: "Becas" },
      { value: "Bolsa de Trabajo|M.N.F. Carlos Báez Ambriz", label: "Bolsa de Trabajo" },
      { value: "Subcomisión Mixta de Puestos de Confianza B|A.E.G. Daniel Alejandro Sáenz Zaragoza", label: "Puestos de Confianza B" },
      { value: "Subcomisión Mixta de Capacitación y Adiestramiento|M.G. Dina Isabel Rivera Sosa", label: "Capacitación y Adiestramiento" },
      { value: "Subcomisión Mixta de Auxiliar de Capacitación y Adiestramiento|E.E. Mario Estrada Hernández", label: "Aux. Capacitación y Adiestramiento" },
      { value: "Subcomisión Mixta de Seguridad e Higiene|M.N.F. Agustín López Hernández", label: "Seguridad e Higiene" },
      { value: "Subcomisión Mixta de Aux. de Seguridad e Higiene|E.F.P. Patricia Guzmán Ramirez", label: "Aux. Seguridad e Higiene" },
      { value: "Subcomisión Mixta de Aux. de Seguridad e Higiene|E.G. Perla Anahí Jiménez Hernández", label: "Aux. Seguridad e Higiene" },
      { value: "Subcomisión Mixta Disciplinaria|A.E.G. Juan de Dios Olivera Vigil", label: "Disciplinaria" },
      { value: "Subcomisión Mixta de Escalafón|E.E. Anilu García Pérez", label: "Escalafón" },
      { value: "Subcomisión Mixta Paritaria de Protección al Salario|A.L. Suri Sadai Muñoz Takami", label: "Protección al Salario" },
      { value: "Subcomisión Mixta de Pasajes|E.G.C. Maria Eugenia Peñaloza Almazán", label: "Pasajes" },
      { value: "Subcomisión Mixta de Ropa de Trabajo y Uniformes|Q.C. Miguel Cerda Avalos", label: "Ropa de Trabajo y Uniformes" },
      { value: "Subcomisión Mixta de Selec. Recursos Humanos para Cambios de Rama|E.G. Jorge Alberto Matías Sánchez", label: "Cambios de Rama" },
      { value: "Subcomisión Mixta de Tiendas|A.L. Ma. Fernanda Madrigal Valencia", label: "Tiendas" },
      { value: "Subcomisión Mixta de Revisión de Plantillas|M.F. Blanca Nely Holanda Albarrán", label: "Revisión de Plantillas" },
      { value: "Subcomisión Mixta de Aux. de Revisión de Plantillas|A.U.O. José Roberto Marín Gallegos", label: "Aux. Revisión de Plantillas" },
      { value: "Subcomisión Mixta de Aux. de Revisión de Plantillas|E.E. Maria Campos Garcia", label: "Aux. Revisión de Plantillas" },
    ],
  },
]
