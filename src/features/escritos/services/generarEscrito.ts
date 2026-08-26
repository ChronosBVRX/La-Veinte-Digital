import { consultarBot } from "@/features/asistente/services/bot"

export async function generarEscrito(hechos: string): Promise<string> {
  const prompt = `Genera el cuerpo de un escrito formal con los siguientes hechos:

${hechos}

El escrito debe:
1. Ser formal y profesional, redactado en primera persona
2. Estructura clara: exposición de hechos y solicitud
3. Máximo 4 párrafos, directo al grano
4. Incluir fundamentos legales basados en el CCT o Estatutos cuando aplique
5. NO incluir encabezado, destinatario, fecha, lugar, despedida, ni firma
6. NO usar markdown ni formato especial — solo texto plano`

  const { respuesta } = await consultarBot([{ role: "user", content: prompt }])
  return respuesta
}
