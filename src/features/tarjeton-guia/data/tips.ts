/**
 * Bloque "¿Sabías que?" de la Guía de mi Tarjetón.
 *
 * Los tips rotan por índice estable (fecha), nunca aleatorios, para evitar
 * mismatches de hidratación. Cada tip puede abrir una sección de la guía.
 */

export interface GuideTip {
  id: string
  text: string
  /** Destino opcional al pulsar el CTA. */
  href?: string
  cta?: string
}

export const guideTips: GuideTip[] = [
  {
    id: "observaciones",
    text: "La sección de Observaciones puede contener información adicional sobre conceptos, vencimientos, unidades, cargos y saldos.",
    href: "/guia/tarjeton",
    cta: "Muéstrame dónde está",
  },
  {
    id: "incidencia",
    text: "La quincena de incidencia puede no coincidir con la quincena de pago: un retardo de esta quincena puede afectar tu estímulo de la siguiente.",
    href: "/guia/aprender/primeros-pasos?leccion=incidencia",
    cta: "Entender la incidencia",
  },
  {
    id: "smi",
    text: "Tu sueldo mensual integrado es la base para calcular prestaciones como la prima vacacional y el tiempo extraordinario.",
    href: "/guia/campos/57",
    cta: "Ver sueldo mensual integrado",
  },
  {
    id: "codigos",
    text: "Todos los tarjetones usan los mismos códigos de tres dígitos: 002 es sueldo, 033 es puntualidad. Aprender unos cuantos te sirve para siempre.",
    href: "/guia/conceptos",
    cta: "Buscar un código",
  },
  {
    id: "conservar",
    text: "Guardar tus tarjetones te sirve como comprobante en trámites, aclaraciones y para verificar cada quincena.",
    href: "/tarjeton",
    cta: "Ir a mis tarjetones",
  },
]
