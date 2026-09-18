import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { DashboardClient } from "../src/features/representacion/components/DashboardClient";
import type { UnionDashboardSummary } from "../src/features/representacion/lib/dashboard-format";

const ARTIFACT_DIR = "C:\\Users\\Axel Rosete\\.gemini\\antigravity\\brain\\82710181-5d4a-4245-b75a-46d395c7f4db";
const OUTPUT_DIR = path.resolve(process.cwd(), "artifacts", "screenshots");

const sampleData: UnionDashboardSummary = {
  delegation: {
    id: "del-xxi",
    code: "XXI",
    name: "Delegación XXI",
    section: "SNTSS · SECCIÓN XX MICHOACÁN",
    facility: "HGR No. 1 Charo",
  },
  metrics: {
    workers: {
      total: 186,
      active: 184,
      error: false,
    },
    cases: {
      total: 94,
      error: false,
    },
    lockers: {
      total: 46,
      assigned: 34,
      available: 12,
      occupancyPercentage: 74,
      waitlistCount: 2,
      error: false,
    },
    procedures: {
      inProgress: 7,
      drafts: 3,
      underReview: 4,
      error: false,
    },
    attentionCount: 4,
  },
  attentionItems: [
    {
      id: "att-1",
      caseId: "lic-001",
      type: "license_draft",
      title: "Licencia XXI-2026-LIC-000005",
      subtitle: "Borrador sin finalizar · BOLAÑOS/VAZQUEZ/EDUARDO (98173968)",
      actionLabel: "Continuar",
      actionHref: "/representacion/licencias?case=lic-001&action=continue",
      urgency: "high",
      date: "2026-09-18T12:00:00Z",
    },
    {
      id: "att-2",
      caseId: "pas-002",
      type: "case_under_review",
      title: "Pasaje 026 XXI-2026-PAS-000002",
      subtitle: "Enviado · TORRES/GARCIA/MARIANA (99382104)",
      actionLabel: "Revisar",
      actionHref: "/representacion/expedientes?folio=XXI-2026-PAS-000002",
      urgency: "medium",
      date: "2026-09-17T15:30:00Z",
    },
    {
      id: "att-3",
      type: "locker_review",
      title: "3 casilleros con diferencias",
      subtitle: "Registros de lockers pendientes de conciliar con el padrón",
      actionLabel: "Conciliar",
      actionHref: "/representacion/lockers/pendientes",
      urgency: "medium",
    },
    {
      id: "att-4",
      type: "locker_waitlist",
      title: "2 compañeros en lista de espera",
      subtitle: "Hay 12 casilleros disponibles para asignar",
      actionLabel: "Asignar",
      actionHref: "/representacion/lockers",
      urgency: "medium",
    },
  ],
  recentActivity: [
    {
      id: "rec-1",
      title: "Licencia XXI-2026-LIC-000006",
      detail: "Borrador · MORALES/CHAVEZ/RODRIGO",
      timeAgo: "Hace 12 min",
      timestamp: "2026-09-18T12:45:00Z",
      caseType: "license",
      folio: "XXI-2026-LIC-000006",
      href: "/representacion/licencias?case=rec-1&action=edit",
    },
    {
      id: "rec-2",
      title: "Locker 24 asignado",
      detail: "Asignado · HERNANDEZ/RODRIGUEZ/VALERIA",
      timeAgo: "Hace 1 h",
      timestamp: "2026-09-18T11:30:00Z",
      caseType: "locker",
    },
    {
      id: "rec-3",
      title: "Pasaje 026 XXI-2026-PAS-000003",
      detail: "Listo para firma · RAMIREZ/LOPEZ/CARLOS",
      timeAgo: "Hace 3 h",
      timestamp: "2026-09-18T09:15:00Z",
      caseType: "passage_026",
      folio: "XXI-2026-PAS-000003",
      href: "/representacion/expedientes?folio=XXI-2026-PAS-000003",
    },
    {
      id: "rec-4",
      title: "Trabajador actualizado",
      detail: "Padrón actualizado · SANCHEZ/GOMEZ/ANA",
      timeAgo: "Ayer",
      timestamp: "2026-09-17T18:00:00Z",
    },
  ],
};

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const globalsCssPath = path.resolve(process.cwd(), "src", "app", "globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

  // Renderizar componente a HTML
  const contentHtml = ReactDOMServer.renderToString(
    React.createElement("div", { style: { maxWidth: "1200px", margin: "0 auto", padding: "1.5rem" } },
      React.createElement(DashboardClient, { initialData: sampleData, isAdmin: true })
    )
  );

  const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Centro de Representación Sindical — Preview</title>
  <style>
    ${globalsCss}
    body {
      margin: 0;
      padding: 0;
      background: var(--bg, #f8fafc);
      color: var(--fg, #0f172a);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    * {
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>`;

  const previewHtmlPath = path.resolve(OUTPUT_DIR, "preview-dashboard.html");
  fs.writeFileSync(previewHtmlPath, fullHtml, "utf-8");
  console.log("HTML preview generado en:", previewHtmlPath);

  const browser = await chromium.launch();

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(`file://${previewHtmlPath.replace(/\\/g, "/")}`);
    await page.waitForLoadState("domcontentloaded");

    const outPng = path.join(OUTPUT_DIR, `union_dashboard_${vp.name}.png`);
    const artifactPng = path.join(ARTIFACT_DIR, `union_dashboard_${vp.name}.png`);

    await page.screenshot({ path: outPng, fullPage: true });
    fs.copyFileSync(outPng, artifactPng);

    console.log(`Captura ${vp.name} guardada en:`, outPng);
    console.log(`Copia en artefactos:`, artifactPng);
    await page.close();
  }

  await browser.close();
  console.log("Todas las capturas se generaron correctamente.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
