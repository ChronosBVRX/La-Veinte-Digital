import data from "./src/lib/services/vectorstore-data.json" with { type: "json" };
import OpenAI from "openai";

const openai = new OpenAI();

const resp = await openai.embeddings.create({
  model: "text-embedding-ada-002",
  input: "declaracion de principios del SNTSS",
});
const q = resp.data[0].embedding;

const scored = data.embeddings.map((emb, i) => {
  let dot = 0, na = 0, nb = 0;
  for (let j = 0; j < q.length; j++) {
    dot += q[j] * emb[j];
    na += q[j] * q[j];
    nb += emb[j] * emb[j];
  }
  return { score: dot / (Math.sqrt(na) * Math.sqrt(nb)), idx: i };
});
scored.sort((a, b) => b.score - a.score);

console.log("Top 5 for 'declaracion de principios':");
for (const s of scored.slice(0, 5)) {
  const header = data.chunks[s.idx].split("\n")[0].trim().substring(0, 80);
  console.log(`  #${s.idx} score=${s.score.toFixed(4)} | ${header}`);
}
