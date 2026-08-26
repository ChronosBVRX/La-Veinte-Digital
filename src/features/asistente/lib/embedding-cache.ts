/**
 * Cache LRU de embeddings server-side (punto 6). Sin Redis ni servicio externo.
 * Oportunista: guarda los últimos N vectores por clave de pregunta.
 */
export class EmbeddingCache {
  private map = new Map<string, number[]>()
  constructor(private maxSize = 256) {}

  get(key: string): number[] | undefined {
    const hit = this.map.get(key)
    if (hit !== undefined) {
      // LRU: reinsertar al final para reflejar uso reciente.
      this.map.delete(key)
      this.map.set(key, hit)
    }
    return hit
  }

  set(key: string, value: number[]): void {
    if (this.map.has(key)) this.map.delete(key)
    else if (this.map.size >= this.maxSize) {
      // Evictar la entrada más antigua (primera clave).
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, value)
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  get size(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }
}

/** Instancia compartida del proceso (server-side). */
export const embeddingCache = new EmbeddingCache(256)
