import type { LibraryDocumentEntry } from "../services/catalog"
import { getPreambulo, type PreambuloNormativo } from "../data/preambulos-normativos"

export function formatTipoDocumento(type: string): string {
  switch (type) {
    case "collective_agreement":
      return "Contrato Colectivo"
    case "union_statutes":
      return "Estatutos Sindicales"
    case "union_regulation":
      return "Reglamento Sindical"
    case "institutional_regulation":
      return "Reglamento Institucional"
    case "regulation":
      return "Reglamento"
    case "federal_law":
      return "Ley Federal"
    case "federal_regulation":
      return "Reglamento Federal"
    case "NOM":
      return "Norma Oficial Mexicana (NOM)"
    case "procedure":
      return "Procedimiento Institucional"
    case "flujos-clinicos":
    case "flujo-clinico":
      return "Procedimiento Clínico"
    case "administrativos":
    case "administrativo":
      return "Procedimiento Administrativo"
    case "salary_table":
      return "Tabulador Salarial"
    case "integrity_code":
      return "Código de Conducta"
    case "manual":
      return "Manual de Procedimientos"
    case "agreement":
      return "Acuerdo Institucional"
    case "criteria":
      return "Criterio Técnico"
    default:
      if (!type) return "Documento Normativo"
      return type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

export function formatDocSubtitle(doc: LibraryDocumentEntry): string {
  const org = (doc.organization || []).filter(Boolean).join(", ").trim()
  const tipo = formatTipoDocumento(doc.type)
  const clave = doc.key ? `Clave ${doc.key}` : null

  const parts = [org, clave, tipo].filter(Boolean)
  return parts.join(" · ")
}

export function getOrSynthesizePreambulo(doc: LibraryDocumentEntry): PreambuloNormativo {
  const found = getPreambulo(doc.id) || (doc.key ? getPreambulo(doc.key) : undefined)
  if (found) return found

  const lowerTitle = doc.title.toLowerCase()
  const tipo = formatTipoDocumento(doc.type)

  let enUnaFrase = "Documento oficial del marco regulatorio para fundamentar procedimientos y proteger tus derechos."
  let preambulo = `Este documento es un ${tipo.toLowerCase()} oficial aplicable en el Instituto Mexicano del Seguro Social. Contiene los lineamientos técnicos, operativos y jurídicos que regulan las actividades en las unidades y centros de trabajo.`
  const aQuienAplica: string[] = ["Personal del Instituto", "Ramas de salud, técnicas y administrativas"]
  const aquiPuedesEncontrar: string[] = [
    "Criterios técnicos y requisitos obligatorios del servicio.",
    "Límites de responsabilidad y alcance funcional de las áreas.",
    "Fundamento normativo para sustentar tu actuación ante jefaturas y usuarios.",
  ]
  const cuandoConsultarlo: string[] = [
    "Cuando requieras conocer el procedimiento oficial paso a paso.",
    "Para justificar tu apego a la norma institucional ante cualquier aclaración.",
    "Al preparar escritos de defensa o solicitudes de insumos y condiciones seguras.",
  ]
  const ojoConEsto: string[] = [
    "Ninguna orden de jefatura ni circular interna puede estar por encima de este documento ni violar las cláusulas del Contrato Colectivo de Trabajo.",
  ]

  if (/salud|médic|hospital|atención|paciente/i.test(lowerTitle)) {
    enUnaFrase = "Regula los estándares de atención médica, expedientes clínicos, derechos de pacientes y obligaciones del personal de salud."
    preambulo = `Establece las directrices para la prestación de servicios de salud en unidades de 1°, 2° y 3° nivel. Define los protocolos que debes seguir en la atención para garantizar la seguridad del paciente y tu propio respaldo legal.`
    aQuienAplica.length = 0
    aQuienAplica.push("Médicos familiares y no familiares", "Personal de enfermería", "Asistentes médicas", "Técnicos de diagnóstico y auxiliares")
    aquiPuedesEncontrar.push("Reglas sobre consentimiento informado y manejo de notas médicas.")
  } else if (/riesgo|accidente|enfermedad de trabajo|st-7|st-9/i.test(lowerTitle)) {
    enUnaFrase = "Lineamientos institucionales para calificar, proteger y subsidiar riesgos y accidentes de trabajo."
    preambulo = `Contiene las disposiciones para dictaminar accidentes en trayecto, en el centro de trabajo y secuelas laborales. Conocer este documento evita que te califiquen indebidamente un riesgo de trabajo como enfermedad general.`
    aQuienAplica.length = 0
    aQuienAplica.push("Todos los trabajadores del IMSS (base, interinos y sustitutos)", "Comisiones de Seguridad e Higiene")
    ojoConEsto.push("Cuentas con 72 horas para dar aviso inicial de cualquier riesgo de trabajo conforme a la Cláusula 89.")
  } else if (/nom-|seguridad|higiene|protecci|ergon|psicosocial|vibrac|ruido/i.test(lowerTitle)) {
    enUnaFrase = "Norma Oficial Mexicana de cumplimiento obligatorio sobre condiciones seguras y medio ambiente de trabajo."
    preambulo = `Define las condiciones mínimas de seguridad e higiene que el patrón (IMSS) está obligado a brindarte en tu centro laboral: equipo de protección, mantenimiento de áreas y prevención de riesgos físicos y psicosociales.`
    aQuienAplica.length = 0
    aQuienAplica.push("Todo el personal en áreas operativas, clínicas, almacenes y oficinas", "Comisiones Mixtas de Seguridad e Higiene")
    ojoConEsto.push("El Instituto está legalmente obligado a proporcionar el equipo de protección personal certificado sin costo para ti.")
  } else if (/beca|capacitaci|educaci|adiestram/i.test(lowerTitle)) {
    enUnaFrase = "Bases y requisitos para acceder a becas, cursos de superación académica y licencias con goce de sueldo."
    preambulo = `Regula los estímulos y permisos para continuar tus estudios técnicos, de licenciatura o posgrado en el Instituto, garantizando tus derechos contractuales de capacitación.`
    aQuienAplica.length = 0
    aQuienAplica.push("Trabajadores de base e interinos con derecho a capacitación", "Hijos de trabajadores en programas de beca")
  } else if (/plantilla|personal|dotaci|sustitu/i.test(lowerTitle)) {
    enUnaFrase = "Criterios para la asignación y cálculo de dotación de personal en turnos y servicios hospitalarios."
    preambulo = `Define cómo se deben estructurar las plantillas por servicio y turno para evitar la sobrecarga de trabajo y asegurar la cobertura de ausentismos programados.`
    aQuienAplica.length = 0
    aQuienAplica.push("Delegados sindicales", "Jefaturas de servicio", "Personal de todas las categorías en unidades médicas")
  }

  return {
    documentId: doc.id,
    tituloComun: doc.title,
    claveOficial: doc.key ?? undefined,
    organizacion: doc.organization.filter(Boolean).join(" / ") || "IMSS",
    categoria: "procedimientos",
    enUnaFrase,
    preambulo,
    aQuienAplica,
    aquiPuedesEncontrar,
    temasClave: [
      {
        tema: "Criterios Oficiales de Aplicación",
        referencia: doc.key ? `Clave ${doc.key}` : "Normativa Vigente",
        queEncontraras: "Reglas institucionales vigentes para el desarrollo de actividades.",
        relevancia: "alta",
      },
      {
        tema: "Respaldo y Seguridad Laboral",
        referencia: "Marco Normativo",
        queEncontraras: "Sustento documental para no incurrir en responsabilidad administrativa.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo,
    ojoConEsto,
    vigenciaTexto: doc.versionLabel ?? "Documento oficial del acervo",
  }
}
