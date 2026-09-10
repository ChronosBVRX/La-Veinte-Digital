import { describe, it, expect } from "vitest";
import { classifyInput, deriveShortTitle } from "../script-classifier";

describe("script-classifier", () => {
  it("clasifica prompt corto normal como 'prompt'", () => {
    const prompt = "Explica cómo funcionan las vacaciones de inclusión y continuidad para trabajadores IMSS";
    const res = classifyInput(prompt);
    expect(res.type).toBe("prompt");
    expect(res.stats.turnsCount).toBe(0);
    expect(res.stats.hasPromptKeywords).toBe(true);
    expect(res.suggestedTitle).toBe("Explica cómo funcionan las vacaciones de inclusión y continuidad para trabajadores IMSS");
  });

  it("clasifica prompt largo explicativo como 'prompt'", () => {
    const prompt = `Quiero un episodio completo sobre el cambio de horario sin consentimiento en el IMSS.
Por favor explica qué cláusulas del Contrato Colectivo de Trabajo protegen al trabajador,
cuáles son los pasos a seguir con la representación sindical y cómo levantar una inconformidad.
Incluye advertencias prácticas sobre no abandonar el servicio sin dejar constancia escrita.`;
    const res = classifyInput(prompt);
    expect(res.type).toBe("prompt");
    expect(res.stats.turnsCount).toBe(0);
  });

  it("clasifica guion Markdown completo como 'script'", () => {
    const script = `# Primera transmisión de La Veinte Radio

[MÚSICA DE APERTURA]

**EDUARDO:** Bienvenidos a La Veinte Radio, el espacio informativo de los trabajadores.
[PAUSA]
Hoy vamos a hablar de un tema vital: tus vacaciones de inclusión y continuidad.

**ANDREA:** Así es, Eduardo. Muchos compañeros tienen dudas sobre cuándo se vencen o si pueden acumularlas.

**JAVIER:** En efecto. De acuerdo con el Contrato Colectivo vigente, el derecho debe programarse con anticipación.

[SFX: campana de notificación]

**RODRIGO:** Saludos desde la clínica 25. En piso la principal duda es si la jefatura puede negarlas.`;

    const res = classifyInput(script);
    expect(res.type).toBe("script");
    expect(res.stats.turnsCount).toBe(4);
    expect(res.stats.cuesCount).toBeGreaterThanOrEqual(2);
    expect(res.stats.uniqueSpeakersFound).toContain("EDUARDO");
    expect(res.stats.uniqueSpeakersFound).toContain("ANDREA");
    expect(res.stats.uniqueSpeakersFound).toContain("JAVIER");
    expect(res.stats.uniqueSpeakersFound).toContain("RODRIGO");
  });

  it("clasifica guion plano sin Markdown como 'script'", () => {
    const script = `EDUARDO: Hola a todos en la mesa. Empezamos el programa de hoy.
ANDREA: Hola Lalo, un gusto estar aquí para revisar la jornada acumulada.
JAVIER: Conforme al tabulador y reglamento, cada hora debe ser registrada.
EDUARDO: Muy claro. Vayamos al siguiente punto.`;

    const res = classifyInput(script);
    expect(res.type).toBe("script");
    expect(res.stats.turnsCount).toBe(4);
    expect(res.stats.uniqueSpeakersFound.length).toBeGreaterThanOrEqual(3);
  });

  it("clasifica guion con cuatro personajes canónicos", () => {
    const script = `EDUARDO: Iniciamos transmisión con el equipo completo.
ANDREA: Lista para revisar el caso práctico de hoy.
JAVIER RÍOS: Presente para contrastar los artículos y normativas aplicables.
RODRIGO TORRES: Y desde las unidades médicas tenemos el reporte de enfermería.`;

    const res = classifyInput(script);
    expect(res.type).toBe("script");
    expect(res.stats.turnsCount).toBe(4);
    expect(res.stats.uniqueSpeakersFound.length).toBe(4);
  });

  it("clasifica guion con acotaciones musicales y de efectos", () => {
    const script = `[MÚSICA DE APERTURA]
EDUARDO: Bienvenidos a su emisión semanal. [PAUSA 2s] Hoy tenemos una mesa redonda.
[MÚSICA SUBE]
ANDREA: [RISAS] Y vaya que hacía falta discutir este asunto.
[FADE OUT]
RODRIGO: Reportando desde urgencias con testimonios en vivo.`;

    const res = classifyInput(script);
    expect(res.type).toBe("script");
    expect(res.stats.cuesCount).toBeGreaterThanOrEqual(3);
    expect(res.stats.turnsCount).toBe(3);
  });

  it("identifica casos ambiguos para ofrecer ambas opciones sin perder datos", () => {
    // Texto que parece instrucción pero menciona a un personaje con dos puntos
    const ambiguous = "Eduardo: haz un guion sobre las vacaciones del personal del IMSS";
    const res = classifyInput(ambiguous);
    // Debe dar 'ambiguous' o 'prompt' con datos preservados, sin perder el texto
    expect(["ambiguous", "prompt"]).toContain(res.type);
    expect(res.suggestedTitle).toBeTruthy();
  });
});

describe("deriveShortTitle", () => {
  it("extrae el título de encabezados Markdown '# ...'", () => {
    const script = `# Primera transmisión de La Veinte Radio
EDUARDO: Hola a todos.`;
    const title = deriveShortTitle(script);
    expect(title).toBe("Primera transmisión de La Veinte Radio");
  });

  it("extrae el título de etiquetas explícitas 'Título: ...'", () => {
    const script = `**Título:** Vacaciones de Inclusión y Continuidad 2026
EDUARDO: Bienvenidos.`;
    const title = deriveShortTitle(script);
    expect(title).toBe("Vacaciones de Inclusión y Continuidad 2026");
  });

  it("limpia Markdown y acotaciones del título derivado", () => {
    const text = `[MÚSICA] **### Vacaciones del IMSS: Guía Definitiva 2026** [SFX]
EDUARDO: Hola.`;
    const title = deriveShortTitle(text);
    expect(title).not.toContain("[MÚSICA]");
    expect(title).not.toContain("###");
    expect(title).not.toContain("**");
    expect(title).toContain("Vacaciones del IMSS: Guía Definitiva 2026");
  });

  it("limita la longitud a máximo 80-120 caracteres y nunca desborda", () => {
    const veryLong = "Este es un tema sumamente extenso y detallado que busca explicar absolutamente todos y cada uno de los aspectos relacionados con los derechos laborales sindicales de los trabajadores del instituto mexicano del seguro social en toda la república mexicana";
    const title = deriveShortTitle(veryLong, 100);
    expect(title.length).toBeLessThanOrEqual(100);
    expect(title.endsWith("…")).toBe(true);
  });
});
