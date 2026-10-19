/**
 * BASE DOCUMENTAL EN LENGUAJE NATURAL — BIBLIOTECA NORMATIVA IMSS-SNTSS
 *
 * Preámbulos pedagógicos, temas clave y casos de consulta cotidiana para las y los trabajadores.
 * Regla de gobernanza: Cada punto está fundamentado exclusivamente en la base documental oficial.
 */

export interface TemaClaveNormativo {
  tema: string
  referencia: string
  queEncontraras: string
  relevancia: "alta" | "media" | "destacada"
}

export interface PreambuloNormativo {
  documentId: string
  aliasIds?: string[]
  tituloComun: string
  claveOficial?: string
  urlOficial?: string
  organizacion: string
  categoria: "cct" | "sntss" | "reglamentos" | "leyes" | "seguridad" | "integridad" | "procedimientos" | "flujos-clinicos" | "administrativos"
  enUnaFrase: string
  preambulo: string
  aQuienAplica: string[]
  aquiPuedesEncontrar: string[]
  temasClave: TemaClaveNormativo[]
  cuandoConsultarlo: string[]
  ojoConEsto: string[]
  vigenciaTexto?: string
}

export const PREAMBULOS_NORMATIVOS: PreambuloNormativo[] = [
  {
    documentId: "CCT-IMSS-SNTSS-2025-2027",
    urlOficial: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    aliasIds: ["cct", "CCT", "contrato-colectivo", "clausulas", "Clausulas"],
    tituloComun: "Contrato Colectivo de Trabajo IMSS-SNTSS (CCT)",
    claveOficial: "CCT 2025-2027",
    organizacion: "IMSS / SNTSS",
    categoria: "cct",
    vigenciaTexto: "16 de octubre de 2025 al 15 de octubre de 2027",
    enUnaFrase: "El pacto supremo que protege tu salario, descansos, licencias y prestaciones por encima de la ley.",
    preambulo: `El Contrato Colectivo de Trabajo es el documento más importante de tu vida laboral en el Seguro Social. Fue pactado de común acuerdo entre el IMSS y el SNTSS para garantizar que tus derechos, ingresos y condiciones de trabajo sean superiores a lo que marca la Ley Federal del Trabajo.

Aquí puedes encontrar las reglas exactas de cómo te pagan, cuántos días de vacaciones te tocan, cómo defenderte ante una queja de jefatura y qué apoyos económicos tienes garantizados para ti y tu familia. Ninguna circular delegacional ni orden de jefatura puede estar por encima de lo que dice este Contrato.`,
    aQuienAplica: [
      "Trabajadores de base",
      "Trabajadores interinos",
      "Personal sustituto (02) en lo aplicable",
      "Ramas médicas, enfermería, paramédicas, administrativas y de servicios",
    ],
    aquiPuedesEncontrar: [
      "Tus días de vacaciones y el pago exacto de prima vacacional (Cláusula 47).",
      "Tu aguinaldo de 3 meses de sueldo tabular (Cláusula 107 y Concepto 023).",
      "El pago de infectocontagiosidad y alto riesgo (Cláusula 91 y Concepto 003/054).",
      "Las reglas de tolerancia de checada y estímulos de puntualidad y asistencia (Cláusulas 38 y 93).",
      "El Fondo de Ahorro patronal (Cláusula 144 y Concepto 050).",
      "El derecho de audiencia y defensa sindical obligatoria antes de cualquier sanción (Cláusula 1 y RIT).",
      "Los tipos de jornada de 6, 6.5, 8 y 12 horas, y pago de guardias o tiempo extra (Cláusulas 29 a 46).",
      "El Régimen de Jubilaciones y Pensiones RJP (Cláusula 110).",
    ],
    temasClave: [
      {
        tema: "Vacaciones y Prima Vacacional",
        referencia: "Cláusula 47",
        queEncontraras: "Tabla de días de descanso según tu antigüedad (de 16 hasta 20 días hábiles en dos periodos) y el pago de tu prima vacacional en el tarjetón.",
        relevancia: "destacada",
      },
      {
        tema: "Aguinaldo Contractual",
        referencia: "Cláusula 107",
        queEncontraras: "El derecho a recibir tres meses de sueldo tabular (90 días), pagaderos en dos exhibiciones (primera quincena de diciembre y enero).",
        relevancia: "destacada",
      },
      {
        tema: "Estímulos de Puntualidad y Asistencia",
        referencia: "Cláusula 93 y Cláusula 38",
        queEncontraras: "Tolerancia de 15 minutos en el checador y cómo se calculan las percepciones quincenales adicionales (Conceptos 024 y 025).",
        relevancia: "alta",
      },
      {
        tema: "Infectocontagiosidad y Alto Riesgo",
        referencia: "Cláusula 91",
        queEncontraras: "Porcentajes adicionales (10% a 20%) para personal en contacto permanente con pacientes infectocontagiosos, sustancias peligrosas o radiaciones.",
        relevancia: "alta",
      },
      {
        tema: "Fondo de Ahorro",
        referencia: "Cláusula 144",
        queEncontraras: "El mecanismo donde el Instituto aporta el equivalente a tu ahorro para entregarse anualmente en la primera quincena de agosto.",
        relevancia: "alta",
      },
      {
        tema: "Ayuda para Renta",
        referencia: "Cláusula 63 Bis",
        queEncontraras: "Prestación quincenal fija (Concepto 063) para apoyo de vivienda otorgada a las categorías amparadas.",
        relevancia: "media",
      },
      {
        tema: "Jornada y Horas Extras",
        referencia: "Cláusulas 29 a 46",
        queEncontraras: "Reglas para jornada diurna, nocturna o mixta, pago doble de horas extras y compensación de días de descanso obligatorio laborados.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si en tu tarjetón de pago te descontaron un estímulo de puntualidad o asistencia que consideras haber cumplido.",
      "Si jefatura pretende cambiarte de turno, horario o servicio sin tu consentimiento o fuera de convenio.",
      "Si te citan a una investigación laboral o acta administrativa (¡exige a tu delegado sindical!).",
      "Para planificar tus roles vacacionales o solicitar licencias con o sin goce de sueldo.",
    ],
    ojoConEsto: [
      "Ninguna sanción es válida si no estuviste acompañado por tu representación sindical.",
      "Los permisos económicos deben tramitarse con anticipación conforme a los plazos del Reglamento Interior de Trabajo.",
    ],
  },
  {
    documentId: "SNTSS-ESTATUTOS-2022",
    urlOficial: "https://media.sntss.org.mx/media/elements/estatutos-sntss-2022-kc64-image.pdf",
    aliasIds: ["estatutos", "estatutos-sntss"],
    tituloComun: "Estatutos del SNTSS",
    claveOficial: "Estatutos Sindicales Ed. 2022",
    organizacion: "SNTSS",
    categoria: "sntss",
    vigenciaTexto: "Publicación oficial SNTSS vigente (sujeto a proceso de reforma estatutaria)",
    enUnaFrase: "La ley interna de nuestro sindicato: tus derechos de agremiado, el voto personal y la fiscalización a dirigentes.",
    preambulo: `Los Estatutos son la máxima norma interna que rige a nuestra organización sindical. Aquí se establece que el Sindicato te pertenece a ti y a todos los trabajadores agremiados.

Aquí puedes encontrar cuáles son tus derechos como socio activo: desde votar en elecciones mediante voto libre, directo y secreto, hasta recibir asesoría jurídica gratuita, solicitar la intervención de comisiones sindicales y fiscalizar las cuotas y decisiones de las representaciones seccionales y nacionales.`,
    aQuienAplica: [
      "Todos los trabajadores de base agremiados al SNTSS",
      "Trabajadores jubilados y pensionados miembros de la asociación de jubilados",
      "Representantes y delegados sindicales",
    ],
    aquiPuedesEncontrar: [
      "Tus derechos de voz y voto en asambleas sindicales.",
      "El procedimiento de elección democrática de delegados y secretariados mediante voto secreto.",
      "Cómo funciona la Comisión de Honor y Justicia para resolver controversias entre compañeros o dirigentes.",
      "Las obligaciones sindicales y el destino de la cuota sindical ordinaria.",
      "La defensa sindical ante cualquier conflicto con autoridades del Instituto.",
    ],
    temasClave: [
      {
        tema: "Derechos de los Miembros",
        referencia: "Capítulo de Derechos de los Socios",
        queEncontraras: "El derecho inalienable a ser defendido frente al patrón, a postularte a cargos de representación y a manifestar tus opiniones en asamblea.",
        relevancia: "destacada",
      },
      {
        tema: "Voto Personal, Libre, Directo y Secreto",
        referencia: "Capítulo Electoral",
        queEncontraras: "Garantías democráticas para la renovación de comités ejecutivos y delegacionales sin presiones ni coacciones.",
        relevancia: "alta",
      },
      {
        tema: "Comisión de Honor y Justicia",
        referencia: "Reglamento Disciplinario Interno",
        queEncontraras: "Mecanismo formal para investigar faltas a la ética sindical, abusos de autoridad o desvío de recursos.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando haya elecciones o renovación de delegados en tu centro de trabajo.",
      "Si sientes que un delegado o dirigente sindical no te defendió conforme a los principios de la organización.",
      "Para revisar cómo se aplican las cuotas sindicales ordinarias (Concepto 107 en tu tarjetón).",
    ],
    ojoConEsto: [
      "Como socio del SNTSS tienes la obligación de asistir a las asambleas convocadas en tu centro de trabajo.",
      "Nadie puede privarte de tus derechos sindicales sin un dictamen fundamentado de la Comisión Nacional de Honor y Justicia.",
    ],
  },
  {
    documentId: "SNTSS-FAS-2025",
    urlOficial: "https://media.sntss.org.mx/media/elements/Reglamento%20FAS%202025%20VF%201.pdf",
    aliasIds: ["fas", "fondo-de-ayuda-sindical"],
    tituloComun: "Reglamento del Fondo de Ayuda Sindical por Defunción (FAS)",
    claveOficial: "Reglamento FAS 2025",
    organizacion: "SNTSS",
    categoria: "sntss",
    vigenciaTexto: "Vigente 2025",
    enUnaFrase: "El apoyo solidario inmediato para proteger económicamente a tus beneficiarios en caso de fallecimiento.",
    preambulo: `El FAS es el fondo solidario de auxilio mutuo sostenido por las aportaciones de las y los trabajadores del IMSS. Su único fin es entregar un respaldo económico urgente a la familia de un compañero que fallece, evitando que queden desamparados.

Aquí puedes encontrar cómo registrar tu Pliego Testamentario, quiénes pueden ser tus beneficiarios, cuánto dinero les corresponde y qué papeles deben presentar para cobrar el beneficio de manera rápida y sin intermediarios.`,
    aQuienAplica: [
      "Trabajadores de base activos",
      "Trabajadores jubilados y pensionados agremiados",
      "Beneficiarios designados en el Pliego Testamentario",
    ],
    aquiPuedesEncontrar: [
      "Cómo llenar y actualizar tu Pliego Testamentario en tu sección sindical.",
      "El monto oficial garantizado de ayuda económica por fallecimiento.",
      "Los requisitos y documentos que deben presentar tus deudos para el cobro.",
      "Los plazos máximos para solicitar la entrega del cheque o transferencia.",
    ],
    temasClave: [
      {
        tema: "Pliego Testamentario Sindical",
        referencia: "Artículos de Designación de Beneficiarios",
        queEncontraras: "El formato legal donde repartes porcentajes a tus seres queridos; prevalece sobre cualquier testamento civil para este fondo.",
        relevancia: "destacada",
      },
      {
        tema: "Trámite de Cobro de Auxilio",
        referencia: "Artículos de Procedimiento de Entrega",
        queEncontraras: "Plazos, entrega de acta de defunción, comprobantes de pago y entrega directa del cheque a los beneficiarios.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando cambies de estado civil, tengas un hijo o desees cambiar a tus beneficiarios.",
      "En caso del fallecimiento de un compañero de trabajo o familiar trabajador para asesorar a sus deudos.",
    ],
    ojoConEsto: [
      "Si no tienes actualizado tu Pliego Testamentario en tu sección sindical, el trámite puede retrasarse meses ante juzgados civiles. ¡Manténlo al día!",
    ],
  },
  {
    documentId: "CCT::BOLSA",
    urlOficial: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    aliasIds: ["IMSS-BOLSA-TRABAJO", "bolsa-de-trabajo"],
    tituloComun: "Reglamento de Bolsa de Trabajo IMSS-SNTSS",
    claveOficial: "Reglamento Anexo al CCT IMSS-SNTSS",
    organizacion: "Comisión Nacional Mixta de Bolsa de Trabajo",
    categoria: "reglamentos",
    vigenciaTexto: "Vigente incorporado al CCT",
    enUnaFrase: "Reglas claras para el ingreso al IMSS, asignación de sustituciones y cambios de adscripción.",
    preambulo: `El Reglamento de Bolsa de Trabajo norma la puerta de entrada al empleo en el Instituto Mexicano del Seguro Social. Garantiza que la contratación no sea arbitraria, sino bilateral entre el IMSS y el SNTSS.

Aquí puedes encontrar los requisitos para ingresar a las listas de bolsa, cómo se asignan las sustituciones del personal 02, cómo opera el derecho de propuesta sindical para hijos de trabajadores y los pasos para solicitar un cambio de clínica o unidad médica.`,
    aQuienAplica: [
      "Aspirantes registrados en bolsa de trabajo",
      "Personal sustituto (código 02)",
      "Trabajadores de base que solicitan traslado o permuta de unidad",
    ],
    aquiPuedesEncontrar: [
      "Los requisitos de inscripción, exámenes médicos y evaluaciones de aptitud.",
      "Las listas de prelación y el orden riguroso de llamado para sustituciones.",
      "El procedimiento para permutas y traslados de centro de trabajo.",
      "Reglas de cancelación de matrícula de bolsa por acumulación de negativas injustificadas.",
    ],
    temasClave: [
      {
        tema: "Asignación de Sustituciones (Personal 02)",
        referencia: "Capítulo de Sustituciones",
        queEncontraras: "Reglas para que las jefaturas y delegados llamen al personal sustituto conforme al turno riguroso de lista y no por favoritismo.",
        relevancia: "destacada",
      },
      {
        tema: "Traslados y Permutas",
        referencia: "Capítulo de Movimientos",
        queEncontraras: "Requisitos de antigüedad mínima para solicitar cambio de hospital o clínica hacia otra localidad o turno.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si eres sustituto y notas que saltaron tu turno en la lista de guardias de la unidad.",
      "Si quieres solicitar tu cambio de clínica u hospital a uno más cercano a tu domicilio.",
      "Para conocer los derechos de registro de propuesta de hijos de trabajadores.",
    ],
    ojoConEsto: [
      "Las renuncias a guardias de sustitución deben justificarse médicamente para no causar baja de la lista de prelación.",
    ],
  },
  {
    documentId: "CCT::ESCALAFON",
    urlOficial: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    aliasIds: ["IMSS-ESCALAFON", "escalafon"],
    tituloComun: "Reglamento de Escalafón IMSS-SNTSS",
    claveOficial: "Reglamento Anexo al CCT IMSS-SNTSS",
    organizacion: "Comisión Nacional Mixta de Escalafón",
    categoria: "reglamentos",
    vigenciaTexto: "Vigente incorporado al CCT",
    enUnaFrase: "El sistema transparente de ascensos: sube de puesto y gana más según tu mérito y antigüedad.",
    preambulo: `El Reglamento de Escalafón protege tu derecho a crecer profesionalmente dentro del Instituto. Define las reglas matemáticas y objetivas para que una vacante de mayor sueldo sea ocupada por quien realmente lo merece.

Aquí puedes encontrar cómo se califica tu antigüedad, cursos tomados, disciplina y puntualidad, cómo postularte a las convocatorias de plazas definitivas o interinatos y cómo meter una inconformidad si sientes que se promovió a alguien con menor derecho.`,
    aQuienAplica: [
      "Todos los trabajadores de base permanentes",
      "Trabajadores que aspiran a plazas de pie de rama o escalonadas",
    ],
    aquiPuedesEncontrar: [
      "Los 4 factores escalafonarios: Antigüedad, Eficiencia, Disciplina y Puntualidad.",
      "El catálogo de escalafones y grupos de ascenso por rama médica y administrativa.",
      "Cómo presentar tu solicitud ante los boletines de plazas vacantes.",
      "El plazo de 30 días para interponer inconformidad ante la Comisión Mixta de Escalafón.",
    ],
    temasClave: [
      {
        tema: "Puntuación de Factores Escalafonarios",
        referencia: "Capítulo de Calificación",
        queEncontraras: "El desglose de puntos por cada año de antigüedad general y de rama, así como el valor de cursos avalados por capacitación.",
        relevancia: "destacada",
      },
      {
        tema: "Boletinaje de Vacantes",
        referencia: "Capítulo de Convocatorias",
        queEncontraras: "Tiempos oficiales en que la Comisión Mixta debe publicar las plazas disponibles en las pizarras de tu unidad.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cada vez que se publica un boletín de vacantes escalafonarias en tu centro de trabajo.",
      "Si concursaste por una plaza y el dictamen favoreció a alguien con menor puntuación que tú.",
    ],
    ojoConEsto: [
      "Tienes un plazo estricto de días hábiles desde la publicación del boletín para inconformarte por escrito ante la Comisión Mixta.",
    ],
  },
  {
    documentId: "CCT::RIT",
    urlOficial: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    aliasIds: ["IMSS-RIT", "reglamento-interior-de-trabajo"],
    tituloComun: "Reglamento Interior de Trabajo IMSS-SNTSS (RIT)",
    claveOficial: "Reglamento Interior de Trabajo Anexo al CCT",
    organizacion: "IMSS / SNTSS",
    categoria: "reglamentos",
    vigenciaTexto: "Vigente incorporado al CCT",
    enUnaFrase: "El orden cotidiano: checadores, pases de salida, justificaciones y el catálogo de sanciones.",
    preambulo: `El Reglamento Interior de Trabajo rige el día a día en cada servicio del Seguro Social. Fija tus obligaciones de asistencia pero también tus derechos ante imprevistos cotidianos.

Aquí puedes encontrar cuántos minutos de tolerancia tienes al checar, cuántos pases de salida puedes pedir al mes, los requisitos para justificar una falta por fuerza mayor y el catálogo estricto de medidas disciplinarias para evitar que jefaturas apliquen castigos inventados.`,
    aQuienAplica: [
      "Todo el personal de base, confianza y sustituto en activo en unidades médicas y administrativas.",
    ],
    aquiPuedesEncontrar: [
      "Tolerancia de checada: 15 minutos en horario normal.",
      "Pases de salida particulares (hasta 2 horas al mes) y pases oficiales de comisión.",
      "Plazo para entregar comprobantes médicos o justificaciones de falta.",
      "Tipos de medidas disciplinarias: amonestación verbal, extrañamiento por escrito y suspensión.",
      "El procedimiento obligatorio de citación con el sindicato antes de levantar un acta administrativa.",
    ],
    temasClave: [
      {
        tema: "Tolerancia de Entrada y Retardos",
        referencia: "Artículos de Asistencia y Puntualidad",
        queEncontraras: "Diferencia entre retardo leve, retardo mayor y falta, y cómo impacta en tus estímulos quincenales.",
        relevancia: "destacada",
      },
      {
        tema: "Pases de Salida y Permisos",
        referencia: "Capítulo de Permisos",
        queEncontraras: "Requisitos para solicitar salir antes de tu turno por motivos personales debidamente autorizados.",
        relevancia: "alta",
      },
      {
        tema: "Medidas Disciplinarias e Investigaciones",
        referencia: "Capítulo de Disciplina",
        queEncontraras: "Nadie puede ser sancionado sin que se le informe el motivo por escrito y se cite previamente al sindicato.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si el biométrico o reloj checador no registró tu huella o tarjeta.",
      "Si necesitas justificar una inasistencia imprevista por causas de fuerza mayor.",
      "Si te enteras de que jefatura planea levantarte un acta administrativa.",
    ],
    ojoConEsto: [
      "Nunca firmes un acta administrativa 'bajo protesta' sin la presencia física de tu delegado o secretario sindical.",
    ],
  },
  {
    documentId: "CCT::JUBILACIONES",
    urlOficial: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    aliasIds: ["rjp", "regimen-de-jubilaciones-y-pensiones"],
    tituloComun: "Régimen de Jubilaciones y Pensiones (RJP)",
    claveOficial: "Convenio Anexo al CCT IMSS-SNTSS",
    organizacion: "IMSS / SNTSS",
    categoria: "cct",
    vigenciaTexto: "Vigente para trabajadores con derechos contractuales",
    enUnaFrase: "El sistema que complementa tu pensión legal para asegurarte un retiro con hasta el 100% de tu sueldo integrado.",
    preambulo: `El Régimen de Jubilaciones y Pensiones es el escudo financiero que ganaron generaciones de trabajadores del IMSS. Garantiza que cuando cumplas tus años de servicio te retires con dignidad y mantengas tu nivel de ingresos.

Aquí puedes encontrar los años exactos de servicio que requieres (27 años mujeres, 28 años hombres sin límite de edad para el régimen histórico), cómo se calcula la cuantía básica, el pago de aguinaldo anual a jubilados y cómo quedan amparadas tus familias en caso de pensión por viudez u orfandad.`,
    aQuienAplica: [
      "Trabajadores activos con derechos al RJP",
      "Trabajadores jubilados y pensionados del Instituto",
      "Beneficiarios legales con derecho a pensión por viudez u orfandad",
    ],
    aquiPuedesEncontrar: [
      "Los años de antigüedad requeridos para la jubilación por años de servicios.",
      "La tabla de cuantía básica porcentual sobre tu salario base de liquidación.",
      "El aguinaldo complementario anual para jubilados.",
      "Pensiones por invalidez, incapacidad permanente o muerte del trabajador.",
    ],
    temasClave: [
      {
        tema: "Jubilación por Años de Servicios",
        referencia: "Artículos de Jubilación",
        queEncontraras: "27 años de servicio para mujeres y 28 años para hombres, sin importar la edad cronológica, con derecho al tope máximo contractual.",
        relevancia: "destacada",
      },
      {
        tema: "Pensión por Viudez y Orfandad",
        referencia: "Capítulo de Beneficiarios",
        queEncontraras: "Los porcentajes que reciben la esposa(o) o concubina(rio) e hijos menores o estudiantes tras el deceso del pensionado.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando tengas más de 20 años de antigüedad y comiences a planificar la fecha exacta de tu retiro.",
      "Si sufres una enfermedad no profesional que impida continuar laborando para tramitar pensión por invalidez.",
    ],
    ojoConEsto: [
      "Verifica con tu sección sindical tu estado de cuenta de aportaciones al RJP (Concepto 152 en tu tarjetón).",
    ],
  },
  {
    documentId: "LFT",
    urlOficial: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf",
    aliasIds: ["ley-federal-del-trabajo"],
    tituloComun: "Ley Federal del Trabajo (LFT)",
    claveOficial: "Ley Federal del Trabajo (Reforma DOF 2026)",
    organizacion: "Congreso de la Unión",
    categoria: "leyes",
    vigenciaTexto: "Reformas vigentes publicadas en DOF",
    enUnaFrase: "El marco legal mexicano que fija los derechos mínimos e irrenunciables de toda persona trabajadora.",
    preambulo: `La Ley Federal del Trabajo es la base constitucional sobre la cual se construye todo el derecho laboral en México. Ningún contrato de trabajo, ni público ni privado, puede dar menos derechos que los aquí señalados.

Aquí puedes encontrar los límites máximos de jornada legal, los días de descanso obligatorio oficiales marcados por el Estado, los principios de no discriminación y las reglas de estabilidad laboral frente a despidos injustificados.`,
    aQuienAplica: [
      "Todos los trabajadores de la República Mexicana",
      "Referencia obligatoria supletoria en el IMSS en todo lo no previsto por el CCT",
    ],
    aquiPuedesEncontrar: [
      "Jornada laboral diurna máxima de 8 horas y nocturna de 7 horas.",
      "Días de descanso obligatorio por ley (1 de enero, 5 de febrero, 21 de marzo, 1 de mayo, etc.).",
      "Licencias de maternidad (84 días) y paternidad con goce de sueldo.",
      "Derecho a la libertad sindical y prohibición patronal de intervenir en la vida sindical.",
    ],
    temasClave: [
      {
        tema: "Principio de la Norma Más Favorable",
        referencia: "Artículo 18 LFT",
        queEncontraras: "En caso de duda en la interpretación de normas de trabajo, prevalecerá la interpretación más favorable a la persona trabajadora.",
        relevancia: "destacada",
      },
      {
        tema: "Descansos Obligatorios Oficiales",
        referencia: "Artículo 74 LFT",
        queEncontraras: "Los días feriados donde se debe pagar salario doble adicional si se laboran.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Para contrastar si una orden patronal viola derechos humanos o garantías constitucionales mínimas.",
      "Para conocer los plazos de prescripción de acciones laborales (ej. 2 meses para reclamar despido).",
    ],
    ojoConEsto: [
      "El CCT del IMSS supera ampliamente a la LFT; cuando el CCT da más beneficio, siempre aplica el CCT.",
    ],
  },
  {
    documentId: "NOM-035-STPS-2018",
    urlOficial: "https://dof.gob.mx/normasOficiales/7415/stps2a11_C/stps2a11_C.html",
    aliasIds: ["nom-035", "factores-psicosociales"],
    tituloComun: "NOM-035-STPS-2018 (Factores de Riesgo Psicosocial)",
    claveOficial: "NOM-035-STPS-2018",
    organizacion: "STPS / DOF",
    categoria: "seguridad",
    vigenciaTexto: "Vigente confirmada en PLATIICA",
    enUnaFrase: "Protección a tu salud mental: identifica y combate el estrés laboral grave, acoso y cargas desmedidas.",
    preambulo: `La NOM-035 es una norma obligatoria de la Secretaría del Trabajo que protege la salud mental y emocional de los trabajadores. Obliga al IMSS a garantizar un entorno organizacional favorable y libre de violencia en cada hospital y centro de trabajo.

Aquí puedes encontrar qué se considera violencia laboral, cómo denunciar un clima de trabajo tóxico o sobrecarga excesiva de trabajo y la obligación del patrón de atender a trabajadores que hayan sufrido acontecimientos traumáticos severos en el servicio.`,
    aQuienAplica: [
      "Todos los centros de trabajo del IMSS a nivel nacional.",
      "Personal de áreas de urgencias, terapia intensiva, atención al público y hospitalización.",
    ],
    aquiPuedesEncontrar: [
      "Definición legal de violencia laboral, hostigamiento y maltrato en el trabajo.",
      "Cuestionarios oficiales para detectar si el ambiente de tu clínica afecta tu salud psicológica.",
      "Protocolos obligatorios de atención a trabajadores expuestos a agresiones de derechohabientes o superiores.",
    ],
    temasClave: [
      {
        tema: "Prevención de la Violencia Laboral",
        referencia: "Numerales 5 y 7",
        queEncontraras: "Obligación patronal de implementar medidas para erradicar actos hostiles, vejatorios o de intimidación en el servicio.",
        relevancia: "destacada",
      },
      {
        tema: "Acontecimientos Traumáticos Severos",
        referencia: "Guía de Referencia I",
        queEncontraras: "Atención psicológica y médica prioritaria para personal que presencie muertes violentas, agresiones físicas o accidentes graves en el servicio.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si enfrentas acoso sistemático o humillaciones por parte de mandos medios o jefaturas de servicio.",
      "Si sufriste una agresión violenta por parte de un usuario o derechohabiente en tu área médica.",
    ],
    ojoConEsto: [
      "El Instituto está obligado por ley federal a contar con buzón confidencial y protocolo activo de atención a la NOM-035.",
    ],
  },
  {
    documentId: "NOM-036-1-STPS-2018",
    urlOficial: "https://dof.gob.mx/normasOficiales/7468/stps11_C/stps11_C.html",
    aliasIds: ["nom-036", "ergonomia-cargas"],
    tituloComun: "NOM-036-1-STPS-2018 (Ergonomía y Manejo de Cargas)",
    claveOficial: "NOM-036-1-STPS-2018",
    organizacion: "STPS / DOF",
    categoria: "seguridad",
    vigenciaTexto: "Vigente confirmada en PLATIICA",
    enUnaFrase: "Cuida tu espalda: límites máximos de carga manual y equipos auxiliares obligatorios para camillería, enfermería y almacén.",
    preambulo: `La NOM-036 es la norma que cuida tu cuerpo de lesiones osteomusculares, hernias de disco y lumbalgias crónicas. Establece cuánto es lo máximo que una persona puede levantar con sus propias fuerzas y cuándo el patrón debe proporcionar carritos, grúas o apoyo de compañeros.

Aquí puedes encontrar los límites en kilogramos según edad y género, las condiciones seguras para el traslado de pacientes en camillas y sillas de ruedas, y la obligación del IMSS de dar capacitación técnica de levantamiento de cargas.`,
    aQuienAplica: [
      "Camilleros, personal de enfermería, intendencia, almacenes, farmacias y servicios generales.",
    ],
    aquiPuedesEncontrar: [
      "Límite máximo de masa: 25 kg para hombres adultos y 15 kg para mujeres.",
      "Obligación patronal de proveer aditamentos ergonómicos (grúas de pacientes, fajas, patines).",
      "Medidas de seguridad cuando se empujan o jalen camillas, sillas o carros de medicamentos.",
    ],
    temasClave: [
      {
        tema: "Límites Máximos de Peso Manual",
        referencia: "Tabla 1 de la Norma",
        queEncontraras: "Nadie puede ser obligado a cargar manualmente bultos o pacientes que superen las masas autorizadas sin equipo auxiliar.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si te ordenan movilizar pacientes pesados sin grúa auxiliar o sin apoyo de más compañeros.",
      "En almacén o farmacia si te exigen estibar cajas pesadas a alturas peligrosas sin montacargas.",
    ],
    ojoConEsto: [
      "Las lesiones por sobreesfuerzo deben reportarse de inmediato a Medicina del Trabajo para su calificación como Riesgo de Trabajo.",
    ],
  },
  {
    documentId: "LEY-SILLA-2025",
    urlOficial: "https://www.dof.gob.mx/nota_detalle.php?codigo=5763187&fecha=17/07/2025",
    aliasIds: ["ley-silla", "bipedestacion"],
    tituloComun: "Disposiciones de Bipedestación ('Ley Silla')",
    claveOficial: "Reforma LFT DOF 17-07-2025",
    organizacion: "Congreso de la Unión / DOF",
    categoria: "leyes",
    vigenciaTexto: "Reforma vigente con plena obligatoriedad",
    enUnaFrase: "Prohibido obligar a trabajar de pie toda la jornada: derecho a asiento con respaldo y descansos periódicos.",
    preambulo: `La llamada Ley Silla es una reforma histórica a la Ley Federal del Trabajo que prohibió que los patrones obliguen a las y los trabajadores a permanecer de pie durante toda su jornada.

Aquí puedes encontrar la obligación del Instituto de proveer asientos o sillas con respaldo en áreas de atención al público, taquillas, mostradores de farmacia, módulos de información y cajas, así como el derecho a descansos periódicos si la naturaleza del servicio requiere estar de pie.`,
    aQuienAplica: [
      "Personal de farmacia, taquillas, admisión médica, orientación al derechohabiente, vigilancia y cajas.",
    ],
    aquiPuedesEncontrar: [
      "Obligación patronal de suministrar número suficiente de sillas con respaldo ergonómico.",
      "Prohibición expresa a jefaturas de retirar sillas o exigir permanencia en bipedestación continua.",
      "Sanciones de la autoridad laboral a centros de trabajo que incumplan.",
    ],
    temasClave: [
      {
        tema: "Derecho al Asiento con Respaldo",
        referencia: "Artículo 132 Fracción V Bis LFT",
        queEncontraras: "Garantía de descanso en asiento durante la jornada para la ejecución de funciones o reposos periódicos.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si en tu mostrador o servicio te retiraron la silla o te prohíben sentarte entre paciente y paciente.",
    ],
    ojoConEsto: [
      "Estar de pie horas continuas genera várices, fascitis plantar y problemas de columna reconocidos como riesgos a la salud.",
    ],
  },
  {
    documentId: "IMSS-CODIGO-CONDUCTA",
    urlOficial: "https://www.imss.gob.mx/sites/all/statics/pdf/codigo-conducta.pdf",
    aliasIds: ["codigo-de-conducta"],
    tituloComun: "Código de Conducta y Prevención de Conflictos de Interés",
    claveOficial: "Código de Conducta IMSS",
    organizacion: "IMSS / Comité de Ética",
    categoria: "integridad",
    vigenciaTexto: "Publicación oficial vigente",
    enUnaFrase: "Los valores de trato digno, cero tolerancia al acoso y prevención de actos indebidos en el servicio público.",
    preambulo: `El Código de Conducta fija los estándares éticos que deben guiar a todo el personal del Instituto. Protege el derecho de los trabajadores y derechohabientes a un trato respetuoso, imparcial y libre de cualquier manifestación de violencia.

Aquí puedes encontrar las definiciones oficiales de acoso laboral, acoso sexual y hostigamiento, y los canales directos y confidenciales ante el Comité de Ética para denunciar represalias o conductas contrarias a la integridad.`,
    aQuienAplica: [
      "Todo el personal del IMSS: base, confianza, mandos medios y directivos.",
    ],
    aquiPuedesEncontrar: [
      "Cero tolerancia al hostigamiento sexual y al acoso laboral.",
      "Obligación de respetar la diversidad, igualdad de género y no discriminación.",
      "Canales de denuncia confidencial ante el Comité de Ética y Conducta.",
    ],
    temasClave: [
      {
        tema: "Erradicación del Acoso y Hostigamiento",
        referencia: "Capítulo de Integridad en el Trato",
        queEncontraras: "Prohibición absoluta de insinuaciones sexuales, tocamientos no consentidos, gritos, humillaciones o exclusión deliberada.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si eres víctima o testigo de acoso sexual o trato discriminatorio por parte de jefaturas o compañeros.",
    ],
    ojoConEsto: [
      "Las denuncias ante el Comité de Ética son independientes y complementarias a la defensa laboral sindical.",
    ],
  },
  // ────────────────────────── PROCEDIMIENTOS CON CLAVE IMSS ──────────────────────────
  {
    documentId: "IMSS-2900-B03-002",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2900-B03-002.pdf",
    aliasIds: ["2900-B03-002", "2900", "plantilla", "plantillas", "dotacion-personal", "indicadores-enfermeria"],
    tituloComun: "Procedimiento de Planeación y Definición de Plantillas en Unidades Médicas",
    claveOficial: "2900-B03-002",
    organizacion: "IMSS / Dirección de Prestaciones Médicas",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "La norma técnica que fija cuántos médicos, enfermeras y personal de apoyo DEBE haber por cada cama y turno para evitar sobrecargas inhumanas.",
    preambulo: `El Procedimiento 2900-B03-002 es la norma técnica e institucional del IMSS que establece cómo se calculan, autorizan y distribuyen las plantillas de personal en hospitales y Unidades de Medicina Familiar (UMF). Fija cuántas plazas de médicos, enfermería, camillería, intendencia, trabajo social, laboratorio y farmacia deben asignarse obligatoriamente según el número de camas censables, consultorios y demanda de derechohabientes.

Aquí puedes encontrar los indicadores oficiales de dotación de personal por servicio (cuántos pacientes puede atender un personal de enfermería en UCI, urgencias o piso; cuántos camilleros por quirófano), la justificación para apertura de nuevas plazas y el mecanismo para reclamar la saturación de los servicios médicos.`,
    aQuienAplica: [
      "Personal médico no familiar y familiar",
      "Personal de enfermería (general, especialista y auxiliares)",
      "Camilleros, personal de laboratorio, rayos X y farmacia",
      "Representantes sindicales en comisiones mixtas de plantillas",
    ],
    aquiPuedesEncontrar: [
      "Los indicadores oficiales de dotación de Recursos Humanos por servicio médico.",
      "La fórmula de cálculo de plantilla autorizada frente a plantilla física real.",
      "Mecanismo de solicitud de ampliación de plazas cuando se abren camas o servicios.",
      "Límites de carga de pacientes en áreas críticas (Terapia Intensiva, Urgencias, Quirófano).",
    ],
    temasClave: [
      {
        tema: "Indicadores de Dotación de Enfermería y Médicos",
        referencia: "Anexos Técnicos de Indicadores",
        queEncontraras: "Tablas obligatorias que señalan la relación personal-paciente recomendada para garantizar la seguridad clínica del paciente y la salud del trabajador.",
        relevancia: "destacada",
      },
      {
        tema: "Plantilla Autorizada vs Plantilla Cubierta",
        referencia: "Apartado de Validación de Recursos",
        queEncontraras: "El procedimiento para cotejar las plazas faltantes o vacías que el Instituto debe cubrir mediante bolsa de trabajo o sustitución.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si en tu hospital o UMF hay sobrecarga extrema de trabajo y jefatura se niega a solicitar más personal o sustitutos.",
      "Para documentar que un evento adverso o queja médica ocurrió por falta de personal asignado conforme al indicador de plantilla.",
      "En reuniones de comisiones mixtas de revisión de plantillas laborales.",
    ],
    ojoConEsto: [
      "La falta de plantilla cubierta es responsabilidad directa de la administración; documenta por escrito ante tu representación sindical cuando labores por debajo del indicador técnico oficial.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-034",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A74-003-034.pdf",
    aliasIds: ["1A74-003-034", "1A74", "biometrico", "checador", "puntualidad-asistencia", "sustituciones"],
    tituloComun: "Procedimiento para el Control de Asistencia, Puntualidad y Sustituciones",
    claveOficial: "1A74-003-034",
    organizacion: "IMSS / Coordinación de Recursos Humanos",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "El manual oficial del reloj checador: cómo operan los biométricos, tus 15 min de tolerancia y el llamado a sustitutos.",
    preambulo: `El Procedimiento 1A74-003-034 es la biblia operativa de las checadas en el Instituto. Norma el funcionamiento de los lectores biométricos (huella digital o facial), el registro de entradas y salidas, los criterios de tolerancia, las firmas en libros de incidencias cuando hay fallas del sistema y las reglas para convocar a sustitutos 02 ante ausencias de personal de base.

Aquí puedes encontrar qué hacer cuando el checador no reconoce tu huella, cómo se computan los retardos, el registro de omisión de checada y la obligación de la administración de convocar al personal sustituto en riguroso orden de lista.`,
    aQuienAplica: [
      "Todos los trabajadores en activo del IMSS (base, confianza y sustitutos)",
      "Jefaturas de personal y enlaces de recursos humanos",
    ],
    aquiPuedesEncontrar: [
      "Operación de checadores biométricos y firmas en libreta de incidencias.",
      "Reglas de aplicación de la tolerancia de 15 minutos en la entrada.",
      "Justificación de checadas por fallas de energía eléctrica o corte de sistema.",
      "Mecanismo de llamamiento transparente a personal sustituto para cubrir turnos vacantes.",
    ],
    temasClave: [
      {
        tema: "Fallas del Checador Biométrico",
        referencia: "Sección de Contingencias Técnicas",
        queEncontraras: "El formato de pase o registro manual en libro de incidencias que avala tu asistencia cuando el reloj biométrico no funciona.",
        relevancia: "destacada",
      },
      {
        tema: "Registro de Sustituciones de Guardia",
        referencia: "Apartado de Cobertura de Ausencias",
        queEncontraras: "Obligación de emitir el nombramiento de sustitución de inmediato para que el sustituto cobre puntualmente su guardia.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si el reloj biométrico no leyó tu huella o estaba apagado y Recursos Humanos pretende ponerte falta injustificada.",
      "Si eres sustituto y notas que llamaron a alguien con menor derecho en la lista de prelación.",
    ],
    ojoConEsto: [
      "Siempre que el biométrico falle, avisa de inmediato a tu delegado sindical y firma el libro de incidencias en presencia de Recursos Humanos.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-031",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A74-003-031.pdf",
    aliasIds: ["1A74-003-031", "tiempo-extra", "tiempo-extraordinario", "concepto-037", "concepto-737"],
    tituloComun: "Procedimiento para Tiempo Extraordinario",
    claveOficial: "1A74-003-031",
    organizacion: "IMSS / Dirección de Administración",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Reglas claras de horas extras: nadie puede obligarte a doblar turno sin oficio oficial y pago doble en nómina.",
    preambulo: `El Procedimiento 1A74-003-031 norma cómo deben autorizarse, registrarse y pagarse las horas de tiempo extraordinario en el IMSS. Protege al trabajador de abusos de jefaturas que exigen permanecer después del turno sin entregar la papeleta oficial de pago.

Aquí puedes encontrar los formatos oficiales de autorización previa, el registro de la checada de salida extraordinaria y cómo se transmiten los datos a nómina para que aparezca el Concepto 037 en tu siguiente recibo.`,
    aQuienAplica: [
      "Personal de base e interino autorizado para cubrir tiempo extra.",
    ],
    aquiPuedesEncontrar: [
      "Formato oficial de autorización de tiempo extraordinario firmado por jefatura.",
      "Registro de salida biométrica para comprobar la permanencia física en la unidad.",
      "Pago doble (o triple según LFT) y compensación por descansos laborados.",
      "Límites máximos de horas extras para evitar fatiga extrema en el servicio.",
    ],
    temasClave: [
      {
        tema: "Autorización y Pago de Horas Extras",
        referencia: "Fase de Autorización y Trámite",
        queEncontraras: "Requisito de orden por escrito; ninguna orden verbal de quedarse a doblar turno es válida para el pago si no está respaldada por la boleta oficial.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si jefatura te solicita quedarte horas extras y necesitas asegurar que se tramite tu boleta de pago.",
      "Si trabajaste tiempo extra y en la quincena no se reflejó el Concepto 037 en tu tarjetón.",
    ],
    ojoConEsto: [
      "Nunca te quedes a tiempo extra solo por palabra; solicita la firma de tu boleta antes de iniciar el periodo extraordinario.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-025",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A74-003-025.pdf",
    aliasIds: ["1A74-003-025", "tramite-vacaciones", "roles-vacacionales", "formato-vacaciones"],
    tituloComun: "Procedimiento para el Trámite y Otorgamiento de Vacaciones",
    claveOficial: "1A74-003-025",
    organizacion: "IMSS / Personal",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "El circuito administrativo para programar, disfrutar o permutar tus periodos vacacionales.",
    preambulo: `El Procedimiento 1A74-003-025 regula el mecanismo administrativo para solicitar, autorizar y registrar las vacaciones del personal del IMSS en apego a la Cláusula 47 del CCT. Evita que jefaturas bloqueen injustificadamente las fechas de descanso de los trabajadores.

Aquí puedes encontrar los calendarios de captura de roles en el sistema SIAP, los requisitos para permutar periodos de vacaciones entre compañeros del mismo servicio y el trámite de pago de la prima vacacional.`,
    aQuienAplica: [
      "Todos los trabajadores de base e interinos con derecho a vacaciones.",
    ],
    aquiPuedesEncontrar: [
      "Fechas de publicación de los roles vacacionales anuales.",
      "Formato oficial de solicitud y confirmación de fechas de descanso.",
      "Reglas de permuta de vacaciones entre trabajadores de igual categoría.",
      "Cálculo de días hábiles efectivos (no cuentan días festivos ni descansos).",
    ],
    temasClave: [
      {
        tema: "Permuta de Periodos Vacacionales",
        referencia: "Apartado de Permutas",
        queEncontraras: "Requisitos para cambiar tu fecha vacacional con otro compañero con visto bueno sindical.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Al programar tus periodos en el rol de vacaciones de tu servicio.",
      "Si requieres cambiar tu fecha por un imprevisto personal o familiar.",
    ],
    ojoConEsto: [
      "Las vacaciones no disfrutadas deben solicitarse por escrito antes de su vencimiento para no perder el derecho.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-030",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A74-003-030.pdf",
    aliasIds: ["1A74-003-030", "catalogo-plazas", "infecto-plazas", "emanaciones-radiactivas"],
    tituloComun: "Procedimiento para Actualización al Catálogo de Plazas",
    claveOficial: "1A74-003-030",
    organizacion: "IMSS / Recursos Humanos",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Cómo se dictamina si una plaza médica o técnica tiene derecho al pago de infectocontagiosidad o radiaciones.",
    preambulo: `El Procedimiento 1A74-003-030 norma la clasificación de plazas en el Catálogo Institucional y define cuándo una plaza de trabajo debe recibir compensación por infectocontagiosidad, emanaciones radiactivas o alto riesgo en apego a los convenios CCT.

Aquí puedes encontrar los estudios de campo que realiza Seguridad en el Trabajo para dictaminar si un área médica o de quirófano amerita el pago del Concepto 003 en el tarjetón.`,
    aQuienAplica: [
      "Personal en áreas de medicina, enfermería, radiología, laboratorio y patología.",
    ],
    aquiPuedesEncontrar: [
      "Criterios de evaluación de riesgo biológico e infectocontagioso.",
      "Dictaminación de áreas con equipos de rayos X, tomografía o medicina nuclear.",
      "Trámite de alta de la clave de infectocontagiosidad en el catálogo de plazas.",
    ],
    temasClave: [
      {
        tema: "Dictamen de Infectocontagiosidad en Nuevos Servicios",
        referencia: "Dictamen Técnico Mixto",
        queEncontraras: "Procedimiento para que la Comisión Mixta acuda a evaluar si tu servicio amerita el pago de alto riesgo.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si abrieron una nueva sala de aislamiento o rayos X en tu unidad y no les están pagando la compensación de riesgo.",
    ],
    ojoConEsto: [
      "El pago de infectocontagiosidad está ligado a la plaza física y a las funciones desempeñadas.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-032",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A74-003-032.pdf",
    aliasIds: ["1A74-003-032", "modificacion-horarios", "cambio-horario-institucional"],
    tituloComun: "Procedimiento para la Modificación de Horarios Institucionales",
    claveOficial: "1A74-003-032",
    organizacion: "IMSS / Relaciones Laborales",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "La norma que impide que un jefe te cambie de horario o turno de forma arbitraria o sin acuerdo sindical.",
    preambulo: `El Procedimiento 1A74-003-032 regula las condiciones bajo las cuales el Instituto puede proponer una modificación en los horarios de atención y servicio. Exige que cualquier cambio respete los nombramientos de los trabajadores y cuente con la anuencia de la representación sindical.

Aquí puedes encontrar los plazos de notificación previa y los derechos de los trabajadores que por causas de fuerza mayor o estudios no pueden aceptar un cambio de turno.`,
    aQuienAplica: [
      "Todo el personal de base y de confianza del Instituto.",
    ],
    aquiPuedesEncontrar: [
      "Requisitos de justificación operativa fundada para modificar horarios.",
      "Intervención obligatoria del SNTSS antes de implementar cualquier ajuste.",
      "Respeto a las jornadas contractuales de 6, 6.5, 8 y 12 horas.",
    ],
    temasClave: [
      {
        tema: "Protección contra Cambios Unilaterales de Turno",
        referencia: "Cláusulas de Nombramiento",
        queEncontraras: "Ninguna jefatura puede alterar tu horario habitual de labores sin tu consentimiento o convenio bilateral.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si una nueva administración en tu hospital pretende cambiar las horas de entrada y salida del servicio.",
    ],
    ojoConEsto: [
      "Tu turno y adscripción forman parte de tus derechos contractuales protegidos por el CCT.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-033",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A74-003-033.pdf",
    aliasIds: ["1A74-003-033", "siap", "altas-bajas", "cambios-nomina", "nomina-ordinaria"],
    tituloComun: "Procedimiento para Bajas, Altas y Cambios en Nómina Ordinaria (SIAP)",
    claveOficial: "1A74-003-033",
    organizacion: "IMSS / División de Operación de Nómina",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "El circuito administrativo del sistema SIAP: cómo entra tu sueldo, aumentos y movimientos a tu recibo de pago.",
    preambulo: `El Procedimiento 1A74-003-033 norma cómo viajan los datos laborales al sistema SIAP para que tu sueldo, quinquenios, compensaciones y descuentos se reflejen fielmente cada quincena.

Aquí puedes encontrar las fechas de corte quincenal de nómina, el alta de cuentas bancarias y el procesamiento de cambios de categoría o traslados.`,
    aQuienAplica: [
      "Todos los trabajadores de nómina ordinaria del IMSS.",
    ],
    aquiPuedesEncontrar: [
      "Calendario oficial de cortes quincenales para movimientos de nómina.",
      "Procedimiento para aclaración de percepciones omitidas en el tarjetón.",
      "Activación de pagos de retroactivos por aumentos salariales.",
    ],
    temasClave: [
      {
        tema: "Pago Retroactivo de Conceptos Omitidos",
        referencia: "Apartado de Nómina Retroactiva",
        queEncontraras: "El mecanismo para que el Instituto te pague quincenas atrasadas mediante nómina especial o ajuste.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si te cambiaste de puesto o ganaste un escalafón y en tu recibo no aparece el sueldo nuevo.",
    ],
    ojoConEsto: [
      "Revisa tu tarjetón de pago cada quincena para detectar omisiones antes de que cierre el periodo presupuestal.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-024",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A74-003-024.pdf",
    aliasIds: ["1A74-003-024", "aclaracion-fondo-ahorro", "pago-fondo-ahorro", "concepto-050"],
    tituloComun: "Procedimiento para la Aclaración y Pago de Fondo de Ahorro",
    claveOficial: "1A74-003-024",
    organizacion: "IMSS / Nómina y Prestaciones",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Cómo reclamar y cobrar si hubo un error o retraso en la entrega de tu Fondo de Ahorro en agosto.",
    preambulo: `El Procedimiento 1A74-003-024 regula las aclaraciones y pagos extemporáneos del Fondo de Ahorro pactado en la Cláusula 144 del CCT. Garantiza que ningún trabajador se quede sin su ahorro anual por fallas administrativas.

Aquí puedes encontrar los plazos para inconformarte, el cálculo de semanas computables y el trámite para emisión de cheque complementario.`,
    aQuienAplica: [
      "Trabajadores de base con aportación al Fondo de Ahorro.",
    ],
    aquiPuedesEncontrar: [
      "Fórmula de revisión de aportaciones patronales del Concepto 050.",
      "Reclamación de días descontados indebidamente del periodo de ahorro.",
      "Calendario de pagos extraordinarios para casos en aclaración.",
    ],
    temasClave: [
      {
        tema: "Reclamación de Fondo de Ahorro Incompleto",
        referencia: "Fase de Aclaraciones",
        queEncontraras: "Formato oficial para exigir el pago de diferencias detectadas en la primera quincena de agosto.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si en agosto recibiste menos importe de Fondo de Ahorro del que te correspondía según tu tabulador.",
    ],
    ojoConEsto: [
      "Cuentas con un plazo perentorio después de la entrega del fondo para presentar tu aclaración ante Nómina.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-023",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A74-003-023.pdf",
    aliasIds: ["1A74-003-023", "guardias-imss", "autorizacion-guardias", "rol-guardias"],
    tituloComun: "Procedimiento para la Autorización de Guardias",
    claveOficial: "1A74-003-023",
    organizacion: "IMSS / Prestaciones Médicas y Recursos Humanos",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Reglas de asignación y pago de guardias hospitalarias nocturnas, en fines de semana y días festivos.",
    preambulo: `El Procedimiento 1A74-003-023 fija las pautas para programar las guardias del personal médico y de enfermería en turnos especiales, festivos y fines de semana, garantizando el descanso legal y la cobertura continua del hospital.

Aquí puedes encontrar cómo se llena el rol oficial de guardias y los tiempos de entrega para asegurar su pago en nómina.`,
    aQuienAplica: [
      "Personal de salud asignado a guardias hospitalarias y de urgencias.",
    ],
    aquiPuedesEncontrar: [
      "Elaboración del rol mensual de guardias con aprobación sindical.",
      "Reemplazos de emergencia ante incapacidad de quien cubría la guardia.",
      "Criterios de compensación económica por guardias efectivas.",
    ],
    temasClave: [
      {
        tema: "Rol Mensual Equitativo de Guardias",
        referencia: "Programación Hospitalaria",
        queEncontraras: "Prohibición de sobrecargar a un solo trabajador con exceso de guardias sin respetar descansos.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si notas favoritismo o inequidad en la distribución del rol de guardias de tu servicio.",
    ],
    ojoConEsto: [
      "Toda guardia cubierta debe quedar registrada en la libreta de pase de visita y en el sistema de asistencia.",
    ],
  },
  {
    documentId: "IMSS-3A21-003-010",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/3A21-003-010.pdf",
    aliasIds: ["3A21-003-010", "3A21", "accidentes-trabajo", "formato-st-7", "st-7", "riesgo-trabajo", "st-2", "st-3"],
    tituloComun: "Procedimiento para la Dictaminación de los Accidentes de Trabajo",
    claveOficial: "3A21-003-010",
    organizacion: "IMSS / Coordinación de Salud en el Trabajo",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Médico-Legal Oficial Vigente",
    enUnaFrase: "El protocolo que debes seguir si sufres un accidente en tu servicio o en el trayecto (Formatos ST-7, ST-2 y ST-3).",
    preambulo: `El Procedimiento 3A21-003-010 es vital para proteger tu salud y tu salario. Establece qué debe hacer el Instituto cuando un trabajador se accidenta laborando o en el trayecto de su casa al hospital o viceversa.

Aquí puedes encontrar cómo se solicita y llena el formato ST-7 (Aviso de Atención Médica Inicial y Calificación de Probable Accidente de Trabajo), el derecho a cobrar el 100% de tu salario íntegro durante la incapacidad y cómo se dictaminan secuelas en los formatos ST-2 (Alta) y ST-3 (Incapacidad Permanente o Defunción).`,
    aQuienAplica: [
      "Todos los trabajadores del IMSS sin excepción (base, confianza y sustitutos).",
    ],
    aquiPuedesEncontrar: [
      "El llenado obligatorio del formato ST-7 en Urgencias.",
      "Criterios de calificación de accidente en trayecto (ruta directa sin desvíos).",
      "Pago del subsidio al 100% de tu sueldo tabular desde el primer día.",
      "Evaluación de secuelas e indemnizaciones en el formato ST-3.",
    ],
    temasClave: [
      {
        tema: "Formato ST-7 y Accidente en Trayecto",
        referencia: "Fase de Calificación Inicial",
        queEncontraras: "Cómo describir los hechos, la hora del percance y la ruta habitual de traslado para que no sea rechazado por Medicina del Trabajo.",
        relevancia: "destacada",
      },
      {
        tema: "Pago al 100% por Riesgo de Trabajo",
        referencia: "Efectos Económicos",
        queEncontraras: "A diferencia de una enfermedad general (que paga el 60%), el riesgo calificado paga el 100% de tus ingresos íntegros.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si te pinchaste con una aguja con sangre, sufriste una caída, agresión o choque al ir o venir de tu turno.",
      "Si Medicina del Trabajo emitió dictamen de 'NO Sí de Trabajo' y requieres inconformarte ante el Consejo Técnico.",
    ],
    ojoConEsto: [
      "Acude a urgencias dentro de las primeras horas del accidente y no omitas ningún detalle en tu declaración inicial.",
    ],
  },
  {
    documentId: "IMSS-3A21-003-003",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/3A21-003-003.pdf",
    aliasIds: ["3A21-003-003", "enfermedades-trabajo", "formato-st-9", "st-9", "salud-trabajo"],
    tituloComun: "Procedimiento para la Dictaminación de las Enfermedades de Trabajo",
    claveOficial: "3A21-003-003",
    organizacion: "IMSS / Salud en el Trabajo",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Médico-Legal Oficial Vigente",
    enUnaFrase: "Cómo lograr que el IMSS reconozca que una hernia, lumbalgia o secuela crónica fue causada por tu trabajo (Formato ST-9).",
    preambulo: `El Procedimiento 3A21-003-003 rige la investigación médica cuando desarrollas un padecimiento derivado de tus funciones en el Instituto: lesiones de columna por movilizar pacientes, problemas pulmonares por químicos, pérdida auditiva, estrés postraumático o contagios hospitalarios crónicos.

Aquí puedes encontrar el trámite del formato ST-9, la inspección que realiza el médico del trabajo en tu servicio y cómo se fija la pensión o indemnización por enfermedad profesional.`,
    aQuienAplica: [
      "Todos los trabajadores expuestos a riesgos ergonómicos, físicos, biológicos o psicosociales.",
    ],
    aquiPuedesEncontrar: [
      "Formato ST-9: Aviso de probable enfermedad de trabajo.",
      "Inspección ergonómica y ambiental en tu centro de adscripción.",
      "Tabla oficial de enfermedades de trabajo de la LFT y CCT.",
      "Dictaminación de indemnizaciones o reubicación de puesto si no puedes seguir en tu servicio.",
    ],
    temasClave: [
      {
        tema: "Reubicación por Causa Médica",
        referencia: "Dictamen de Reubicación Laboral",
        queEncontraras: "El derecho a ser cambiado de servicio o categoría a una labor compatible con tu estado de salud sin reducción de sueldo.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si padeces una hernia o dolor de espalda crónico por cargar pacientes o material pesado.",
      "Si adquiriste una infección hospitalaria derivada de tu labor en áreas infectocontagiosas.",
    ],
    ojoConEsto: [
      "Conserva todos tus expedientes médicos, recetas y estudios de laboratorio para respaldar la causalidad del trabajo.",
    ],
  },
  {
    documentId: "IMSS-1A31-003-015",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A31-003-015.pdf",
    aliasIds: ["1A31-003-015", "1A31", "reconsiderar-sanciones", "defensa-sanciones", "apelacion-sancion"],
    tituloComun: "Procedimiento para Reconsiderar las Sanciones Laborales",
    claveOficial: "1A31-003-015",
    organizacion: "IMSS / Relaciones Laborales y Asuntos Jurídicos",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "El recurso formal para apelar, revocar o anular sanciones, suspensiones o actas levantadas injustamente.",
    preambulo: `El Procedimiento 1A31-003-015 es una de las herramientas de defensa más poderosas del trabajador del IMSS. Establece la vía institucional para que una sanción impuesta por el Órgano de Operación Administrativa (Delegación) sea revisada y revocada si hubo violaciones al debido proceso o falta de pruebas.

Aquí puedes encontrar los plazos para interponer el recurso de reconsideración, cómo presentar pruebas supervenientes y la intervención obligatoria de la Secretaría de Conflictos del SNTSS para defenderte.`,
    aQuienAplica: [
      "Trabajadores que hayan recibido una amonestación, suspensión de sueldo o rescisión laboral.",
    ],
    aquiPuedesEncontrar: [
      "Plazo para ingresar el escrito de reconsideración ante la autoridad laboral.",
      "Causas de nulidad: falta de citación previa al sindicato o vicios en el acta.",
      "Restitución de días de sueldo descontados si la sanción se revoca.",
      "Mesa de trabajo bilateral IMSS-SNTSS para resolver la controversia.",
    ],
    temasClave: [
      {
        tema: "Nulidad por Violación al Derecho de Audiencia",
        referencia: "Causales de Revocación",
        queEncontraras: "Cualquier acta administrativa levantada sin la presencia de tu representación sindical es legalmente nula y revocable.",
        relevancia: "destacada",
      },
    ],
    ojoConEsto: [
      "No dejes pasar los días de plazo para meter la reconsideración; acude a tu secretaría seccional inmediatamente tras recibir la notificación.",
    ],
    cuandoConsultarlo: [
      "Si te notificaron una suspensión de labores y consideras que las acusaciones de jefatura son falsas o desproporcionadas.",
    ],
  },
  {
    documentId: "IMSS-1A31-003-001",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A31-003-001.pdf",
    aliasIds: ["1A31-003-001", "reconocimiento-antiguedad", "antiguedad-sustituto", "quinquenios-retroactivos"],
    tituloComun: "Procedimiento para el Reconocimiento de Antigüedad",
    claveOficial: "1A31-003-001",
    organizacion: "IMSS / Relaciones Laborales",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Haz valer cada día: cómo sumar tu tiempo laborado como sustituto o contratos pasados para quinquenios y jubilación.",
    preambulo: `El Procedimiento 1A31-003-001 regula cómo los trabajadores pueden solicitar la acumulación oficial de todos los periodos laborados en el Instituto (guardias de sustitución, contratos de obra o periodos en bolsa) para que se sumen a su antigüedad efectiva general.

Aquí puedes encontrar la documentación probatoria requerida, el cotejo de nóminas históricas en SIAP y la expedición de la Constancia Oficial de Antigüedad para cobrar tus quinquenios completos (Concepto 058) y acelerar tu fecha de jubilación RJP.`,
    aQuienAplica: [
      "Trabajadores de base que tuvieron periodos previos como sustitutos o temporales.",
    ],
    aquiPuedesEncontrar: [
      "Documentos válidos: comprobantes de nómina, hojas de servicio y tarjetones viejos.",
      "Cálculo de días laborados acumulados para transformarse en años de antigüedad.",
      "Ajuste automático en el pago de compensación por antigüedad (quinquenios).",
    ],
    temasClave: [
      {
        tema: "Impacto en Quinquenios y Jubilación",
        referencia: "Efectos en Nómina y RJP",
        queEncontraras: "El reconocimiento aumenta tu pago quincenal por antigüedad y descuenta tiempo para tu retiro definitivo.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Apenas obtengas tu plaza de base si trabajaste meses o años anteriores cubriendo guardias como sustituto.",
    ],
    ojoConEsto: [
      "Conserva copias físicas o digitales de todos tus tarjetones y nombramientos de sustitución; son oro para tu trámite de antigüedad.",
    ],
  },
  {
    documentId: "IMSS-1A31-003-005",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A31-003-005.pdf",
    aliasIds: ["1A31-003-005", "ausentismo-no-programado", "faltas-justificadas", "fuerza-mayor"],
    tituloComun: "Procedimiento para el Seguimiento del Ausentismo No Programado",
    claveOficial: "1A31-003-005",
    organizacion: "IMSS / Relaciones Laborales",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Qué hacer ante una falta imprevista: cómo justificarla por fuerza mayor y evitar actas por abandono de servicio.",
    preambulo: `El Procedimiento 1A31-003-005 establece las reglas para la notificación y justificación de ausencias imprevistas por causas de fuerza mayor (enfermedad repentina, emergencias familiares graves, accidentes o desastres naturales).

Aquí puedes encontrar los plazos oficiales para avisar al servicio, entregar justificantes y evitar que Recursos Humanos levante actas de abandono de empleo o aplique rescisiones laborales arbitrarias.`,
    aQuienAplica: [
      "Todos los trabajadores de las unidades médicas y administrativas.",
    ],
    aquiPuedesEncontrar: [
      "Canales oficiales de aviso de inasistencia antes o durante el inicio de la jornada.",
      "Plazo para presentar constancias de atención médica u otros comprobantes de fuerza mayor.",
      "Criterios para evitar la pérdida de estímulos si la falta fue debidamente justificada.",
    ],
    temasClave: [
      {
        tema: "Definición Legal de Fuerza Mayor",
        referencia: "Criterios Contractuales",
        queEncontraras: "Todo acontecimiento imprevisible o inevitable que física o moralmente te impida asistir con puntualidad a tus labores.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si sufriste una emergencia médica en la madrugada y no pudiste llegar a checar tu turno matutino.",
    ],
    ojoConEsto: [
      "Notifica siempre a tu jefatura y a tu delegado sindical el mismo día de la ausencia y entrega el comprobante en cuanto te reincorpores.",
    ],
  },
  {
    documentId: "IMSS-1A31-003-016",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A31-003-016.pdf",
    aliasIds: ["1A31-003-016", "permisos-clausula-41", "reserva-plaza", "licencias-con-goce"],
    tituloComun: "Procedimiento para Permisos Temporales de la Cláusula 41 del CCT",
    claveOficial: "1A31-003-016",
    organizacion: "IMSS / Relaciones Laborales",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Trámite de permisos contractuales con reserva de plaza y protección a tu estabilidad laboral.",
    preambulo: `El Procedimiento 1A31-003-016 regula el otorgamiento de licencias y permisos temporales establecidos en la Cláusula 41 del CCT. Garantiza que tu plaza quede blindada y reservada mientras disfrutas de tu permiso autorizado.

Aquí puedes encontrar los requisitos de trámite, formatos de solicitud y tiempos de respuesta por parte de la Jefatura de Servicios Jurídicos y de Personal.`,
    aQuienAplica: [
      "Trabajadores de base con nombramiento definitivo.",
    ],
    aquiPuedesEncontrar: [
      "Formatos de solicitud con anticipación debida.",
      "Garantía de reserva de plaza y retorno a la misma adscripción y turno.",
    ],
    temasClave: [
      {
        tema: "Reserva de Plaza Contractual",
        referencia: "Cláusula 41 Fracción I",
        queEncontraras: "El derecho a reincorporarte exactamente al mismo puesto, clínica y horario al concluir el plazo concedido.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Cuando requieras solicitar una licencia temporal por motivos académicos, personales o familiares de mediano plazo.",
    ],
    ojoConEsto: [
      "Debes presentar tu solicitud de reincorporación antes de la fecha límite para evitar que se considere abandono.",
    ],
  },
  {
    documentId: "IMSS-1A31-003-003",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A31-003-003.pdf",
    aliasIds: ["1A31-003-003", "permiso-sin-goce", "licencia-sin-sueldo", "permiso-un-ano"],
    tituloComun: "Procedimiento para Permisos sin Goce de Sueldo",
    claveOficial: "1A31-003-003",
    organizacion: "IMSS / Relaciones Laborales",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Reglas para permisos particulares de hasta 1 año sin sueldo, conservando tu plaza para cuando regreses.",
    preambulo: `El Procedimiento 1A31-003-003 norma los permisos sin goce de sueldo para atender asuntos particulares o profesionales. Establece que no generarás antigüedad ni sueldo durante la ausencia, pero tu plaza definitiva no puede ser entregada a nadie más.

Aquí puedes encontrar la duración máxima permitida (hasta 365 días), cómo se autoriza bilateralmente y el proceso de regreso al servicio activo.`,
    aQuienAplica: [
      "Trabajadores de base con antigüedad mínima requerida.",
    ],
    aquiPuedesEncontrar: [
      "Requisitos de antigüedad para solicitar permiso de larga duración.",
      "Estatus de tu plaza en el catálogo (ocupación interina temporal).",
      "Paso a paso para avisar tu regreso con 15 días de anticipación.",
    ],
    temasClave: [
      {
        tema: "Aviso de Reincorporación Oportuna",
        referencia: "Retorno al Servicio",
        queEncontraras: "Obligación de notificar con antelación tu regreso para reactivar tu checador y nómina en SIAP.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si vas a radicar temporalmente fuera, cuidar a un familiar o emprender un proyecto personal y deseas congelar tu plaza.",
    ],
    ojoConEsto: [
      "Durante este periodo quedan en pausa las aportaciones al RJP y al Fondo de Ahorro.",
    ],
  },
  {
    documentId: "IMSS-1A32-003-005",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A32-003-005.pdf",
    aliasIds: ["1A32-003-005", "1A32", "tramite-rjp", "expediente-jubilacion", "finiquito-jubilacion"],
    tituloComun: "Procedimiento para el Trámite de Prestaciones del RJP",
    claveOficial: "1A32-003-005",
    organizacion: "IMSS / Coordinación de Prestaciones Económicas",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "El circuito oficial para armar tu expediente de jubilación RJP y cobrar tu liquidación y primera pensión sin trabas.",
    preambulo: `El Procedimiento 1A32-003-005 es la guía oficial que sigue la Delegación para calcular y otorgar los beneficios del Régimen de Jubilaciones y Pensiones. Define cómo se integra el expediente de retiro, el desglose de conceptos que integran tu salario base de liquidación y los tiempos para recibir tu pago finiquito y tarjeta de pensionado.

Aquí puedes encontrar la lista exhaustiva de documentos que te pedirán en Prestaciones Económicas, cómo se calcula tu prima de antigüedad y el trámite de seguro de vida y FAS para pensionados.`,
    aQuienAplica: [
      "Trabajadores en proceso de jubilación por años de servicios, edad avanzada, vejez o invalidez.",
      "Viudas, concubinas e hijos en trámite de pensión derivada.",
    ],
    aquiPuedesEncontrar: [
      "Integración del expediente de jubilación o pensión RJP.",
      "Cálculo del salario base de liquidación y cuantía básica mensual.",
      "Pago de finiquito: prima de antigüedad, proporcional de vacaciones y fondo de ahorro.",
      "Entrega de credencial de pensionado del IMSS.",
    ],
    temasClave: [
      {
        tema: "Salario Base de Liquidación Contractual",
        referencia: "Cálculo de Cuantía",
        queEncontraras: "Fórmula de integración que incluye sueldo tabular, ayuda de renta, antigüedad y conceptos fijos.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "De 3 a 6 meses antes de cumplir tus 27 años (mujeres) o 28 años (hombres) de antigüedad laboral.",
    ],
    ojoConEsto: [
      "Inicia la revisión de tu historial laboral con tiempo para solventar cualquier inconsistencia de semanas o nombres en actas.",
    ],
  },
  {
    documentId: "IMSS-9220-003-329",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/9220-003-329.pdf",
    aliasIds: ["9220-003-329", "9220", "prestaciones-dinero", "pago-subsidios-incapacidad", "subsidio-maternidad"],
    tituloComun: "Procedimiento para Prestaciones en Dinero (Subsidios e Incapacidades)",
    claveOficial: "9220-003-329",
    organizacion: "IMSS / Dirección de Prestaciones Económicas",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Cómo se tramitan y cobran los pagos de subsidio de incapacidad por enfermedad, riesgo o maternidad.",
    preambulo: `El Procedimiento 9220-003-329 norma la transferencia bancaria y pago de las prestaciones en dinero que amparan a los trabajadores durante periodos de incapacidad médica. Fija las reglas para la acreditación en cuenta bancaria y el cobro de subsidios por maternidad directa o incapacidad temporal.

Aquí puedes encontrar qué porcentaje corresponde por cada ramo de seguro (Riesgo de Trabajo 100%, Maternidad 100%, Enfermedad General 60%) y el calendario de dispersión de fondos.`,
    aQuienAplica: [
      "Trabajadores activos con certificados de incapacidad médica expedidos por el Instituto.",
    ],
    aquiPuedesEncontrar: [
      "Registro de cuenta CLABE para cobro directo sin acudir al banco.",
      "Porcentajes de subsidio según el ramo de seguro calificado.",
      "Subsidio de maternidad prenatal y postnatal en una sola exhibición.",
    ],
    temasClave: [
      {
        tema: "Acreditación Bancaria de Subsidios",
        referencia: "Trámite Digital de Pago",
        queEncontraras: "Instrucciones para dar de alta tu cuenta bancaria y recibir tus pagos de incapacidad sin filas ni demoras.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando tengas una incapacidad médica prolongada y necesites verificar cuándo y cómo caerá el depósito de tu subsidio.",
    ],
    ojoConEsto: [
      "Las incapacidades por Riesgo de Trabajo no pagan si el formato ST-7 no fue entregado y calificado a tiempo.",
    ],
  },
  {
    documentId: "IMSS-1A72-003-005",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A72-003-005.pdf",
    aliasIds: ["1A72-003-005", "1A72", "prestamos-habitacion", "credito-vivienda-imss", "fomento-habitacion"],
    tituloComun: "Procedimiento para Préstamos de Fomento a la Habitación IMSS",
    claveOficial: "1A72-003-005",
    organizacion: "IMSS / Prestaciones Sociales",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "El trámite oficial para solicitar préstamos hipotecarios y créditos de vivienda a tasa preferencial.",
    preambulo: `El Procedimiento 1A72-003-005 regula los créditos institucionales para adquisición, construcción o remodelación de vivienda que otorga el Instituto a sus trabajadores en apego a los programas de fomento a la habitación.

Aquí puedes encontrar los montos máximos autorizados según categoría, la tasa de interés social preferencial y las tablas de retención quincenal en nómina.`,
    aQuienAplica: [
      "Trabajadores de base con la antigüedad y capacidad de pago requeridas.",
    ],
    aquiPuedesEncontrar: [
      "Requisitos de solicitud y convocatoria anual de créditos de vivienda.",
      "Tasas de interés institucionales muy por debajo de la banca comercial.",
      "Límites de retención para no comprometer el salario mínimo líquido.",
    ],
    temasClave: [
      {
        tema: "Capacidad de Endeudamiento Protegida",
        referencia: "Reglas de Retención",
        queEncontraras: "El tope máximo que pueden descontarte quincenalmente para asegurar que siempre conserves líquido para vivir.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando desees comprar tu casa, liquidar un gravamen o remodelar tu vivienda mediante crédito del Instituto.",
    ],
    ojoConEsto: [
      "Revisa las convocatorias de la Comisión Mixta de Vivienda IMSS-SNTSS para inscribir tu solicitud en tiempo.",
    ],
  },
  {
    documentId: "IMSS-1A72-003-014",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A72-003-014.pdf",
    aliasIds: ["1A72-003-014", "financiamiento-vehiculos", "credito-auto-imss", "seguro-automotores"],
    tituloComun: "Procedimiento para Financiamiento de Vehículos Automotores",
    claveOficial: "1A72-003-014",
    organizacion: "IMSS / Prestaciones Sociales",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Cómo solicitar el crédito institucional para comprar automóvil con seguro a precio preferencial vía nómina.",
    preambulo: `El Procedimiento 1A72-003-014 norma el otorgamiento del crédito automotriz institucional para trabajadores del Seguro Social. Fija los plazos de financiamiento (de 24 a 60 meses), las agencias de convenio y la inclusión del seguro con cargo quincenal directo al tarjetón.

Aquí puedes encontrar los requisitos de antigüedad, capacidad crediticia y los pasos para la entrega del vehículo en tu localidad.`,
    aQuienAplica: [
      "Trabajadores de base con nombramiento permanente.",
    ],
    aquiPuedesEncontrar: [
      "Simulador de crédito y tabla de amortización con cargo quincenal.",
      "Pólizas de seguro automotriz de cobertura amplia con tarifa colectiva.",
      "Procedimiento de finiquito y liberación de factura al terminar de pagar.",
    ],
    temasClave: [
      {
        tema: "Descuento Vía Nómina Protegido",
        referencia: "Mecanismo Financiero",
        queEncontraras: "Las retenciones se ajustan estrictamente al marco del CCT para evitar descuentos dobles.",
        relevancia: "media",
      },
    ],
    cuandoConsultarlo: [
      "Si buscas adquirir un vehículo nuevo o seminuevo con tasas más bajas que las financieras de agencia.",
    ],
    ojoConEsto: [
      "El vehículo queda con reserva de dominio hasta la liquidación total del financiamiento.",
    ],
  },
  {
    documentId: "IMSS-1A14-003-011",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A14-003-011.pdf",
    aliasIds: ["1A14-003-011", "1A14", "fonacot", "credito-fonacot", "descuentos-fonacot"],
    tituloComun: "Procedimiento para la Recuperación del Crédito FONACOT",
    claveOficial: "1A14-003-011",
    organizacion: "IMSS / Finanzas",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "Regula los descuentos de créditos FONACOT para evitar retenciones excesivas o cobros indebidos en tu tarjetón.",
    preambulo: `El Procedimiento 1A14-003-011 establece las normas financieras entre el IMSS y el Instituto FONACOT para la retención y entero de los abonos de créditos contratados por los trabajadores. Garantiza que las retenciones respeten los límites de ley y cesen automáticamente cuando se liquida la deuda.

Aquí puedes encontrar qué hacer si te siguen descontando FONACOT después de terminar de pagar o si el monto descontado excede tu capacidad de pago.`,
    aQuienAplica: [
      "Trabajadores que cuentan con crédito activo ante el Fondo FONACOT.",
    ],
    aquiPuedesEncontrar: [
      "Tope del 20% máximo de descuento sobre salario base para créditos al consumo.",
      "Trámite de cancelación de descuento al presentar carta finiquito de FONACOT.",
      "Devolución de descuentos aplicados indebidamente por desfase de nómina.",
    ],
    temasClave: [
      {
        tema: "Suspensión Inmediata de Retenciones al Liquidar",
        referencia: "Cancelación de Clave de Descuento",
        queEncontraras: "Cómo ingresar tu constancia de no adeudo para retirar la clave de retención en el siguiente corte de SIAP.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si ya terminaste de pagar tu crédito FONACOT y en tu tarjetón sigue apareciendo el descuento quincenal.",
    ],
    ojoConEsto: [
      "Solicita tu carta finiquito en el portal de FONACOT y preséntala de inmediato en Recursos Humanos para evitar retenciones de más.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-029",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A74-003-029.pdf",
    aliasIds: ["1A74-003-029", "cambio-residencia", "concepto-031", "clausula-99", "gastos-traslado"],
    tituloComun: "Procedimiento para Pago por Cambio de Lugar de Residencia",
    claveOficial: "1A74-003-029",
    organizacion: "IMSS / Nómina y Personal",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "El cobro de gastos de mudanza, transporte y menaje (Concepto 031) cuando el IMSS te traslada de ciudad.",
    preambulo: `El Procedimiento 1A74-003-029 norma el pago de compensaciones económicas por cambio de adscripción y residencia conforme a la Cláusula 99 del CCT. Garantiza que si el Instituto te traslada a otra localidad, cubra íntegramente los gastos de mudanza, pasajes y ayuda de instalación para ti y tu familia.

Aquí puedes encontrar cómo cotizar y facturar los gastos de mudanza, los días de permiso con goce de sueldo para realizar el traslado y el pago del Concepto 031 en tu nómina.`,
    aQuienAplica: [
      "Trabajadores trasladados a otra población o centro de trabajo por orden o convenio institucional.",
    ],
    aquiPuedesEncontrar: [
      "Pago de flete y seguro de menaje de casa completo.",
      "Boletos de transporte o kilometraje para el trabajador y sus dependientes económicos.",
      "Días hábiles de permiso con goce de sueldo para la mudanza e instalación.",
      "Compensación económica por cambio de zona geográfica.",
    ],
    temasClave: [
      {
        tema: "Ayuda Económica por Cambio de Residencia (Concepto 031)",
        referencia: "Cláusula 99 del CCT",
        queEncontraras: "El desglose de gastos que el Instituto debe reimbolsarte o anticiparte antes de la fecha de traslado.",
        relevancia: "destacada",
      },
    ],
    cuandoConsultarlo: [
      "Si recibiste orden de cambio de adscripción a otro municipio o estado para tramitar tus viáticos y mudanza.",
    ],
    ojoConEsto: [
      "No realices el gasto de mudanza sin haber ingresado las cotizaciones previas autorizadas por la Delegación.",
    ],
  },
  {
    documentId: "IMSS-1A32-A03-008",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1A32-A03-008.pdf",
    aliasIds: ["1A32-A03-008", "pago-pasajes", "pasajes-nomina", "comision-oficial", "concepto-pasajes"],
    tituloComun: "Procedimiento para el Pago de Pasajes y su Inclusión en Nómina",
    claveOficial: "1A32-A03-008",
    organizacion: "IMSS / Finanzas y Nómina",
    categoria: "procedimientos",
    vigenciaTexto: "Procedimiento Oficial Normativo Vigente",
    enUnaFrase: "El reembolso puntual de gastos de pasajes y transporte cuando sales a comisiones oficiales fuera de tu unidad.",
    preambulo: `El Procedimiento 1A32-A03-008 regula la comprobación y reembolso de gastos de transporte local y foráneo para trabajadores que realizan traslados o diligencias oficiales en cumplimiento de su servicio (traslado de pacientes en ambulancia, auditorías, supervisión o toma de muestras).

Aquí puedes encontrar los formatos de comprobación, las tarifas autorizadas de kilometraje y transporte y cómo se reflejan los reintegros directamente en tu nómina quincenal.`,
    aQuienAplica: [
      "Personal en comisión oficial de servicio, choferes de ambulancia, notificadores y personal de campo.",
    ],
    aquiPuedesEncontrar: [
      "Boleta oficial de comisión y comprobación de pasajes.",
      "Tarifas oficiales de kilometraje para traslados en vehículo propio.",
      "Inclusión del pago en la nómina quincenal sin retención indebida de impuestos.",
    ],
    temasClave: [
      {
        tema: "Reembolso Rápido de Pasajes en Nómina",
        referencia: "Apartado de Dispersión",
        queEncontraras: "Tiempos para que los gastos cubiertos por el trabajador sean restituidos en el corte de nómina más próximo.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando debas trasladarte entre clínicas u hospitales para realizar trámites oficiales o atender urgencias de servicio.",
    ],
    ojoConEsto: [
      "Conserva boletos de caseta, pasajes de autobús o comprobantes fiscales oficiales de inmediato para validar tu reembolso.",
    ],
  },
  {
    documentId: "IMSS-2610-003-017",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2660-003-053.pdf",
    aliasIds: [
      "2610-003-017",
      "2610-003-005",
      "enfermeria",
      "enfermero",
      "enfermera",
      "auxiliar-enfermeria",
      "enfermera-especialista",
      "notas-enfermeria",
      "medicamentos-enfermeria",
      "enlace-turno",
    ],
    tituloComun: "Manual de Procedimientos y Actividades de Enfermería en Unidades Médicas (1°, 2° y 3° Nivel)",
    claveOficial: "2660-003-053 / 2610-003-017",
    organizacion: "IMSS / Dirección de Prestaciones Médicas",
    categoria: "flujos-clinicos",
    enUnaFrase: "Qué le corresponde y qué NO le corresponde hacer a Auxiliares, Enfermeras Generales y Especialistas en UMF, HGZ y UMAE.",
    preambulo: `Este manual estandariza las intervenciones de enfermería en los tres niveles de atención del IMSS, delimitando funciones y protegiendo el ejercicio profesional:

• Primer Nivel (UMF): Atención preventiva, programas PrevenIMSS, vacunación según Cartilla Nacional de Salud, somatometría, curaciones ambulatorias y educación comunitaria para la salud.
• Segundo Nivel (Hospital General de Zona / HGZ): Hospitalización general, proceso de atención de enfermería (PAE), ministración segura de fármacos intravenosos y orales bajo la regla de los correctos, enlace clínico de turno a pie de cama y cuidados perioperatorios.
• Tercer Nivel (UMAE): Cuidados de alta especialidad en Terapia Intensiva (UCI), Cuidados Coronarios, Tococirugía de alto riesgo, Terapia Pediátrica/Neonatal, Hemodiálisis y Quirófano Especializado.

Diferenciación estricta por categoría contractual:
- Auxiliar de Enfermería General: Higiene, confort, tendido de cama clínica, toma de signos vitales básicos y traslado de muestras biológicas. No debe asumir ministración de medicamentos intravenosos de alto riesgo ni procedimientos invasivos sin supervisión directa.
- Enfermera General: Valoración clínica, preparación y ministración de fármacos parenterales y vía oral, notas de evolución de enfermería en expediente clínico, cateterismo venoso periférico e instalación de sondas.
- Enfermera Especialista: Instrumentación quirúrgica estricta con conteo de gasas e instrumental, monitoreo hemodinámico invasivo en UCI, manejo de ventiladores mecánicos y bombas de infusión complejas.`,
    aQuienAplica: [
      "Auxiliares de Enfermería General",
      "Enfermeras Generales",
      "Enfermeras Especialistas (Quirúrgicas, UCI, Pediatría)",
      "Jefas de Piso y Supervisoras de Enfermería",
    ],
    aquiPuedesEncontrar: [
      "Funciones específicas desglosadas por categoría: Auxiliar vs. General vs. Especialista.",
      "Protocolo estricto de los 'Correctos' en la ministración de medicamentos (fármaco, dosis, vía, paciente, hora, caducidad, registro).",
      "Reglas del enlace de turno clínico (entrega y recepción de pacientes a pie de cama).",
      "Llenado reglamentario de la hoja de registros clínicos y notas de enfermería (NOM-004-SSA3-2012).",
      "Límites de responsabilidad: qué procedimientos invasivos no pueden exigirte si no corresponden a tu profesiograma o si no cuentas con insumos estériles.",
    ],
    temasClave: [
      {
        tema: "Delimitación de Funciones: Auxiliar vs. General vs. Especialista",
        referencia: "Profesiograma y Distribución Operativa",
        queEncontraras: "El Auxiliar asiste en cuidados básicos y confort; la Enfermera General valora y medica; la Especialista opera en quirófano y áreas críticas.",
        relevancia: "destacada",
      },
      {
        tema: "Ministración Segura de Medicamentos y Farmacovigilancia",
        referencia: "Protocolo de los Correctos",
        queEncontraras: "Prohibición de aplicar medicamentos por órdenes verbales no urgentes; todo fármaco requiere indicación escrita, firmada y dosificada en el expediente.",
        relevancia: "alta",
      },
      {
        tema: "Enlace Clínico de Turno a Pie de Cama",
        referencia: "Procedimiento de Entrega-Recepción",
        queEncontraras: "Obligación de revisar al paciente físicamente, estado de catéteres, bombas de infusión y saldo de narcóticos en vitrina antes de recibir el servicio.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando una jefatura intente obligar a un Auxiliar de Enfermería a realizar funciones exclusivas de Enfermera General o Especialista.",
      "Si te asignan un número desproporcionado de pacientes en piso que rebase los indicadores de seguridad de la Cláusula 22 del CCT y la norma 2900-B03-002.",
      "Para verificar los pasos correctos del enlace de turno y no recibir pacientes sin la debida nota médica o medicación reportada.",
    ],
    ojoConEsto: [
      "Nunca recibas un servicio ni firmes la entrega si faltan medicamentos controlados, narcóticos en vitrina o si un paciente en estado grave no cuenta con hoja de registro actualizada.",
      "Cualquier ministración de medicamento debe estar respaldada por orden médica escrita y firmada en el expediente (no por órdenes verbales informales salvo paro/código rojo).",
    ],
  },
  {
    documentId: "IMSS-2430-003-018",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2250-003-002.pdf",
    aliasIds: [
      "2430-003-018",
      "2430-003-024",
      "asistente-medica",
      "asistentes-medicas",
      "recepcion-medica",
      "triage-asistente",
      "citas-unifila",
      "arimac",
      "somatometria-asistente",
    ],
    tituloComun: "Manual de Procedimientos de la Asistente Médica en Unidades de Medicina Familiar, Hospitales y Urgencias",
    claveOficial: "2250-003-002 / 2430-003-018",
    organizacion: "IMSS / Dirección de Prestaciones Médicas",
    categoria: "flujos-clinicos",
    enUnaFrase: "Las actividades oficiales de la Asistente Médica en consultorios, Unifila, Triage de Urgencias y qué tareas NO le corresponden por norma.",
    preambulo: `Este manual define los flujos de trabajo, competencias y límites de actuación de las Asistentes Médicas en el IMSS en los tres niveles de atención:

• Primer Nivel (UMF - Consultorios de Medicina Familiar):
  - Recepción de derechohabientes con cita previa en sistema SIMF y gestión de la estrategia 'Unifila' para pacientes sin cita.
  - Toma y registro de somatometría básica (peso, talla, temperatura).
  - Preparación de cartillas de salud y orientación sobre citas de medicina preventiva PrevenIMSS.
  - Gestión de la Hoja de Referencia (Formato 4-30-6) para envío a segundo nivel.

• Segundo Nivel (HGZ/HGR - Urgencias y Especialidades):
  - Recepción en Módulo de Triage de Urgencias: registro inicial y canalización al médico clasificador según el semáforo de urgencia.
  - Control de agendas de consulta externa de especialidades y solicitud de expedientes al Archivo Clínico (ARIMAC).

• Tercer Nivel (UMAE):
  - Módulos de Información y Admisión de Alta Especialidad, confirmación de interconsultas y citas foráneas.

Límites estrictos de la categoría:
La Asistente Médica NO debe realizar diagnósticos clínicos, no prescribe medicamentos, no aplica inyecciones, ni toma muestras biológicas ni realiza curaciones (esas son facultades exclusivas de enfermería y personal médico).`,
    aQuienAplica: [
      "Asistentes Médicas de Consulta Externa de Medicina Familiar",
      "Asistentes Médicas de Urgencias y Triage",
      "Asistentes Médicas de Módulos de Información y Admisión Hospitalaria",
      "Coordinadoras de Asistentes Médicas",
    ],
    aquiPuedesEncontrar: [
      "El flujo paso a paso de atención en ventanilla y recepción de derechohabientes.",
      "Tiempos estándar y límites de pacientes por turno en consultorio de medicina familiar y Unifila.",
      "Procedimiento de operación en el módulo de Triage de Urgencias.",
      "Qué hacer si el sistema digital (SIMF/ECE) se cae: activación del registro manual en libreta oficial de contingencia.",
      "Delimitación clara de funciones para evitar sobrecargas o invasión de funciones de enfermería o trabajo social.",
    ],
    temasClave: [
      {
        tema: "Flujo de Atención en Consultorio y Estrategia Unifila",
        referencia: "Recepción y Agenda SIMF",
        queEncontraras: "El orden de atención: pacientes citados por hora y distribución equilibrada de espontáneos en Unifila sin saturar el consultorio.",
        relevancia: "destacada",
      },
      {
        tema: "Límites Profesionales: Qué NO le Corresponde a la Asistente Médica",
        referencia: "Catálogo de Puestos y Responsabilidades",
        queEncontraras: "Prohibición tajante de aplicar inyecciones, canalizar vías, tomar muestras o dar diagnósticos; esas funciones son médicas y de enfermería.",
        relevancia: "alta",
      },
      {
        tema: "Protocolo de Contingencia por Caída de Sistemas Informáticos",
        referencia: "Registro Manual de Respaldo",
        queEncontraras: "Uso de libretas de control y sellado de formatos cuando el SIMF/ECE pierde conexión a internet o intranet institucional.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si un directivo o médico pretende obligarte a inyectar medicamentos, realizar curaciones o emitir opiniones diagnósticas.",
      "Si te asignan simultáneamente la carga de más consultorios de los autorizados por la plantilla sin personal de apoyo.",
      "Para conocer el protocolo oficial de atención ante usuarios inconformes en ventanilla o saturación de salas de espera.",
    ],
    ojoConEsto: [
      "No entregues recetas ni hojas de incapacidad sin que estén debidamente firmadas y selladas por el médico tratante.",
      "Si el sistema SIMF se interrumpe, levanta de inmediato el reporte técnico institucional y anota la hora de contingencia en la libreta para respaldarte ante cualquier reclamo de derechohabientes.",
    ],
  },
  {
    documentId: "IMSS-2430-003-022",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2660-003-049.pdf",
    aliasIds: [
      "2430-003-022",
      "2430-003-040",
      "radiologo",
      "radiologia",
      "tecnico-radiologo",
      "rayos-x",
      "mastografia",
      "tomografia",
      "tac",
      "resonancia",
      "dosimetro",
      "proteccion-radiologica",
      "nom-229",
    ],
    tituloComun: "Procedimiento para el Servicio de Radiodiagnóstico e Imagenología (Rayos X, Mastografía, TAC y Resonancia)",
    claveOficial: "2660-003-049 / 2430-003-022",
    organizacion: "IMSS / DPM / Seguridad Radiológica",
    categoria: "flujos-clinicos",
    enUnaFrase: "Operación de equipos, protección radiológica obligatoria, descansos profilácticos y derechos del personal expuesto a radiaciones.",
    preambulo: `Establece el flujo operativo, normas de bioseguridad y derechos laborales del personal técnico en imagenología en unidades de primer, segundo y tercer nivel:

• Primer Nivel (UMF con Rayos X): Estudios radiológicos simples de tórax, extremidades y columna; mastografía de tamizaje preventivo.
• Segundo Nivel (HGZ/HGR): Radiología general, estudios con medios de contraste (series esofagogastroduodenales, urografías), mastografía diagnóstica, tomografía axial computarizada (TAC) y ultrasonido.
• Tercer Nivel (UMAE): Tomografía multicorte, Resonancia Magnética (RM), angiografías, radiología intervencionista y hemodinamia.

Seguridad Radiológica y Derechos del Trabajador (POE):
- Cumplimiento estricto de la NOM-229-SSA1-2002 y NOM-012-STPS-2012.
- Uso obligatorio y dotación patronal del dosímetro personal de radiación con lectura e historial de dosis acumulada.
- Blindaje plomado obligatorio en consolas de disparo (vidrios plomados de espesor reglamentario y mamparas).
- Descanso profiláctico de 10 días hábiles por cada 6 meses de servicio conforme a la Cláusula 47 del CCT y Reglamento de Infectocontagiosidad y Emanaciones Radiactivas.
- Pago del Concepto 030 de Alto Riesgo / Radiaciones en nómina ordinaria.`,
    aQuienAplica: [
      "Técnicos en Radiología e Imagen",
      "Técnicos Radiólogos Especialistas (TAC / Resonancia)",
      "Médicos Radiólogos",
      "Personal Ocupacionalmente Expuesto (POE)",
    ],
    aquiPuedesEncontrar: [
      "Técnica de preparación y verificación del paciente antes del disparo (descarte de embarazo, retiro de metales).",
      "Protocolo para estudios con medio de contraste: verificar ayuno, creatinina sérica y consentimiento informado firmado por el médico tratante.",
      "Límites máximos permisibles de radiación para el POE y entrega obligatoria del reporte dosimétrico.",
      "Derecho a suspender el servicio si las mamparas o vidrios plomados no cuentan con certificación vigente o presentan fracturas.",
      "Reglas de tramitación del descanso profiláctico de 10 días y el pago de infecto/radiaciones.",
    ],
    temasClave: [
      {
        tema: "Protección Radiológica del POE y Dosimetría Personal",
        referencia: "NOM-229-SSA1-2002 / NOM-012-STPS-2012",
        queEncontraras: "El uso obligatorio del dosímetro a nivel del pecho y el derecho a conocer bimestralmente tu lectura acumulada de radiación.",
        relevancia: "destacada",
      },
      {
        tema: "Descanso Profiláctico de 10 Días Semestrales",
        referencia: "Cláusula 47 CCT / Reglamento de Radiaciones",
        queEncontraras: "Los 10 días hábiles adicionales por semestre concedidos por exposición continua a radiaciones ionizantes.",
        relevancia: "alta",
      },
      {
        tema: "Seguridad en Estudios con Medios de Contraste",
        referencia: "Protocolo de Imagen Contrastada",
        queEncontraras: "Requisitos indispensables: consentimiento informado firmado, función renal documentada y presencia médica ante riesgo de choque anafiláctico.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si el dosímetro no te ha sido reemplazado o no te entregan tu reporte bimestral de radiación recibida.",
      "Si te ordenan operar un equipo cuya consola no cuenta con cristal plomado íntegro o tiene fallas en el colimador.",
      "Para exigir tu descanso profiláctico semestral adicional a tus vacaciones ordinarias.",
    ],
    ojoConEsto: [
      "Bajo ninguna circunstancia realices estudios con medio de contraste intravenoso sin la presencia física del médico radiólogo o urgencista en el servicio para responder ante un choque anafiláctico.",
      "No dispares sin antes corroborar la ausencia de embarazo en mujeres en edad fértil o sin colocar protección gonadal plomada cuando proceda.",
    ],
  },
  {
    documentId: "IMSS-2430-003-007",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2250-003-002.pdf",
    aliasIds: [
      "2430-003-007",
      "2430-003-009",
      "medico-familiar",
      "medico-especialista",
      "consulta-medica",
      "pase-visita",
      "expediente-clinico",
      "tiempos-consulta",
      "referencia-4306",
      "nom-004",
    ],
    tituloComun: "Procedimiento para la Consulta de Medicina Familiar y Consulta Externa de Especialidades (1°, 2° y 3° Nivel)",
    claveOficial: "2250-003-002 / 2660-003-052",
    organizacion: "IMSS / Dirección de Prestaciones Médicas",
    categoria: "flujos-clinicos",
    enUnaFrase: "Tiempos oficiales por consulta, llenado de notas médicas, expedición de incapacidades y referencia entre niveles.",
    preambulo: `Regula la práctica médica institucional, los tiempos de atención, el llenado reglamentario del expediente clínico y la interconexión entre unidades:

• Primer Nivel (Medicina Familiar): Consulta integral programada y espontánea (Unifila), promedio de 15 minutos por consulta para exploración, diagnóstico, prescripción terapéutica y notas en SIMF/ECE. Emisión y control de incapacidades temporales para el trabajo.
• Segundo Nivel (HGZ/HGR): Consulta de especialidades troncales (Cirugía, Medicina Interna, Pediatría, Gineco-Obstetricia, Traumatología), tiempos de 20 a 30 minutos por paciente, programación quirúrgica y pase de visita hospitalario diario con nota de evolución.
• Tercer Nivel (UMAE): Subespecialidades de alta complejidad, interconsultas intrahospitalarias y procedimientos de tercer nivel.
• Protocolo de Referencia y Contrarreferencia (4-30-6 / 4-30-8): Criterios técnicos de envío oportuno a segundo o tercer nivel y devolución del contrarreferencia a la unidad de origen.`,
    aQuienAplica: [
      "Médicos Familiares",
      "Médicos No Familiares / Especialistas",
      "Médicos de Urgencias",
      "Médicos Residentes e Internos de Pregrado",
    ],
    aquiPuedesEncontrar: [
      "Tiempos estándar de atención para no saturar la consulta y salvaguardar la relación médico-paciente.",
      "Estructura obligatoria de la nota médica según la NOM-004-SSA3-2012 (SOAP: Subjetivo, Objetivo, Análisis, Plan).",
      "Reglas de emisión de incapacidades (iniciales, subsecuentes y de enlace) y blindaje legal ante auditorías.",
      "Criterios para envío de pacientes a segundo nivel mediante el formato 4-30-6.",
      "Derecho a no ser forzado a atender sobrecargas injustificadas que pongan en riesgo la vida del paciente o la cédula profesional del médico.",
    ],
    temasClave: [
      {
        tema: "Tiempos Estándar de Consulta Médica",
        referencia: "Indicadores de Productividad y Calidad",
        queEncontraras: "El tiempo mínimo necesario para una exploración física completa y diagnóstico seguro sin consultas express impuestas.",
        relevancia: "destacada",
      },
      {
        tema: "Expediente Clínico y Nota Médica (NOM-004-SSA3-2012)",
        referencia: "Marco Médico-Legal",
        queEncontraras: "Los elementos indispensables que debe contener la nota médica para evitar responsabilidades administrativas o penales.",
        relevancia: "alta",
      },
      {
        tema: "Emisión Legal de Incapacidades Médicas",
        referencia: "Reglamento de Prestaciones Médicas",
        queEncontraras: "El criterio clínico para otorgar días de reposo justificados conforme a la patología y evolución real del paciente.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si la dirección médica pretende sobreagendar citas por encima de la capacidad horaria del consultorio.",
      "Si te cuestionan la emisión técnica de una incapacidad médica expedida en apego a la evolución del paciente.",
      "Para conocer el proceso reglamentario de pase de visita y entrega de guardia en hospitalización.",
    ],
    ojoConEsto: [
      "Toda prescripción farmacológica e indicación médica debe quedar registrada en el expediente clínico con tu firma electrónica o autógrafa y cédula profesional.",
      "Nunca emitas incapacidades retroactivas sin la justificación médica documental y el visto bueno de la dirección de la unidad.",
    ],
  },
  {
    documentId: "IMSS-2610-003-028",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2660-003-056.pdf",
    aliasIds: [
      "2610-003-028",
      "camillero",
      "camilleria",
      "traslado-pacientes",
      "ergonomia-camillero",
      "silla-ruedas",
      "camilla-hospital",
      "nom-036-camillero",
    ],
    tituloComun: "Procedimiento para el Traslado Intrahospitalario de Pacientes en Unidades Médicas (Camillería)",
    claveOficial: "2660-003-056 / 2610-003-028",
    organizacion: "IMSS / DPM / Servicios Básicos de Salud",
    categoria: "flujos-clinicos",
    enUnaFrase: "Técnicas seguras de movilización de pacientes, prevención de lesiones de columna y derechos del personal de camillería.",
    preambulo: `Define los flujos de movilización de derechohabientes entre Urgencias, Quirófanos, Terapia Intensiva, Rayos X y Hospitalización, protegiendo tanto la integridad del paciente como la salud biomecánica del camillero:

• Flujo operativo: Recepción del paciente con la indicación médica/enfermería, revisión de dispositivos conectados (portasueros, drenajes, oxígeno portátil), colocación obligatoria de barandales y verificación de frenos.
• Ergonomía y NOM-036-1-STPS-2018: Límites de esfuerzo físico en manejo de cargas. Si el paciente excede el peso estándar o está inconsciente/intubado, es obligación institucional asignar a dos o más camilleros para el pase en bloque de camilla a cama.
• Dotación de insumos: Provisión patronal de calzado antiderrapante, fajas ergonómicas y mantenimiento correctivo de ruedas y frenos de camillas y sillas de ruedas.`,
    aQuienAplica: [
      "Choferes de Servicios de Camillería",
      "Camilleros de Urgencias y Hospitalización",
      "Personal de Traslado de Pacientes",
    ],
    aquiPuedesEncontrar: [
      "Protocolo seguro de traslado a quirófanos, áreas críticas y estudios de imagen.",
      "Reglas de movilización en bloque y apoyo multidisciplinario para pacientes graves o con obesidad mórbida.",
      "Derecho a negarse a trasladar pacientes en camillas defectuosas, sin frenos o sin barandales.",
      "Medidas de bioseguridad en pacientes aislados por patógenos de alta transmisibilidad.",
    ],
    temasClave: [
      {
        tema: "Seguridad del Paciente: Barandales y Frenos",
        referencia: "Metas Internacionales de Seguridad",
        queEncontraras: "Obligación de elevar los barandales antes de iniciar la marcha y frenar camillas en elevadores y áreas de espera.",
        relevancia: "destacada",
      },
      {
        tema: "Ergonomía y Movilización en Bloque (NOM-036)",
        referencia: "Salud Ocupacional del Camillero",
        queEncontraras: "El derecho a requerir apoyo de dos o más compañeros y grúas de transferencia ante pacientes pesados o dependientes.",
        relevancia: "alta",
      },
      {
        tema: "Traslado de Pacientes Graves e Intubados",
        referencia: "Acompañamiento Clínico Obligatorio",
        queEncontraras: "Prohibición de trasladar pacientes intubados o con monitoreo invasivo sin personal médico o de enfermería a cargo durante todo el trayecto.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si te ordenan movilizar a un paciente obeso o en bloque sin el personal de apoyo necesario.",
      "Si las camillas de tu unidad tienen las llantas amarradas o barandales caídos y la administración no las repara.",
      "Para respaldarte si un paciente intenta levantarse por sí mismo durante el trayecto.",
    ],
    ojoConEsto: [
      "Nunca traslades a un paciente intubado o con soporte vital sin la presencia física y acompañamiento de un médico o enfermera general durante todo el trayecto.",
      "Revisa siempre que los barandales de la camilla queden debidamente bloqueados antes de iniciar cualquier desplazamiento en pasillos o elevadores.",
    ],
  },
  {
    documentId: "IMSS-2430-003-015",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2660-003-071.pdf",
    aliasIds: [
      "2430-003-015",
      "trabajador-social",
      "trabajadora-social",
      "trabajo-social",
      "estudio-socioeconomico",
      "traslado-foraneo",
      "alta-voluntaria",
      "dif-ministerio-publico",
    ],
    tituloComun: "Procedimiento para la Operación del Servicio de Trabajo Social en Unidades Médicas (1°, 2° y 3° Nivel)",
    claveOficial: "2660-003-071 / 2430-003-015",
    organizacion: "IMSS / Dirección de Prestaciones Médicas",
    categoria: "flujos-clinicos",
    enUnaFrase: "Intervención socio-médica, pasajes para traslados foráneos, altas voluntarias y canalización legal ante autoridades.",
    preambulo: `Establece el marco de acción y protocolos de Trabajo Social en clínicas y hospitales del IMSS:

• Primer Nivel: Educación para la salud, fomento del autocuidado en enfermos crónicos y visitas domiciliarias en casos de abandono de tratamiento.
• Segundo y Tercer Nivel: Estudios socioeconómicos para exención de cuotas en convenios especiales, trámite de pasajes para traslados médicos foráneos a UMAE, gestión de aparatos ortopédicos y prótesis, y acompañamiento en egresos por alta voluntaria.
• Situaciones médico-legales: Notificación inmediata al Ministerio Público y DIF en sospechas de maltrato infantil, violencia contra la mujer o pacientes en calidad de desconocidos/abandonados.`,
    aQuienAplica: [
      "Trabajadoras y Trabajadores Sociales en UMF, HGZ y UMAE",
      "Jefas de Trabajo Social",
    ],
    aquiPuedesEncontrar: [
      "Requisitos para la gestión de pasajes terrestres o aéreos para pacientes referidos a tercer nivel.",
      "Formato y protocolo legal de recepción y trámite del alta voluntaria del paciente.",
      "Intervención ante el Ministerio Público para deslinde de responsabilidades en urgencias.",
      "Límites del servicio: Trabajo Social no realiza cobranza coactiva ni sustituye funciones administrativas de ventanilla.",
    ],
    temasClave: [
      {
        tema: "Trámite de Pasajes para Traslados Médicos Foráneos",
        referencia: "Gestión de Viáticos y Traslados",
        queEncontraras: "Requisitos de la hoja de referencia y plazos para autorizar boletos de transporte al paciente y acompañante cuando proceda.",
        relevancia: "destacada",
      },
      {
        tema: "Protocolo Legal de Alta Voluntaria",
        referencia: "Deslinde Médico-Legal",
        queEncontraras: "El llenado riguroso del documento donde el paciente asume la responsabilidad de su egreso tras ser informado de los riesgos.",
        relevancia: "alta",
      },
      {
        tema: "Notificación al Ministerio Público y DIF",
        referencia: "Casos de Violencia o Pacientes Vulnerables",
        queEncontraras: "El aviso inmediato por oficio oficial ante casos de sospecha de maltrato, abuso o abandono de menores y adultos mayores.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando familiares de un paciente requieran viáticos y pasajes para atenderse en otra entidad federativa.",
      "Ante el ingreso de pacientes lesionados por violencia o menores en situación de vulnerabilidad.",
      "Si un derechohabiente decide retirarse del hospital contra opinión médica.",
    ],
    ojoConEsto: [
      "En toda alta voluntaria, asegúrate de que el documento esté firmado por el paciente o tutor legal con dos testigos, especificando claramente que se les informaron los riesgos graves a la salud.",
      "Nunca retengas documentos personales originales de los derechohabientes.",
    ],
  },
  {
    documentId: "IMSS-2610-003-035",
    urlOficial: "https://dof.gob.mx/nota_detalle.php?codigo=715206&fecha=17/02/2003",
    aliasIds: [
      "2610-003-035",
      "limpieza-e-higiene",
      "intendencia",
      "rpbi",
      "manejo-residuos",
      "desinfeccion-hospitalaria",
      "doble-cubeta",
      "nom-087",
    ],
    tituloComun: "Procedimiento para la Limpieza, Desinfección Hospitalaria y Manejo de RPBI (Servicios Generales)",
    claveOficial: "NOM-087-SEMARNAT-SSA1-2002 / 2610-003-035",
    organizacion: "IMSS / Servicios Generales / Epidemiología",
    categoria: "flujos-clinicos",
    enUnaFrase: "Técnicas oficiales de sanitización hospitalaria, separación de basura biológico-infecciosa y protección al personal de intendencia.",
    preambulo: `Regula las labores del personal de Limpieza e Higiene para garantizar la asepsia hospitalaria y prevenir infecciones asociadas a la atención médica (IAAS), salvaguardando la salud del trabajador:

• Zonificación hospitalaria:
  - Áreas Críticas: Quirófanos, Terapia Intensiva, Tococirugía, Salas de Aislamiento y Urgencias de Choque. Desinfección exhaustiva programada y entre cirugías.
  - Áreas Semicríticas: Pisos de hospitalización, consultorios, curaciones y toma de muestras.
  - Áreas No Críticas: Oficinas administrativas, auditorios, salas de espera y pasillos.
• Técnicas de limpieza: Prohibición de barrido en seco en áreas clínicas (para no levantar aerosoles bacterianos); uso obligatorio de técnica de doble cubeta y trapeadores con código de color.
• Manejo de RPBI (NOM-087): Recolección y traslado seguro de bolsas rojas (sangre y gasas empapadas) y recipientes rígidos de punzocortantes (agujas, hojas de bisturí) al 80% de su capacidad.
• Derechos y EPP: Dotación obligatoria de botas de hule, guantes de nitrilo/neopreno de uso rudo, mandil impermeable, mascarilla y pago del concepto de infectocontagiosidad.`,
    aQuienAplica: [
      "Auxiliares de Limpieza e Higiene",
      "Operadores de Servicios Generales",
      "Jefes de Intendencia y Supervisión",
    ],
    aquiPuedesEncontrar: [
      "Diferencia entre limpieza rutinaria, terminal y exhaustiva por servicio médico.",
      "Colores y envasado de RPBI: bolsas rojas, bolsas amarillas y contenedores rígidos de punzocortantes.",
      "Derecho a negarse a manipular recipientes de punzocortantes desbordados o agujas sueltas fuera de contenedor.",
      "Reglas de lavado y desinfección de material según el tipo de desinfectante químico (hipoclorito, sales de amonio).",
    ],
    temasClave: [
      {
        tema: "Técnica de Doble Cubeta y Prohibición de Barrido en Seco",
        referencia: "Manual de Asepsia Hospitalaria",
        queEncontraras: "El uso obligatorio de agua jabonosa y agua clorada en cubetas separadas para no esparcir patógenos.",
        relevancia: "destacada",
      },
      {
        tema: "Manejo de RPBI y Contenedores Punzocortantes (NOM-087)",
        referencia: "Bioseguridad Ocupacional",
        queEncontraras: "El llenado máximo al 80% de recipientes rígidos y el traslado en carros herméticos exclusivos sin arrastrar bolsas.",
        relevancia: "alta",
      },
      {
        tema: "Limpieza Terminal en Quirófanos y Salas de Aislamiento",
        referencia: "Protocolo Epidemiológico",
        queEncontraras: "El procedimiento de lavado de paredes, techos, mesas quirúrgicas y lámparas antes de recibir al siguiente paciente.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si te ordenan limpiar áreas contaminadas o quirófanos sin proporcionarte guantes de uso rudo o cubrebocas adecuados.",
      "Si encuentras punzocortantes tirados en bolsas comunes de basura en lugar de sus recipientes rígidos oficiales.",
      "Para verificar los tiempos y frecuencia de limpieza exhaustiva asignados a tu turno.",
    ],
    ojoConEsto: [
      "Nunca comprimas las bolsas rojas de basura biológica con las manos o pies para hacer espacio; esto causa accidentes por punzocortantes que transmiten VIH y Hepatitis.",
      "No aceptes contenedores de punzocortantes que superen el 80% de su capacidad de llenado.",
    ],
  },
  {
    documentId: "IMSS-2430-003-019",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1832-003-004.pdf",
    aliasIds: [
      "2430-003-019",
      "farmacia",
      "despachador-farmacia",
      "receta-medica",
      "red-de-frio",
      "medicamentos-controlados",
      "peps",
      "estupefacientes",
    ],
    tituloComun: "Procedimiento para el Manejo, Almacenamiento y Surtimiento en Farmacias Hospitalarias y de UMF",
    claveOficial: "1832-003-004 / 2430-003-019",
    organizacion: "IMSS / Coordinación de Control de Abasto",
    categoria: "flujos-clinicos",
    enUnaFrase: "Reglas para el surtimiento de recetas médicas, control de psicotrópicos, red de frío y protección del despachador.",
    preambulo: `Norma la operación de las farmacias en Unidades de Medicina Familiar y Hospitales, garantizando la seguridad en la entrega de fármacos y respaldando legalmente al personal despachador:

• Recepción y validación de recetas: Cotejo de vigencia de la receta, nombre del paciente, número de seguridad social, firma y cédula del médico prescriptor.
• Medicamentos controlados (Grupos I, II y III): Registro obligatorio en libros oficiales de control con folio de receta y retención de la misma conforme a la Ley General de Salud.
• Monitoreo de Red de Frío: Registro gráfico diario de temperatura (entre 2°C y 8°C) en refrigeradores de biológicos, insulinas y hemoderivados.
• Almacenamiento PEPS: Primeras Entradas, Primeras Salidas para evitar el vencimiento de lotes en anaquel.`,
    aQuienAplica: [
      "Despachadores de Farmacia",
      "Oficiales de Almacén",
      "Jefes de Farmacia",
    ],
    aquiPuedesEncontrar: [
      "Pasos para validar recetas médicas digitales (código de barras) y recetas manuales oficiales.",
      "Protocolo legal para el despacho de narcóticos y psicotrópicos.",
      "Qué hacer ante medicamentos faltantes o desabasto institucional (sellado de receta no surtida).",
      "Monitoreo de termohidrómetros y red de frío para conservar la efectividad de medicamentos delicados.",
    ],
    temasClave: [
      {
        tema: "Control de Recetas y Fármacos Controlados (Grupos I, II y III)",
        referencia: "Ley General de Salud / Libros de Farmacia",
        queEncontraras: "El registro formal obligatorio y retención de la receta original para deslindar responsabilidad penal del despachador.",
        relevancia: "destacada",
      },
      {
        tema: "Control de Red de Frío (2°C a 8°C)",
        referencia: "Cadena de Frío Institucional",
        queEncontraras: "La bitácora de registro térmico dos veces por turno para insulinas, vacunas y factores de coagulación.",
        relevancia: "alta",
      },
      {
        tema: "Procedimiento ante Medicamentos No Disponibles (Vales y Sellado)",
        referencia: "Protocolo de Desabasto",
        queEncontraras: "La expedición de vale de canje o sello institucional de no existencia para orientación del paciente.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si un derechohabiente o médico exige la entrega de psicotrópicos sin receta oficial firmada o sin cédula visible.",
      "Si se interrumpe el suministro eléctrico y se pone en riesgo la red de frío de las insulinas o vacunas.",
      "Para conocer el procedimiento de sellado cuando un medicamento no se encuentra en inventario.",
    ],
    ojoConEsto: [
      "Nunca entregues medicamentos del Grupo I (estupefacientes) o Grupo II sin retener la receta original firmada; la falta de este soporte genera responsabilidad penal directa.",
      "Revisa siempre la fecha de caducidad antes de entregar cualquier frasco o blíster al derechohabiente.",
    ],
  },
  {
    documentId: "IMSS-2430-003-021",
    urlOficial: "https://dof.gob.mx/nota_detalle.php?codigo=5239855&fecha=27/03/2012",
    aliasIds: [
      "2430-003-021",
      "laboratorio-clinico",
      "quimico-clinico",
      "laboratorista",
      "banco-de-sangre",
      "flebotomia",
      "analisis-clinicos",
      "nom-007",
      "valores-panico",
    ],
    tituloComun: "Procedimiento para la Operación del Laboratorio Clínico y Banco de Sangre en Unidades Médicas",
    claveOficial: "NOM-007-SSA3-2011 / 2430-003-021",
    organizacion: "IMSS / DPM / Servicios Auxiliares de Diagnóstico",
    categoria: "flujos-clinicos",
    enUnaFrase: "Toma segura de muestras, procesamiento analítico, reporte de valores de alarma y bioseguridad del personal de laboratorio.",
    preambulo: `Define los procedimientos técnicos desde la toma de muestra hasta la emisión de resultados en análisis clínicos en los tres niveles de atención:

• Fase preanalítica: Flebotomía, etiquetado unívoco con código de barras en presencia del paciente, centrifugación oportuna y criterios de rechazo de muestras (hemolizadas, coaguladas o insuficientes).
• Fase analítica: Procesamiento en equipos automatizados en hematología, química clínica, urianálisis, coagulación, microbiología e inmunología; calibración diaria y control de calidad interno.
• Fase postanalítica: Notificación inmediata de 'Valores Críticos / De Pánico' (glucosa extrema, potasio letal, troponinas elevadas) vía telefónica directa al médico de urgencias o piso.
• Banco de Sangre y Medicina Transfusional: Pruebas cruzadas de compatibilidad, serología infecciosa obligatoria y fraccionamiento de hemoderivados.
• Protección laboral: Pago de concepto de infectocontagiosidad, descanso profiláctico en microbiología y banco de sangre, y dotación de equipo de bioseguridad.`,
    aQuienAplica: [
      "Químicos Clínicos / Químicos Farmacobiólogos",
      "Técnicos de Laboratorio",
      "Auxiliares de Laboratorio",
      "Personal de Banco de Sangre y Flebotomía",
    ],
    aquiPuedesEncontrar: [
      "Protocolo unívoco de identificación de tubos y muestras para evitar errores diagnósticos.",
      "Lista y rangos de valores críticos que obligan a llamada de alerta inmediata al médico tratante.",
      "Criterios técnicos para rechazar muestras mal tomadas o sin ayuno reglamentario.",
      "Medidas de bioseguridad en cabinas de flujo laminar y manejo de cultivos microbiológicos.",
      "Reglas de descansos profilácticos semestrales y compensación salarial por infecto.",
    ],
    temasClave: [
      {
        tema: "Identificación de Muestras y Criterios de Rechazo",
        referencia: "Fase Preanalítica",
        queEncontraras: "El etiquetado obligatorio frente al paciente y causales técnicas de rechazo por coagulación o hemólisis.",
        relevancia: "destacada",
      },
      {
        tema: "Reporte Telefónico Obligatorio de Valores de Pánico",
        referencia: "Fase Postanalítica de Urgencias",
        queEncontraras: "La llamada directa al médico tratante anotando hora y matrícula para salvar la vida del paciente crítico.",
        relevancia: "alta",
      },
      {
        tema: "Bioseguridad y Pruebas Cruzadas en Banco de Sangre",
        referencia: "Seguridad Transfusional",
        queEncontraras: "El descarte estricto de paquetes globulares no compatibles o seropositivos antes de su liberación.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si recibes una muestra sin membretar o con discrepancia de datos respecto a la orden médica.",
      "Para corroborar los límites de tiempo máximo de notificación de un valor de pánico en urgencias.",
      "Para exigir cabinas de bioseguridad funcionales y campanas de extracción en bacteriología.",
    ],
    ojoConEsto: [
      "Nunca proceses muestras biológicas sin identificación clara; un error de etiqueta puede ocasionar una transfusión incompatible o un tratamiento médico fatal.",
      "Todo reporte verbal de valor de pánico debe acompañarse de la anotación de nombre y matrícula del médico que recibió la llamada.",
    ],
  },
  {
    documentId: "IMSS-2430-003-027",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2660-003-045.pdf",
    aliasIds: [
      "2430-003-027",
      "urgencias",
      "triage",
      "codigo-rojo",
      "atencion-continua",
      "sala-choque",
      "semaforizacion-triage",
    ],
    tituloComun: "Procedimiento para la Atención en Urgencias y Operación del Sistema Triage IMSS",
    claveOficial: "2660-003-045 / 2430-003-027",
    organizacion: "IMSS / Dirección de Prestaciones Médicas",
    categoria: "flujos-clinicos",
    enUnaFrase: "Cómo se clasifican y atienden las urgencias médicas por código de color (Rojo a Azul) y tiempos máximos de respuesta.",
    preambulo: `Estandariza la recepción, evaluación y atención médica continua en los servicios de urgencias de clínicas de segundo y tercer nivel, coordinando a Asistentes Médicas, Enfermería, Médicos Urgencistas y Camilleros:

• Escala de Clasificación Triage (5 Niveles):
  - 🔴 Código Rojo (Reanimación / Paro): Compromiso vital inmediato; ingreso directo a Sala de Choque (tiempo de espera: 0 minutos).
  - 🟠 Código Naranja (Emergencia crítica): Riesgo potencial severo a órganos blanco (tiempo de espera: menor a 10 minutos).
  - 🟡 Código Amarillo (Urgencia calificada): Condición estable que requiere estudios y tratamiento (tiempo de espera: hasta 30 a 60 minutos).
  - 🟢 Código Verde (Urgencia no calificada): Padecimiento menor sin compromiso orgánico (tiempo de espera: hasta 120-180 minutos).
  - 🔵 Código Azul (No urgente): Pacientes con trámites o enfermedades crónicas no agudizadas (canalización a consulta de Medicina Familiar o Unifila).

• Coordinación multidisciplinaria: Trabajo sincronizado entre Asistente Médica en ventanilla, Enfermera de Triage para signos vitales, Médico Clasificador y Camillero para traslados expeditos.`,
    aQuienAplica: [
      "Médicos Urgencistas",
      "Médicos Generales de Urgencias",
      "Enfermeras de Triage",
      "Asistentes Médicas de Urgencias",
      "Camilleros de Urgencias",
    ],
    aquiPuedesEncontrar: [
      "Parámetros clínicos y escalas para clasificar a cada paciente en el color correspondiente.",
      "Protocolo de apertura de la Sala de Choque y Código Rojo (reanimación cardiopulmonar).",
      "Tiempos estándar máximos de atención que respaldan al personal ante reclamos de familiares.",
      "Mecanismo de derivación a consulta de Medicina Familiar para códigos verdes y azules.",
    ],
    temasClave: [
      {
        tema: "Escala Cromática de 5 Niveles del Triage IMSS",
        referencia: "Criterios de Clasificación Clínica",
        queEncontraras: "La definición exacta de Rojo, Naranja, Amarillo, Verde y Azul para priorizar vidas por gravedad y no por orden de llegada.",
        relevancia: "destacada",
      },
      {
        tema: "Protocolo de Sala de Choque (Código Rojo)",
        referencia: "Atención Inmediata de Reanimación",
        queEncontraras: "El paso expedito a sala de reanimación sin trámites de ventanilla previos para pacientes con paro o choque.",
        relevancia: "alta",
      },
      {
        tema: "Respaldo Legal ante Quejas por Tiempos de Espera",
        referencia: "Marco Normativo del Triage",
        queEncontraras: "El fundamento oficial que avala que los casos no graves (Verde/Azul) esperen mientras se salvan vidas críticas.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Ante la llegada de pacientes graves o politraumatizados para activar la cadena de respuesta inmediata.",
      "Para explicar a familiares de pacientes clasificados como verde o azul los criterios de prioridad médica y tiempos de espera.",
      "Si directivos intentan sancionar por demoras en la atención en salas de espera sobrepobladas.",
    ],
    ojoConEsto: [
      "La clasificación de Triage es una valoración médica y de enfermería profesional: ningún personal administrativo puede reclasificar a un paciente por presión de familiares.",
      "Todo paciente en sala de espera clasificado como amarillo o verde debe ser reevaluado periódicamente si manifiesta cambio en su estado de conciencia o signos vitales.",
    ],
  },
  {
    documentId: "IMSS-2610-003-012",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2660-003-019.pdf",
    aliasIds: [
      "2610-003-012",
      "nutricion",
      "dietetica",
      "nutricionista",
      "auxiliar-nutricion",
      "dietas-hospitalarias",
      "lactario",
      "nom-251",
    ],
    tituloComun: "Procedimiento para el Servicio de Nutrición y Dietética en Hospitales de Segundo y Tercer Nivel",
    claveOficial: "2660-003-019 / 2610-003-012",
    organizacion: "IMSS / DPM / Nutrición y Dietética",
    categoria: "flujos-clinicos",
    enUnaFrase: "Elaboración del censo dietético, preparación de fórmulas terapéuticas, lactarios y entrega de charolas a pacientes.",
    preambulo: `Regula la alimentación intrahospitalaria, cálculo de nutrientes y manipulación higiénica de alimentos para acelerar la recuperación de pacientes encamados:

• Censo dietético diario: Cotejo de dietas indicadas por los médicos tratantes en piso (líquida, blanda, para diabético, hiposódica, hiperproteica, renal, etc.).
• Preparación higiénica (NOM-251): Control estricto de temperaturas de cocción y refrigeración, almacenamiento de víveres secos y congelados, y desinfección de frutas y verduras.
• Lactarios y Fórmulas Enterales: Preparación en ambiente aséptico de sucedáneos de leche materna y nutrición enteral por sonda.
• Distribución de charolas: Entrega en carros térmicos a piso en horarios estipulados y recolección higiénica de loza sucia con desinfección de charolas.`,
    aQuienAplica: [
      "Nutricionistas Dietistas",
      "Especialistas en Nutrición",
      "Auxiliares de Servicios de Nutrición y Dietética",
      "Cocineros y Manejadores de Alimentos",
    ],
    aquiPuedesEncontrar: [
      "Catálogo de dietas hospitalarias institucionales y sus especificaciones clínicas.",
      "Tiempos estándar para la entrega de charolas por turno (desayuno, comida, cena y colaciones).",
      "Medidas de bioseguridad para el manejo de fórmulas enterales y banco de leche materna.",
      "Derecho a uniformes térmicos e indumentaria de cocina impermeable y calzado antiderrapante.",
    ],
    temasClave: [
      {
        tema: "Catálogo de Dietas Terapéuticas Hospitalarias",
        referencia: "Prescripción Dietética",
        queEncontraras: "Las características de dietas especiales para diabéticos, nefrópatas, postquirúrgicos y pacientes con disfagia.",
        relevancia: "destacada",
      },
      {
        tema: "Operación Aséptica de Lactarios y Fórmulas Enterales",
        referencia: "Nutrición Especializada",
        queEncontraras: "El protocolo de preparación estéril de fórmulas para recién nacidos y pacientes con nutrición por sonda.",
        relevancia: "alta",
      },
      {
        tema: "Higiene y Control Térmico en Cocinas (NOM-251)",
        referencia: "Inocuidad Alimentaria",
        queEncontraras: "El control diario de temperaturas en cámaras frigoríficas y cocción para evitar brotes infecciosos hospitalarios.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si el médico de piso cambia la dieta de un paciente después del corte del censo dietético matutino.",
      "Para conocer las medidas de protección e higiene que la unidad debe proveer en cocinas y cámaras frías.",
      "Para evitar la entrega de charolas en áreas de aislamiento sin el equipo de protección correspondiente.",
    ],
    ojoConEsto: [
      "Toda charola debe llevar la tarjeta identificadora con nombre del paciente, cama, servicio y tipo de dieta; una dieta equivocada en un paciente diabético o alérgico es causa de responsabilidad grave.",
      "No permitas el ingreso a la cocina a personal sin red para el cabello, cofia o cubrebocas reglamentario.",
    ],
  },
  {
    documentId: "IMSS-2610-003-025",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2430-A03-042.pdf",
    aliasIds: [
      "2610-003-025",
      "ceye",
      "esterilizacion",
      "autoclave",
      "instrumental-quirurgico",
      "bultos-quirurgicos",
      "indicadores-biologicos",
    ],
    tituloComun: "Procedimiento para la Operación de la Central de Equipos y Esterilización (CEYE)",
    claveOficial: "2430-A03-042 / 2610-003-025",
    organizacion: "IMSS / DPM / Enfermería y Quirófanos",
    categoria: "flujos-clinicos",
    enUnaFrase: "Lavado, empaque, esterilización por autoclave y control biológico del instrumental quirúrgico de hospitales.",
    preambulo: `Estandariza los procesos de la CEYE para garantizar que todo el material, ropa quirúrgica e instrumental utilizado en quirófanos y procedimientos invasivos esté 100% libre de microorganismos:

• Zonificación técnica estricta:
  - Área Roja (Contaminada): Recepción, desarticulación, lavado manual o ultrasónico y descontaminación de instrumental sucio.
  - Área Azul (Limpia): Inspección, ensamble, empaque en papel grado médico o cajas metálicas y colocación de testigos químicos internos y externos.
  - Área Verde (Estéril): Descarga de autoclaves de vapor o plasma de gas de peróxido de hidrógeno, almacenamiento en anaqueles cerrados y distribución a quirófano.
• Control de esterilización: Monitoreo de ciclos de autoclave con indicadores físicos (presión y temperatura), químicos (cintas testigo) y biológicos (esporas) semanales obligatorios.
• Protección del trabajador: Ropa de protección térmica para descarga de autoclaves, guantes de nitrilo de manga larga, protección ocular y concepto salarial de infectocontagiosidad.`,
    aQuienAplica: [
      "Enfermeras Especialistas en Quirófano/CEYE",
      "Enfermeras Generales asignadas a CEYE",
      "Auxiliares de Enfermería en CEYE",
    ],
    aquiPuedesEncontrar: [
      "Parámetros de tiempo, temperatura y presión para cada ciclo de autoclave a vapor o calor seco.",
      "Protocolo ante fallo de indicador biológico: suspensión inmediata del autoclave y retiro de bultos.",
      "Reglas de empaque y caducidad de bultos estériles según el tipo de envoltura.",
      "Medidas de prevención de quemaduras y ergonomía en la descarga de carros de esterilización.",
    ],
    temasClave: [
      {
        tema: "Separación Estricta de Áreas: Roja, Azul y Verde",
        referencia: "Flujo Unidireccional Aséptico",
        queEncontraras: "La prohibición de cruzar material sucio con limpio y el sentido único de avance hacia el área estéril.",
        relevancia: "destacada",
      },
      {
        tema: "Validación de Autoclaves con Indicadores Biológicos",
        referencia: "Garantía de Esterilidad Quirúrgica",
        queEncontraras: "El cultivo semanal de esporas para avalar que los autoclaves realmente destruyen todos los microorganismos.",
        relevancia: "alta",
      },
      {
        tema: "Protección Térmica y Ergonomía del Personal de CEYE",
        referencia: "Salud y Seguridad en Quirófanos",
        queEncontraras: "El uso obligatorio de guantes térmicos especiales y tiempos de enfriamiento para evitar quemaduras graves.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si un indicador químico no vira de color al salir del autoclave para rechazar el lote y evitar infecciones quirúrgicas.",
      "Para verificar los tiempos de caducidad de paquetes de gasas o apósitos esterilizados almacenados en repisas.",
      "Si las autoclaves presentan fugas de vapor o fallas en los manómetros de presión.",
    ],
    ojoConEsto: [
      "Nunca liberes material estéril para cirugía si el indicador químico no viró completamente o si el paquete presenta humedad o roturas.",
      "Espera siempre el tiempo de enfriamiento reglamentario antes de manipular las canastillas metálicas para prevenir quemaduras de segundo grado.",
    ],
  },
  {
    documentId: "IMSS-1A74-003-AUO",
    urlOficial: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    aliasIds: [
      "1a74-003-auo",
      "auo",
      "profesiogramas",
      "profesiograma",
      "auxiliar-universal-de-oficinas",
      "oficial-administrativo",
      "administrativo",
      "tramites-administrativos",
      "ventanilla-imss",
      "oficinista",
      "capturista",
    ],
    tituloComun: "Manual de Organización y Procedimientos del Auxiliar Universal de Oficinas (AUO) y Rama Administrativa",
    claveOficial: "Profesiograma Administrativo CCT",
    organizacion: "IMSS / Coordinación de Recursos Humanos y Organización",
    categoria: "administrativos",
    enUnaFrase: "Qué le corresponde y qué límites tiene el AUO en ventanillas, captura de datos, trámites y áreas operativas.",
    preambulo: `Regula las funciones y responsabilidades del personal administrativo en subdelegaciones, delegaciones, hospitales y unidades de medicina familiar:

• Actividades principales: Recepción, cotejo, folio y sellado de documentación de derechohabientes y patrones; captura de datos en sistemas institucionales (SIAP, SIMF, SUA, IDSE, PREI); archivo y foliación de expedientes administrativos; atención al público en ventanillas de trámite.
• Límites de responsabilidad: El AUO es personal de apoyo operativo y técnico; no toma decisiones discrecionales que impliquen dictámenes jurídicos, peritajes o auditorías fiscales. No debe asumir funciones de jefatura sin nombramiento oficial de interinato o compensación correspondiente.
• Derechos y ergonomía: Mobiliario ergonómico con asiento regulable y respaldo (cumplimiento de Ley Silla y NOM-036), descansos visuales en jornadas intensivas de cómputo, y dotación patronal de insumos de papelería e informática.`,
    aQuienAplica: [
      "Auxiliares Universales de Oficinas (AUO)",
      "Oficiales Administrativos",
      "Secretarias y Capturistas",
      "Personal Administrativo en General",
    ],
    aquiPuedesEncontrar: [
      "Catálogo oficial de actividades del AUO según el profesiograma pactado CCT-SNTSS.",
      "Tiempos estándar de captura y atención ciudadana en ventanillas.",
      "Protocolo ante fallas técnicas de red, impresoras o corte de energía eléctrica.",
      "Derecho a no ser responsabilizado por rezagos derivados de falta de equipo, insumos o caída del sistema central.",
    ],
    temasClave: [
      {
        tema: "Profesiograma del AUO y Funciones Asignadas",
        referencia: "Catálogo de Puestos CCT-SNTSS",
        queEncontraras: "Las actividades específicas de captura, archivo y ventanilla que legalmente corresponden a la categoría.",
        relevancia: "destacada",
      },
      {
        tema: "Delimitación de Responsabilidades: Apoyo vs. Decisión de Mando",
        referencia: "Marco Jurídico Administrativo",
        queEncontraras: "El respaldo normativo que impide que te hagan responsable por decisiones discrecionales o fiscales que tocan a directivos.",
        relevancia: "alta",
      },
      {
        tema: "Salud Laboral: Ergonomía y Descansos de Pantalla",
        referencia: "NOM-036-1-STPS / Ley Silla",
        queEncontraras: "El derecho a pausas activas y mobiliario adecuado para evitar el síndrome del túnel carpiano y dolor lumbar.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si te exigen firmar o autorizar documentos que corresponden a jefes de oficina o auditores.",
      "Cuando la jefatura intente cambiarte de adscripción o área de trabajo sin acuerdo sindical ni justificación de plantilla.",
      "Para exigir equipo de cómputo funcional y asiento ergonómico.",
    ],
    ojoConEsto: [
      "Nunca prestes tus credenciales de acceso ni contraseña personal a ningún compañero o jefe; todo movimiento en los sistemas queda grabado bajo tu matrícula.",
      "Revisa siempre que todo documento recibido cuente con sello de recepción fechado y legible.",
    ],
  },
  {
    documentId: "IMSS-2430-003-016",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2430-003-016.pdf",
    aliasIds: [
      "2430-003-016",
      "arimac",
      "archivo-clinico",
      "expediente-clinico",
      "manejador-de-archivo",
      "depuracion-expedientes",
      "prestamo-expedientes",
      "nom-004",
    ],
    tituloComun: "Procedimiento para la Operación del Archivo Clínico (ARIMAC) en Hospitales y UMF",
    claveOficial: "2430-003-016 / NOM-004-SSA3-2012",
    organizacion: "IMSS / DPM / Servicios de Información y Archivo",
    categoria: "administrativos",
    enUnaFrase: "Resguardo, préstamo, localización, confidencialidad y depuración técnica de los expedientes clínicos del IMSS.",
    preambulo: `Estandariza la organización, custodia legal y flujo continuo de los expedientes clínicos en unidades de primer, segundo y tercer nivel:

• Recepción y localización: Clasificación numérica por sistema decimal o dígito terminal con base en el NSS; surtimiento oportuno a Consulta Externa, Urgencias y Hospitalización con vale de préstamo oficial (Tarjeta de salida).
• Confidencialidad y custodia legal (NOM-004-SSA3-2012 / LFPDPPP): El expediente clínico es propiedad institucional y contiene información confidencial de salud del derechohabiente. Nadie puede sustraerlo ni fotocopiarlo sin orden judicial escrita o solicitud de peritaje médico-legal avalada por la Dirección de la unidad.
• Depuración y archivo pasivo: Conservación obligatoria por un mínimo de 5 años contados a partir de la última fecha de atención médica antes de su pase a archivo pasivo o microfilme/digitalización.
• Ergonomía en estantería: Uso de escaleras de tijera de seguridad para estantes altos, carritos portadocumentos y guantes para evitar cortes con papel y alergias por polvo acumulado.`,
    aQuienAplica: [
      "Manejadores de Archivo Clínico (ARIMAC)",
      "Oficiales de Archivo",
      "Jefes de ARIMAC y Archivo General",
    ],
    aquiPuedesEncontrar: [
      "Procedimiento de entrega y recepción de expedientes mediante tarjeta de control.",
      "Protocolo ante extravío temporal de un expediente: búsqueda exhaustiva y apertura reglamentaria de expediente duplicado provisional.",
      "Reglas de confidencialidad y sanciones legales por filtración de datos sensibles.",
      "Plazos obligatorios de retención y proceso de depuración documental.",
    ],
    temasClave: [
      {
        tema: "Control de Préstamos y Tarjetas de Salida",
        referencia: "Flujo Documental de ARIMAC",
        queEncontraras: "El registro formal obligatorio de quién tiene físicamente el expediente para evitar extravíos y responsabilidades.",
        relevancia: "destacada",
      },
      {
        tema: "Confidencialidad Médica y Blindaje Legal (NOM-004)",
        referencia: "Protección de Datos Personales en Salud",
        queEncontraras: "La prohibición de prestar expedientes a personas ajenas sin oficio ministerial o directivo que lo avale.",
        relevancia: "alta",
      },
      {
        tema: "Conservación Mínima de 5 Años y Archivo Pasivo",
        referencia: "Depuración Técnica Reglamentaria",
        queEncontraras: "Los tiempos oficiales de guarda activa antes de enviar expedientes antiguos a concentración o digitalización.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si un médico, abogado o directivo exige la entrega física de un expediente sin firmar la tarjeta de resguardo.",
      "Cuando una autoridad ministerial o judicial solicite copias de un expediente clínico para verificar el conducto oficial.",
      "Para fundamentar la necesidad de escaleras de tijera certificadas y carritos de transporte en tu área.",
    ],
    ojoConEsto: [
      "Bajo ninguna circunstancia entregues un expediente clínico a un paciente o familiar directamente; el expediente solo viaja entre el personal de salud autorizado.",
      "Exige siempre la firma de acuse de quien recibe el expediente en piso o consultorio para deslindarte de pérdidas.",
    ],
  },
  {
    documentId: "IMSS-4130-003-005",
    urlOficial: "https://www.imss.gob.mx/derechohabientes/vigencia-derechos",
    aliasIds: [
      "4130-003-005",
      "afiliacion-vigencia",
      "vigencia-de-derechos",
      "asegurados",
      "subdelegacion",
      "acreditacion-derechos",
      "adscripcion-clinica",
      "constancia-semanas",
    ],
    tituloComun: "Procedimiento para la Acreditación de Vigencia de Derechos y Registro de Asegurados",
    claveOficial: "IMSS-02-020-B",
    organizacion: "IMSS / Dirección de Incorporación y Recaudación (DIR)",
    categoria: "administrativos",
    enUnaFrase: "Altas, bajas, asignación de clínica, acreditación de beneficiarios y expedición de constancias de semanas cotizadas.",
    preambulo: `Regula la atención ventanilla para el registro patronal, aseguramiento de trabajadores y acreditación del derecho a las prestaciones médicas y económicas de la Ley del Seguro Social:

• Acreditación y alta: Cotejo de CURP, NSS, comprobante de domicilio y actas de nacimiento/matrimonio para registro de beneficiarios (esposa/esposo, concubina/concubino, hijos y padres dependientes).
• Asignación de UMF y turno: Vinculación geográfica del derechohabiente a su unidad médica más cercana según código postal y disponibilidad de cupo.
• Constancias oficiales: Emisión de constancias de semanas cotizadas, reconocimientos de derechos (conservación de derechos conforme al Art. 150 LSS) y regularización de homonimias o duplicidad de NSS.
• Protección del trabajador ventanillero: Tiempos de atención fijados, respeto a los requisitos reglamentarios y respaldo ante derechohabientes molestos por faltantes de documentos oficiales.`,
    aQuienAplica: [
      "Auxiliares Universales de Oficinas de Afiliación-Vigencia",
      "Operadores de Ventanilla en Subdelegaciones y UMF",
      "Jefes de Afiliación y Cobranza",
    ],
    aquiPuedesEncontrar: [
      "Lista oficial de documentos exigibles por ley para cada tipo de trámite de beneficiario.",
      "Trámite de conservación de derechos para trabajadores dados de baja (Art. 150 LSS).",
      "Protocolo para corrección de datos patronales y regularización de semanas cotizadas.",
      "Qué hacer ante discrepancias de CURP o doble asignación de Número de Seguridad Social.",
    ],
    temasClave: [
      {
        tema: "Registro y Alta de Beneficiarios Legales",
        referencia: "Artículos 84 y 85 de la Ley del Seguro Social",
        queEncontraras: "Los requisitos exactos para registrar a cónyuges, concubinas(os), hijos estudiantes y padres.",
        relevancia: "destacada",
      },
      {
        tema: "Período de Conservación de Derechos (Art. 150 LSS)",
        referencia: "Cobertura Post-Baja Laboral",
        queEncontraras: "El derecho a seguir recibiendo atención médica y maternidad durante 8 semanas después de la baja del empleo.",
        relevancia: "alta",
      },
      {
        tema: "Corrección de Homonimias y Duplicidad de NSS",
        referencia: "Unificación de Cuentas Individuales",
        queEncontraras: "El trámite institucional para separar o fusionar números de seguridad social erróneos.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si un usuario te exige dar de alta a un familiar sin los documentos oficiales requeridos por ley.",
      "Para corroborar si un derechohabiente dado de baja laboral aún se encuentra dentro de su período de conservación de derechos.",
      "Ante quejas ciudadanas por demoras en la actualización de semanas cotizadas en sistema.",
    ],
    ojoConEsto: [
      "Nunca alteres datos de filiación o fecha de nacimiento sin el dictamen formal de corrección emitido por la subdelegación.",
      "Verifica siempre la validez de las actas de matrimonio y actas testimoniales de concubinato para evitar responsabilidades por altas irregulares.",
    ],
  },
  {
    documentId: "IMSS-1A11-003-012",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/1832-003-001.pdf",
    aliasIds: [
      "1a11-003-012",
      "almacen",
      "almacenista",
      "auxiliar-almacen",
      "control-abasto",
      "recepcion-bienes",
      "peps-almacen",
      "inventario-fisico",
      "tarimas-estiba",
    ],
    tituloComun: "Procedimiento para el Almacenamiento, Control y Distribución de Bienes de Consumo en Almacenes IMSS",
    claveOficial: "1832-003-001 / 1A11-003-012",
    organizacion: "IMSS / Coordinación de Control de Abasto y Suministros",
    categoria: "administrativos",
    enUnaFrase: "Recepción de mercancía, cotejo de remisiones, estiba segura de tarimas, inventarios y distribución a farmacias y servicios.",
    preambulo: `Estandariza la logística de insumos médicos, medicamentos, material de curación, papelería y víveres en almacenes delegacionales y de unidades operativas:

• Recepción técnica y cotejo: Revisión física de cajas, lotes, caducidades mínimas (mínimo 18 a 24 meses o carta compromiso del proveedor) contra remisión y contrato de compra.
• Muestreo y control de calidad: Verificación de empaques secundarios, sellos inviolados y reporte inmediato de lotes sospechosos a Control Analítico.
• Estiba y seguridad física (NOM-006-STPS-2014): Reglas de apilamiento en racks y tarimas de madera/plástico; prohibición de estibas por encima de los límites de seguridad de carga. Pasillos libres de obstrucciones y uso obligatorio de montacargas o patines hidráulicos certificados.
• Distribución PEPS: Primeras Entradas, Primeras Salidas para evitar pérdidas financieras por caducidad en bodega.
• Derechos y EPP: Dotación de calzado con casquillo de acero o poliamida, faja de carga ergonómica, guantes de carnaza y chaleco reflejante.`,
    aQuienAplica: [
      "Almacenistas y Subalmacenistas",
      "Auxiliares de Almacén",
      "Operadores de Montacargas",
      "Oficiales de Suministros",
    ],
    aquiPuedesEncontrar: [
      "Criterios para rechazar entregas de proveedores por empaque dañado, caducidad corta o falta de código de barras.",
      "Protocolo oficial para la toma de inventarios físicos semestrales y anuales.",
      "Técnica de estiba segura en racks para prevenir aplastamiento o caídas de mercancía.",
      "Límites máximos de carga manual y uso indispensable de patines hidráulicos o montacargas.",
    ],
    temasClave: [
      {
        tema: "Cotejo de Remisión y Carta Compromiso de Caducidad",
        referencia: "Criterios de Recepción de Bienes",
        queEncontraras: "El derecho a rechazar lotes con fecha de caducidad menor a la requerida si el proveedor no entrega carta de canje.",
        relevancia: "destacada",
      },
      {
        tema: "Manejo Seguro de Cargas y Racks (NOM-006)",
        referencia: "Salud y Seguridad en Bodegas",
        queEncontraras: "Las alturas máximas de estiba y la separación de pasillos para evitar desplomes de tarimas pesadas.",
        relevancia: "alta",
      },
      {
        tema: "Inventarios Físicos y Conciliación en Sistema PREI",
        referencia: "Control Contable de Existencias",
        queEncontraras: "El deslinde de responsabilidad del almacenista ante mermas justificadas por roturas o caducidades de origen.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si un proveedor entrega cajas violadas, golpeadas o con caducidad inferior a la contratada.",
      "Si te ordenan descargar tarimas de tonelaje excesivo sin equipo hidráulico o mecánico funcional.",
      "Para la conciliación de diferencias físicas contra el sistema de inventarios PREI.",
    ],
    ojoConEsto: [
      "Nunca firmes de recibido de conformidad una remisión sin haber contado físicamente las cajas y revisado los números de lote y caducidades.",
      "No permitas la estiba de cajas a gran altura que sobrepase la línea de seguridad marcada en las paredes del almacén.",
    ],
  },
  {
    documentId: "IMSS-1A13-003-006",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/14C2-003-001.pdf",
    aliasIds: [
      "1a13-003-006",
      "conservacion",
      "mantenimiento",
      "electricista",
      "plomero",
      "calderas",
      "gases-medicinales",
      "planta-emergencia",
      "climatizacion",
      "nom-020",
    ],
    tituloComun: "Procedimiento para el Mantenimiento Preventivo y Correctivo a Instalaciones y Equipo Electromecánico",
    claveOficial: "14C2-003-001 / 1A13-003-006",
    organizacion: "IMSS / Coordinación de Infraestructura y Mantenimiento",
    categoria: "administrativos",
    enUnaFrase: "Operación de calderas, plantas de emergencia eléctrica, gases medicinales (oxígeno) y climatización hospitalaria.",
    preambulo: `Regula la operación técnica y mantenimiento que mantiene vivos los hospitales y clínicas del IMSS:

• Gases medicinales (Oxígeno, Aire Medicinal, Vacío): Monitoreo permanente de presiones en manifold y tanques criogénicos; pruebas de fuga y cambio seguro de cilindros a alta presión.
• Planta de Emergencia Eléctrica: Pruebas semanales en vacío y con carga para garantizar el suministro ininterrumpido en Quirófanos, UCI y Choque ante fallas de CFE.
• Cuarto de Calderas y Vapor: Purga diaria, control de nivel de agua, presostatos de seguridad y ablandadores de agua conforme a la NOM-020-STPS-2011 (recipientes sujetos a presión).
• Sistemas de Climatización y Flujo Laminar: Presión positiva y filtros HEPA en Quirófanos para evitar contaminación biológica intrahospitalaria.
• Derechos y EPP del técnico: Herramientas dieléctricas certificadas para electricistas, calzado de seguridad dieléctrico, caretas para soldador, guantes para calor en calderas, arneses de línea de vida para trabajos en altura (NOM-009) y pago de conceptos de alto riesgo.`,
    aQuienAplica: [
      "Oficiales de Servicios Técnicos de Conservación",
      "Electricistas y Técnicos en Clima",
      "Plomeros y Fontaneros",
      "Operadores de Calderas y Soldadores",
    ],
    aquiPuedesEncontrar: [
      "Bitácora obligatoria de presiones de oxígeno medicinal y pruebas de transferencia de planta de luz.",
      "Parámetros de purga y seguridad en calderas de vapor para evitar explosiones.",
      "Protocolo para libranzas eléctricas programadas y bloqueo/etiquetado (LOTO) antes de reparar transformadores.",
      "Derecho a negarse a intervenir líneas vivas de alta tensión sin el equipo de aislamiento reglamentario.",
    ],
    temasClave: [
      {
        tema: "Monitoreo Continuo de Oxígeno y Gases Medicinales",
        referencia: "Seguridad Hospitalaria Vital",
        queEncontraras: "El cambio preventivo de bancos de cilindros antes de que la presión descienda de las 500 PSI de reserva.",
        relevancia: "destacada",
      },
      {
        tema: "Operación Segura de Calderas y Recipientes a Presión (NOM-020)",
        referencia: "Prevención de Siniestros Térmicos",
        queEncontraras: "Las pruebas diarias de válvulas de seguridad de vapor y dosificación de productos químicos desincrustantes.",
        relevancia: "alta",
      },
      {
        tema: "Procedimiento de Bloqueo y Etiquetado LOTO",
        referencia: "Seguridad Eléctrica Industrial",
        queEncontraras: "El corte físico de interruptores con candado personal antes de intervenir motores, tableros o bombas de agua.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si los manómetros del manifold de oxígeno caen a niveles de alarma y la jefatura médica no ha sido alertada.",
      "Si te ordenan reparar tableros eléctricos energizados sin guantes dieléctricos ni tapetes aislantes.",
      "Para verificar los programas de mantenimiento preventivo calendarizados en tu unidad.",
    ],
    ojoConEsto: [
      "Nunca realices maniobras en tableros de media o alta tensión en solitario; siempre debe haber un compañero técnico de apoyo capacitado en primeros auxilios y rescate eléctrico.",
      "Verifica siempre las válvulas de alivio de las calderas antes de iniciar el encendido de quemadores.",
    ],
  },
  {
    documentId: "IMSS-1A13-003-015",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/14E1-003-017.pdf",
    aliasIds: [
      "1a13-003-015",
      "ambulancia",
      "chofer",
      "chofer-de-ambulancia",
      "traslado-foraneo",
      "nom-034",
      "parque-vehicular",
      "bitacora-gasolina",
      "codigo-rojo-ambulancia",
    ],
    tituloComun: "Procedimiento para la Operación, Mantenimiento y Control de Ambulancias y Vehículos del IMSS",
    claveOficial: "14E1-003-017 / 1A13-003-015",
    organizacion: "IMSS / Coordinación de Servicios Generales y Transportes",
    categoria: "administrativos",
    enUnaFrase: "Conducción segura de ambulancias, sirena y códigos de emergencia, bitácora de combustible y mantenimiento vehicular.",
    preambulo: `Regula el servicio de transportación terrestre de pacientes, personal y carga institucional:

• Operación de ambulancias de urgencias (NOM-034-SSA3-2013): Traslado seguro de pacientes críticos y no críticos; activación responsable de torreta y sirena únicamente durante traslados de urgencia calificada con paciente a bordo o en trayecto inmediato a rescate.
• Revisión mecánica previa al turno (Checklist vehicular): Verificación diaria de niveles de aceite, frenos, presión de llantas (incluyendo refacción funcional), tanque de combustible lleno y funcionamiento de luces de emergencia.
• Equipamiento rodante de ambulancia: Verificación de sujeción hermética de tanques de oxígeno fijos y portátiles, camilla rodante de tijera con arnés de seguridad de tres puntos y tomas eléctricas operativas para monitores médicos.
• Control y protección del operador: Registro de kilometraje en bitácora oficial, vales de combustible autorizados, póliza de seguro vehicular vigente en cabina y pago de viáticos en traslados foráneos (Cláusula 99 CCT).`,
    aQuienAplica: [
      "Choferes de Ambulancia",
      "Operadores de Vehículos de Carga y Pasaje",
      "Mecánicos del Parque Vehicular Institucional",
    ],
    aquiPuedesEncontrar: [
      "Checklist matutino obligatorio para entrega y recepción de la ambulancia.",
      "Protocolo de velocidad y paso preferencial en cruces viales bajo código rojo.",
      "Derecho a negarse a sacar a carretera vehículos con llantas lisas, frenos desgastados o sin seguro de daños a terceros.",
      "Reglas para el cobro de pasajes y alimentos en traslados médicos foráneos de larga distancia.",
    ],
    temasClave: [
      {
        tema: "Conducción Defensiva y Uso Reglamentario de Sirena (NOM-034)",
        referencia: "Seguridad Vial y Urgencias",
        queEncontraras: "El uso ético de códigos sonoros y luminosos exclusivamente en situaciones de riesgo vital acreditadas.",
        relevancia: "destacada",
      },
      {
        tema: "Sujeción de Camilla y Tanques de Oxígeno Asistenciales",
        referencia: "Seguridad del Paciente a Bordo",
        queEncontraras: "La fijación hermética de la camilla rodante al chasis y amarre de cilindros para evitar proyectiles en frenadas bruscas.",
        relevancia: "alta",
      },
      {
        tema: "Póliza de Seguro y Viáticos Foráneos (Cláusula 99 CCT)",
        referencia: "Derechos Laborales del Chofer",
        queEncontraras: "El pago íntegro adelantado o por reembolso de viáticos para combustible, casetas y alimentos en comisiones foráneas.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si una jefatura pretende obligarte a manejar una ambulancia con fallas mecánicas en frenos o dirección.",
      "Ante un percance vial durante un traslado para coordinar el peritaje y asistencia jurídica del Instituto.",
      "Para verificar los montos de viáticos que te corresponden por traslados foráneos fuera de tu zona.",
    ],
    ojoConEsto: [
      "Nunca circules con una ambulancia que no tenga la póliza de seguro vigente en la guantera; en caso de accidente sin póliza el chofer queda en estado de indefensión legal.",
      "Revisa siempre que la camilla rodante quede trabada en el riel de fijación del piso antes de cerrar las puertas y arrancar.",
    ],
  },
  {
    documentId: "IMSS-1A52-003-002",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/GC10-003-001.pdf",
    aliasIds: [
      "1a52-003-002",
      "taod",
      "atencion-al-derechohabiente",
      "orientacion-al-derechohabiente",
      "quejas-medicas",
      "modulo-atencion",
      "satisfaccion-usuario",
      "siam",
    ],
    tituloComun: "Procedimiento para la Atención de Quejas, Peticiones y Orientación a la Derechohabiencia (TAOD)",
    claveOficial: "GC10-003-001 / 1A52-003-002",
    organizacion: "IMSS / Coordinación de Atención y Orientación al Derechohabiente",
    categoria: "administrativos",
    enUnaFrase: "Gestión de quejas de servicio, peticiones ciudadanas, orientación médica y resolución pacífica de conflictos en unidades.",
    preambulo: `Estandariza la labor de las compañeras TAOD en módulos de hospitales y clínicas para mediar, canalizar inconformidades y garantizar el trato digno:

• Atención y gestión inmediata: Recepción de solicitudes de orientación sobre trámites médicos y administrativos; gestión directa con directivos para agilizar citas rezagadas, estudios suspendidos o surtimiento de recetas no disponibles.
• Registro formal de quejas: Captura en el Sistema Institucional de Quejas y Peticiones (SIAM) con folio oficial y seguimiento con áreas médicas para respuesta fundada en plazos estipulados.
• Acompañamiento humanista: Apoyo directo a personas de la tercera edad, personas con discapacidad o de comunidades indígenas en su tránsito por la unidad médica.
• Protección laboral del personal TAOD: El TAOD no es responsable de las fallas operativas o desabastos de la unidad; su función es de intermediación y gestión, contando con respaldo institucional ante agresiones verbales de derechohabientes.`,
    aQuienAplica: [
      "Técnicas de Atención y Orientación al Derechohabiente (TAOD)",
      "Coordinadoras Delegacionales de TAOD",
    ],
    aquiPuedesEncontrar: [
      "Pasos para desahogar y canalizar una petición ciudadana con los jefes de servicio de la unidad.",
      "Criterios para diferenciar una petición de gestión rápida de una queja administrativa formal.",
      "Protocolo de contención ante usuarios molestos o en crisis emocional.",
      "Límites del puesto: la TAOD gestiona soluciones pero no autoriza dictámenes médicos ni presupuestales.",
    ],
    temasClave: [
      {
        tema: "Sistema Institucional de Atención al Derechohabiente (SIAM)",
        referencia: "Captura y Seguimiento de Gestiones",
        queEncontraras: "El registro formal obligatorio con número de folio para evidenciar la productividad y seguimiento del caso.",
        relevancia: "destacada",
      },
      {
        tema: "Gestión Directa de Recetas No Surtidas y Citas Médicas",
        referencia: "Intermediación Inmediata con Directivos",
        queEncontraras: "La coordinación expedita con farmacia y subdirección médica para resolver problemáticas sin confrontación.",
        relevancia: "alta",
      },
      {
        tema: "Seguridad del Módulo y Protección ante Agresiones",
        referencia: "Protocolo de Seguridad Institucional",
        queEncontraras: "El derecho a solicitar apoyo inmediato del personal de vigilancia ante conatos de violencia o amenazas de usuarios.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando un derechohabiente inconforme exija levantar un acta administrativa contra personal de salud o ventanilla.",
      "Para conocer los tiempos de respuesta oficiales que marca la normativa ante peticiones ciudadanas.",
      "Si un usuario se torna violento en el módulo para activar el protocolo de seguridad institucional.",
    ],
    ojoConEsto: [
      "Todo caso gestionado debe contar con folio registrado en el sistema; las gestiones informales no generan antecedente para demostrar tu productividad ni te protegen ante aclaraciones.",
      "Mantén siempre la neutralidad institucional sin emitir juicios de valor sobre la atención de tus compañeros de trabajo.",
    ],
  },
  {
    documentId: "IMSS-1A61-003-004",
    urlOficial: "https://www.imss.gob.mx/conoce-al-imss/marco-normativo",
    aliasIds: [
      "1a61-003-004",
      "sistemas",
      "informatica",
      "soporte-tecnico",
      "redes",
      "computo",
      "impresoras-institucionales",
      "simf-soporte",
      "cuentas-imss",
    ],
    tituloComun: "Procedimiento para el Soporte Técnico, Mantenimiento de Hardware y Redes Institucionales",
    claveOficial: "1A61-003-004",
    organizacion: "IMSS / Dirección de Innovación y Desarrollo Tecnológico (DIDT)",
    categoria: "administrativos",
    enUnaFrase: "Mantenimiento de computadoras, redes, servidores locales, soporte al expediente electrónico y cuentas institucionales.",
    preambulo: `Regula el mantenimiento y continuidad operativa de la infraestructura informática y telecomunicaciones en unidades médicas y delegacionales:

• Atención a incidentes tecnológicos: Mantenimiento preventivo y correctivo a computadoras, impresoras de recetas y etiquetas, conmutadores y cableado estructurado.
• Soporte a sistemas clínicos y administrativos: Diagnóstico y restauración de enlaces con el SIMF, ECE, SIAP y bases de datos centrales ante caídas de enlace.
• Gestión de cuentas y seguridad de la información: Creación, reseteo de contraseñas y asignación de perfiles de usuario institucionales conforme a las políticas de seguridad de la información.
• Protección laboral: Derecho a herramienta especializada (probadores de red, ponchadoras, desarmadores de precisión), equipo de protección para trabajo en racks y no asumir responsabilidades por fallas atribuibles a los proveedores de telecomunicaciones nacionales.`,
    aQuienAplica: [
      "Operadores de Sistemas",
      "Técnicos de Soporte Informático",
      "Ingenieros de Redes y Telecomunicaciones",
    ],
    aquiPuedesEncontrar: [
      "Tiempos de respuesta para tickets de falla según el nivel de impacto (Servicio de Urgencias vs. Oficinas).",
      "Políticas de respaldo de bases de datos locales y contingencia ante virus o ransomware.",
      "Protocolo para el reemplazo de equipo de cómputo obsoleto o fuera de vida útil.",
      "Delimitación: los técnicos de informática no capturan datos ni realizan trámites administrativos de las áreas usuarias.",
    ],
    temasClave: [
      {
        tema: "Prioridad en Soporte a Sistemas Médicos (SIMF / ECE)",
        referencia: "Continuidad del Servicio Clínico",
        queEncontraras: "La atención inmediata preferente a consultorios médicos, urgencias y farmacia para evitar parálisis de consultas.",
        relevancia: "destacada",
      },
      {
        tema: "Seguridad de Cuentas y Políticas de Contraseñas",
        referencia: "Directrices de Ciberseguridad DIDT",
        queEncontraras: "Las reglas para no transferir perfiles administrativos y blindar el acceso a los datos de los derechohabientes.",
        relevancia: "alta",
      },
      {
        tema: "Resguardo de Bienes Informáticos y Baja de Equipos",
        referencia: "Control de Activo Fijo Tecnológico",
        queEncontraras: "El procedimiento para dictaminar la obsolescencia técnica de computadoras o impresoras descompuestas.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Cuando una unidad médica se quede sin conexión a la red central para documentar la contingencia.",
      "Si un jefe de área pretende ordenar que el personal de informática capture recetas o expedientes.",
      "Para solicitar refacciones, switches o cables certificados para el cableado estructurado.",
    ],
    ojoConEsto: [
      "Nunca instales software no autorizado o sin licencia en equipos institucionales; la DIDT audita periódicamente las máquinas y sanciona al técnico que instala programas piratas.",
      "Toda entrega o movimiento de computadoras o impresoras debe respaldarse con el resguardo de activo fijo debidamente firmado.",
    ],
  },
  {
    documentId: "IMSS-2430-003-033",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/0730-003-006.pdf",
    aliasIds: [
      "2430-003-033",
      "estomatologia",
      "asistente-dental",
      "dentista",
      "sillón-dental",
      "amalgamas",
      "nom-013",
      "esterilizacion-dental",
    ],
    tituloComun: "Procedimiento para la Atención Estomatológica en Unidades de Primer y Segundo Nivel",
    claveOficial: "0730-003-006 / 2430-003-033",
    organizacion: "IMSS / DPM / Estomatología",
    categoria: "administrativos",
    enUnaFrase: "Flujo del consultorio dental, preparación de instrumental, prevención de infecciones y protección biológica en odontología.",
    preambulo: `Estandariza la práctica clínica en consultorios dentales de UMF y hospitales, regulando la asistencia en sillón, manipulación de amalgamas y bioseguridad:

• Asistencia en sillón dental: Preparación de charolas de exploración, anestesia local, aislamiento del campo operatorio y entrega de instrumental en mano al médico estomatólogo.
• Control de infecciones y bioseguridad (NOM-013-SSA2-2015): Esterilización de piezas de mano (turbinas y micromotores) entre paciente y paciente; desinfección de mangueras de succión y escupidera con desinfectantes de nivel intermedio.
• Manejo seguro de mercurio y desechos dentales: Almacenamiento hermético de restos de amalgamas dentales bajo solución fijadora para evitar vapores tóxicos de mercurio en el consultorio.
• Derechos laborales: Uso obligatorio de careta de protección facial completa (por generación de aerosoles biológicos), cubrebocas de alta eficiencia, guantes de látex/nitrilo y concepto salarial de infectocontagiosidad.`,
    aQuienAplica: [
      "Asistentes Dentales",
      "Promotores de Estomatología",
      "Médicos Estomatólogos",
    ],
    aquiPuedesEncontrar: [
      "Técnica de esterilización en autoclave y desinfección del sillón y piezas de mano.",
      "Protocolo para la toma y revelado de radiografías dentales periapicales.",
      "Manejo seguro de cápsulas de amalgama y disposición final de residuos de mercurio.",
      "Derecho a suspender la atención si el compresor de aire está descompuesto o contamina el aire médico con aceite.",
    ],
    temasClave: [
      {
        tema: "Control de Aerosoles Biológicos y Esterilización (NOM-013)",
        referencia: "Bioseguridad en el Consultorio Dental",
        queEncontraras: "El uso indispensable de careta de policarbonato y autoclave para piezas rotatorias para evitar hepatitis y tuberculosis.",
        relevancia: "destacada",
      },
      {
        tema: "Manejo Hermético de Residuos de Amalgama",
        referencia: "Prevención de Toxicidad por Mercurio",
        queEncontraras: "El envasado seguro en frascos cerrados con solución para evitar que los vapores pesados dañen los pulmones del personal.",
        relevancia: "alta",
      },
      {
        tema: "Mantenimiento del Compresor y Líneas de Aire",
        referencia: "Infraestructura del Sillón Dental",
        queEncontraras: "El purgado diario de agua del compresor para garantizar aire limpio y libre de humedad a las turbinas.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Si el compresor de aire dental no cuenta con filtros desecadores o presenta fugas de aceite.",
      "Para verificar los tiempos reglamentarios de desinfección de superficies entre consultas de pacientes.",
      "Para exigir caretas de policarbonato íntegras y cubrebocas reglamentarios ante la alta dispersión de saliva y sangre.",
    ],
    ojoConEsto: [
      "Nunca reutilices fresas ni instrumental dental en otro paciente sin haber completado el ciclo reglamentario de lavado ultrasónico y autoclave.",
      "Los restos de amalgama nunca deben tirarse al drenaje ni a la basura común; deben colocarse en recipientes cerrados con agua o aceite mineral.",
    ],
  },
  {
    documentId: "IMSS-2430-003-038",
    urlOficial: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2660-003-069.pdf",
    aliasIds: [
      "2430-003-038",
      "anatomia-patologica",
      "disector",
      "mortuorio",
      "patologia",
      "formol",
      "necropsias",
      "entrega-cadaveres",
      "biopsias",
    ],
    tituloComun: "Procedimiento para los Servicios de Anatomía Patológica y Mortuorio en Hospitales IMSS",
    claveOficial: "2660-003-069 / 2430-003-038",
    organizacion: "IMSS / DPM / Anatomía Patológica y Servicios Forenses",
    categoria: "administrativos",
    enUnaFrase: "Manejo de biopsias, preservación de piezas anatómicas, auxilio en necropsias hospitalarias y entrega digna de cadáveres.",
    preambulo: `Regula las actividades en laboratorios de patología y anfiteatros hospitalarios, garantizando el respeto a la dignidad humana y la bioseguridad del personal:

• Recepción y procesamiento de biopsias: Registro unívoco de piezas quirúrgicas, inclusión en parafina, corte en micrótomo y tinción histológica para diagnóstico de cáncer y otras patologías.
• Servicios Mortuorios y Entrega de Cadáveres: Identificación rigurosa del cuerpo con pulsera de datos, resguardo en gavetas refrigeradas (entre 2°C y 4°C) y entrega formal a los deudos y funeraria acreditada con certificado de defunción y acta de entrega.
• Auxilio en Necropsias Hospitalarias: Preparación de instrumental, asistencia al médico patólogo en la evisceración y reconstrucción estética y digna del cuerpo.
• Bioseguridad y Exposición a Químicos (Formol): Manejo de formaldehído bajo campanas de extracción de gases certificadas; uso obligatorio de respiradores con filtros para vapores orgánicos, guantes de nitrilo grueso, delantal de PVC impermeable y botas de agua.
• Derechos laborales: Descansos profilácticos semestrales de 10 días hábiles (Cláusula 47 CCT) y pago de concepto de infectocontagiosidad y alto riesgo biológico.`,
    aQuienAplica: [
      "Técnicos Disectores",
      "Histotécnicos",
      "Médicos Patólogos",
      "Personal de Servicios Mortuorios",
    ],
    aquiPuedesEncontrar: [
      "Protocolo unívoco de entrega de cadáveres para evitar entregas equivocadas de cuerpos.",
      "Límites máximos de exposición a vapores de formaldehído en áreas de macroscopía.",
      "Reglas de refrigeración y conservación de cuerpos en cámaras mortuorias.",
      "Derecho a descansos profilácticos por trabajo continuo con tejidos biológicos y formol.",
    ],
    temasClave: [
      {
        tema: "Identificación y Entrega Legal de Cadáveres",
        referencia: "Protocolo de Anfiteatro Hospitalario",
        queEncontraras: "El cotejo indispensable de la pulsera, certificado médico de defunción e identificación oficial del familiar antes de la entrega.",
        relevancia: "destacada",
      },
      {
        tema: "Protección Respiratoria ante Vapores de Formaldehído",
        referencia: "Salud Ocupacional en Patología",
        queEncontraras: "La obligación de operar campanas de extracción activas y uso de mascarillas con filtro químico para vapores orgánicos.",
        relevancia: "alta",
      },
      {
        tema: "Reconstrucción Digna del Cuerpo y Evisceración",
        referencia: "Técnica de Necropsia Hospitalaria",
        queEncontraras: "El trato respetuoso y cierre quirúrgico estético del cuerpo tras la toma de piezas anatómicas de estudio.",
        relevancia: "alta",
      },
    ],
    cuandoConsultarlo: [
      "Ante dudas de filiación o reclamación de un cuerpo para verificar los documentos indispensables antes de liberarlo.",
      "Si las campanas de extracción de vapores de formol presentan fallas de motor y saturan el laboratorio de olores irritantes.",
      "Para fundamentar la entrega obligatoria de respiradores con cartuchos para formaldehído aprobados por NIOSH.",
    ],
    ojoConEsto: [
      "Nunca entregues un cuerpo a personal funerario sin la presencia física y firma de un familiar directo acreditado con identificación oficial y cotejo de la pulsera identificadora.",
      "El formaldehído es una sustancia clasificada como cancerígena; está estrictamente prohibido trabajar con recipientes abiertos fuera de campana de extracción.",
    ],
  },
]

export const TEMAS_COTIDIANOS_TRABAJADOR: Array<{
  id: string
  titulo: string
  icono: string
  descripcion: string
  documentoId: string
  referencia: string
  beneficioClave: string
}> = [
  {
    id: "vacaciones",
    titulo: "Vacaciones y prima",
    icono: "🏖️",
    descripcion: "Días de descanso según la antigüedad laboral y cálculo de prima vacacional.",
    documentoId: "CCT-IMSS-SNTSS-2025-2027",
    referencia: "Cláusula 47 del CCT",
    beneficioClave: "De 16 a 20 días hábiles en dos periodos con pago de prima vacacional íntegra.",
  },
  {
    id: "aguinaldo",
    titulo: "Aguinaldo de 3 meses",
    icono: "💰",
    descripcion: "El pago de 90 días de sueldo tabular pactado en dos partes.",
    documentoId: "CCT-IMSS-SNTSS-2025-2027",
    referencia: "Cláusula 107 del CCT",
    beneficioClave: "Pago equivalente a 90 días de salario tabular conforme a la Cláusula 107.",
  },
  {
    id: "fondo-ahorro",
    titulo: "Fondo de Ahorro",
    icono: "🏦",
    descripcion: "Aportación patronal y entrega anual en la primera quincena de agosto.",
    documentoId: "CCT-IMSS-SNTSS-2025-2027",
    referencia: "Cláusula 144 del CCT",
    beneficioClave: "Aportación patronal equivalente al ahorro del trabajador conforme a la Cláusula 144.",
  },
  {
    id: "infecto",
    titulo: "Infectocontagiosidad",
    icono: "🧪",
    descripcion: "Porcentajes adicionales (Conceptos 003 y 054) por riesgo biológico o químico.",
    documentoId: "CCT-IMSS-SNTSS-2025-2027",
    referencia: "Cláusula 91 del CCT",
    beneficioClave: "Compensación de 10% a 20% para personal en áreas de riesgo.",
  },
  {
    id: "puntualidad",
    titulo: "Puntualidad y Asistencia",
    icono: "⏱️",
    descripcion: "Tolerancia de checada de 15 min y cómo no perder tus estímulos 024 y 025.",
    documentoId: "CCT-IMSS-SNTSS-2025-2027",
    referencia: "Cláusulas 38 y 93 del CCT / RIT",
    beneficioClave: "Estímulos económicos quincenales por cumplimiento puntual.",
  },
  {
    id: "defuncion-fas",
    titulo: "Fondo de Defunción (FAS)",
    icono: "🤝",
    descripcion: "Apoyo económico inmediato para familiares tras el fallecimiento de un compañero.",
    documentoId: "SNTSS-FAS-2025",
    referencia: "Reglamento FAS 2025",
    beneficioClave: "Pago garantizado e inmediato según tu Pliego Testamentario registrado.",
  },
  {
    id: "sustituciones",
    titulo: "Bolsa y Sustituciones (02)",
    icono: "📋",
    descripcion: "Reglas para el llamado en lista de prelación y asignación de guardias.",
    documentoId: "CCT::BOLSA",
    referencia: "Reglamento de Bolsa de Trabajo",
    beneficioClave: "Respeto riguroso al orden de antigüedad en sustituciones.",
  },
  {
    id: "ascensos",
    titulo: "Escalafón y Promociones",
    icono: "📈",
    descripcion: "Cómo concursar por plazas definitivas o interinatos de mayor sueldo.",
    documentoId: "CCT::ESCALAFON",
    referencia: "Reglamento de Escalafón",
    beneficioClave: "Ascenso por mérito objetivo: antigüedad, eficiencia y capacitación.",
  },
  {
    id: "jubilacion",
    titulo: "Jubilaciones (RJP)",
    icono: "🛡️",
    descripcion: "27 años mujeres y 28 años hombres para retirarte con tu sueldo íntegro.",
    documentoId: "CCT::JUBILACIONES",
    referencia: "RJP Convenio CCT",
    beneficioClave: "Pensión contractual complementaria de hasta el 100% de salario integrado.",
  },
  {
    id: "acoso-salud",
    titulo: "Acoso y Clima Laboral",
    icono: "🧠",
    descripcion: "Protección contra estrés severo, maltrato de jefaturas y violencia laboral.",
    documentoId: "NOM-035-STPS-2018",
    referencia: "NOM-035-STPS-2018",
    beneficioClave: "Obligación institucional de prevenir factores de riesgo psicosocial y violencia laboral.",
  },
  {
    id: "cargas-ergonomia",
    titulo: "Pesos y Ergonomía",
    icono: "🦾",
    descripcion: "Límites máximos de carga manual (máx 25 kg) y grúas de traslado de pacientes.",
    documentoId: "NOM-036-1-STPS-2018",
    referencia: "NOM-036-1-STPS-2018",
    beneficioClave: "Límites máximos de carga manual y prevención de trastornos musculoesqueléticos.",
  },
  {
    id: "ley-silla",
    titulo: "Ley Silla (Descanso)",
    icono: "🪑",
    descripcion: "Disposición de asiento con respaldo y descansos periódicos durante la jornada laboral.",
    documentoId: "LEY-SILLA-2025",
    referencia: "Reforma LFT 2025",
    beneficioClave: "Asientos obligatorios para áreas de mostrador, farmacia y taquillas.",
  },
  {
    id: "plantilla-personal",
    titulo: "Plantillas (2900-B03-002)",
    icono: "🏥",
    descripcion: "Estándares oficiales de dotación de personal médico y de enfermería por servicio y turno.",
    documentoId: "IMSS-2900-B03-002",
    referencia: "Norma 2900-B03-002",
    beneficioClave: "Fórmulas de dotación obligatoria para evitar sobrecargas de servicio.",
  },
  {
    id: "accidentes-st7",
    titulo: "Accidentes ST-7 (3A21-003-010)",
    icono: "🚑",
    descripcion: "Protocolo médico si te accidentas en el hospital o en el trayecto de ida y vuelta.",
    documentoId: "IMSS-3A21-003-010",
    referencia: "Norma 3A21-003-010",
    beneficioClave: "Pago del 100% de tu sueldo íntegro durante la incapacidad calificada.",
  },
  {
    id: "checador-biometrico",
    titulo: "Checador (1A74-003-034)",
    icono: "⏱️",
    descripcion: "Tolerancia de registro, justificación de incidencias técnicas y asignación de sustituciones.",
    documentoId: "IMSS-1A74-003-034",
    referencia: "Norma 1A74-003-034",
    beneficioClave: "Respaldo oficial ante fallas técnicas del reloj biométrico.",
  },
  {
    id: "reconsiderar-sancion",
    titulo: "Apelar Sanción (1A31-003-015)",
    icono: "⚖️",
    descripcion: "Procedimiento de inconformidad y revisión de actas administrativas o sanciones.",
    documentoId: "IMSS-1A31-003-015",
    referencia: "Norma 1A31-003-015",
    beneficioClave: "Garantía de audiencia y representación sindical previa a cualquier resolución.",
  },
  {
    id: "antiguedad-sustituto",
    titulo: "Antigüedad (1A31-003-001)",
    icono: "📜",
    descripcion: "Reconocimiento del tiempo laborado como personal sustituto para efectos de antigüedad y prestaciones.",
    documentoId: "IMSS-1A31-003-001",
    referencia: "Norma 1A31-003-001",
    beneficioClave: "Acumulación retroactiva de guardias y contratos previos en nómina SIAP.",
  },
  {
    id: "enfermeria-funciones",
    titulo: "Enfermería (1°, 2° y 3° Nivel)",
    icono: "🩺",
    descripcion: "Qué le corresponde a Auxiliar vs. General vs. Especialista y regla de los correctos.",
    documentoId: "IMSS-2610-003-017",
    referencia: "Norma 2610-003-017",
    beneficioClave: "Delimitación estricta de funciones y protección en la ministración de fármacos.",
  },
  {
    id: "asistente-medica-flujos",
    titulo: "Asistente Médica (Consultorio y Triage)",
    icono: "📑",
    descripcion: "Actividades en Unifila, agendas y delimitación de funciones clínicas asignadas.",
    documentoId: "IMSS-2430-003-018",
    referencia: "Norma 2430-003-018",
    beneficioClave: "Prohibición de invasión de funciones de enfermería y protección de carga laboral.",
  },
  {
    id: "radiologia-poe",
    titulo: "Técnico Radiólogo (Rayos X y TAC)",
    icono: "☢️",
    descripcion: "Dosimetría obligatoria, descanso profiláctico de 10 días y protección POE.",
    documentoId: "IMSS-2430-003-022",
    referencia: "Norma 2430-003-022 / NOM-229",
    beneficioClave: "Descanso semestral de 10 días hábiles y concepto 030 de riesgo radiológico.",
  },
  {
    id: "camilleria-ergonomia",
    titulo: "Camillería y Traslados",
    icono: "🛏️",
    descripcion: "Traslado seguro con barandales y movilización en bloque con apoyo obligatorio.",
    documentoId: "IMSS-2610-003-028",
    referencia: "Norma 2610-003-028 / NOM-036",
    beneficioClave: "Límites ergonómicos de esfuerzo y prohibición de operar camillas descompuestas.",
  },
  {
    id: "triage-urgencias",
    titulo: "Triage y Urgencias (Semaforización)",
    icono: "🚨",
    descripcion: "Escala cromática de 5 niveles (Rojo a Azul) y tiempos máximos de atención médica.",
    documentoId: "IMSS-2430-003-027",
    referencia: "Norma 2430-003-027",
    beneficioClave: "Sustento normativo oficial ante tiempos de espera y clasificación del paciente.",
  },
  {
    id: "auo-administrativo",
    titulo: "Administrativo / AUO",
    icono: "💼",
    descripcion: "Actividades de ventanilla, captura en sistemas y delimitación de funciones.",
    documentoId: "IMSS-1A74-003-AUO",
    referencia: "Profesiograma AUO",
    beneficioClave: "Protección ante responsabilidades de mando y derecho a mobiliario ergonómico.",
  },
  {
    id: "arimac-archivo",
    titulo: "Archivo Clínico (ARIMAC)",
    icono: "📁",
    descripcion: "Custodia de expedientes médicos, préstamos de salida y confidencialidad NOM-004.",
    documentoId: "IMSS-2430-003-016",
    referencia: "Norma 2430-003-016",
    beneficioClave: "Protección legal y confidencialidad ante solicitudes de expedientes clínicos sin orden oficial.",
  },
  {
    id: "afiliacion-vigencia-modulo",
    titulo: "Afiliación y Vigencia",
    icono: "👥",
    descripcion: "Altas patronales, beneficiarios y conservación de derechos por 8 semanas.",
    documentoId: "IMSS-4130-003-005",
    referencia: "Norma 4130-003-005",
    beneficioClave: "Requisitos de ley para el registro de familiares y corrección de semanas cotizadas.",
  },
  {
    id: "almacen-logistica",
    titulo: "Almacén y Suministros",
    icono: "📦",
    descripcion: "Cotejo de remisiones, caducidades mínimas y estiba segura de tarimas.",
    documentoId: "IMSS-1A11-003-012",
    referencia: "Norma 1A11-003-012",
    beneficioClave: "Derecho a rechazar mercancía dañada o de corta caducidad sin carta de canje.",
  },
  {
    id: "conservacion-servicios",
    titulo: "Conservación y Calderas",
    icono: "🔧",
    descripcion: "Monitoreo de oxígeno medicinal, plantas de luz, calderas y seguridad LOTO.",
    documentoId: "IMSS-1A13-003-006",
    referencia: "Norma 1A13-003-006 / NOM-020",
    beneficioClave: "Herramientas dieléctricas, equipos de protección y conceptos de alto riesgo.",
  },
  {
    id: "ambulancias-chofer",
    titulo: "Choferes y Ambulancias",
    icono: "🚐",
    descripcion: "Códigos de emergencia sonora, checklist mecánico y viáticos foráneos.",
    documentoId: "IMSS-1A13-003-015",
    referencia: "Norma 1A13-003-015 / NOM-034",
    beneficioClave: "Póliza de seguro obligatoria en cabina y cobro íntegro de pasajes y viáticos.",
  },
  {
    id: "taod-atencion",
    titulo: "Módulos TAOD (Atención)",
    icono: "🎗️",
    descripcion: "Gestión expedita de recetas faltantes, quejas SIAM y trato humanista.",
    documentoId: "IMSS-1A52-003-002",
    referencia: "Norma 1A52-003-002",
    beneficioClave: "Intermediación pacífica sin responsabilidad sobre desabastos de la unidad.",
  },
]

/**
 * Busca el preámbulo correspondiente a un ID o alias de documento
 */
export function getPreambulo(docIdOrAlias: string): PreambuloNormativo | undefined {
  if (!docIdOrAlias) return undefined
  const clean = docIdOrAlias.trim().toLowerCase()
  return PREAMBULOS_NORMATIVOS.find(
    (p) =>
      p.documentId.toLowerCase() === clean ||
      (p.claveOficial && p.claveOficial.toLowerCase() === clean) ||
      p.aliasIds?.some((a) => a.toLowerCase() === clean) ||
      (p.claveOficial && p.claveOficial.toLowerCase().includes(clean)) ||
      (clean.length > 5 && p.documentId.toLowerCase().includes(clean)) ||
      (clean.length > 5 && clean.includes(p.documentId.toLowerCase()))
  )
}

/**
 * Búsqueda en lenguaje natural sobre todos los preámbulos, temas clave y casos cotidianos
 */
export function searchPreambulosEnLenguajeNatural(query: string): PreambuloNormativo[] {
  if (!query || !query.trim()) return PREAMBULOS_NORMATIVOS
  const q = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

  const words = q.split(/\s+/).filter((w) => w.length >= 2)
  if (words.length === 0) return PREAMBULOS_NORMATIVOS

  return PREAMBULOS_NORMATIVOS.filter((p) => {
    const haystack = [
      p.tituloComun,
      p.claveOficial ?? "",
      p.documentId,
      ...(p.aliasIds ?? []),
      p.enUnaFrase,
      p.preambulo,
      ...p.aquiPuedesEncontrar,
      ...p.cuandoConsultarlo,
      ...p.ojoConEsto,
      ...p.temasClave.map((t) => `${t.tema} ${t.referencia} ${t.queEncontraras}`),
    ]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

    return words.some((w) => haystack.includes(w))
  })
}
