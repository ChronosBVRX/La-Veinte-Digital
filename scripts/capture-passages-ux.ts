// Script to capture multi-resolution screenshots of Passage UI redesign
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);
const cssProxy = new Proxy({}, { get: (_, p) => (typeof p === "string" ? p : "") });
nodeRequire.extensions[".css"] = function (m: NodeModule) {
  m.exports = { __esModule: true, default: cssProxy };
};

nodeRequire("tsx/cjs");

nodeRequire.extensions[".css"] = function (m: NodeModule) {
  m.exports = { __esModule: true, default: cssProxy };
};

const { PassageConceptSelector } = nodeRequire("../src/features/representacion/components/passages/PassageConceptSelector.tsx");
const { PassageWorkerSection } = nodeRequire("../src/features/representacion/components/passages/PassageWorkerSection.tsx");
const { PassageRequestDetails } = nodeRequire("../src/features/representacion/components/passages/PassageRequestDetails.tsx");
const { Passage026Details } = nodeRequire("../src/features/representacion/components/passages/Passage026Details.tsx");
const { Passage027Details } = nodeRequire("../src/features/representacion/components/passages/Passage027Details.tsx");
const { PassageInternalNotes } = nodeRequire("../src/features/representacion/components/passages/PassageInternalNotes.tsx");
const { PassageValidationBanner } = nodeRequire("../src/features/representacion/components/passages/PassageValidationBanner.tsx");
const { PassageActions } = nodeRequire("../src/features/representacion/components/passages/PassageActions.tsx");
const { PassageSummarySidebar } = nodeRequire("../src/features/representacion/components/passages/PassageSummarySidebar.tsx");

const ARTIFACT_DIR = "C:\\Users\\Axel Rosete\\.gemini\\antigravity\\brain\\c14bd2d1-7d8d-4bc7-a5b9-d0c36d552bd6";
const OUTPUT_DIR = path.resolve(process.cwd(), "artifacts", "screenshots");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const globalsCss = fs.readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf-8");
const moduleCss = fs.readFileSync(path.resolve(process.cwd(), "src/features/representacion/components/passages/PassageWizard.module.css"), "utf-8");

const sampleWorker = {
  id: "w-101",
  employee_number: "98321045",
  first_name: "MARÍA ELENA",
  paternal_surname: "RAMÍREZ",
  maternal_surname: "GONZÁLEZ",
  category: "ENFERMERA GENERAL",
  assignment: "HGZ No. 83 Camelinas",
  turn: "Matutino",
};

const sampleWorkerAddress = {
  street: "Av. Camelinas 1450 Int. 3B",
  neighborhood: "La Loma",
  postalCode: "58290",
  municipality: "Morelia",
  state: "Michoacán",
};

const sampleAssignmentAddress = {
  street: "Calzada Ventura Puente s/n",
  neighborhood: "Cuauhtémoc",
  postalCode: "58020",
  municipality: "Morelia",
  state: "Michoacán",
};

interface RenderConfig {
  name: string;
  title: string;
  concept: "026" | "027";
  worker: typeof sampleWorker | null;
  controlNumber: string;
  extramural: string;
  transfer: string;
  discontinuousSchedule: "Si" | "No" | "";
  workerAddress: typeof sampleWorkerAddress;
  assignmentAddress: typeof sampleAssignmentAddress;
  phone: string;
  observations: string;
  caseId: string | null;
  folio: string | null;
  isDirty: boolean;
  missingFields: string[];
}

const states: RenderConfig[] = [
  {
    name: "state_a_027_empty",
    title: "Concepto 027 - Estado Inicial (Sin Trabajador)",
    concept: "027",
    worker: null,
    controlNumber: "",
    extramural: "",
    transfer: "",
    discontinuousSchedule: "",
    workerAddress: { street: "", neighborhood: "", postalCode: "", municipality: "", state: "" },
    assignmentAddress: { street: "", neighborhood: "", postalCode: "", municipality: "", state: "" },
    phone: "",
    observations: "",
    caseId: null,
    folio: null,
    isDirty: false,
    missingFields: [],
  },
  {
    name: "state_b_027_worker_selected",
    title: "Concepto 027 - Trabajador Seleccionado (Alta Jerarquía)",
    concept: "027",
    worker: sampleWorker,
    controlNumber: "",
    extramural: "",
    transfer: "",
    discontinuousSchedule: "Si",
    workerAddress: { street: "", neighborhood: "", postalCode: "", municipality: "", state: "" },
    assignmentAddress: { street: "", neighborhood: "", postalCode: "", municipality: "", state: "" },
    phone: "",
    observations: "",
    caseId: null,
    folio: null,
    isDirty: false,
    missingFields: [],
  },
  {
    name: "state_c_027_complete",
    title: "Concepto 027 - Formulario Completo Listo para Preparar",
    concept: "027",
    worker: sampleWorker,
    controlNumber: "027-2026-MICH",
    extramural: "",
    transfer: "",
    discontinuousSchedule: "Si",
    workerAddress: sampleWorkerAddress,
    assignmentAddress: sampleAssignmentAddress,
    phone: "4431234567",
    observations: "Revisado por Delegado Sindical Seccional XXI. Documentación completa cotejada.",
    caseId: null,
    folio: null,
    isDirty: false,
    missingFields: [],
  },
  {
    name: "state_d_027_prepared",
    title: "Concepto 027 - Preparado con Folio y Descarga",
    concept: "027",
    worker: sampleWorker,
    controlNumber: "027-2026-MICH",
    extramural: "",
    transfer: "",
    discontinuousSchedule: "Si",
    workerAddress: sampleWorkerAddress,
    assignmentAddress: sampleAssignmentAddress,
    phone: "4431234567",
    observations: "Expediente generado con éxito.",
    caseId: "case-987",
    folio: "XXI-2026-PAS-000987",
    isDirty: false,
    missingFields: [],
  },
  {
    name: "state_e_026_complete",
    title: "Concepto 026 - Compensación Fija Extramuros Completo",
    concept: "026",
    worker: sampleWorker,
    controlNumber: "",
    extramural: "Traslado y cobertura de jornadas extramuros en unidades de primer nivel y brigadas móviles de salud.",
    transfer: "1 de Octubre al 31 de Diciembre de 2026",
    discontinuousSchedule: "",
    workerAddress: { street: "", neighborhood: "", postalCode: "", municipality: "", state: "" },
    assignmentAddress: { street: "", neighborhood: "", postalCode: "", municipality: "", state: "" },
    phone: "",
    observations: "Autorizado para labores de campo comunitarias.",
    caseId: null,
    folio: null,
    isDirty: false,
    missingFields: [],
  },
];

function renderPage(cfg: RenderConfig): string {
  const content = React.createElement(
    "div",
    { className: "container", style: { maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem" } },
    // Header
    React.createElement(
      "div",
      { style: { marginBottom: "1.5rem" } },
      React.createElement("h1", { style: { fontSize: "1.5rem", fontWeight: 700, margin: 0, color: "var(--fg)" } }, "Pasajes de Representación Sindical"),
      React.createElement("p", { style: { margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.875rem" } }, "Prepara la solicitud con los datos del trabajador y genera los formatos oficiales 026 y 027 listos para imprimir y firmar.")
    ),
    // Layout
    React.createElement(
      "div",
      { className: "layout" },
      React.createElement(
        "div",
        { className: "mainColumn" },
        React.createElement(PassageConceptSelector, {
          concept: cfg.concept,
          onChange: () => {},
        }),
        React.createElement(PassageWorkerSection, {
          selected: cfg.worker,
          onSelect: () => {},
        }),
        React.createElement(PassageRequestDetails, {
          ooad: "MICHOACÁN",
          onOoadChange: () => {},
          requestDate: "2026-09-21",
          onRequestDateChange: () => {},
          controlNumber: cfg.controlNumber,
          onControlNumberChange: () => {},
        }),
        cfg.concept === "026"
          ? React.createElement(Passage026Details, {
              extramuralFunctions: cfg.extramural,
              onExtramuralFunctionsChange: () => {},
              transferPeriod: cfg.transfer,
              onTransferPeriodChange: () => {},
            })
          : React.createElement(Passage027Details, {
              discontinuousSchedule: cfg.discontinuousSchedule,
              onDiscontinuousScheduleChange: () => {},
              workerAddress: cfg.workerAddress,
              onWorkerAddressChange: () => {},
              assignmentAddress: cfg.assignmentAddress,
              onAssignmentAddressChange: () => {},
              phone: cfg.phone,
              onPhoneChange: () => {},
            }),
        React.createElement(PassageInternalNotes, {
          observations: cfg.observations,
          onObservationsChange: () => {},
        }),
        cfg.missingFields.length > 0
          ? React.createElement(PassageValidationBanner, {
              missingFields: cfg.missingFields,
            })
          : null,
        React.createElement(PassageActions, {
          concept: cfg.concept,
          caseId: cfg.caseId,
          folio: cfg.folio,
          isDirty: cfg.isDirty,
          busy: false,
          downloading: false,
          onPrepare: () => {},
          onDownload: () => {},
        })
      ),
      React.createElement(PassageSummarySidebar, {
        concept: cfg.concept,
        worker: cfg.worker,
        ooad: "MICHOACÁN",
        requestDate: "2026-09-21",
        controlNumber: cfg.controlNumber,
        isReadyToDownload: Boolean(cfg.caseId && !cfg.isDirty),
        folio: cfg.folio,
        busy: false,
        downloading: false,
        onPrepare: () => {},
        onDownload: () => {},
      })
    ),
    // Discrete footer disclaimer
    React.createElement(
      "footer",
      { style: { marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", textAlign: "center", fontSize: "0.75rem", color: "var(--muted)" } },
      "La solicitud de pasajes constituye un acto de gestión sindical preparatoria. La autorización definitiva y asignación de presupuesto corresponden a la Subcomisión Mixta de Pasajes conforme al Contrato Colectivo de Trabajo vigente."
    )
  );

  const bodyHtml = ReactDOMServer.renderToString(content);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cfg.title} - Pasajes de Representación Sindical</title>
  <style>
    ${globalsCss}
    ${moduleCss}
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

async function main() {
  console.log("=== INICIANDO CAPTURAS MULTI-RESOLUCIÓN ===");
  const browser = await chromium.launch();

  const viewports = [
    { name: "desktop_1440", width: 1440, height: 900 },
    { name: "laptop_1280", width: 1280, height: 800 },
    { name: "tablet_768", width: 768, height: 1024 },
    { name: "mobile_430", width: 430, height: 932 },
    { name: "mobile_390", width: 390, height: 844 },
    { name: "mobile_360", width: 360, height: 800 },
  ];

  for (const st of states) {
    const html = renderPage(st);
    const htmlPath = path.resolve(OUTPUT_DIR, `preview_${st.name}.html`);
    fs.writeFileSync(htmlPath, html, "utf-8");

    console.log(`\nProcesando estado: ${st.title}`);

    for (const vp of viewports) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
      });

      await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`);
      await page.waitForLoadState("domcontentloaded");

      // Verificación de scroll horizontal indeseado
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (overflow) {
        console.warn(`  [ALERTA OVERFLOW] ${st.name} en ${vp.name} tiene overflow horizontal!`);
      } else {
        console.log(`  [OK NO-OVERFLOW] ${st.name} en ${vp.name} sin scroll horizontal.`);
      }

      const filename = `passage_ux_${st.name}_${vp.name}.png`;
      const outPath = path.join(OUTPUT_DIR, filename);
      const artifactPath = path.join(ARTIFACT_DIR, filename);

      await page.screenshot({ path: outPath, fullPage: true });
      fs.copyFileSync(outPath, artifactPath);

      await page.close();
    }
  }

  await browser.close();
  console.log("\n=== TODAS LAS CAPTURAS COMPLETADAS EXITOSAMENTE ===");
}

main().catch((err) => {
  console.error("Error en generación de capturas:", err);
  process.exit(1);
});
