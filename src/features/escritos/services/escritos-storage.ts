const ESCRITOS_KEY = "escritos_guardados"

export interface EscritoGuardado {
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

export function getEscritosGuardados(): EscritoGuardado[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(ESCRITOS_KEY)
  if (!raw) return []
  try {
    const list = JSON.parse(raw) as EscritoGuardado[]
    return list.filter((e) => e && e.id)
  } catch {
    return []
  }
}

export function guardarEscrito(escrito: EscritoGuardado): EscritoGuardado[] {
  if (typeof window === "undefined") return getEscritosGuardados()
  const list = getEscritosGuardados()
  const idx = list.findIndex((e) => e.id === escrito.id)
  if (idx >= 0) {
    list[idx] = escrito
  } else {
    list.unshift(escrito)
  }
  localStorage.setItem(ESCRITOS_KEY, JSON.stringify(list))
  return list
}

export function eliminarEscrito(id: string): EscritoGuardado[] {
  if (typeof window === "undefined") return getEscritosGuardados()
  const list = getEscritosGuardados().filter((e) => e.id !== id)
  localStorage.setItem(ESCRITOS_KEY, JSON.stringify(list))
  return list
}

export function nuevoIdEscrito(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `escrito_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
