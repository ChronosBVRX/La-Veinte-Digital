import { REPO_ROOT } from "./shared";
import { NormativeCatalog } from "../services/catalog";

async function main() {
  const query = process.argv.slice(2).join(" ");
  if (!query) {
    console.error('Uso: npm run normativa:search -- "<consulta>"');
    process.exit(1);
  }
  const includeHistorical = process.argv.includes("--historical");
  const catalog = new NormativeCatalog(REPO_ROOT);
  const hits = catalog.searchNormativeCorpus(query, { includeHistorical, limit: 12 });
  console.log(`Resultados para "${query}" (${hits.length}):\n`);
  for (const h of hits) {
    console.log(`▸ ${h.documentTitle} [${h.validity}]`);
    if (h.clause) console.log(`    Cláusula: ${h.clause}`);
    if (h.article) console.log(`    Artículo: ${h.article}`);
    console.log(`    Página PDF: ${h.pdfPageIndex ?? "-"} | Página impresa: ${h.printedPage ?? "-"} | Sección: ${h.section ?? "-"}`);
    console.log(`    …${h.snippet.replace(/\[|\]/g, "")}…`);
    console.log("");
  }
  if (hits.length === 0) {
    console.log("Sin resultados. No puedo fundamentar esa consulta con el corpus.");
  }
}

main();
