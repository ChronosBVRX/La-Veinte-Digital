import { describe, it, expect } from "vitest";
import {
  parseScript,
  normalizeSpeakerId,
  sanitizeTtsText,
  parseSpeakerHeader,
  buildEpisodeManifest,
} from "../script-parser";
import { validateScriptIntegrity } from "../script-validator";
import { ScriptSchema } from "@la-veinte/studio-contract";

describe("script-parser", () => {
  it("normaliza variantes de nombres a sus IDs canónicos (JAVIER, RODRIGO, VALERIA, EDUARDO, ANDREA)", () => {
    expect(normalizeSpeakerId("**EDUARDO**")).toBe("EDUARDO");
    expect(normalizeSpeakerId("Eduardo:")).toBe("EDUARDO");
    expect(normalizeSpeakerId("ANDREA:")).toBe("ANDREA");
    expect(normalizeSpeakerId("Andrea")).toBe("ANDREA");
    expect(normalizeSpeakerId("JAVIER RÍOS")).toBe("JAVIER");
    expect(normalizeSpeakerId("Javier Rios:")).toBe("JAVIER");
    expect(normalizeSpeakerId("NARRADOR:")).toBe("JAVIER");
    expect(normalizeSpeakerId("RODRIGO TORRES:")).toBe("RODRIGO");
    expect(normalizeSpeakerId("Corresponsal:")).toBe("RODRIGO");
    expect(normalizeSpeakerId("VALERIA:")).toBe("VALERIA");
    expect(normalizeSpeakerId("Comercial:")).toBe("VALERIA");
  });

  it("elimina estrictamente acotaciones de producción en ttsText", () => {
    const raw = "Hola a todos. [PAUSA] Bienvenidos al programa. [RISAS] Hoy tenemos novedades. [MÚSICA SUBE]";
    const clean = sanitizeTtsText(raw);
    expect(clean).not.toContain("[PAUSA]");
    expect(clean).not.toContain("[RISAS]");
    expect(clean).not.toContain("[MÚSICA SUBE]");
    expect(clean).toBe("Hola a todos. Bienvenidos al programa. Hoy tenemos novedades.");
  });

  // ═══ CASOS MÍNIMOS REQUERIDOS ═══

  // Caso 1: Estándar con 2 turnos
  it("Caso 1: EDUARDO: Hola. ANDREA: Hola Eduardo. -> 2 turnos", () => {
    const raw = `EDUARDO: Hola.
ANDREA: Hola Eduardo.`;
    const script = parseScript(raw);
    expect(script.turns.length).toBe(2);
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[0].ttsText).toBe("Hola.");
    expect(script.turns[1].speaker).toBe("ANDREA");
    expect(script.turns[1].ttsText).toBe("Hola Eduardo.");
  });

  // Caso 2: Separación rigurosa de dirección actoral (delivery) del ttsText
  it("Caso 2: **EDUARDO — cálido, natural** y **ANDREA — rápida** separan delivery de ttsText", () => {
    const raw = `**EDUARDO — cálido, natural**
¿Ya estamos?

**ANDREA — rápida**
Sí.`;

    const script = parseScript(raw);
    expect(script.turns.length).toBe(2);

    // Eduardo
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[0].ttsText).toBe("¿Ya estamos?");
    expect(script.turns[0].ttsText).not.toContain("cálido");
    expect(script.turns[0].ttsText).not.toContain("natural");
    expect(script.turns[0].delivery?.styles).toEqual(["cálido", "natural"]);

    // Andrea
    expect(script.turns[1].speaker).toBe("ANDREA");
    expect(script.turns[1].ttsText).toBe("Sí.");
    expect(script.turns[1].ttsText).not.toContain("rápida");
    expect(script.turns[1].delivery?.styles).toEqual(["rápida"]);
  });

  // Caso 3: Inline inequívoco sin saltos de línea produce turnos separados
  it("Caso 3: EDUARDO: Uno. ANDREA: Dos. RODRIGO: Tres. -> 3 turnos separados", () => {
    const raw = `EDUARDO: Uno. ANDREA: Dos. RODRIGO: Tres.`;
    const script = parseScript(raw);
    expect(script.turns.length).toBe(3);
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[0].ttsText).toBe("Uno.");
    expect(script.turns[1].speaker).toBe("ANDREA");
    expect(script.turns[1].ttsText).toBe("Dos.");
    expect(script.turns[2].speaker).toBe("RODRIGO");
    expect(script.turns[2].ttsText).toBe("Tres.");
  });

  // Caso 4: Mención casual dentro de diálogo NO se confunde con speaker
  it("Caso 4: EDUARDO: Andrea me comentó que vendría mañana. -> 1 solo turno", () => {
    const raw = `EDUARDO:
Andrea me comentó que vendría mañana.`;
    const script = parseScript(raw);
    expect(script.turns.length).toBe(1);
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[0].ttsText).toBe("Andrea me comentó que vendría mañana.");
  });

  // Caso 5: Pausas de autor preservadas como eventos
  it("Caso 5: EDUARDO: Espera. [PAUSA: 500 ms] ANDREA: ¿Qué pasó? -> 2 turnos + pausa 500 ms", () => {
    const raw = `EDUARDO: Espera.
[PAUSA: 500 ms]
ANDREA: ¿Qué pasó?`;

    const script = parseScript(raw);
    expect(script.turns.length).toBe(2);
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[0].ttsText).toBe("Espera.");

    expect(script.turns[1].speaker).toBe("ANDREA");
    expect(script.turns[1].ttsText).toBe("¿Qué pasó?");
    expect(script.turns[1].pauseBeforeMs).toBe(500);
    expect(script.turns[1].authorPause).toBe(true);

    const pauseEv = script.turns[1].productionEvents.find((e) => e.durationMs === 500);
    expect(pauseEv).toBeDefined();
    expect(pauseEv?.type).toBe("pause");
  });

  // Caso 6: Fusión de locutores corregida en diálogo rápido
  it("Caso 6: Cierra inmediatamente el turno al detectar nuevo speaker (sin fusionar diálogo)", () => {
    const raw = `EDUARDO:
“Pregúntale a fulano, él sí sabe.”

ANDREA:
Y fulano te manda con mengano.

RODRIGO:
Y mengano con Personal.

ANDREA:
Y Personal te dice que preguntes en tu servicio.`;

    const script = parseScript(raw);
    expect(script.turns.length).toBe(4);
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[0].ttsText).not.toContain("ANDREA");
    expect(script.turns[0].ttsText).not.toContain("RODRIGO");

    expect(script.turns[1].speaker).toBe("ANDREA");
    expect(script.turns[1].ttsText).toBe("Y fulano te manda con mengano.");

    expect(script.turns[2].speaker).toBe("RODRIGO");
    expect(script.turns[2].ttsText).toBe("Y mengano con Personal.");

    expect(script.turns[3].speaker).toBe("ANDREA");
    expect(script.turns[3].ttsText).toBe("Y Personal te dice que preguntes en tu servicio.");
  });

  // Caso 7: Directiva intermedia no cambia speaker y genera turnos separados para el mismo locutor
  it("Caso 7: EDUARDO -> PAUSA -> EDUARDO -> PAUSA -> ANDREA genera 3 turnos conservando el locutor con pausa no duplicada", () => {
    const raw = `EDUARDO:
Hay una frase.

[PAUSA: 350 ms]

Oye... ¿tú sabes cómo funciona esto?

[PAUSA: 650 ms]

ANDREA:
Sí.`;

    const script = parseScript(raw);
    expect(script.turns.length).toBe(3);

    // Turno 1: Eduardo
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[0].ttsText).toBe("Hay una frase.");
    expect(script.turns[0].pauseAfterMs).toBe(0); // Sin duplicar después

    // Turno 2: Eduardo continúa tras la pausa sin perder atribución
    expect(script.turns[1].speaker).toBe("EDUARDO");
    expect(script.turns[1].ttsText).toBe("Oye... ¿tú sabes cómo funciona esto?");
    expect(script.turns[1].pauseBeforeMs).toBe(350); // Exactamente 350 ms
    expect(script.turns[1].pauseAfterMs).toBe(0);

    // Turno 3: Andrea
    expect(script.turns[2].speaker).toBe("ANDREA");
    expect(script.turns[2].ttsText).toBe("Sí.");
    expect(script.turns[2].pauseBeforeMs).toBe(650); // Exactamente 650 ms
    expect(script.turns[2].pauseAfterMs).toBe(0);
  });

  it("EDUARDO: Uno. [PAUSA: 350 ms] Dos. -> separación editorial exactamente 350 ms y no 700 ms", () => {
    const raw = `EDUARDO:
Uno.

[PAUSA: 350 ms]

Dos.`;

    const script = parseScript(raw);
    expect(script.turns.length).toBe(2);

    expect(script.turns[0].ttsText).toBe("Uno.");
    expect(script.turns[0].pauseAfterMs).toBe(0);

    expect(script.turns[1].ttsText).toBe("Dos.");
    expect(script.turns[1].pauseBeforeMs).toBe(350);
    expect(script.turns[1].pauseAfterMs).toBe(0);

    // La separación editorial entre turnos adyacentes es única: exactamente 350 ms
    const totalSeparation = (script.turns[0].pauseAfterMs ?? 0) + (script.turns[1].pauseBeforeMs ?? 0);
    expect(totalSeparation).toBe(350);
  });

  it("EDUARDO: Uno. [PAUSA: 350 ms] Dos. [PAUSA: 650 ms] ANDREA: Tres. -> Uno -> 350 ms -> Dos -> 650 ms -> Tres sin pausas adicionales", () => {
    const raw = `EDUARDO:
Uno.

[PAUSA: 350 ms]

Dos.

[PAUSA: 650 ms]

ANDREA:
Tres.`;

    const script = parseScript(raw);
    expect(script.turns.length).toBe(3);

    // Turno 1
    expect(script.turns[0].ttsText).toBe("Uno.");
    expect(script.turns[0].pauseAfterMs).toBe(0);

    // Turno 2
    expect(script.turns[1].ttsText).toBe("Dos.");
    expect(script.turns[1].pauseBeforeMs).toBe(350);
    expect(script.turns[1].pauseAfterMs).toBe(0);

    // Turno 3
    expect(script.turns[2].ttsText).toBe("Tres.");
    expect(script.turns[2].pauseBeforeMs).toBe(650);
    expect(script.turns[2].pauseAfterMs).toBe(0);

    // Verificación de manifiesto de timeline
    const manifest = buildEpisodeManifest(raw, script);
    expect(manifest.totalSpeechNodes).toBe(3);
    expect(manifest.totalPauseDirectives).toBe(2);
    expect(manifest.orphanNodes).toBe(0);
    expect(manifest.duplicateSpeechIds.length).toBe(0);

    const speechNodes = manifest.timeline.filter((n) => n.type === "speech");
    const pauseNodes = manifest.timeline.filter((n) => n.type === "pause");

    expect(speechNodes.map((s) => s.ttsText)).toEqual(["Uno.", "Dos.", "Tres."]);
    expect(pauseNodes.map((p) => p.durationMs)).toEqual([350, 650]);
  });

  it("parsea un guion completo con cuatro personajes y acotaciones", () => {
    const rawScript = `# Guion de Prueba: Jornadas y Descansos

[MÚSICA DE APERTURA]

**EDUARDO:** Bienvenidos al episodio de hoy. [PAUSA 1.5s]
Vamos a analizar la jornada acumulada.

**ANDREA:** Así es, Eduardo. [RISAS] Hay mucha confusión en las clínicas.

**JAVIER RÍOS:** De acuerdo con la Cláusula 22 del CCT, el descanso es irrenunciable.

[SFX: timbre de mensaje]

**RODRIGO:** Desde el Hospital de Especialidades nos reportan turnos dobles.

**VALERIA:** Espacio patrocinado por la Caja de Ahorro. Préstamos inmediatos.

[FADE OUT]`;

    const script = parseScript(rawScript);

    // Debe validar contra el schema de studio-contract
    const parsed = ScriptSchema.safeParse(script);
    expect(parsed.success).toBe(true);

    expect(script.turns.length).toBe(5);

    // Turno 1: Eduardo
    expect(script.turns[0].speaker).toBe("EDUARDO");
    expect(script.turns[0].ttsText).not.toContain("[PAUSA 1.5s]");
    expect(script.turns[0].ttsText).toContain("Bienvenidos al episodio de hoy. Vamos a analizar la jornada acumulada.");
    expect(script.turns[0].ssml).toContain('<break time="1500ms"/>');
    expect(script.turns[0].productionEvents.some((e) => e.durationMs === 1500)).toBe(true);
    expect(script.turns[0].authorPause).toBe(true);

    // Turno 2: Andrea
    expect(script.turns[1].speaker).toBe("ANDREA");
    expect(script.turns[1].ttsText).not.toContain("[RISAS]");
    expect(script.turns[1].ttsText).toBe("Así es, Eduardo. Hay mucha confusión en las clínicas.");

    // Turno 3: Javier Ríos
    expect(script.turns[2].speaker).toBe("JAVIER");
    expect(script.turns[2].ttsText).toContain("De acuerdo con la Cláusula 22 del CCT");

    // Turno 4: Rodrigo (Corresponsal)
    expect(script.turns[3].speaker).toBe("RODRIGO");

    // Turno 5: Valeria (Comercial / Patrocinio)
    expect(script.turns[4].speaker).toBe("VALERIA");
    expect(script.turns[4].adSlot).toBe(true);
    expect(script.turns[4].kind).toBe("ad");

    // Título derivado debe ser corto
    expect(script.topic).toBe("Guion de Prueba: Jornadas y Descansos");
  });

  // ═══ VALIDACIÓN DE INTEGRIDAD ═══
  it("ScriptIntegrityValidator aprueba guiones limpios y rechaza contaminaciones", () => {
    const cleanScript = parseScript(`EDUARDO: Hola.
ANDREA: Hola.`);
    const cleanReport = validateScriptIntegrity(cleanScript);
    expect(cleanReport.isValid).toBe(true);
    expect(cleanReport.canProduceAudio).toBe(true);
    expect(cleanReport.errors.length).toBe(0);

    // Simular contaminación cruzada
    const contaminatedScript = {
      ...cleanScript,
      turns: [
        {
          ...cleanScript.turns[0],
          ttsText: "Hola. ANDREA: Y te manda con mengano.",
        },
      ],
    };
    const badReport = validateScriptIntegrity(contaminatedScript);
    expect(badReport.isValid).toBe(false);
    expect(badReport.canProduceAudio).toBe(false);
    expect(badReport.errors.some((e) => e.message.includes("etiquetas de ANDREA"))).toBe(true);
  });

  // ═══ GUION INAUGURAL COMPLETO ═══
  it("parsea el guion inaugural completo de project.json (1b75e010) sin omitir frases ni fusionar locutores", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const projPath = path.resolve(process.cwd(), "data/projects/1b75e010/project.json");
    if (!fs.existsSync(projPath)) return;

    const project = JSON.parse(fs.readFileSync(projPath, "utf8"));
    const script = parseScript(project.topic);
    const manifest = buildEpisodeManifest(project.topic, script);

    // Métricas del manifiesto
    expect(manifest.totalSpeechNodes).toBeGreaterThan(50);
    expect(manifest.orphanNodes).toBe(0);
    expect(manifest.parserErrors).toBe(0);
    expect(manifest.duplicateSpeechIds.length).toBe(0);
    expect(manifest.missingSpeechIds.length).toBe(0);

    // ═══ VERIFICACIÓN EXPRESA DE LAS 17 FRASES CRÍTICAS EN ORDEN CRONOLÓGICO ═══
    const expectedPhrases: Array<{ text: string; speaker: string }> = [
      { text: "¿Qué es esto?", speaker: "ANDREA" },
      { text: "Oye... ¿tú sabes cómo funciona esto?", speaker: "EDUARDO" },
      { text: "Me pagaron menos esta quincena y no sé por qué.", speaker: "EDUARDO" },
      { text: "¿Qué haces?", speaker: "EDUARDO" },
      { text: "¿Qué puede hacer el trabajador?", speaker: "EDUARDO" },
      { text: "¿Y mañana qué hago?", speaker: "RODRIGO" },
      { text: "¿Voy con mi jefe?", speaker: "RODRIGO" },
      { text: "¿Voy a Personal?", speaker: "RODRIGO" },
      { text: "¿Necesito un escrito?", speaker: "RODRIGO" },
      { text: "¿Hay un plazo?", speaker: "RODRIGO" },
      { text: "¿Tengo que llevar algún documento?", speaker: "RODRIGO" },
      { text: "¿A quién se lo entrego?", speaker: "ANDREA" },
      { text: "Ya entendí qué significa para mí.", speaker: "EDUARDO" },
      { text: "Aunque estén mal.", speaker: "ANDREA" },
      { text: "donde va a depender.", speaker: "JAVIER" },
      { text: "¿Y después?", speaker: "RODRIGO" },
      { text: "¿ya quedó inaugurada La Veinte Radio?", speaker: "ANDREA" },
    ];

    let lastFoundTurnIndex = 0;
    for (const item of expectedPhrases) {
      const matchIndex = script.turns.findIndex(
        (t, idx) => idx >= lastFoundTurnIndex && t.ttsText?.includes(item.text)
      );

      expect(matchIndex, `Frase no encontrada o fuera de orden: "${item.text}"`).toBeGreaterThan(-1);
      const matchedTurn = script.turns[matchIndex];
      expect(matchedTurn.speaker, `Personaje incorrecto para "${item.text}"`).toBe(item.speaker);
      lastFoundTurnIndex = matchIndex;
    }

    // Integridad estructural
    const report = validateScriptIntegrity(script);
    expect(report.isValid).toBe(true);
    expect(report.canProduceAudio).toBe(true);

    console.log("=== MANIFIESTO INAUGURAL CALCULADO ===");
    console.log(`speech nodes: ${manifest.totalSpeechNodes}`);
    console.log(`pause directives: ${manifest.totalPauseDirectives}`);
    console.log(`music directives: ${manifest.totalMusicDirectives}`);
    console.log(`SFX directives: ${manifest.totalSfxDirectives}`);
    console.log(`palabras hablables: ${manifest.totalSpeakableWords}`);
    console.log(`orphan nodes: ${manifest.orphanNodes}`);
    console.log(`parser errors: ${manifest.parserErrors}`);
    console.log(`duplicate speech IDs: ${manifest.duplicateSpeechIds.length}`);
    console.log(`missing speech IDs: ${manifest.missingSpeechIds.length}`);
  });

  it("parsea el guion golden original sin saltos de línea (ya-estamos-grabando-golden.txt) reconociendo todos los locutores", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const goldenPath = path.resolve(process.cwd(), "data/fixtures/ya-estamos-grabando-golden.txt");
    if (!fs.existsSync(goldenPath)) return;

    const goldenText = fs.readFileSync(goldenPath, "utf8");
    const script = parseScript(goldenText);

    expect(script.turns.length).toBeGreaterThan(40);
    const speakers = new Set(script.turns.map((t) => t.speaker));
    expect(speakers.has("ANDREA")).toBe(true);
    expect(speakers.has("EDUARDO")).toBe(true);
    expect(speakers.has("RODRIGO")).toBe(true);
    expect(speakers.has("JAVIER")).toBe(true);

    const report = validateScriptIntegrity(script);
    expect(report.isValid).toBe(true);
    expect(report.canProduceAudio).toBe(true);
  });
});
