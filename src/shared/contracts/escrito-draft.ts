/**
 * Contratos y definiciones de tipos para el Generador de Escritos V2
 * La Veinte Digital
 */

export type TipoEscritoKey =
  | "solicitud"
  | "aclaracion"
  | "queja"
  | "seguimiento"
  | "libre"

export interface TipoEscritoDef {
  key: TipoEscritoKey
  titulo: string
  icono: string
  subtitulo: string
  placeholderPeticion: string
  placeholderHechos: string
  descripcion: string
}

export const TIPOS_ESCRITO: Record<TipoEscritoKey, TipoEscritoDef> = {
  solicitud: {
    key: "solicitud",
    titulo: "Solicitud",
    icono: "📄",
    subtitulo: "Pide una prestación, permiso, cambio o servicio oficial.",
    placeholderPeticion: "Ej. Solicito la autorización de 3 días de pase de salida...",
    placeholderHechos: "Ej. El pasado 15 de agosto presenté mi solicitud ante mi jefatura...",
    descripcion: "Para solicitar licencias, vacaciones, cambios de adscripción, descansos o trámites institucionales.",
  },
  aclaracion: {
    key: "aclaracion",
    titulo: "Aclaración",
    icono: "🔍",
    subtitulo: "Corrige un dato, descuento indebido, error de registro o malentendido.",
    placeholderPeticion: "Ej. Solicito la devolución del descuento indebido concepto 054...",
    placeholderHechos: "Ej. En el tarjetón de la primera quincena de agosto se aplicó un descuento...",
    descripcion: "Para aclarar descuentos en nómina, omisiones de checada, estímulos no pagados o discrepancias en tu expediente.",
  },
  queja: {
    key: "queja",
    titulo: "Queja / Inconformidad",
    icono: "⚠️",
    subtitulo: "Señala una irregularidad, trato indigno o violación a tus derechos laborales.",
    placeholderPeticion: "Ej. Solicito la intervención sindical para el cese del hostigamiento...",
    placeholderHechos: "Ej. De manera reiterada se me ha asignado una carga laboral que no corresponde a mi categoría...",
    descripcion: "Para denunciar sobrecargas injustificadas, acoso, faltas de insumos que pongan en riesgo tu labor o violaciones al CCT.",
  },
  seguimiento: {
    key: "seguimiento",
    titulo: "Seguimiento",
    icono: "📌",
    subtitulo: "Reitera un escrito previo que no ha recibido respuesta.",
    placeholderPeticion: "Ej. Reitero mi solicitud de dictamen de riesgo laboral ingresada con fecha...",
    placeholderHechos: "Ej. Con fecha 10 de julio de 2026 ingresé oficio con número de folio...",
    descripcion: "Para dar curso y exigir respuesta a trámites rezagados o solicitudes que ya excedieron el plazo legal de respuesta.",
  },
  libre: {
    key: "libre",
    titulo: "Redacción Libre",
    icono: "✍️",
    subtitulo: "Redacta un oficio formal con estructura personalizada.",
    placeholderPeticion: "Ej. Se solicita de la manera más atenta...",
    placeholderHechos: "Ej. Expongo que en mi centro de adscripción...",
    descripcion: "Estructura flexible para cualquier comunicación institucional, sindical o administrativa personalizada.",
  },
}

export interface DestinoCargoNombre {
  cargo: string
  nombre: string
}

export interface DestinatarioItem {
  id: string
  cargo: string
  nombre: string
}

export interface AnexoItem {
  id: string
  nombre: string
  descripcion: string
  tipo: string
  size: number
  /**
   * Identificador interno para recuperar el Blob binario desde IndexedDB.
   * NUNCA contiene base64 ni dataUrl en el almacenamiento persistente de localStorage.
   */
  storageRef: string
  /**
   * URL de objeto en memoria (blob:) válida solo en la sesión del navegador.
   */
  previewUrl?: string
}

export interface FuenteNormativaVerificada {
  documento: string
  version: string
  numero?: string
  paginaInicio?: number
  paginaFin?: number
  sourceUrl?: string
  fragmento: string
}

export type GenerationMode =
  | "ai_with_sources"
  | "ai_without_sources"
  | "basic_fallback"

export interface EscritoDraftV2 {
  schemaVersion: 2
  id: string
  ownerId: string
  titulo: string
  tipo: TipoEscritoKey
  asunto: string
  destino: DestinoCargoNombre
  ciudad: string
  fecha: string
  hechos: string
  peticion: string
  cuerpo: string
  atencion: DestinatarioItem[]
  copias: DestinatarioItem[]
  anexos: AnexoItem[]
  fuentes: FuenteNormativaVerificada[]
  /**
   * Referencia interna a la firma en IndexedDB.
   */
  firmaRef?: string
  /**
   * URL de objeto en memoria (blob:) para la firma, válida en sesión actual.
   */
  firmaPreviewUrl?: string
  status: "draft" | "completed"
  generationMode: GenerationMode
  advertencias?: string[]
  createdAt: string
  updatedAt: string
}

/** Formato legado V1 (almacenado previamente en `escritos_guardados`) */
export interface LegacyEscritoV1 {
  id: string
  titulo?: string
  fecha?: string
  tipo?: string
  cuerpo?: string
  asunto?: string
  destino?: string | DestinoCargoNombre
  ciudad?: string
  hechos?: string
  peticion?: string
  atencion?: string | string[]
  copias?: string | string[]
  anexos?: unknown[]
  fuentes?: unknown[]
  createdAt?: string
  updatedAt?: string
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

export function nuevoIdEscrito(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function createEmptyEscritoDraftV2(
  ownerId = "anonymous",
  tipo: TipoEscritoKey = "solicitud",
  initialValues?: Partial<EscritoDraftV2>
): EscritoDraftV2 {
  const now = new Date().toISOString()
  return {
    schemaVersion: 2,
    id: initialValues?.id || nuevoIdEscrito(),
    ownerId: initialValues?.ownerId || ownerId,
    titulo: initialValues?.titulo || "Nuevo escrito",
    tipo: initialValues?.tipo || tipo,
    asunto: initialValues?.asunto || "",
    destino: initialValues?.destino ?? { cargo: "", nombre: "" },
    ciudad: initialValues?.ciudad || "",
    fecha: initialValues?.fecha || now.slice(0, 10),
    hechos: initialValues?.hechos || "",
    peticion: initialValues?.peticion || "",
    cuerpo: initialValues?.cuerpo || "",
    atencion: initialValues?.atencion ?? [],
    copias: initialValues?.copias ?? [],
    anexos: initialValues?.anexos ?? [],
    fuentes: initialValues?.fuentes ?? [],
    firmaRef: initialValues?.firmaRef,
    firmaPreviewUrl: initialValues?.firmaPreviewUrl,
    status: initialValues?.status ?? "draft",
    generationMode: initialValues?.generationMode ?? "ai_without_sources",
    advertencias: initialValues?.advertencias,
    createdAt: initialValues?.createdAt || now,
    updatedAt: initialValues?.updatedAt || now,
  }
}

export function migrateLegacyEscritoToV2(
  legacy: LegacyEscritoV1,
  ownerId: string
): EscritoDraftV2 {
  const now = new Date().toISOString()
  const legacyId = legacy.id || nuevoIdEscrito()

  let destino: DestinoCargoNombre = { cargo: "", nombre: "" }
  if (legacy.destino && typeof legacy.destino === "object") {
    destino = {
      cargo: String((legacy.destino as DestinoCargoNombre).cargo || ""),
      nombre: String((legacy.destino as DestinoCargoNombre).nombre || ""),
    }
  } else if (typeof legacy.destino === "string") {
    destino = {
      cargo: "",
      nombre: legacy.destino,
    }
  }

  const atencion: DestinatarioItem[] = []
  if (Array.isArray(legacy.atencion)) {
    for (const at of legacy.atencion) {
      if (typeof at === "string" && at.trim()) {
        atencion.push({ id: `at_${Math.random().toString(36).slice(2, 7)}`, cargo: "", nombre: at.trim() })
      }
    }
  } else if (typeof legacy.atencion === "string" && legacy.atencion.trim()) {
    atencion.push({ id: `at_${Math.random().toString(36).slice(2, 7)}`, cargo: "", nombre: legacy.atencion.trim() })
  }

  const copias: DestinatarioItem[] = []
  if (Array.isArray(legacy.copias)) {
    for (const cp of legacy.copias) {
      if (typeof cp === "string" && cp.trim()) {
        copias.push({ id: `cp_${Math.random().toString(36).slice(2, 7)}`, cargo: "", nombre: cp.trim() })
      }
    }
  } else if (typeof legacy.copias === "string" && legacy.copias.trim()) {
    copias.push({ id: `cp_${Math.random().toString(36).slice(2, 7)}`, cargo: "", nombre: legacy.copias.trim() })
  }

  let tipoVal: TipoEscritoKey = "solicitud"
  if (legacy.tipo && Object.keys(TIPOS_ESCRITO).includes(legacy.tipo)) {
    tipoVal = legacy.tipo as TipoEscritoKey
  }

  return {
    schemaVersion: 2,
    id: legacyId,
    ownerId,
    titulo: legacy.titulo || `Escrito ${legacy.fecha || now.slice(0, 10)}`,
    tipo: tipoVal,
    asunto: legacy.asunto || "",
    destino,
    ciudad: legacy.ciudad || "",
    fecha: legacy.fecha || now.slice(0, 10),
    hechos: legacy.hechos || "",
    peticion: legacy.peticion || "",
    cuerpo: legacy.cuerpo || "",
    atencion,
    copias,
    anexos: [],
    fuentes: [],
    status: "draft",
    generationMode: "basic_fallback",
    createdAt: legacy.createdAt || now,
    updatedAt: legacy.updatedAt || now,
  }
}

export interface GenerarEscritoRequest {
  tipo: TipoEscritoKey
  hechos: string
  peticion: string
  destino: DestinoCargoNombre
  ciudad: string
  fecha: string
  asunto?: string
  atencion?: DestinatarioItem[]
  copias?: DestinatarioItem[]
  incluirFundamentos?: boolean
  cuerpoActual?: string
  instruccionAjuste?: string
}

export interface GenerarEscritoResponse {
  cuerpo: string
  asuntoSugerido: string
  tituloSugerido: string
  fuentes: FuenteNormativaVerificada[]
  advertencias: string[]
  generationMode: GenerationMode
}
