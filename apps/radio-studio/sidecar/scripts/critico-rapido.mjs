import fs from "node:fs";
import { LocalLLMService, loadLlmConfig } from "/home/chronos/Escritorio/La Veinte/apps/radio-studio/sidecar/src/llm/local-llm.ts";
import { ConversationCritiqueSchema } from "/home/chronos/Escritorio/La Veinte/apps/radio-studio/sidecar/src/llm/schemas.ts";
import { z } from "zod";
const g = JSON.parse(fs.readFileSync("data/tts/episodes/ep-1787544655135/guion-iterado.json","utf8"));
const llm = new LocalLLMService(loadLlmConfig(), "data/tts");
const prompt = fs.readFileSync("apps/radio-studio/sidecar/prompts/conversation-critic.v2.txt","utf8");
const toSchema = (s) => z.toJSONSchema(s, { io: "input" });
console.log("Consultando crítico Qwen...");
const critica = await llm.generateStructured({
  task: "qa",
  system: prompt,
  user: `GUION:\n${JSON.stringify(g.turns.map(t=>({id:t.id,speaker:t.speaker,intent:t.intent,respondsTo:t.respondsTo,text:t.text})))}`,
  jsonSchema: toSchema(ConversationCritiqueSchema),
  validate: raw => ConversationCritiqueSchema.parse(raw),
  useCache: false,
});
console.log("score", critica.conversationQualityScore);
console.log("subscores", critica.subscores);
console.log("issues", critica.issues.length);
for (const iss of critica.issues.slice(0,3)) console.log(" -", iss.issueType, "|", iss.problema.slice(0,80));
fs.writeFileSync("data/tts/episodes/ep-1787544655135/06-critica-rapida.json", JSON.stringify(critica, null, 1));
