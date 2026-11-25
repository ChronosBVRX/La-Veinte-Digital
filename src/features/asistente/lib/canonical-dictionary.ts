import type { SanitizedWorkerProfile } from "./worker-context-adapter"

export interface CanonicalMapping {
  keywords: RegExp
  canonicalTitle: string
  associatedClauses: string[]
  searchExpansionTerms: string[]
  isTopicOnly?: boolean
  lexicalOrTerms?: string[]
}

export const CANONICAL_MAPPINGS: CanonicalMapping[] = [
  {
    keywords: /\b(radi[oó]log[oa]|rayos\s*x|gabinete de rayos|emanaci[oó]n|radiaci[oó]n)\b/i,
    canonicalTitle: "TÉCNICO RADIÓLOGO",
    associatedClauses: [
      "Cláusula 86 Bis",
      "Cláusula 63 Bis",
      "Reglamento de Infectocontagiosidad y Emanaciones Radiactivas",
    ],
    searchExpansionTerms: [
      "TECNICO RADIOLOGO",
      "clausula 86 bis",
      "clausula 63 bis",
      "emanaciones radiactivas",
      "sobresueldo",
      "riesgo",
      "tabulador de sueldos",
    ],
  },
  {
    keywords: /\b(enfermer[oa]|auxiliar de enfermer[íi]a|jefe de piso)\b/i,
    canonicalTitle: "ENFERMERA GENERAL / AUXILIAR DE ENFERMERÍA",
    associatedClauses: ["Cláusula 63", "Cláusula 86 Bis"],
    searchExpansionTerms: [
      "ENFERMERA GENERAL",
      "AUXILIAR DE ENFERMERIA",
      "ENFERMERA ESPECIALISTA",
      "tabulador",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(m[eé]dic[oa]|doctor[a]?|especialista)\b/i,
    canonicalTitle: "MÉDICO FAMILIAR / MÉDICO NO FAMILIAR",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos"],
    searchExpansionTerms: [
      "MEDICO FAMILIAR",
      "MEDICO NO FAMILIAR",
      "MEDICO GENERAL",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(camiller[oa])\b/i,
    canonicalTitle: "CAMILLERO EN UNIDADES HOSPITALARIAS",
    associatedClauses: ["Cláusula 63", "Reglamento de Infectocontagiosidad"],
    searchExpansionTerms: [
      "CAMILLERO EN UNIDADES HOSPITALARIAS",
      "infectocontagiosidad",
      "tabulador",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(ch[oó]fer|conductor)\b/i,
    canonicalTitle: "CHOFER",
    associatedClauses: ["Reglamento de Conductores de Vehículos", "Cláusula 63"],
    searchExpansionTerms: [
      "CONDUCTOR",
      "CHOFER",
      "viaticos",
      "reglamento de conductores",
    ],
  },
  {
    keywords: /\b(limpieza|intendencia|higiene y limpieza)\b/i,
    canonicalTitle: "AUXILIAR UNIVERSAL DE OFICINAS / INTENDENCIA",
    associatedClauses: ["Cláusula 63", "Reglamento de Infectocontagiosidad"],
    searchExpansionTerms: [
      "OPERADOR DE SERVICIOS GENERALES",
      "LIMPIEZA E HIGIENE",
      "infectocontagiosidad",
      "tabulador",
    ],
  },
  {
    keywords: /\b(manejador(a)?\s*(de)?\s*alimentos|cociner[oa]|nutrici[oó]n|diet[eé]tica|nutri[oó]log[oa]|dietista)\b/i,
    canonicalTitle: "MANEJADOR DE ALIMENTOS",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "MANEJADOR DE ALIMENTOS",
      "SERVICIOS DE NUTRICION Y DIETETICA",
      "COCINERO TECNICO",
      "NUTRICIONISTA DIETISTA",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(asistente\s*m[eé]dic[oa]|trabajador(a)?\s*social)\b/i,
    canonicalTitle: "ASISTENTE MÉDICA / TRABAJADORA SOCIAL",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "ASISTENTE MEDICA",
      "TRABAJADORA SOCIAL",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(farmacia|almac[eé]n|almacenista)\b/i,
    canonicalTitle: "OFICIAL DE FARMACIA / AUXILIAR DE ALMACÉN",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "OFICIAL DE FARMACIA",
      "AUXILIAR DE FARMACIA",
      "AUXILIAR DE ALMACEN",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(laboratorista|auxiliar\s*de\s*laboratorio|qu[ií]mic[oa]\s*cl[ií]nic[oa]|citotecn[oó]log[oa]|histotecn[oó]log[oa])\b/i,
    canonicalTitle: "LABORATORISTA / QUÍMICO CLÍNICO",
    associatedClauses: ["Cláusula 63", "Cláusula 86 Bis", "Tabulador de Sueldos"],
    searchExpansionTerms: [
      "LABORATORISTA",
      "AUXILIAR DE LABORATORIO",
      "QUIMICO CLINICO",
      "CITOTECNOLOGO",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(auxiliar\s*universal\s*de\s*oficinas|auo\b|oficial\s*de\s*estad[ií]stica|oficial\s*de\s*personal|operador\s*telef[oó]nico|mensajero)\b/i,
    canonicalTitle: "AUXILIAR UNIVERSAL DE OFICINAS",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "AUXILIAR UNIVERSAL DE OFICINAS",
      "OFICIAL DE ESTADISTICA",
      "OFICIAL DE PERSONAL",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(inhaloterapeuta|terapista\s*f[ií]sic[oa]|terapista\s*ocupacional|psic[oó]log[oa]|estomat[oó]log[oa]|dentista|fonoaudi[oó]log[oa])\b/i,
    canonicalTitle: "PERSONAL CLÍNICO Y PARAMÉDICO",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "INHALOTERAPEUTA",
      "TERAPISTA FISICO",
      "PSICOLOGO CLINICO",
      "ESTOMATOLOGO",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(polivalente|electricista|plomero|mec[aá]nico|lavander[ií]a|ambulancia|operador\s*de\s*ambulancias|conservaci[oó]n)\b/i,
    canonicalTitle: "CONSERVACIÓN, LAVANDERÍA Y AMBULANCIAS",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "TECNICO POLIVALENTE",
      "OPERADOR DE SERVICIOS DE LAVANDERIA",
      "OPERADOR DE AMBULANCIAS",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(puericultista|guarder[ií]a|oficial\s*de\s*puericultura)\b/i,
    canonicalTitle: "OFICIAL DE PUERICULTURA / GUARDERÍAS",
    associatedClauses: ["Cláusula 63", "Reglamento de Guarderías", "Tabulador de Sueldos"],
    searchExpansionTerms: [
      "OFICIAL DE PUERICULTURA",
      "GUARDERIAS",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(cu[aá]nto (gana|gano|pagan)|cu[aá]l es el (sueldo|salario)|sueldo (de|neto|base|mensual|quincenal)|salario (de|base|mensual)|mi sueldo|ingreso mensual|percepciones|tabulador)\b/i,
    canonicalTitle: "SUELDO TABULAR DIARIO Y PERCEPCIONES",
    associatedClauses: ["Cláusula 63", "Cláusula 63 Bis", "Tabulador de Sueldos"],
    searchExpansionTerms: [
      "sueldo tabular diario",
      "concepto 011 ayuda de renta",
      "percepciones ordinarias",
      "tabulador de sueldos",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["sueldo tabular", "clausula 63", "tabulador"],
  },
  {
    keywords: /\b(peligrosidad|emanaciones|infecto|alto riesgo|riesgo de trabajo)\b/i,
    canonicalTitle: "SOBRESUELDO POR INFECTOCONTAGIOSIDAD Y EMANACIONES",
    associatedClauses: [
      "Cláusula 86 Bis",
      "Reglamento de Infectocontagiosidad y Emanaciones Radiactivas",
    ],
    searchExpansionTerms: [
      "clausula 86 bis",
      "concepto 063 emanaciones radiactivas",
      "concepto 058 infectocontagiosidad",
      "sobresueldo porcentaje",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["clausula 86 bis", "infectocontagiosidad", "emanaciones radiactivas"],
  },
  {
    keywords: /\b(profesiograma|perfil de puesto|requisitos de puesto|funciones del puesto|actividades de)\b/i,
    canonicalTitle: "CATÁLOGO DE PROFESIOGRAMAS",
    associatedClauses: ["Profesiogramas", "Reglamento de Escalafón"],
    searchExpansionTerms: [
      "profesiograma descripcion de funciones",
      "requisitos academicos",
      "lineas de escalafon",
      "catalogo de puestos",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["profesiograma", "requisitos", "funciones"],
  },
  {
    keywords: /\b(vacacion\w*|rol vacacional|quincena vacacional|prima vacacional|por vencer|cuatrimestral|continuidad vacacional)\b/i,
    canonicalTitle: "VACACIONES Y ROL VACACIONAL",
    associatedClauses: ["Cláusula 47", "Procedimiento 1A74-003-025"],
    searchExpansionTerms: [
      "clausula 47 vacaciones",
      "prima vacacional",
      "rol vacacional",
      "periodos vacacionales",
      "1A74-003-025",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["vacaciones", "clausula 47", "prima vacacional"],
  },
  {
    keywords: /\b(aguinaldo|gratificaci[oó]n anual|concepto\s*0?49)\b/i,
    canonicalTitle: "AGUINALDO CONTRACTUAL",
    associatedClauses: ["Cláusula 107", "Cláusula 63 Bis"],
    searchExpansionTerms: [
      "clausula 107 aguinaldo",
      "noventa dias sueldo",
      "concepto 049",
      "gratificacion anual",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["aguinaldo", "clausula 107", "gratificacion"],
  },
  {
    keywords: /\b(segunda de julio|fondo de ahorro|bono de julio|concepto\s*0?55)\b/i,
    canonicalTitle: "FONDO DE AHORRO Y SEGUNDA DE JULIO",
    associatedClauses: ["Cláusula 144", "Cláusula 63 Bis inc. b", "Procedimiento 1A74-003-024"],
    searchExpansionTerms: [
      "clausula 144 fondo de ahorro",
      "46 dias",
      "clausula 63 bis",
      "1A74-003-024",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["fondo de ahorro", "clausula 144", "segunda quincena julio"],
  },
  {
    keywords: /\b(horas? extra|tiempo extraordinario|doblar turno|guardias?|festiv[oa]s?|d[ií]a inh[aá]bil|descanso obligatorio|prima dominical|domingo|032|040)\b/i,
    canonicalTitle: "TIEMPO EXTRA, GUARDIAS Y DESCANSOS",
    associatedClauses: ["Cláusula 32", "Cláusula 37", "Cláusula 46", "Procedimiento 1A74-003-031", "Procedimiento 1A74-003-023"],
    searchExpansionTerms: [
      "tiempo extraordinario",
      "guardias",
      "dias descanso obligatorio",
      "prima dominical",
      "1A74-003-031",
      "1A74-003-023",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["tiempo extraordinario", "guardias", "descanso obligatorio", "prima dominical"],
  },
  {
    keywords: /\b(retardos?|faltas?|faltar|sin retardo|puntualidad|asiduidad|pase de salida|nota mala|ausentismo|033|034)\b/i,
    canonicalTitle: "ASISTENCIA, PUNTUALIDAD, RETARDOS Y FALTAS",
    associatedClauses: ["Cláusula 38", "Artículo 93 RIT", "Procedimiento 1A74-003-034", "Procedimiento 1A31-003-005"],
    searchExpansionTerms: [
      "control de asistencia puntualidad",
      "estimulo puntualidad",
      "tolerancia retardo",
      "ausentismo no programado",
      "concepto 033",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["asistencia", "puntualidad", "retardo", "faltas", "ausentismo"],
  },
  {
    keywords: /\b(permisos?|licencias?|econ[oó]mico|sin goce|con goce|duelo|falleci[oó]|matrimonio|paternidad|140\s*bis|cuidados m[eé]dicos)\b/i,
    canonicalTitle: "PERMISOS Y LICENCIAS",
    associatedClauses: ["Cláusula 41", "Cláusula 43", "Cláusula 45", "Procedimiento 1A31-003-016", "Procedimiento 1A31-003-003"],
    searchExpansionTerms: [
      "permisos temporales con goce sin goce sueldo",
      "clausula 41",
      "licencia cuidados medicos",
      "1A31-003-016",
      "1A31-003-003",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["permisos", "licencia", "clausula 41", "goce de sueldo"],
  },
  {
    keywords: /\b(embaraz\w*|maternidad|prenatal|postnatal|lactancia|puerperio)\b/i,
    canonicalTitle: "MATERNIDAD Y LACTANCIA",
    associatedClauses: ["Cláusula 42", "Cláusula 91", "Ley del Seguro Social"],
    searchExpansionTerms: [
      "maternidad embarazo descanso",
      "lactancia",
      "clausula 42",
      "incapacidad maternidad",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["maternidad", "embarazo", "lactancia", "clausula 42"],
  },
  {
    keywords: /\b(jubil\w*|pensi[oó]n\w*|rjp\b|r[eé]gimen de jubilaciones|retiro|afore|sar\b|cesant[ií]a|vejez|107|108|152)\b/i,
    canonicalTitle: "JUBILACIONES, PENSIONES Y RETIRO",
    associatedClauses: ["Régimen de Jubilaciones y Pensiones", "Convenio Adicional", "Procedimiento 1A32-003-005"],
    searchExpansionTerms: [
      "regimen de jubilaciones y pensiones",
      "anos de servicio edad",
      "fondo de jubilacion",
      "1A32-003-005",
      "afore retiro",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["jubilacion", "pension", "regimen jubilaciones", "retiro"],
  },
  {
    keywords: /\b(antig[üu]edad|quinquenio|prima de antig[üu]edad|a[ñn]os de servicio|reconocimiento de antig[üu]edad)\b/i,
    canonicalTitle: "ANTIGÜEDAD Y QUINQUENIO",
    associatedClauses: ["Cláusula 59", "Procedimiento 1A31-003-001"],
    searchExpansionTerms: [
      "reconocimiento de antiguedad",
      "prima antiguedad",
      "clausula 59",
      "1A31-003-001",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["antiguedad", "clausula 59", "anos servicio"],
  },
  {
    keywords: /\b(08|sustitut\w*|interin\w*|eventual\w*|temporal\w*|bolsa de trabajo|basificaci[oó]n|escalaf[oó]n|ascenso|subir de categor[ií]a)\b/i,
    canonicalTitle: "BOLSA DE TRABAJO, SUSTITUTOS 08 Y ESCALAFÓN",
    associatedClauses: ["Reglamento de Bolsa de Trabajo", "Reglamento de Escalafón", "Procedimiento 1A75-003-010"],
    searchExpansionTerms: [
      "bolsa de trabajo sustituto",
      "reglamento de escalafon",
      "plaza base temporal",
      "1A75-003-010",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["bolsa de trabajo", "escalafon", "sustituto", "base"],
  },
  {
    keywords: /\b(cambio de adscripci[oó]n|adscripci[oó]n|permuta|traslado|cambio de turno|modificaci[oó]n de horario|cambio de horario|cambio de residencia)\b/i,
    canonicalTitle: "ADSCRIPCIÓN, TURNOS, HORARIOS Y PERMUTAS",
    associatedClauses: ["Procedimiento 1A74-003-032", "Procedimiento 1A74-003-029", "Reglamento de Selección para Cambio de Rama/Residencia"],
    searchExpansionTerms: [
      "cambio de adscripcion permuta",
      "modificacion de horarios turno",
      "cambio lugar residencia",
      "1A74-003-032",
      "1A74-003-029",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["adscripcion", "permuta", "horario", "turno", "residencia"],
  },
  {
    keywords: /\b(pr[eé]stamo\w*|cl[aá]usula\s*97|anticipo|caja de ahorro|hipotecario|habitaci[oó]n|veh[ií]culo|autom[oó]vil|infonavit|fonacot|160|154|170)\b/i,
    canonicalTitle: "PRÉSTAMOS, ANTICIPOS Y CRÉDITOS",
    associatedClauses: ["Cláusula 97", "Procedimiento 1A72-003-005", "Procedimiento 1A72-003-014", "Procedimiento 1A14-003-011"],
    searchExpansionTerms: [
      "clausula 97 anticipo sueldo",
      "prestamo fomento habitacion",
      "infonavit fonacot",
      "1A72-003-005",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["prestamo", "clausula 97", "anticipo", "infonavit", "fonacot"],
  },
  {
    keywords: /\b(acta administrativa|investigaci[oó]n laboral|citatorio|sanci[oó]n\w*|suspensi[oó]n|rescisi[oó]n|despid\w*|correr|reconsider\w*|honor y justicia|comisi[oó]n mixta disciplinaria)\b/i,
    canonicalTitle: "DEFENSA ANTE ACTAS, INVESTIGACIONES Y SANCIONES",
    associatedClauses: ["Cláusula 22", "Cláusula 55", "Cláusula 56", "Procedimiento 1A31-003-015"],
    searchExpansionTerms: [
      "clausula 22 investigacion acta administrativa representante sindical",
      "clausula 55 clausula 56 rescision",
      "reconsiderar sanciones laborales",
      "1A31-003-015",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["clausula 22", "investigacion", "acta", "sancion", "rescision"],
  },
  {
    keywords: /\b(acoso|hostig\w*|violencia laboral|maltrat\w*|amenaz\w*|discriminaci[oó]n|riesgo psicosocial|denuncia|represali\w*|intimid\w*)\b/i,
    canonicalTitle: "ACOSO, HOSTIGAMIENTO Y VIOLENCIA LABORAL",
    associatedClauses: ["Protocolo Violencia y Acoso IMSS-SNTSS", "NOM-035-STPS-2018", "Medidas de Protección"],
    searchExpansionTerms: [
      "protocolo prevencion violencia acoso",
      "hostigamiento laboral",
      "medidas de proteccion denunciantes",
      "NOM-035 riesgo psicosocial",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["violencia", "acoso", "hostigamiento", "NOM-035", "denuncia"],
  },
  {
    keywords: /\b(accidente\w*|en trayecto|enfermedad (?:de trabajo|profesional|general)|incapacidad\w*|st-?7|st-?9|equipo de protecci[oó]n|epp\b|ergon[oó]m\w*|ley silla|bipedestaci[oó]n|rpbi)\b/i,
    canonicalTitle: "RIESGOS DE TRABAJO, INCAPACIDADES Y SEGURIDAD",
    associatedClauses: ["Procedimiento 3A21-003-010", "Procedimiento 3A21-003-003", "Procedimiento 1A75-B03-013", "NOM-017-STPS-2024", "NOM-087"],
    searchExpansionTerms: [
      "riesgo de trabajo accidente enfermedad",
      "incapacidad temporal subsidio",
      "equipo proteccion personal NOM-017",
      "bipedestacion descanso",
      "3A21-003-010",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["riesgo trabajo", "accidente", "incapacidad", "equipo proteccion", "bipedestacion"],
  },
  {
    keywords: /\b(becas?|capacitaci[oó]n|curso|post[eé]cnico|residente\w*|residencia m[eé]dica)\b/i,
    canonicalTitle: "BECAS, CAPACITACIÓN Y RESIDENCIAS",
    associatedClauses: ["Reglamento de Becas", "Reglamento de Capacitación", "Reglamento de Médicos Residentes"],
    searchExpansionTerms: [
      "reglamento becas capacitacion",
      "comision academica",
      "medicos residentes",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["becas", "capacitacion", "residentes"],
  },
  {
    keywords: /\b(uniformes?|ropa de trabajo|calzado|zapatos|lentes|anteojos|despensa|ayuda de renta|pasajes|vi[aá]ticos|defunci[oó]n|funeral\w*|fondo de ayuda sindical|pliego testamentario|seguro de vida)\b/i,
    canonicalTitle: "PRESTACIONES VARIAS CCT (ROPA, LENTES, DEFUNCIÓN, PASAJES)",
    associatedClauses: ["Reglamento de Ropa de Trabajo y Uniformes", "Reglamento Fondo de Ayuda Sindical por Defunción", "Procedimiento 1A32-A03-008"],
    searchExpansionTerms: [
      "ropa de trabajo uniformes calzado",
      "lentes anteojos despensa",
      "fondo ayuda sindical defuncion",
      "pago de pasajes viaticos",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["uniformes", "ropa trabajo", "lentes", "defuncion", "pasajes"],
  },
  {
    keywords: /\b(confianza\s*[ab]?|estatuto.*confianza|permiso sindical|licencia sindical|cuota sindical|impugnaci[oó]n|asamblea sindical|delegad[oa] sindical|honor y justicia)\b/i,
    canonicalTitle: "ESTATUTO DE CONFIANZA Y VIDA SINDICAL",
    associatedClauses: ["Estatutos SNTSS", "Estatuto Confianza A", "Procedimiento 1A31-003-007"],
    searchExpansionTerms: [
      "estatutos sntss derechos sindicales",
      "trabajadores confianza A",
      "permisos sindicales 1A31-003-007",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["estatutos", "confianza", "sindical", "permiso sindical"],
  },
  {
    keywords: /\b(teletrabajo|home office|discapacidad|inclusi[oó]n laboral|accesibilidad)\b/i,
    canonicalTitle: "TELETRABAJO E INCLUSIÓN LABORAL",
    associatedClauses: ["NOM-037-STPS-2023", "NOM-034-STPS-2016", "LGIPD"],
    searchExpansionTerms: [
      "NOM-037 teletrabajo",
      "NOM-034 discapacidad centros trabajo",
      "inclusion personas discapacidad",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["teletrabajo", "NOM-037", "discapacidad", "NOM-034"],
  },
  {
    keywords: /\b(derechos?\s+(?:laborales|como trabajador|en el imss)|prestaciones?\s+(?:tengo|laborales|imss|del cct)|qu[eé]\s+me\s+(?:toca|corresponde)\s+(?:por trabajar|en el imss)|beneficios\s+del\s+contrato|nuevo ingreso|soy nuevo)\b/i,
    canonicalTitle: "DERECHOS Y PRESTACIONES GENERALES CCT IMSS-SNTSS",
    associatedClauses: ["CCT IMSS-SNTSS 2025-2027", "Cláusula 47", "Cláusula 63", "Cláusula 107", "Cláusula 144"],
    searchExpansionTerms: [
      "contrato colectivo prestaciones salario jornada vacaciones aguinaldo fondo ahorro antiguedad",
    ],
    isTopicOnly: true,
    lexicalOrTerms: ["prestaciones", "vacaciones", "aguinaldo", "jornada", "salario", "contrato colectivo"],
  },
]

export interface DecomposedQuery {
  focus: "SALARY" | "HAZARD_PAY" | "JOB_DESCRIPTION" | "GENERAL"
  query: string
}

const CONVERSATIONAL_STOPWORDS =
  /\b(cu[aá]l|cu[aá]les|cu[aá]nto|cu[aá]ntos|cu[aá]nta|cu[aá]ntas|c[oó]mo|d[oó]nde|cu[aá]ndo|qui[eé]n|qu[eé]|dime|expl[ií]came|puedes|podr[ií]as|quiero|necesito|saber|conocer|gana|gano|ganan|pagan|percibe|toca|corresponde|corresponden|hace|hacen|tengo|soy|favor|hola|oye|disculpa|buenos|buenas|d[ií]as|tardes|noches|gracias|ayuda|ay[uú]dame|mu[eé]strame|ens[eé][nñ]ame|h[aá]blame|trabajando|trabajo|imss|puedo|pueden|debo|deben|hago|pasa|si|pero|para|por|con|sin|sobre|acerca|unos?|unas?|llevo|meses|a[ñn]os|agarrar|meter|sacar|quitar|poner|pusieron|mandaron|dijeron|dieron|dar|ver|algo|todo|mucho|poco|bien|mal|mi|mis|tu|tus|su|sus|me|te|se|nos|le|les|lo|la|los|las|el|un|una|de|del|al|en|y|o|a|e|es|son|esta|est[aá]|estan|est[aá]n|hay)\b/gi

/**
 * Construye una consulta léxica limpia para PostgreSQL FTS (`websearch_to_tsquery`),
 * eliminando verbos conversacionales e interrogativos que provocan 0 resultados
 * al combinarse con AND, y añadiendo términos canónicos de puesto o tema con OR.
 */
export function buildLexicalQuery(
  question: string,
  matchedCategories: string[],
  hasSalary: boolean,
  matchedTopicOrTerms: string[] = [],
): string {
  const cleaned = question
    .replace(/[¿?¡!.,;:()"']/g, " ")
    .replace(CONVERSATIONAL_STOPWORDS, " ")
    .replace(/\s+/g, " ")
    .trim()

  const topicOrBlock = [...new Set(matchedTopicOrTerms)]
    .slice(0, 6)
    .map((term) => (term.includes(" ") ? `"${term}"` : term))
    .join(" OR ")

  const primaryCat = matchedCategories[0]
  if (primaryCat) {
    if (hasSalary) {
      return topicOrBlock
        ? `sueldo ${primaryCat} OR ${primaryCat} OR ${topicOrBlock}`
        : `sueldo ${primaryCat} OR ${primaryCat}`
    }
    const base = cleaned ? `${cleaned} OR ${primaryCat}` : primaryCat
    return topicOrBlock ? `${base} OR ${topicOrBlock}` : base
  }

  if (hasSalary && cleaned && !/\bsueldo\b/i.test(cleaned)) {
    return topicOrBlock
      ? `sueldo ${cleaned} OR ${cleaned} OR ${topicOrBlock}`
      : `sueldo ${cleaned} OR ${cleaned}`
  }

  if (topicOrBlock) {
    return cleaned ? `${cleaned} OR ${topicOrBlock}` : topicOrBlock
  }

  // Para preguntas generales sin mapeo explícito: si quedan >=2 palabras de contenido,
  // evitar que websearch_to_tsquery falle por AND estricto uniendo las palabras clave con OR.
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 3)
  if (tokens.length >= 2) {
    return `${cleaned} OR ${tokens.slice(0, 6).join(" OR ")}`
  }

  return cleaned || question.trim()
}

/**
 * Normaliza y expande la consulta léxica con términos canónicos de la institución.
 */
export function normalizeForRetrieval(
  question: string,
  userProfile?: SanitizedWorkerProfile | null,
): { expandedQuery: string; lexicalQuery: string; subQueries: DecomposedQuery[] } {
  const matchingExpansions: string[] = []
  const matchedCategories: string[] = []
  const matchedTopicOrTerms: string[] = []
  const subQueries: DecomposedQuery[] = []

  // 1. Si el usuario pregunta en primera persona o sobre un tema dependiente de su régimen/puesto
  // y cuenta con perfil en la plataforma, inyectamos su contexto verificado para afinar retrieval.
  const isPersonalOrProfileSensitive =
    /\b(cu[aá]nto (gano|me toca|me corresponde|debo ganar|cobro|cobr[eé])|mi (sueldo|salario|puesto|categor[íi]a|aguinaldo|vacaci[oó]n|tarjet[oó]n|quincena|jornada|turno|antig[üu]edad)|mis (vacaciones|derechos|prestaciones|deducciones|percepciones|marcas))\b/i.test(
      question,
    ) ||
    /\b(vacaciones|aguinaldo|fondo de ahorro|segunda de julio|jubilaci[oó]n|pensi[oó]n|prestaciones|derechos laborales|sobresueldo|radiaci[oó]n|riesgo)\b/i.test(
      question,
    )

  if (isPersonalOrProfileSensitive && userProfile?.hasProfile) {
    if (userProfile.categoria) {
      matchingExpansions.push(userProfile.categoria)
      matchedCategories.push(userProfile.categoria)
    }
    if (userProfile.jornadaHoras) {
      matchingExpansions.push(`jornada ${userProfile.jornadaHoras}`)
    }
    if (userProfile.tipoPlaza && /08|sustituto|eventual/i.test(userProfile.tipoPlaza)) {
      matchingExpansions.push("sustituto 08 proporcional bolsa de trabajo")
      matchedTopicOrTerms.push("sustituto", "proporcional")
    }
    if (userProfile.exposicionRadiologica) {
      matchingExpansions.push("clausula 86 bis emanaciones radiactivas concepto 063")
      matchedTopicOrTerms.push("clausula 86 bis", "emanaciones radiactivas")
    }
  }

  // 2. Mapeos canónicos por palabras clave en la pregunta
  for (const m of CANONICAL_MAPPINGS) {
    if (m.keywords.test(question)) {
      matchingExpansions.push(...m.searchExpansionTerms)
      if (!m.isTopicOnly) {
        matchedCategories.push(m.searchExpansionTerms[0])
      }
      if (m.lexicalOrTerms) {
        matchedTopicOrTerms.push(...m.lexicalOrTerms)
      }
    }
  }

  // 3. Descomposición Multi-Query cuando se detecta más de un dominio (ej. sueldo + riesgo + profesiograma)
  const hasSalary = /\b(sueldo|salario|gana|gano|ganan|percepciones|pag[ao]n?|tabulador)\b/i.test(question)
  const hasHazard = /\b(radi[oó]log[oa]s?|rayos|riesgo|emanaci[oó]n|infecto|peligro)\b/i.test(question)
  const hasJobDesc = /\b(profesiograma|funciones|requisitos|perfil|puesto|actividades)\b/i.test(question)

  if (hasSalary) {
    subQueries.push({
      focus: "SALARY",
      query: `${question} sueldo tabular diario tabulador de sueldos clausula 63`,
    })
  }
  if (hasHazard) {
    subQueries.push({
      focus: "HAZARD_PAY",
      query: `${question} emanaciones radiactivas clausula 86 bis concepto 063 reglamento infectocontagiosidad`,
    })
  }
  if (hasJobDesc) {
    subQueries.push({
      focus: "JOB_DESCRIPTION",
      query: `${question} profesiograma catalogo de perfiles de puesto requisitos funciones`,
    })
  }

  // Si no hubo subconsultas específicas, crear una genérica
  if (subQueries.length === 0) {
    subQueries.push({
      focus: "GENERAL",
      query: question,
    })
  }

  const dedupedTerms = [...new Set(matchingExpansions)].join(" ")
  const expandedQuery = dedupedTerms ? `${question} ${dedupedTerms}` : question
  const lexicalQuery = buildLexicalQuery(question, matchedCategories, hasSalary, matchedTopicOrTerms)

  return { expandedQuery, lexicalQuery, subQueries }
}
