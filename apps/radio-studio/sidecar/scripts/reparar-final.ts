/**
 * Reparación final del episodio horario.
 * Corrige TEMPORAL_CONTINUITY (t004-t008), FIRST_PERSON_EVIDENCE (t017),
 * y re-centra el episodio en 1A74-003-032 como fuente primaria.
 * NO genera TTS. Solo texto + gates de verificación.
 */
import fs from "node:fs";
import path from "node:path";
import { LocalLLMService, loadLlmConfig } from "../src/llm/local-llm";
import { z } from "zod";
import { humanConversationGate, gateBloqueado, conversationQualityScore, auditConversation, validateRoleFirewall } from "@la-veinte/radio-core";

const EP = process.argv[2] ?? "ep-horario-1787599336487";
const dir = path.join("/home/chronos/Escritorio/La Veinte/data/tts/episodes", EP);
const guionPath = path.join(dir, "guion-final.json");
const d = JSON.parse(fs.readFileSync(guionPath, "utf8"));
let turns = d.turns;
const llm = new LocalLLMService(loadLlmConfig(), "/home/chronos/Escritorio/La Veinte/data/tts");

const RepairSeq = z.object({
  secuencia: z.array(z.object({
    id: z.string(),
    speaker: z.enum(["EDUARDO", "ANDREA", "NARRADOR", "RODRIGO"]),
    intent: z.enum(["statement","question","answer","reaction","backchannel","agreement","disagreement","interrupt_question","interrupt_correction","clarification","example","callback","summary","handoff","normative_request","normative_answer","field_report"]),
    text: z.string().min(10),
    sourceIds: z.array(z.string()).default([]),
    pauseBeforeMs: z.number().min(0).max(900).default(250),
  })).min(1).max(8),
}).strict();
const toSchema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as object;

// ── Extraer fragmentos de 1A74-003-032 para dar contexto al LLM ──
const PROCEDIMIENTO_032 = `Procedimiento IMSS-1A74-003-032 "Modificación de horarios institucionales":
- El Responsable de los Servicios de Personal verifica que los horarios exclusivos para determinadas categorías solo podrán modificarse de manera temporal o definitiva siguiendo este procedimiento.
- Se elabora una "Solicitud de modificación de horario" en original y dos copias.
- La División de Servicios de Personal firma la solicitud.
- Se identifica si es cambio temporal o definitivo.
- Se genera "Oficio de modificación de horario" o "Oficio de improcedencia".
- Se envía con acuse de recibo a la persona trabajadora.
- Definición: modificación de horario(s) = cambio temporal o definitivo del horario original.`;

async function repararRango(desdeId: string, hastaId: string, instruccion: string): Promise<void> {
  const iDesde = turns.findIndex(t => t.id === desdeId);
  const iHasta = turns.findIndex(t => t.id === hastaId);
  if (iDesde < 0 || iHasta < 0 || iHasta <= iDesde) { console.log(`⚠ rango ${desdeId}-${hastaId} inválido`); return; }

  const ventana = turns.slice(iDesde, iHasta + 1);
  console.log(`\n═══ Reparando ${desdeId}–${hastaId} (${ventana.length} turnos) ═══`);

  try {
    const rep = await llm.generateStructured({
      task: "repair",
      system: `Eres el GUIONISTA de "La Veinte Radio" (IMSS). Recibes una SECUENCIA DE TURNOS que debe reescribirse COMPLETA.

REGLAS ABSOLUTAS:
1. Nadie se dirige a sí mismo por su nombre ("Eduardo, ..." dicho por Eduardo = PROHIBIDO).
2. Nadie verbaliza su rol ("narrador", "analista normativo"). Los conductores llaman al analista "Javier".
3. Javier (NARRADOR) habla máximo 2-3 oraciones por turno (~12 segundos). Si necesita más, otro interviene entre medias.
4. Rodrigo JAMÁS fabrica experiencias personales ("una vez", "yo vi", "me pasó"). Habla de lo que se sabe documentalmente.
5. NO inventes normas/artículos/cláusulas/cifras nuevas. Usa SOLO las fuentes que te doy.
6. El tema central es: ¿pueden cambiar tu horario sin avisarte? Y la fuente principal es el procedimiento IMSS 1A74-003-032 que establece que hay un proceso formal con solicitud escrita, autorización y oficio de notificación.
7. PROHIBIDO: "totalmente de acuerdo" solo, "exactamente" solo, metáforas escritas ("dos muros"), alarmismo sin sustento ("ruleta rusa").
8. Correcciones reconocidas: "Sí, tienes razón en esa precisión..." seguido de QUÉ fue corregido.
9. Casos hipotéticos en genérico/3ª persona: "Y ahí está el miedo de cualquiera: ...". NUNCA el conductor como afectado personal.
10. Estilo hablado radiofónico español mexicano, contexto IMSS ("el Instituto", "tu jefatura", "tu responsable de servicio").

FUENTE PRIMARIA:
${PROCEDIMIENTO_032}

Genera la secuencia completa que REEMPLAZA todos estos turnos. Mantén ids nuevos secuenciales (usar prefijo "r" + número).`,
      user: `SECUENCIA ACTUAL A REESCRIBIR:\n${JSON.stringify(ventana.map(t => ({ id: t.id, speaker: t.speaker, intent: t.intent, text: t.text.slice(0,200), citations: t.citations ?? [] })), null, 1)}\n\nINSTRUCCIÓN ESPECÍFICA:\n${instruccion}`,
      jsonSchema: toSchema(RepairSeq),
      validate: raw => RepairSeq.parse(raw),
      useCache: false,
    });

    // construir turnos completos
    const nuevos = rep.secuencia.map((r, i) => ({
      id: r.id,
      speaker: r.speaker,
      text: r.text,
      intent: /NARRADOR/i.test(r.speaker) && !["normative_answer","statement","handoff"].includes(r.intent)
        ? (r.sourceIds.length > 0 ? "normative_answer" : "statement")
        : r.intent,
      respondsTo: i > 0 ? rep.secuencia[i-1].id : (iDesde > 0 ? turns[iDesde-1].id : null),
      citations: r.sourceIds,
      pauseBeforeMs: r.pauseBeforeMs,
      pauseAfterMs: 250,
      energy: (/NARRADOR/i.test(r.speaker) ? 2 : 4) as 1|2|3|4|5,
      pace: "normal",
      canOverlap: false,
      transition: null as string | null,
      sceneId: ventana[0]?.sceneId ?? "desarrollo",
      editorial: true,
      overlapPreviousMs: undefined,
    }));

    // verificar citas
    const citasOriginales = new Set(ventana.flatMap(t => t.citations ?? []));
    const citasUsadas = new Set(nuevos.flatMap(n => n.citations ?? []));
    // agregar procedimiento 032 como cita válida
    citasOriginales.add("src_procedimiento");
    for (const c of citasUsadas) {
      if (!citasOriginales.has(c)) console.log(`  ⚠ cita no autorizada: ${c}`);
    }

    turns.splice(iDesde, ventana.length, ...nuevos);
    console.log(`  → ${nuevos.length} turnos:`);
    for (const n of nuevos) {
      const cit = n.citations.length > 0 ? ` [${n.citations.join(",")}]` : "";
      console.log(`    [${n.id}] ${n.speaker.padEnd(8)} (${n.intent}): ${n.text.slice(0,90)}${cit}`);
    }
  } catch (e) {
    console.log(`  ✗ fallo: ${e instanceof Error ? e.message.slice(0,100) : e}`);
  }
}

async function main() {

// ── BLOQUE 1: t001-t009 (Eduardo monólogo + desvío comedor) ──
await repararRango("t002", "t009",
`PROBLEMA: Eduardo tiene 5 turnos consecutivos hablando solo (monólogo). Además se introduce el tema del "comedor" y "veladas alternas" que distrae del tema central.

REESCRIBE para que:
- Andrea plantee el caso (persona que llega tarde sin aviso previo).
- EDUARDO reaccione brevemente y pregunte a Javier si existe un procedimiento formal.
- JAVIER explique en MÁXIMO 3 oraciones que sí existe un procedimiento institucional (IMSS 1A74-003-032): hay una solicitud de modificación de horario, se autoriza, y se notifica por oficio. Sin ese proceso, un cambio verbal no está formalizado.
- ANDREA haga una pregunta específica sobre qué pasa si no hubo ese proceso.
- JAVIER precise brevemente.

ELIMINA completamente el tema del comedor, veladas alternas y jornada acumulada. Céntrate en: ¿el jefe puede cambiar mi horario verbalmente? No, debe seguir el procedimiento.`);

// ── BLOQUE 2: t010-t016 (LFT extrapolación + ruleta rusa) ──
await repararRango("t010", "t016",
`PROBLEMA: Esta sección extrapola demasiado la LFT. Los artículos 60/61 definen tipos de jornada y máximos, pero el guion inventa frases como "zona de riesgo legal" y "ruleta rusa con tu seguridad social" que no están sustentadas. También "Espera, Narrador" suena a meta-lenguaje.

REESCRIBE para que:
- JAVIER dé la regla práctica en máximo 3 oraciones: los cambios de horario requieren el procedimiento formal; si no lo hubo, la persona puede pedir que se respete su horario original y acudir a su representación sindical.
- ANDREA traduzca a lenguaje cotidiano lo que esto significa para el trabajador.
- EDUARDO haga una pregunta práctica sobre qué documento debería existir.
- JAVIER precise que sería la "Solicitud de modificación de horario" y el "Oficio" que notifica la decisión.
- ELIMINA completamente "ruleta rusa", "zona de riesgo legal", "espera narrador".

Si Rodrigo aparece, que hable del procedimiento documental SIN fabricar experiencias personales ("el procedimiento establece...", NO "una vez vi...").`);

// ── BLOQUE 3: t017-t018 (Rodrigo fabricando + mezcla procedimientos) ──
await repararRango("t017", "t018",
`PROBLEMA: Rodrigo dice "Una vez un jefe pidió..." — está fabricando experiencia personal. Y Eduardo mezcla "cambio de turno" con "Bolsa de Trabajo" cuando son procedimientos diferentes.

REESCRIBE para que:
- RODRIGO explique el recorrido práctico del procedimiento SIN primera persona: "El procedimiento establece que primero se llena una Solicitud de modificación de horario, luego se verifica que corresponda a la categoría y jornada, y finalmente se notifica por oficio."
- EDUARDO resuma simplemente: "Entonces: papel, autorización y oficio de notificación. Sin esos tres elementos, el cambio no está formalizado."`);

// ── BLOQUE 4: t021 cierre largo ──
const t21idx = turns.findIndex(t => t.id === "t021");
if (t21idx >= 0 && turns[t21idx].text.split(/\s+/).length > 50) {
  console.log("\n═══ Acortando cierre t021 ═══");
  try {
    const rep = await llm.generateStructured({
      task: "repair",
      system: "Eres el GUIONISTA. Reescribe el cierre para que sea conversacional, breve (máximo 3 oraciones ~10 segundos), y conecte con el caso inicial.",
      user: `CIERRE ACTUAL: "${turns[t21idx].text}"\n\nReescribe para que Eduardo cierre de forma conversacional, mencionando brevemente que hay un procedimiento formal, y despida.`,
      jsonSchema: toSchema(RepairSeq),
      validate: raw => RepairSeq.parse(raw),
      useCache: false,
    });
    if (rep.secuencia.length > 0 && rep.secuencia[0].text.length > 20) {
      turns[t21idx].text = rep.secuencia[0].text;
      console.log(`  → nuevo cierre: "${turns[t21idx].text.slice(0,80)}…"`);
    }
  } catch { /* conservar cierre original */ }
}

// ── Renumerar ids ──
const renames = new Map<string, string>();
turns.forEach((t, i) => {
  const nid = `t${String(i+1).padStart(3,"0")}`;
  if (t.id !== nid) renames.set(t.id, nid);
  t.id = nid;
});
for (const t of turns) {
  if (t.respondsTo && renames.has(t.respondsTo)) t.respondsTo = renames.get(t.respondsTo)!;
}

// ── GATES FINALES ──
console.log("\n═══ GATES FINALES ═══");
const gateV = humanConversationGate(turns as never);
const gate = gateBloqueado(gateV);
const score = conversationQualityScore(turns as never);
const qaFails = auditConversation(turns as never).filter(q => !q.pass);
const fw = validateRoleFirewall(turns as never);

console.log("determinista:", score.score, "| aprobado:", score.aprobarGeneracion);
console.log("QA fails:", qaFails.length === 0 ? "NINGUNO ✓" : qaFails.map(q=>q.check));
console.log("firewall:", fw.length === 0 ? "OK ✓" : fw);
console.log(`humanGate: ${gate.fatales} fatales / bloquear=${gate.bloquear}`);
for (const r of gate.resumen) console.log(" ", r);

d.turns = turns;
d.gates = { determinista: score.score, qaFails: qaFails.map(q=>q.check), gateFatales: gate.fatales, gateResumen: gate.resumen };
fs.writeFileSync(guionPath, JSON.stringify(d, null, 1));
console.log(`\nguardado → ${guionPath}\ntotal turnos: ${turns.length}`);

// mostrar guion completo
console.log("\n═══════ GUION FINAL ═══════");
let prevSp = "";
for (const t of turns) {
  const sep = t.speaker !== prevSp ? "\n──" : "  ·";
  const w = t.text.split(/\s+/).filter(Boolean).length;
  const estS = Math.round(w / 2.6 * 10) / 10;
  const cit = t.citations?.length ? ` [${t.citations.join(",")}]` : "";
  console.log(`${sep} [${t.id}] ${t.speaker} (${t.intent},~${estS}s): ${t.text}${cit}`);
  prevSp = t.speaker;
}
}

main().catch(e => { console.error("FATAL:", e.message ?? e); process.exit(1); });
