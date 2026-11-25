import type { User, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { getWorkerContext, type WorkerContext } from "@/shared/server/worker-context"

export interface WorkerPayslipConcept {
  codigo: string
  nombre: string
  importe: number
  tipo: "percepcion" | "deduccion"
}

export interface WorkerCalculatedEstimates {
  baseQuincenalTabular: number
  cuotaDiaria: number
  aguinaldoAnualCompleto: number
  aguinaldoPorMes: number
  segundaJulioCompleta: number
  segundaJulioPorMes: number
}

export interface WorkerLatestPayslipSummary {
  periodo?: string | null
  percepcionesTotal?: number | null
  deduccionesTotal?: number | null
  netoPagar?: number | null
  salarioIntegradoAproximado?: number | null
  percepciones: WorkerPayslipConcept[]
  deducciones: WorkerPayslipConcept[]
  calculosProporcionales?: WorkerCalculatedEstimates | null
}

export interface WorkerAttendanceSummary {
  retardos?: number | null
  faltas?: number | null
  sinRetardo?: number | null // marcas de asistencia puntual para estímulo 033
  pasesSalida?: number | null
  asiduidad?: number | null
  diasConcepto033?: number | null
  incapacidadGeneralDias?: number | null
  riesgoTrabajoDias?: number | null
  maternidadDias?: number | null
  licenciasConSueldo?: number | null
  licenciasSinSueldo?: number | null
  comisiones?: number | null
}

export interface WorkerVacationSummary {
  marcaContinuidad?: number | null
  periodoPorDisfrutar?: number | null
  diasDisfrutados?: number | null
  diasEnElAno?: number | null
  diasV20?: number | null
  periodosVencidos?: number | null
  porVencerFecha?: string | null
  regimenVacacional?: string | null
}

/**
 * Representación no sensible del contexto del trabajador para el Asistente IA.
 * NUNCA incluye: RFC, CURP, NSS, cuentas bancarias, sellos ni folios fiscales.
 */
export interface SanitizedWorkerProfile {
  hasProfile: boolean
  hasTarjeton?: boolean
  nombre?: string | null
  categoria?: string | null
  categoriaCodigo?: string | null
  jornadaHoras?: number | null
  antiguedadAnios?: number | null
  antiguedadTexto?: string | null
  tipoPlaza?: string | null
  turno?: string | null
  adscripcion?: string | null
  exposicionRadiologica?: boolean
  conceptosRecurrentes?: string[]
  vacacionesPorVencer?: string | null
  salarioIntegradoAproximado?: number | null
  tarjeton?: WorkerLatestPayslipSummary | null
  asistencia?: WorkerAttendanceSummary | null
  vacacionesDetalle?: WorkerVacationSummary | null
}

export async function fetchSanitizedWorkerProfile(
  user: User,
  supabase?: SupabaseClient<Database>,
  requestId?: string,
): Promise<SanitizedWorkerProfile> {
  try {
    const ctx = await getWorkerContext(user, supabase, requestId)
    return sanitizeWorkerContext(ctx)
  } catch (err) {
    console.warn("[asistente:worker-profile] Error obteniendo contexto laboral:", err instanceof Error ? err.message : err)
    return { hasProfile: false, hasTarjeton: false }
  }
}

export function sanitizeWorkerContext(ctx: WorkerContext): SanitizedWorkerProfile {
  if (!ctx || (!ctx.profile && !ctx.employment && !ctx.payroll && !ctx.attendance && !ctx.vacations)) {
    return { hasProfile: false, hasTarjeton: false }
  }

  const nombre = ctx.profile?.fullName?.trim() || null
  const categoria = ctx.employment?.categoryName?.trim() || ctx.profile?.categoria?.trim() || null
  const categoriaCodigo = ctx.employment?.categoryCode?.trim() || null
  const jornadaHoras = ctx.employment?.workdayHours ?? null

  const antiguedadAnios =
    ctx.vacationProfile?.effectiveSeniorityYears ??
    (ctx.profile?.antiguedad ? parseInt(ctx.profile.antiguedad, 10) || null : null)
  const antiguedadTexto = ctx.profile?.antiguedad?.trim() || (antiguedadAnios ? `${antiguedadAnios} años` : null)

  const tipoPlaza = ctx.employment?.employmentType?.trim() || null
  const turno = ctx.employment?.shift?.trim() || null
  const adscripcion = ctx.employment?.adscripcion?.trim() || ctx.profile?.adscripcion?.trim() || null

  const exposicionRadiologica =
    ctx.employment?.radiologicalExposure === true ||
    ctx.vacationProfile?.radiologicalExposure === "true" ||
    (Array.isArray(ctx.payroll?.recurringConcepts) &&
      ctx.payroll.recurringConcepts.some((c: unknown) => {
        if (typeof c === "object" && c !== null && "conceptCode" in c) {
          const code = String((c as { conceptCode: unknown }).conceptCode)
          return code === "063" || code === "058"
        }
        return false
      }))

  const conceptosRecurrentes: string[] = []
  if (Array.isArray(ctx.payroll?.recurringConcepts)) {
    for (const c of ctx.payroll.recurringConcepts) {
      if (typeof c === "object" && c !== null && "conceptCode" in c) {
        const code = String((c as { conceptCode: unknown }).conceptCode).trim()
        if (code && !conceptosRecurrentes.includes(code)) {
          conceptosRecurrentes.push(code)
        }
      }
    }
  }

  const vacacionesPorVencer = ctx.vacations?.porVencer?.trim() || ctx.vacations?.dueDate?.trim() || null
  const salarioIntegradoAproximado = ctx.payroll?.integratedMonthlySalary ?? null

  // Desglose de percepciones y deducciones de tarjetón desde las líneas confirmadas
  const rawLines = Array.isArray(ctx.payroll?.lines) ? ctx.payroll.lines : []
  const percepciones: WorkerPayslipConcept[] = []
  const deducciones: WorkerPayslipConcept[] = []

  for (const l of rawLines) {
    if (!l.confirmed_by_user) continue
    const code = String(l.concept_code || "").trim()
    const nombreDesc = String(l.description || "").trim()
    const amount = Number(l.amount) || 0
    if (l.kind === "earning") {
      percepciones.push({
        codigo: code,
        nombre: nombreDesc || `Concepto ${code}`,
        importe: Math.round(amount * 100) / 100,
        tipo: "percepcion",
      })
    } else if (l.kind === "deduction") {
      deducciones.push({
        codigo: code,
        nombre: nombreDesc || `Deducción ${code}`,
        importe: Math.round(amount * 100) / 100,
        tipo: "deduccion",
      })
    }
  }

  // Cálculos contractuales directos (Aguinaldo y Segunda de Julio / Fondo de Ahorro)
  const c002 = percepciones.find((p) => p.codigo === "002")?.importe || 0
  const c011 = percepciones.find((p) => p.codigo === "011")?.importe || 0
  const c054 = percepciones.find((p) => p.codigo === "054")?.importe || 0
  const baseTabularQuincenal = Math.round((c002 + c011 + c054) * 100) / 100

  let calculosProporcionales: WorkerCalculatedEstimates | null = null
  if (baseTabularQuincenal > 0) {
    const cuotaDiaria = Math.round((baseTabularQuincenal / 15) * 100) / 100
    // Cláusula 107 CCT: 90 días = 6 quincenas de salario tabular
    const aguinaldoAnualCompleto = Math.round(baseTabularQuincenal * 6 * 100) / 100
    // Por cada mes (1/12): 7.5 días de salario
    const aguinaldoPorMes = Math.round((aguinaldoAnualCompleto / 12) * 100) / 100

    // Cláusula 144 y Cláusula 63 Bis inc. b CCT: 46 días de salario tabular (002 + 011)
    const baseFondoAhorro = Math.round((c002 + c011) * 100) / 100
    const cuotaDiariaFondo = Math.round((baseFondoAhorro / 15) * 100) / 100
    const segundaJulioCompleta = Math.round(cuotaDiariaFondo * 46 * 100) / 100
    const segundaJulioPorMes = Math.round((segundaJulioCompleta / 12) * 100) / 100

    calculosProporcionales = {
      baseQuincenalTabular: baseTabularQuincenal,
      cuotaDiaria,
      aguinaldoAnualCompleto,
      aguinaldoPorMes,
      segundaJulioCompleta,
      segundaJulioPorMes,
    }
  }

  const hasTarjetonData = Boolean(
    ctx.payroll?.latestPeriod ||
    ctx.payroll?.totalEarnings != null ||
    ctx.payroll?.netPay != null ||
    percepciones.length > 0 ||
    deducciones.length > 0,
  )

  const tarjeton: WorkerLatestPayslipSummary | null = hasTarjetonData
    ? {
        periodo: ctx.payroll?.latestPeriod ?? null,
        percepcionesTotal: ctx.payroll?.totalEarnings ?? null,
        deduccionesTotal: ctx.payroll?.totalDeductions ?? null,
        netoPagar: ctx.payroll?.netPay ?? null,
        salarioIntegradoAproximado,
        percepciones,
        deducciones,
        calculosProporcionales,
      }
    : null

  // Asistencia e incidencias (marcas de asistencia puntual, faltas, retardos, licencias)
  const att = ctx.attendance
  const hasAttendanceData = Boolean(
    att &&
    (att.noDelayDays != null ||
      att.delays != null ||
      att.absences != null ||
      att.exitPasses != null ||
      att.attendanceScore != null ||
      att.concept033Days != null ||
      att.generalIllnessLeave != null ||
      att.occupationalRiskLeave != null),
  )

  const asistencia: WorkerAttendanceSummary | null = hasAttendanceData
    ? {
        retardos: att?.delays ?? null,
        faltas: att?.absences ?? null,
        sinRetardo: att?.noDelayDays ?? null,
        pasesSalida: att?.exitPasses ?? null,
        asiduidad: att?.attendanceScore ?? null,
        diasConcepto033: att?.concept033Days ?? null,
        incapacidadGeneralDias: att?.generalIllnessLeave ?? null,
        riesgoTrabajoDias: att?.occupationalRiskLeave ?? null,
        maternidadDias: att?.maternityLeave ?? null,
        licenciasConSueldo: att?.paidLicenses ?? null,
        licenciasSinSueldo: att?.unpaidLicenses ?? null,
        comisiones: att?.commissions ?? null,
      }
    : null

  // Vacaciones y marcas de continuidad
  const vac = ctx.vacations
  const hasVacationData = Boolean(
    vac &&
    (vac.continuityMark != null ||
      vac.periodNumberToEnjoy != null ||
      vac.enjoyedDays != null ||
      vac.daysInYear != null ||
      vac.twentyYearsOrMoreDays != null ||
      vac.expiredPeriods != null ||
      vacacionesPorVencer != null),
  )

  const vacacionesDetalle: WorkerVacationSummary | null = hasVacationData
    ? {
        marcaContinuidad: vac?.continuityMark ?? null,
        periodoPorDisfrutar: vac?.periodNumberToEnjoy ?? null,
        diasDisfrutados: vac?.enjoyedDays ?? null,
        diasEnElAno: vac?.daysInYear ?? null,
        diasV20: vac?.twentyYearsOrMoreDays ?? null,
        periodosVencidos: vac?.expiredPeriods ?? null,
        porVencerFecha: vacacionesPorVencer,
        regimenVacacional: exposicionRadiologica
          ? "CUATRIMESTRAL (por riesgo de radiaciones / infectocontagiosidad)"
          : "SEMESTRAL",
      }
    : null

  const hasAnyData = Boolean(
    categoria ||
    jornadaHoras ||
    antiguedadAnios ||
    antiguedadTexto ||
    tipoPlaza ||
    adscripcion ||
    hasTarjetonData ||
    hasAttendanceData,
  )

  return {
    hasProfile: hasAnyData,
    hasTarjeton: hasTarjetonData,
    nombre,
    categoria,
    categoriaCodigo,
    jornadaHoras,
    antiguedadAnios,
    antiguedadTexto,
    tipoPlaza,
    turno,
    adscripcion,
    exposicionRadiologica,
    conceptosRecurrentes,
    vacacionesPorVencer,
    salarioIntegradoAproximado,
    tarjeton,
    asistencia,
    vacacionesDetalle,
  }
}

/**
 * Formatea el perfil para el System Prompt del asistente con personalización profunda.
 */
export function formatWorkerProfilePrompt(
  profile: SanitizedWorkerProfile,
  opts?: { tarjetonAlreadyInContext?: boolean },
): string {
  if (!profile.hasProfile) return ""

  const lineas: string[] = [
    "--- PERFIL DEL TRABAJADOR CONSULTANTE (Datos verificados en expediente) ---",
  ]
  if (profile.nombre) lineas.push(`- Nombre: ${profile.nombre}`)
  if (profile.categoria) lineas.push(`- Categoría / Puesto: ${profile.categoria}${profile.categoriaCodigo ? ` (Código: ${profile.categoriaCodigo})` : ""}`)
  if (profile.jornadaHoras) lineas.push(`- Jornada de trabajo: ${profile.jornadaHoras} horas diarias`)
  if (profile.antiguedadTexto || profile.antiguedadAnios) lineas.push(`- Antigüedad: ${profile.antiguedadTexto ?? `${profile.antiguedadAnios} años`}`)
  if (profile.tipoPlaza) lineas.push(`- Tipo de contratación: ${profile.tipoPlaza}`)
  if (profile.turno) lineas.push(`- Turno: ${profile.turno}`)
  if (profile.adscripcion) lineas.push(`- Adscripción: ${profile.adscripcion}`)
  if (profile.exposicionRadiologica) lineas.push(`- Exposición a emanaciones radiactivas / infectocontagiosidad: SÍ (Acreditada)`)
  if (profile.conceptosRecurrentes && profile.conceptosRecurrentes.length > 0) {
    lineas.push(`- Conceptos de nómina recurrentes registrados: ${profile.conceptosRecurrentes.join(", ")}`)
  }
  if (profile.vacacionesPorVencer) lineas.push(`- Periodo vacacional próximo / por vencer: ${profile.vacacionesPorVencer}`)

  // Optimización de tokens: si el tarjetón completo ya va como [S1] en Contexto,
  // evitar duplicar ~500 tokens y remitir directamente a [S1] para que el modelo lo cite a la primera.
  if (opts?.tarjetonAlreadyInContext && profile.tarjeton) {
    lineas.push(
      "- El desglose de su tarjetón, percepciones, deducciones, marcas y cálculos proporcionales está en [S1]. Usa esas cifras exactas citando [S1].",
    )
    lineas.push(
      "INSTRUCCIÓN DE PERSONALIZACIÓN: Salúdalo por su nombre de pila si aplica y responde directo con sus datos reales de [S1]; para 08 calcula proporción con 7.5 días/mes (aguinaldo Cl. 107) o 3.83 días/mes (fondo ahorro Cl. 144).",
    )
    lineas.push("-----------------------------------------------------------------------")
    return lineas.join("\n")
  }

  if (profile.tarjeton) {
    const t = profile.tarjeton
    lineas.push("")
    lineas.push(`DATOS DE SU ÚLTIMO TARJETÓN CONFIRMADO (Periodo: ${t.periodo ?? "Activo"}):`)
    if (t.percepcionesTotal != null) lineas.push(`- Percepciones totales brutas: $${t.percepcionesTotal.toFixed(2)}`)
    if (t.deduccionesTotal != null) lineas.push(`- Deducciones totales: $${t.deduccionesTotal.toFixed(2)}`)
    if (t.netoPagar != null) lineas.push(`- Alcance líquido (sueldo neto a cobrar): $${t.netoPagar.toFixed(2)}`)
    if (t.salarioIntegradoAproximado != null) lineas.push(`- Salario Mensual Integrado aproximado (SMI): $${t.salarioIntegradoAproximado.toFixed(2)}`)

    if (t.percepciones.length > 0) {
      lineas.push("- Desglose de percepciones en su recibo:")
      for (const p of t.percepciones) {
        lineas.push(`  * [${p.codigo}] ${p.nombre}: $${p.importe.toFixed(2)}`)
      }
    }
    if (t.deducciones.length > 0) {
      lineas.push("- Desglose de deducciones en su recibo:")
      for (const d of t.deducciones) {
        lineas.push(`  * [${d.codigo}] ${d.nombre}: $${d.importe.toFixed(2)}`)
      }
    }

    if (t.calculosProporcionales) {
      const c = t.calculosProporcionales
      lineas.push("")
      lineas.push("CÁLCULOS CONTRACTUALES DIRECTOS CON BASE EN SU TARJETÓN (Conceptos 002 y 011):")
      lineas.push(`- Sueldo tabular quincenal base (002 + 011): $${c.baseQuincenalTabular.toFixed(2)} (Cuota diaria: $${c.cuotaDiaria.toFixed(2)})`)
      lineas.push(`- Aguinaldo Anual Completo (90 días / 6 quincenas, Cláusula 107 CCT): $${c.aguinaldoAnualCompleto.toFixed(2)}`)
      lineas.push(`  * Proporción para trabajadores 08 (sustitutos/eventuales) o año incompleto: $${c.aguinaldoPorMes.toFixed(2)} por mes laborado (7.5 días de salario por mes). Ejemplos: 3 meses = $${(c.aguinaldoPorMes * 3).toFixed(2)} (22.5 días) | 6 meses = $${(c.aguinaldoPorMes * 6).toFixed(2)} (45 días) | 8 meses = $${(c.aguinaldoPorMes * 8).toFixed(2)} (60 días).`)
      lineas.push(`- Segunda de Julio / Fondo de Ahorro Completo (46 días, Cláusula 144 y 63 Bis inc. b CCT): $${c.segundaJulioCompleta.toFixed(2)}`)
      lineas.push(`  * Proporción para trabajadores 08 o año incompleto: $${c.segundaJulioPorMes.toFixed(2)} por mes laborado (3.83 días por mes). Ejemplos: 3 meses = $${(c.segundaJulioPorMes * 3).toFixed(2)} | 6 meses = $${(c.segundaJulioPorMes * 6).toFixed(2)}.`)
    }
  }

  if (profile.asistencia) {
    const a = profile.asistencia
    lineas.push("")
    lineas.push("REGISTRO DE ASISTENCIA, INCIDENCIAS Y MARCAS (en su tarjetón):")
    if (a.sinRetardo != null) lineas.push(`- Marcas 'Sin retardo' (puntualidad para Concepto 033): ${a.sinRetardo} marcas acumuladas`)
    if (a.diasConcepto033 != null) lineas.push(`- Días ganados de estímulo puntualidad (Concepto 033): ${a.diasConcepto033} días`)
    if (a.retardos != null) lineas.push(`- Retardos: ${a.retardos}`)
    if (a.faltas != null) lineas.push(`- Faltas: ${a.faltas}`)
    if (a.pasesSalida != null) lineas.push(`- Pases de salida: ${a.pasesSalida}`)
    if (a.asiduidad != null) lineas.push(`- Puntos de asiduidad: ${a.asiduidad}`)
    if (a.incapacidadGeneralDias != null && a.incapacidadGeneralDias > 0) lineas.push(`- Incapacidad enfermedad general: ${a.incapacidadGeneralDias} días`)
    if (a.riesgoTrabajoDias != null && a.riesgoTrabajoDias > 0) lineas.push(`- Incapacidad por riesgo de trabajo: ${a.riesgoTrabajoDias} días`)
    if (a.maternidadDias != null && a.maternidadDias > 0) lineas.push(`- Licencia/incapacidad por maternidad: ${a.maternidadDias} días`)
    if (a.licenciasConSueldo != null && a.licenciasConSueldo > 0) lineas.push(`- Licencias con goce de sueldo: ${a.licenciasConSueldo}`)
    if (a.licenciasSinSueldo != null && a.licenciasSinSueldo > 0) lineas.push(`- Licencias sin goce de sueldo: ${a.licenciasSinSueldo}`)
    if (a.comisiones != null && a.comisiones > 0) lineas.push(`- Comisiones registradas: ${a.comisiones}`)
  }

  if (profile.vacacionesDetalle) {
    const v = profile.vacacionesDetalle
    lineas.push("")
    lineas.push("INFORMACIÓN Y MARCAS DE VACACIONES:")
    if (v.regimenVacacional) lineas.push(`- Régimen vacacional: ${v.regimenVacacional}`)
    if (v.marcaContinuidad != null) lineas.push(`- Marca de continuidad en tarjetón: Marca ${v.marcaContinuidad}`)
    if (v.periodoPorDisfrutar != null) lineas.push(`- Periodo por disfrutar: ${v.periodoPorDisfrutar}`)
    if (v.diasEnElAno != null) lineas.push(`- Días de vacaciones en el año: ${v.diasEnElAno}`)
    if (v.diasDisfrutados != null) lineas.push(`- Días disfrutados: ${v.diasDisfrutados}`)
    if (v.diasV20 != null && v.diasV20 > 0) lineas.push(`- Días por 20 años o más (V20): ${v.diasV20}`)
    if (v.periodosVencidos != null && v.periodosVencidos > 0) lineas.push(`- Periodos vencidos: ${v.periodosVencidos}`)
    if (v.porVencerFecha) lineas.push(`- Fecha límite / Por vencer: ${v.porVencerFecha}`)
  }

  lineas.push("")
  lineas.push(
    "INSTRUCCIÓN DE PERSONALIZACIÓN: Si la consulta del trabajador atañe a sus propios derechos, percepciones, deducciones, tarjetón, marcas o vacaciones, respóndele de inmediato usando con total exactitud sus datos reales de arriba sin preguntarle su puesto o antigüedad. Si el trabajador es 08 (sustituto/eventual) o no laboró el año completo y pregunta cuánto le van a pagar de aguinaldo o de segunda de julio (fondo de ahorro), CALCÚLALE DIRECTAMENTE SU PARTE PROPORCIONAL con la base de su tarjetón real arriba: explícale su cuota mensual (7.5 días de aguinaldo/mes o 3.83 días de fondo de ahorro/mes), dale los ejemplos exactos o el monto por los meses que mencione, cita la Cláusula 107 (aguinaldo) o Cláusula 144 (fondo de ahorro) y sugiérele las calculadoras [🎁 Calcular mi aguinaldo](/calculadoras/aguinaldo) y [📊 Segunda de julio proporcional](/calculadoras/segunda-julio-proporcional). Háblale con calidez por su nombre de pila si está disponible (ej. '¡Hola, Juan! 😊').",
  )
  lineas.push("-----------------------------------------------------------------------")

  return lineas.join("\n")
}

/**
 * Genera un fragmento de evidencia estructurada del tarjetón para grounding del LLM.
 */
export function formatWorkerTarjetonEvidence(profile: SanitizedWorkerProfile): string {
  if (!profile.hasProfile && !profile.hasTarjeton) return ""
  const parts: string[] = []

  parts.push(`Trabajador: ${profile.nombre ?? "Compañero(a)"}`)
  if (profile.categoria) {
    parts.push(`Categoría: ${profile.categoria}${profile.categoriaCodigo ? ` (Clave ${profile.categoriaCodigo})` : ""} | Jornada: ${profile.jornadaHoras ?? 8}h | Turno: ${profile.turno ?? "No especificado"} | Adscripción: ${profile.adscripcion ?? "No especificada"}`)
  }
  if (profile.antiguedadTexto || profile.antiguedadAnios) {
    parts.push(`Antigüedad: ${profile.antiguedadTexto ?? `${profile.antiguedadAnios} años`} | Contratación: ${profile.tipoPlaza ?? "Base"}`)
  }

  if (profile.tarjeton) {
    const t = profile.tarjeton
    parts.push(`Periodo del tarjetón: ${t.periodo ?? "Último registrado"}`)
    if (t.percepcionesTotal != null) parts.push(`Percepciones totales: $${t.percepcionesTotal.toFixed(2)}`)
    if (t.deduccionesTotal != null) parts.push(`Deducciones totales: $${t.deduccionesTotal.toFixed(2)}`)
    if (t.netoPagar != null) parts.push(`Alcance líquido neto: $${t.netoPagar.toFixed(2)}`)
    if (t.salarioIntegradoAproximado != null) parts.push(`Salario Mensual Integrado (SMI): $${t.salarioIntegradoAproximado.toFixed(2)}`)

    if (t.calculosProporcionales) {
      const c = t.calculosProporcionales
      parts.push(`Base tabular quincenal (002+011): $${c.baseQuincenalTabular.toFixed(2)} | Cuota diaria: $${c.cuotaDiaria.toFixed(2)}`)
      parts.push(`Aguinaldo anual completo (90 días, Cl. 107 CCT): $${c.aguinaldoAnualCompleto.toFixed(2)} | Aguinaldo proporcional para 08 por mes laborado: $${c.aguinaldoPorMes.toFixed(2)} (7.5 días)`)
      parts.push(`Fondo de ahorro / Segunda de julio anual completo (46 días, Cl. 144 CCT): $${c.segundaJulioCompleta.toFixed(2)} | Fondo de ahorro proporcional para 08 por mes laborado: $${c.segundaJulioPorMes.toFixed(2)} (3.83 días)`)
    }

    if (t.percepciones.length > 0) {
      const perc = t.percepciones.map((p) => `Cpto [${p.codigo}] ${p.nombre}: $${p.importe.toFixed(2)}`).join(" | ")
      parts.push(`Percepciones en tarjetón: ${perc}`)
    }
    if (t.deducciones.length > 0) {
      const ded = t.deducciones.map((d) => `Cpto [${d.codigo}] ${d.nombre}: $${d.importe.toFixed(2)}`).join(" | ")
      parts.push(`Deducciones en tarjetón: ${ded}`)
    }
  }

  if (profile.asistencia) {
    const a = profile.asistencia
    const asis: string[] = []
    if (a.sinRetardo != null) asis.push(`Marcas sin retardo (estímulo 033): ${a.sinRetardo}`)
    if (a.diasConcepto033 != null) asis.push(`Días Cpto 033 ganados: ${a.diasConcepto033}`)
    if (a.retardos != null) asis.push(`Retardos: ${a.retardos}`)
    if (a.faltas != null) asis.push(`Faltas: ${a.faltas}`)
    if (a.pasesSalida != null) asis.push(`Pases de salida: ${a.pasesSalida}`)
    if (a.asiduidad != null) asis.push(`Asiduidad: ${a.asiduidad}`)
    if (a.incapacidadGeneralDias != null && a.incapacidadGeneralDias > 0) asis.push(`Incapacidad enf. general: ${a.incapacidadGeneralDias}d`)
    if (a.riesgoTrabajoDias != null && a.riesgoTrabajoDias > 0) asis.push(`Riesgo de trabajo: ${a.riesgoTrabajoDias}d`)
    if (a.maternidadDias != null && a.maternidadDias > 0) asis.push(`Maternidad: ${a.maternidadDias}d`)
    if (a.licenciasConSueldo != null && a.licenciasConSueldo > 0) asis.push(`Licencias con sueldo: ${a.licenciasConSueldo}`)
    if (a.licenciasSinSueldo != null && a.licenciasSinSueldo > 0) asis.push(`Licencias sin sueldo: ${a.licenciasSinSueldo}`)
    if (asis.length > 0) parts.push(`Asistencia y marcas: ${asis.join(" | ")}`)
  }

  if (profile.vacacionesDetalle) {
    const v = profile.vacacionesDetalle
    const vac: string[] = []
    if (v.regimenVacacional) vac.push(`Régimen: ${v.regimenVacacional}`)
    if (v.marcaContinuidad != null) vac.push(`Marca continuidad vacacional: ${v.marcaContinuidad}`)
    if (v.periodoPorDisfrutar != null) vac.push(`Periodo por disfrutar: ${v.periodoPorDisfrutar}`)
    if (v.diasEnElAno != null) vac.push(`Días en el año: ${v.diasEnElAno}`)
    if (v.diasDisfrutados != null) vac.push(`Días disfrutados: ${v.diasDisfrutados}`)
    if (v.diasV20 != null && v.diasV20 > 0) vac.push(`Días V20: ${v.diasV20}`)
    if (v.periodosVencidos != null && v.periodosVencidos > 0) vac.push(`Periodos vencidos: ${v.periodosVencidos}`)
    if (v.porVencerFecha) vac.push(`Fecha por vencer: ${v.porVencerFecha}`)
    if (vac.length > 0) parts.push(`Vacaciones y marcas: ${vac.join(" | ")}`)
  }

  return parts.join("\n")
}
