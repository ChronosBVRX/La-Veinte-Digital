import fs from "node:fs";
import path from "node:path";
import { LocalLLMService, loadLlmConfig } from "/home/chronos/Escritorio/La Veinte/apps/radio-studio/sidecar/src/llm/local-llm.ts";
import { z } from "zod";

const EP = "/home/chronos/Escritorio/La Veinte/data/tts/episodes/ep-1787544655135";
const guionPath = path.join(EP, "guion-iterado.json");
const g = JSON.parse(fs.readFileSync(guionPath, "utf8"));
const critica = JSON.parse(fs.readFileSync(path.join(EP, "06-critica-r3.json"), "utf8"));

const llm = new LocalLLMService(loadLlmConfig(), "/home/chronos/Escritorio/La Veinte/data/tts");
const repairSchema = z.object({ turns: z.array(z.object({ id: z.string(), text: z.string().min(1) })).min(1) });
const toSchema = (s) => { const { toJSONSchema } = z; return toJSONSchema(s, { io: "input" }); };

for (const iss of critica.issues.slice(0, 3)) {
  const idx = g.turns.findIndex(t => t.id === iss.turnId);
  if (idx < 0) continue;
  const ventana = g.turns.slice(Math.max(0, idx-1), Math.min(g.turns.length, idx+2));
  console.log(`\n--- reparando ${iss.turnId} (${iss.issueType}) ---`);
  console.log(" antes:", g.turns[idx].text.slice(0,80));
  try {
    const rep = await llm.generateStructured({
      task: "repair",
      system: fs.readFileSync("apps/radio-studio/sidecar/prompts/repair.v1.txt","utf8"),
      user: `VENTANA:\n${JSON.stringify(ventana.map(t=>({id:t.id,speaker:t.speaker,text:t.text})),null,1)}\n\nTURNO A REPARAR: ${iss.turnId}\nTIPO: ${iss.issueType}\nPROBLEMA: ${iss.problema}\nEVIDENCIA: ${iss.evidencia}\nESPERABA: ${iss.esperabaEscuchar}\nINSTRUCCIÓN: ${iss.repairInstruction}`,
      jsonSchema: toSchema(repairSchema),
      validate: raw => repairSchema.parse(raw),
      useCache: false,
    });
    for (const rt of rep.turns) {
      const t = g.turns.find(x=>x.id===rt.id);
      if (t) { console.log(" despues:", rt.text.slice(0,80)); t.text = rt.text; }
    }
  } catch(e){ console.log(" fallo:", e.message.slice(0,80)); }
}

fs.writeFileSync(guionPath, JSON.stringify(g, null, 1));
console.log("\nGuardado", guionPath);

// re-evaluar determinista rápido
import { conversationQualityScore, auditConversation } from "/home/chronos/Escritorio/La Veinte/packages/radio-core/src/index.ts";
const score = conversationQualityScore(g.turns);
console.log("determinista:", score.score, score.aprobarGeneracion, score.issues);
console.log("qa fails:", auditConversation(g.turns).filter(l=>!l.pass).map(l=>l.check));
