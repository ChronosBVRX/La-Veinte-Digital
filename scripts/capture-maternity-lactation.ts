// Script para capturar capturas de regresión visual de Maternidad y Lactancia
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

const { MaternidadLactanciaHub } = nodeRequire("../src/features/representacion/components/maternity-lactation/MaternidadLactanciaHub.tsx");
const { MaternityTimeline } = nodeRequire("../src/features/representacion/components/maternity-lactation/MaternityTimeline.tsx");
const { MaternityLactationNav } = nodeRequire("../src/features/representacion/components/maternity-lactation/MaternityLactationNav.tsx");
const { LactationProgress } = nodeRequire("../src/features/representacion/components/maternity-lactation/LactationProgress.tsx");
const { LactationMonthlyBreakdown } = nodeRequire("../src/features/representacion/components/maternity-lactation/LactationMonthlyBreakdown.tsx");
const { LactationModalityCards } = nodeRequire("../src/features/representacion/components/maternity-lactation/LactationModalityCards.tsx");
const { calculateMaternity } = nodeRequire("../src/features/representacion/lib/maternity.ts");
const { calculateLactation, getLactationModalities } = nodeRequire("../src/features/representacion/lib/lactation.ts");

const OUTPUT_DIR = path.resolve(process.cwd(), "artifacts", "screenshots");
const BRAIN_DIR = "C:\\Users\\Axel Rosete\\.gemini\\antigravity\\brain\\d12d4908-1ac7-4822-a8fd-1381d62469f0";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const globalsCss = fs.readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf-8");

function buildPageHtml(title: string, subtitle: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} · Representación Sindical</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${globalsCss}
    body {
      margin: 0;
      padding: 0;
      background: var(--bg, #f8fafc);
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      color: var(--fg, #0f172a);
      -webkit-font-smoothing: antialiased;
    }
    .shell-header {
      height: 56px;
      background: linear-gradient(135deg, #1e3a8a 0%, #172554 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justifyContent: space-between;
      padding: 0 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    .page-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <header class="shell-header">
    <div style="display:flex;align-items:center;gap:0.5rem;font-weight:800;font-size:0.9375rem;">
      <span>🤝</span>
      <span>Representación Sindical</span>
      <span style="font-size:0.625rem;background:rgba(96,165,250,0.2);color:#bfdbfe;padding:2px 6px;border-radius:999px;">Delegación XXI</span>
      <span style="font-size:0.625rem;background:rgba(234,179,8,0.2);color:#fef08a;padding:2px 6px;border-radius:999px;">BETA PRIVADA</span>
    </div>
    <div style="font-size:0.8125rem;color:#e0f2fe;font-weight:600;">
      Maternidad y Lactancia
    </div>
  </header>

  <main class="page-container">
    <div style="margin-bottom:1.25rem;">
      <a href="/representacion" style="font-size:0.8125rem;color:var(--primary,#2563eb);text-decoration:none;font-weight:600;display:inline-block;margin-bottom:0.25rem;">
        ← Representación Sindical
      </a>
      <h1 style="margin:0.25rem 0;font-size:clamp(1.25rem,4vw,1.5rem);font-weight:800;letter-spacing:-0.02em;">
        ${title}
      </h1>
      <p style="margin:0;font-size:0.875rem;color:var(--muted,#64748b);line-height:1.5;">
        ${subtitle}
      </p>
    </div>

    ${bodyContent}
  </main>
</body>
</html>`;
}

// 1. Hub Screen HTML
function renderHubHtml(): string {
  const hubHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(MaternidadLactanciaHub));
  return buildPageHtml(
    "Maternidad y Lactancia",
    "Acompañamiento de la trabajadora desde el inicio de su periodo de maternidad hasta la conclusión de la lactancia.",
    hubHtml
  );
}

// 2. Maternity Screen HTML
function renderMaternityHtml(): string {
  const preview = calculateMaternity("2026-04-01");
  const navHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MaternityLactationNav, { activeTab: "maternidad" })
  );

  const sampleWorkerCard = `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--accent,#f1f5f9);border:1px solid var(--border,#e2e8f0);border-radius:var(--radius,0.5rem);padding:0.625rem 0.75rem;">
      <div>
        <div style="font-weight:700;font-size:0.875rem;">MARÍA ELENA RAMÍREZ GONZÁLEZ</div>
        <div style="font-size:0.75rem;color:var(--muted,#64748b);">Mat. 98321045 · ENFERMERA GENERAL · Matutino</div>
      </div>
      <span style="font-size:0.75rem;color:var(--primary,#2563eb);font-weight:600;">Seleccionada</span>
    </div>
  `;

  const timelineHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MaternityTimeline, { preview, workerId: "w-101" })
  );

  const fullContent = `
    <div style="display:flex;flex-direction:column;gap:1rem;">
      ${navHtml}

      <div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
          <span style="width:22px;height:22px;border-radius:50%;background:var(--primary,#2563eb);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">1</span>
          <span style="font-size:0.875rem;font-weight:700;">Trabajadora</span>
        </div>
        ${sampleWorkerCard}
      </div>

      <div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
          <span style="width:22px;height:22px;border-radius:50%;background:var(--primary,#2563eb);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">2</span>
          <span style="font-size:0.875rem;font-weight:700;">Fecha de incapacidad</span>
        </div>
        <div style="background:#fff;border:1px solid var(--border,#e2e8f0);border-radius:var(--radius,0.5rem);padding:1rem;">
          <label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:0.375rem;">Fecha de inicio de la incapacidad</label>
          <input type="date" value="2026-04-01" style="width:100%;min-height:44px;border:1px solid var(--border,#e2e8f0);border-radius:var(--radius,0.375rem);padding:0.5rem;box-sizing:border-box;" readonly />
        </div>
      </div>

      <div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
          <span style="width:22px;height:22px;border-radius:50%;background:var(--primary,#2563eb);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">3</span>
          <span style="font-size:0.875rem;font-weight:700;">Cronograma resultante y registro</span>
        </div>
        <div style="background:#fff;border:1px solid var(--border,#e2e8f0);border-radius:var(--radius,0.5rem);padding:1.25rem;">
          ${timelineHtml}
        </div>
      </div>
    </div>
  `;

  return buildPageHtml(
    "Maternidad",
    "90 días naturales desde la incapacidad (Cl. 77). Cálculo administrativo orientativo.",
    fullContent
  );
}

// 3. Lactation Screen HTML
function renderLactationHtml(): string {
  const result = calculateLactation("2026-07-01", "2026-10-15");
  const modalities = getLactationModalities("8h");

  const navHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(MaternityLactationNav, { activeTab: "lactancia" })
  );

  const sampleWorkerCard = `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--accent,#f1f5f9);border:1px solid var(--border,#e2e8f0);border-radius:var(--radius,0.5rem);padding:0.625rem 0.75rem;">
      <div>
        <div style="font-weight:700;font-size:0.875rem;">MARÍA ELENA RAMÍREZ GONZÁLEZ</div>
        <div style="font-size:0.75rem;color:var(--muted,#64748b);">Mat. 98321045 · ENFERMERA GENERAL · Matutino</div>
      </div>
      <span style="font-size:0.75rem;color:var(--primary,#2563eb);font-weight:600;">Seleccionada</span>
    </div>
  `;

  const progressHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(LactationProgress, { result })
  );

  const monthlyHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(LactationMonthlyBreakdown, { monthlyBreakdown: result.monthlyBreakdown })
  );

  const modalitiesHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(LactationModalityCards, {
      modalities,
      selectedModality: modalities[0].id,
      onSelectModality: () => {},
    })
  );

  const fullContent = `
    <div style="display:flex;flex-direction:column;gap:1rem;">
      ${navHtml}

      <div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
          <span style="width:22px;height:22px;border-radius:50%;background:var(--primary,#2563eb);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">1</span>
          <span style="font-size:0.875rem;font-weight:700;">Trabajadora</span>
        </div>
        ${sampleWorkerCard}
      </div>

      <div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
          <span style="width:22px;height:22px;border-radius:50%;background:var(--primary,#2563eb);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">2</span>
          <span style="font-size:0.875rem;font-weight:700;">Reanudación y jornada</span>
        </div>
        <div style="background:#fff;border:1px solid var(--border,#e2e8f0);border-radius:var(--radius,0.5rem);padding:1rem;">
          <div style="margin-bottom:0.75rem;">
            <label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:0.375rem;">Fecha de reanudación de labores</label>
            <input type="date" value="2026-07-01" style="width:100%;min-height:44px;border:1px solid var(--border,#e2e8f0);border-radius:var(--radius,0.375rem);padding:0.5rem;box-sizing:border-box;" readonly />
          </div>
          <div>
            <label style="display:block;font-size:0.875rem;font-weight:600;margin-bottom:0.375rem;">Jornada contractual</label>
            <select style="width:100%;min-height:44px;border:1px solid var(--border,#e2e8f0);border-radius:var(--radius,0.375rem);padding:0.5rem;background:#fff;" disabled>
              <option selected>Jornada de 8 horas</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
          <span style="width:22px;height:22px;border-radius:50%;background:var(--primary,#2563eb);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">3</span>
          <span style="font-size:0.875rem;font-weight:700;">Periodo contractual y modalidades</span>
        </div>
        <div style="background:#fff;border:1px solid var(--border,#e2e8f0);border-radius:var(--radius,0.5rem);padding:1.25rem;display:flex;flex-direction:column;gap:1.25rem;">
          ${progressHtml}
          ${monthlyHtml}
          ${modalitiesHtml}
        </div>
      </div>
    </div>
  `;

  return buildPageHtml(
    "Lactancia",
    "365 días desde la reanudación (Cl. 77). Modalidad sujeta a acuerdo cuando aplique.",
    fullContent
  );
}

async function captureScreenshots() {
  console.log("Iniciando captura de capturas visuales Playwright...");
  const browser = await chromium.launch({ headless: true });

  const tasks = [
    {
      name: "maternity_lactation_hub_desktop.png",
      html: renderHubHtml(),
      viewport: { width: 1440, height: 900 },
    },
    {
      name: "maternity_lactation_hub_mobile.png",
      html: renderHubHtml(),
      viewport: { width: 390, height: 844 },
    },
    {
      name: "maternity_desktop.png",
      html: renderMaternityHtml(),
      viewport: { width: 1440, height: 900 },
    },
    {
      name: "maternity_mobile.png",
      html: renderMaternityHtml(),
      viewport: { width: 390, height: 844 },
    },
    {
      name: "lactation_desktop.png",
      html: renderLactationHtml(),
      viewport: { width: 1440, height: 900 },
    },
    {
      name: "lactation_mobile.png",
      html: renderLactationHtml(),
      viewport: { width: 390, height: 844 },
    },
  ];

  for (const t of tasks) {
    const context = await browser.newContext({ viewport: t.viewport });
    const page = await context.newPage();
    await page.setContent(t.html, { waitUntil: "networkidle" });

    const localPath = path.join(OUTPUT_DIR, t.name);
    await page.screenshot({ path: localPath, fullPage: true });
    console.log(`✓ Captura generada en: ${localPath}`);

    // También copiar al directorio de artefactos del asistente si existe
    if (fs.existsSync(BRAIN_DIR)) {
      const brainPath = path.join(BRAIN_DIR, t.name);
      fs.copyFileSync(localPath, brainPath);
      console.log(`  (Copiada a artefactos: ${brainPath})`);
    }

    await context.close();
  }

  await browser.close();
  console.log("¡Todas las capturas se completaron con éxito!");
}

captureScreenshots().catch((err) => {
  console.error("Error al capturar pantallas:", err);
  process.exit(1);
});
