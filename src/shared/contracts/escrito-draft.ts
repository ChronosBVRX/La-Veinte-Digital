/**
 * Contrato formal y versionado para el módulo Generador de Escritos.
 * Define la estructura de datos (EscritoDraftV2), validadores de esquema,
 * funciones de migración desde V1 (legado) y DTOs para la API dedicada.
 */

export const ESCRITO_SCHEMA_VERSION = 2

export type TipoEscritoKey =
  | "solicitud"
  | "aclaracion"
  | "queja"
  | "seguimiento"
  | "libre"

export interface TipoEscritoDef {
  key: TipoEscritoKey
  titulo: string
  descripcion: string
  icono: string
  ejemploAsunto: string
  placeholderHechos: string
  placeholderPeticion: string
}

export const TIPOS_ESCRITO: Record<TipoEscritoKey, TipoEscritoDef> = {
  solicitud: {
    key: "solicitud",
    titulo: "Solicitud",
    descripcion: "Pide una prestación, permiso, cambio o servicio oficial.",
    icono: "📄",
    ejemploAsunto: "Solicitud de días a cuenta de vacaciones",
    placeholderHechos: "Describe claramente las fechas, turno o condiciones de tu solicitud...",
    placeholderPeticion: "¿Qué resolución o autorización requieres de la autoridad?",
  },
  aclaracion: {
    key: "aclaracion",
    titulo: "Aclaración",
    descripcion: "Corrige un dato, descuento indebido, error de registro o malentendido.",
    icono: "🔍",
    ejemploAsunto: "Aclaración respecto al descuento aplicado en la quincena...",
    placeholderHechos: "Explica qué concepto o registro presenta discrepancia con tus comprobantes...",
    placeholderPeticion: "¿Qué corrección, reintegro o ajuste necesitas que se efectúe?",
  },
  queja: {
    key: "queja",
    titulo: "Queja o inconformidad",
    descripcion: "Expresa formalmente un desacuerdo, maltrato o falta de cumplimiento.",
    icono: "⚠️",
    ejemploAsunto: "Inconformidad por asignación de funciones fuera de categoría...",
    placeholderHechos: "Narra lo ocurrido cronológicamente, mencionando lugares, fechas y personas involucradas...",
    placeholderPeticion: "¿Qué medidas correctivas o intervención sindical solicitas?",
  },
  seguimiento: {
    key: "seguimiento",
    titulo: "Seguimiento de trámite",
    descripcion: "Consulta el estado, respuesta o resolución de una gestión previa.",
    icono: "⏳",
    ejemploAsunto: "Seguimiento a trámite ingresado con fecha...",
    placeholderHechos: "Indica el número de folio, fecha de ingreso o solicitud previa...",
    placeholderPeticion: "¿Qué información o respuesta necesitas que te sea comunicada?",
  },
  libre: {
    key: "libre",
    titulo: "Escrito libre",
    descripcion: "Redacción formal abierta y personalizada para cualquier otro asunto.",
    icono: "✏️",
    ejemploAsunto: "Asunto general relativo a...",
    placeholderHechos: "Expón los antecedentes y hechos relevantes de tu situación...",
    placeholderPeticion: "¿Qué solicitud o posicionamiento formal deseas asentar?",
  },
}

export interface DestinoCargoNombre {
  cargo: string
  nombre: string
}

export interface AnexoItem {
  id: string
  nombre: string
  descripcion: string
  dataUrl?: string
  storageRef?: string
}

export interface FuenteNormativaVerificada {
  documento: string
  version?: string
  numero?: string
  paginaInicio?: number
  paginaFin?: number
  sourceUrl?: string
  fragmento?: string
}

export type GenerationMode =
  | "ai_with_sources"
  | "ai_without_sources"
  | "basic_fallback"

export interface EscritoDraftV2 {
  schemaVersion: 2
  id: string
  ownerId: string
  status: "draft" | "final"
  titulo: string
  tipo: TipoEscritoKey | string
  asunto: string
  destino: DestinoCargoNombre
  ciudad: string
  fecha: string
  hechos: string
  peticion: string
  cuerpo: string
  atencion: DestinoCargoNombre[]
  copias: DestinoCargoNombre[]
  anexos: AnexoItem[]
  firmaUrl?: string
  fuentes: FuenteNormativaVerificada[]
  generationMode: GenerationMode
  createdAt: string
  updatedAt: string
}

export interface LegacyEscritoV1 {
  id: string
  titulo: string
  cuerpo: string
  destino: string
  ciudad: string
  fecha: string
  nombre: string
  matricula: string
  categoria: string
  adscripcion: string
  atencion: string
  copia: string
  fotos: string[]
  firmaUrl: string
  createdAt: string
}

export interface WorkerProfileContext {
  nombre?: string
  matricula?: string
  categoria?: string
  adscripcion?: string
}

export function createEmptyEscritoDraftV2(
  ownerId: string,
  _profile?: WorkerProfileContext,
  initialValues?: Partial<EscritoDraftV2>,
): EscritoDraftV2 {
  const now = new Date().toISOString()
  return {
    schemaVersion: 2,
    id: initialValues?.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `esc_${Date.now()}`),
    ownerId,
    status: "draft",
    titulo: initialValues?.titulo ?? "Nuevo escrito",
    tipo: initialValues?.tipo ?? "solicitud",
    asunto: initialValues?.asunto ?? "",
    destino: initialValues?.destino ?? { cargo: "", nombre: "" },
    ciudad: initialValues?.ciudad ?? "",
    fecha: initialValues?.fecha ?? now.slice(0, 10),
    hechos: initialValues?.hechos ?? "",
    peticion: initialValues?.peticion ?? "",
    cuerpo: initialValues?.cuerpo ?? "",
    atencion: initialValues?.atencion ?? [],
    copias: initialValues?.copias ?? [],
    anexos: initialValues?.anexos ?? [],
    firmaUrl: initialValues?.firmaUrl,
    fuentes: initialValues?.fuentes ?? [],
    generationMode: initialValues?.generationMode ?? "ai_without_sources",
    createdAt: initialValues?.createdAt ?? now,
    updatedAt: now,
  }
}

export function isEscritoDraftV2(val: unknown): val is EscritoDraftV2 {
  if (!val || typeof val !== "object") return false
  const d = val as Partial<EscritoDraftV2>
  return (
    d.schemaVersion === 2 &&
    typeof d.id === "string" &&
    d.id.length > 0 &&
    typeof d.ownerId === "string" &&
    typeof d.titulo === "string" &&
    typeof d.tipo === "string" &&
    typeof d.asunto === "string" &&
    d.destino !== null &&
    typeof d.destino === "object" &&
    typeof d.destino.cargo === "string" &&
    typeof d.destino.nombre === "string" &&
    typeof d.ciudad === "string" &&
    typeof d.fecha === "string" &&
    typeof d.hechos === "string" &&
    typeof d.peticion === "string" &&
    typeof d.cuerpo === "string" &&
    Array.isArray(d.atencion) &&
    Array.isArray(d.copias) &&
    Array.isArray(d.anexos) &&
    Array.isArray(d.fuentes) &&
    typeof d.createdAt === "string" &&
    typeof d.updatedAt === "string"
  )
}

function parseDestinoPipe(raw: string | undefined | null): DestinoCargoNombre {
  if (!raw) return { cargo: "", nombre: "" }
  const [cargo, nombre] = raw.split("|")
  return {
    cargo: (cargo ?? "").trim(),
    nombre: (nombre ?? "").trim(),
  }
}

export function migrateLegacyEscritoToV2(
  legacy: LegacyEscritoV1,
  ownerId: string,
): EscritoDraftV2 {
  const destino = parseDestinoPipe(legacy.destino)
  const atencion: DestinoCargoNombre[] = []
  if (legacy.atencion) {
    const parsed = parseDestinoPipe(legacy.atencion)
    if (parsed.cargo || parsed.nombre) atencion.push(parsed)
  }
  const copias: DestinoCargoNombre[] = []
  if (legacy.copia) {
    const parsed = parseDestinoPipe(legacy.copia)
    if (parsed.cargo || parsed.nombre) copias.push(parsed)
  }

  const anexos: AnexoItem[] = (legacy.fotos ?? []).map((foto, idx) => ({
    id: `anexo_mig_${idx + 1}`,
    nombre: `Anexo ${idx + 1}`,
    descripcion: "Evidencia adjunta",
    dataUrl: foto,
  }))

  const now = new Date().toISOString()

  return {
    schemaVersion: 2,
    id: legacy.id || `esc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ownerId,
    status: "draft",
    titulo: legacy.titulo || `Escrito a ${destino.nombre || "Destinatario"}`,
    tipo: "libre",
    asunto: legacy.titulo || "",
    destino,
    ciudad: legacy.ciudad || "",
    fecha: legacy.fecha || now.slice(0, 10),
    hechos: "",
    peticion: "",
    cuerpo: legacy.cuerpo || "",
    atencion,
    copias,
    anexos,
    firmaUrl: legacy.firmaUrl || undefined,
    fuentes: [],
    generationMode: "basic_fallback",
    createdAt: legacy.createdAt || now,
    updatedAt: now,
  }
}

// ── DTOs para /api/escritos/generar ──

export interface GenerarEscritoRequest {
  tipo: TipoEscritoKey | string
  hechos: string
  peticion: string
  destino: DestinoCargoNombre
  ciudad: string
  fecha: string
  asunto?: string
  incluirFundamentos?: boolean
  instruccionAjuste?: "mejorar" | "formal" | "breve" | "fundamentos"
  cuerpoActual?: string
}

export interface GenerarEscritoResponse {
  cuerpo: string
  asuntoSugerido: string
  tituloSugerido: string
  fuentes: FuenteNormativaVerificada[]
  advertencias: string[]
  generationMode: GenerationMode
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export function parseGenerarEscritoRequest(input: unknown): ParseResult<GenerarEscritoRequest> {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "El cuerpo de la solicitud no es un objeto válido." }
  }
  const body = input as Record<string, unknown>

  const hechos = typeof body.hechos === "string" ? body.hechos.trim() : ""
  const peticion = typeof body.peticion === "string" ? body.peticion.trim() : ""
  const tipo = typeof body.tipo === "string" && body.tipo.trim().length > 0 ? body.tipo.trim() : "solicitud"
  const ciudad = typeof body.ciudad === "string" ? body.ciudad.trim() : ""
  const fecha = typeof body.fecha === "string" ? body.fecha.trim() : ""
  const asunto = typeof body.asunto === "string" ? body.asunto.trim() : undefined
  const incluirFundamentos = body.incluirFundamentos === true
  const instruccionAjuste = typeof body.instruccionAjuste === "string"
    && ["mejorar", "formal", "breve", "fundamentos"].includes(body.instruccionAjuste)
    ? (body.instruccionAjuste as "mejorar" | "formal" | "breve" | "fundamentos")
    : undefined
  const cuerpoActual = typeof body.cuerpoActual === "string" ? body.cuerpoActual.trim() : undefined

  let destino: DestinoCargoNombre = { cargo: "", nombre: "" }
  if (body.destino && typeof body.destino === "object") {
    const d = body.destino as Record<string, unknown>
    destino = {
      cargo: typeof d.cargo === "string" ? d.cargo.trim() : "",
      nombre: typeof d.nombre === "string" ? d.nombre.trim() : "",
    }
  }

  // Si no es ajuste y falta información sustancial
  if (!instruccionAjuste) {
    if (!hechos) {
      return { ok: false, error: "La descripción de los hechos es obligatoria." }
    }
    if (hechos.length > 8000) {
      return { ok: false, error: "La descripción de los hechos excede el límite permitido de 8,000 caracteres." }
    }
    if (peticion.length > 4000) {
      return { ok: false, error: "La petición excede el límite permitido de 4,000 caracteres." }
    }
  } else {
    if (!cuerpoActual && !hechos) {
      return { ok: false, error: "Se requiere el cuerpo actual o los hechos para aplicar el ajuste." }
    }
  }

  return {
    ok: true,
    value: {
      tipo,
      hechos,
      peticion,
      destino,
      ciudad,
      fecha,
      asunto,
      incluirFundamentos,
      instruccionAjuste,
      cuerpoActual,
    },
  }
}
