/**
 * Reparación dirigida: convierte los monólogos de Javier (t004, t007, t009)
 * en conversación real por capas con reacciones entre medias.
 * Solo texto — sin TTS. Inserta turnos nuevos de reacción, no solo reescribe.
 */
import fs from "node:fs";
import path from "node:path";
import { LocalLLMService, loadLlmConfig } from "../src/llm/local-llm";
import { z } from "zod";
import { humanConversationGate, gateBloqueado } from "@la-veinte/radio-core";
import { conversationQualityScore, auditConversation, validateRoleFirewall } from "@la-veinte/radio-core";


async function main() {
  const EP = process.argv[2] ?? "ep-horario-1787599336487";
  const dir = path.join("/home/chronos/Escritorio/La Veinte/data/tts/episodes", EP);
  const guionPath = path.join(dir, "guion-final.json");
  const g = JSON.parse(fs.readFileSync(guionPath, "utf8"));
  let turns = g.turns as Array<{ id: string; speaker: string; text: string; intent?: string; respondsTo?: string | null; citations?: string[]; pauseBeforeMs?: number; pauseAfterMs?: number; energy?: number; pace?: string; canOverlap?: boolean; transition?: string | null; sceneId?: string; editorial?: boolean }>;

  const llm = new LocalLLMService(loadLlmConfig(), "/home/chronos/Escritorio/La Veinte/data/tts");

  // Schema para reparación con inserción de turnos
  const RepairMonologoSchema = z.object({
    /** Secuencia completa que REEMPLAZA al turno original: puede incluir turnos nuevos de EDUARDO/ANDREA entre capas de JAVIER */
    secuencia: z.array(z.object({
      id: z.string().describe("nuevo id único (t004a, t004b... si insertas; el original si es reescritura)"),
      speaker: z.enum(["EDUARDO", "ANDREA", "NARRADOR"]),
      intent: z.enum(["normative_answer", "reaction", "question", "clarification", "statement", "backchannel"]),
      text: z.string().min(10),
      sourceIds: z.array(z.string()).default([]),
      /** ms desde fin del turno anterior; interrupciones = 0 */
      pauseBeforeMs: z.number().min(0).max(900).default(250),
    })).min(2).max(6),
  }).strict();

  const toSchema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as object;

  const MONOLOGOS = ["t004", "t007", "t009"];
  let cambiados = 0;

  for (const tid of MONOLOGOS) {
    const idx = turns.findIndex(t => t.id === tid);
    if (idx < 0) { console.log(`⚠ ${tid} no encontrado`); continue; }
    const turno = turns[idx];
    const palabras = turno.text.trim().split(/\s+/).length;
    const segEstimados = Math.round(palabras / 2.6);
    console.log(`\n═══ ${tid} (${turno.speaker}, ~${segEstimados}s) ═══`);
    console.log(`  texto: ${turno.text.slice(0,100)}…`);

    const prev = turns[idx - 1] ?? null;
    const next = turns[idx + 1] ?? null;
    const fuentes = turno.citations ?? [];

    try {
      const rep = await llm.generateStructured({
        task: "repair",
        system: `Eres el GUIONISTA de "La Veinte Radio" (IMSS). Recibes un TURNO LARGO del analista normativo Javier que debe convertirse en conversación real.

  REGLAS:
  - Divide el fundamento en 2-3 CAPAS cortas de Javier (cada capa máximo 3 oraciones / ~12 segundos hablados).
  - ENTRE las capas de Javier, inserta UNA intervención de Eduardo o Andrea que REACCIONE ESPECÍFICAMENTE a lo que Javier acaba de decir (interpretación, duda concreta, consecuencia práctica o precisión).
  - PROHIBIDO como reacción: "exactamente", "totalmente de acuerdo", "sí", "claro" solos. La reacción debe aportar una idea nueva conectada al dato.
  - NO inventes normas, artículos, cláusulas, cifras ni conclusiones nuevas. Usa SOLO la información del turno original y sus citas.
  - Conserva los IDs de fuente (${fuentes.join(", ")}) SOLO en las capas de Javier que realmente los respaldan.
  - Los ids nuevos deben ser ${tid}a, ${tid}b... para capas de Javier, e ins1_${tid}, ins2_${tid}... para inserciones de Eduardo/Andrea.
  - El PRIMER elemento de la secuencia conserva el id original "${tid}" (es la primera capa de Javier).
  - Si en el texto original hay una corrección reconocida ("me expliqué mal"), consérvala en su capa.
  - Estilo hablado radiofónico español mexicano. Nada de "en virtud de".`,
        user: `TURNO ORIGINAL (${turno.speaker}, responde a ${turno.respondsTo ?? "?"}):
  "${turno.text}"

  FUENTES DISPONIBLES: ${fuentes.join(", ")}

  CONTEXTO ANTERIOR: ${prev ? `${prev.speaker}: "${prev.text.slice(0,120)}"` : "(inicio)"}
  CONTEXTO SIGUIENTE: ${next ? `${next.speaker}: "${next.text.slice(0,120)}"` : "(fin)"}

  Genera la secuencia completa que reemplaza este turno.`,
        jsonSchema: toSchema(RepairMonologoSchema),
        validate: raw => RepairMonologoSchema.parse(raw),
        useCache: false,
      });

      if (rep.secuencia.length < 2) { console.log("  ⚠ secuencia muy corta"); continue; }

      // construir turnos completos
      const nuevos = rep.secuencia.map((r, i) => ({
        id: r.id,
        speaker: r.speaker === "NARRADOR" ? "NARRADOR" : r.speaker,
        text: r.text,
        intent: r.intent,
        respondsTo: i === 0 ? turno.respondsTo : rep.secuencia[i-1]?.id ?? null,
        citations: r.sourceIds.length > 0 ? r.sourceIds : (r.speaker === "NARRADOR" ? [] : []),
        pauseBeforeMs: r.pauseBeforeMs,
        pauseAfterMs: 250,
        energy: (r.speaker === "NARRADOR" ? 2 : 4) as 1|2|3|4|5,
        pace: "normal",
        canOverlap: r.intent === "backchannel",
        transition: null,
        sceneId: turno.sceneId,
        editorial: true,
        overlapPreviousMs: r.pauseBeforeMs === 0 && /interrupt|reaction/.test(r.intent) ? 150 : undefined,
      }));

      // verificar que las capas de Javier conservan las citas
      const citasOriginales = new Set(fuentes);
      for (const n of nuevos.filter(n => /NARRADOR/i.test(n.speaker))) {
        for (const c of n.citations ?? []) {
          if (!citasOriginales.has(c)) console.log(`  ⚠ cita nueva no autorizada: ${c}`);
        }
      }
      const citasUsadas = new Set(nuevos.flatMap(n => n.citations ?? []));
      for (const c of fuentes) {
        if (!citasUsadas.has(c)) console.log(`  ⚠ cita perdida: ${c}`);
      }

      // reemplazar
      turns.splice(idx, 1, ...nuevos);
      cambiados++;
      console.log(`  → ${nuevos.length} turnos:`);
      for (const n of nuevos) console.log(`    [${n.id}] ${n.speaker} (${n.intent}): ${n.text.slice(0,90)}${n.citations?.length ? ` [${n.citations.join(",")}]` : ""}`);
    } catch (e) {
      console.log(`  ✗ fallo: ${e instanceof Error ? e.message.slice(0,80) : e}`);
    }
  }

  if (cambiados > 0) {
    // renumerar ids secuenciales
    const renames = new Map<string, string>();
    turns.forEach((t, i) => {
      const nuevoId = `t${String(i + 1).padStart(3, "0")}`;
      if (t.id !== nuevoId) renames.set(t.id, nuevoId);
      t.id = nuevoId;
    });
    // actualizar respondsTo
    for (const t of turns) {
      if (t.respondsTo && renames.has(t.respondsTo)) t.respondsTo = renames.get(t.respondsTo)!;
    }
  }

  // ── GATES FINALES ──
  console.log("\n═══ GATES ═══");
  const gateV = humanConversationGate(turns as never);
  const gate = gateBloqueado(gateV);
  const score = conversationQualityScore(turns as never);
  const qaFails = auditConversation(turns as never).filter(q => !q.pass);
  const fw = validateRoleFirewall(turns as never);

  console.log("crítico-determinista:", score.score, "| aprobado:", score.aprobarGeneracion);
  console.log("QA fails:", qaFails.map(q => q.check));
  console.log("firewall:", fw.length === 0 ? "OK" : fw);
  console.log(`humanGate: ${gate.fatales} fatales / bloquear=${gate.bloquear}`);
  for (const r of gate.resumen) console.log(" ", r);

  g.turns = turns;
  g.gates = {
    determinista: score.score,
    qaFails: qaFails.map(q => q.check),
    gateFatales: gate.fatales,
    gateResumen: gate.resumen,
  };
  fs.writeFileSync(guionPath, JSON.stringify(g, null, 1));
  console.log(`\nguardado → ${guionPath}`);
  console.log(`total turnos: ${turns.length}`);


}

main().catch((e) => { console.error("FATAL:", e.message ?? e); process.exit(1); });
