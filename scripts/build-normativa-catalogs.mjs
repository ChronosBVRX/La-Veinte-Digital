import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function buildCatalogs() {
  console.log("--- Parsing CCT Clausulas ---");
  const cctPath = "bot-api/pdfs/Clausulas.pdf";
  const cctData = new Uint8Array(fs.readFileSync(cctPath));
  const cctDoc = await pdfjs.getDocument({ data: cctData }).promise;
  const cctPages = [];
  for (let p = 1; p <= cctDoc.numPages; p++) {
    const page = await cctDoc.getPage(p);
    const content = await page.getTextContent();
    const str = content.items.map((i) => i.str).join(" ");
    cctPages.push({ pageNum: p, text: str });
  }

  const fullCct = cctPages.map((p) => `<<<PAGE_${p.pageNum}>>> ${p.text}`).join("\n");
  const clauseRegex = /Cl[áa]usula\s+(\d+\s*(?:Bis|Ter)?)\.-?\s*/gi;
  const cctMatches = [];
  let m;
  while ((m = clauseRegex.exec(fullCct)) !== null) {
    cctMatches.push({
      num: m[1].replace(/\s+/g, " ").trim(),
      index: m.index,
      headerLength: m[0].length,
    });
  }

  const cctClauses = [];
  let currentCapitulo = "Capítulo I.- Definiciones";

  for (let i = 0; i < cctMatches.length; i++) {
    const curr = cctMatches[i];
    const nextIdx = i < cctMatches.length - 1 ? cctMatches[i + 1].index : fullCct.length;
    const rawContent = fullCct.slice(curr.index + curr.headerLength, nextIdx);

    const precedingText = fullCct.slice(Math.max(0, curr.index - 350), curr.index);
    const capMatch = precedingText.match(/Cap[íi]tulo\s+([IVXLCDM]+\.-?[^\n\.]+)/i);
    if (capMatch) {
      currentCapitulo = capMatch[0].trim();
    }

    const pageMatch = fullCct.slice(0, curr.index).match(/<<<PAGE_(\d+)>>>(?![\s\S]*<<<PAGE_)/);
    const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;

    let cleaned = rawContent
      .replace(/<<<PAGE_\d+>>>/g, "")
      .replace(/CONTRATO COLECTIVO DE TRABAJO/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    let titulo = "";
    let texto = cleaned;

    const titleMatch = cleaned.match(/^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s,\/]{2,60}?)(?:\s{2,}|\.\s+|:\s+|(?=\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+(?:y|el|la|los|las|de|en|para|se|por|que|con|al|a)\b))/);
    if (titleMatch && !/^(Para|El|La|Los|Las|En|Por|Se|Todo|Toda|Cuando|Si|A\b)/.test(titleMatch[1])) {
      titulo = titleMatch[1].trim();
      texto = cleaned.slice(titleMatch[0].length).trim();
    } else {
      titulo = `Cláusula ${curr.num}`;
    }

    cctClauses.push({
      id: `cct-clausula-${curr.num.toLowerCase().replace(/\s+/g, "-")}`,
      documentId: "CCT-IMSS-SNTSS-2025-2027",
      documento: "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
      numero: curr.num,
      titulo,
      capitulo: currentCapitulo,
      paginaPdf: pageNum,
      texto,
    });
  }

  // Deduplicate: prioritize main contract body (lower pageNum and meaningful title)
  const cctMap = new Map();
  for (const c of cctClauses) {
    if (!cctMap.has(c.numero)) {
      cctMap.set(c.numero, c);
    } else {
      const existing = cctMap.get(c.numero);
      const isCurrentBetter =
        (c.paginaPdf <= 66 && existing.paginaPdf > 66) ||
        (existing.titulo === `Cláusula ${existing.numero}` && c.titulo !== `Cláusula ${c.numero}`);
      if (isCurrentBetter) {
        cctMap.set(c.numero, c);
      }
    }
  }
  const finalCctClauses = Array.from(cctMap.values()).sort((a, b) => {
    const na = parseInt(a.numero, 10);
    const nb = parseInt(b.numero, 10);
    if (na !== nb) return na - nb;
    return a.numero.localeCompare(b.numero);
  });

  console.log(`Extracted ${finalCctClauses.length} CCT clauses.`);
  const outDir = "src/shared/data/normativa";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "cct-clausulas.json"),
    JSON.stringify(finalCctClauses, null, 2),
    "utf8"
  );

  console.log("--- Parsing Estatutos Articulos ---");
  const estPath = "bot-api/pdfs/estatutos-sntss-2022.pdf";
  const estData = new Uint8Array(fs.readFileSync(estPath));
  const estDoc = await pdfjs.getDocument({ data: estData }).promise;
  const estPages = [];
  for (let p = 1; p <= estDoc.numPages; p++) {
    const page = await estDoc.getPage(p);
    const content = await page.getTextContent();
    estPages.push({ pageNum: p, text: content.items.map((i) => i.str).join(" ") });
  }

  const fullEst = estPages.map((p) => `<<<PAGE_${p.pageNum}>>> ${p.text}`).join("\n");
  const artRegex = /Art[íi]culo\s+(\d+\s*(?:Bis|Ter)?)\.-?\s*/gi;
  const estMatches = [];
  while ((m = artRegex.exec(fullEst)) !== null) {
    estMatches.push({
      num: m[1].replace(/\s+/g, " ").trim(),
      index: m.index,
      headerLength: m[0].length,
    });
  }

  let currentEstCapitulo = "Capítulo I";
  const estArticles = [];

  for (let i = 0; i < estMatches.length; i++) {
    const curr = estMatches[i];
    const nextIdx = i < estMatches.length - 1 ? estMatches[i + 1].index : fullEst.length;
    const rawContent = fullEst.slice(curr.index + curr.headerLength, nextIdx);

    const precedingText = fullEst.slice(Math.max(0, curr.index - 350), curr.index);
    const capMatch = precedingText.match(/(?:Cap[íi]tulo|T[íi]tulo)\s+([IVXLCDM]+\.-?[^\n\.]+)/i);
    if (capMatch) {
      currentEstCapitulo = capMatch[0].trim();
    }

    const pageMatch = fullEst.slice(0, curr.index).match(/<<<PAGE_(\d+)>>>(?![\s\S]*<<<PAGE_)/);
    const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;

    let cleaned = rawContent
      .replace(/<<<PAGE_\d+>>>\s*SINDICATO NACIONAL DE TRABAJADORES DEL SEGURO SOCIAL\s*“SEGURIDAD SOCIAL Y BIENESTAR ECONÓMICO DE LOS TRABAJADORES”/gi, "")
      .replace(/<<<PAGE_\d+>>>/g, "")
      .replace(/“SEGURIDAD SOCIAL Y BIENESTAR ECONÓMICO DE LOS TRABAJADORES”/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    estArticles.push({
      id: `estatuto-articulo-${curr.num.toLowerCase().replace(/\s+/g, "-")}`,
      documentId: "SNTSS-ESTATUTOS-2022",
      documento: "Estatutos SNTSS (Edición Octubre 2022)",
      numero: curr.num,
      titulo: `Artículo ${curr.num}`,
      capitulo: currentEstCapitulo,
      paginaPdf: pageNum,
      texto: cleaned,
    });
  }

  const estMap = new Map();
  for (const a of estArticles) {
    if (!estMap.has(a.numero) || estMap.get(a.numero).texto.length < a.texto.length) {
      estMap.set(a.numero, a);
    }
  }
  const finalEstArticles = Array.from(estMap.values()).sort((a, b) => {
    const na = parseInt(a.numero, 10);
    const nb = parseInt(b.numero, 10);
    if (na !== nb) return na - nb;
    return a.numero.localeCompare(b.numero);
  });

  console.log(`Extracted ${finalEstArticles.length} Estatutos articles.`);
  fs.writeFileSync(
    path.join(outDir, "estatutos-articulos.json"),
    JSON.stringify(finalEstArticles, null, 2),
    "utf8"
  );

  // Clean temp files if any
  if (fs.existsSync("temp_clausulas_extracted.txt")) fs.unlinkSync("temp_clausulas_extracted.txt");
  if (fs.existsSync("temp_estatutos_extracted.txt")) fs.unlinkSync("temp_estatutos_extracted.txt");
  console.log("Catalogs built successfully!");
}

buildCatalogs().catch((err) => {
  console.error("Error building catalogs:", err);
  process.exit(1);
});
