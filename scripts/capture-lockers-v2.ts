import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { LockerMetrics } from "../src/features/representacion/components/lockers/LockerMetrics";
import { LockerZoneNavigator } from "../src/features/representacion/components/lockers/LockerZoneNavigator";
import { LockerZoneMap } from "../src/features/representacion/components/lockers/LockerZoneMap";
import { LockerViewSwitcher } from "../src/features/representacion/components/lockers/LockerViewSwitcher";
import { RepresentationSectionHeader } from "../src/features/representacion/components/ui";
import type { LockerZone, LockerBank, LockerMapItem } from "../src/features/representacion/lib/lockers";

const ARTIFACT_DIR = "C:\\Users\\Axel Rosete\\.gemini\\antigravity\\brain\\82710181-5d4a-4245-b75a-46d395c7f4db";
const OUTPUT_DIR = path.resolve(process.cwd(), "artifacts", "screenshots");

const sampleZones: LockerZone[] = [
  {
    id: "zone-pb",
    delegation_id: "del-xxi",
    name: "Vestidores Planta Baja",
    description: "Zona principal de vestidores generales frente a quirófanos",
    building: "Hospital General Regional No. 1 Charo",
    floor: "Planta Baja",
    sort_order: 1,
    active: true,
    total_lockers: 48,
    assigned_lockers: 36,
    available_lockers: 10,
    attention_lockers: 2,
  },
  {
    id: "zone-p1",
    delegation_id: "del-xxi",
    name: "Piso 1 Quirófanos",
    description: "Vestidores de personal quirúrgico y anestesia",
    building: "HGR 1 Charo",
    floor: "Piso 1",
    sort_order: 2,
    active: true,
    total_lockers: 32,
    assigned_lockers: 28,
    available_lockers: 4,
    attention_lockers: 0,
  },
];

const sampleBanks: LockerBank[] = [
  {
    id: "bank-a",
    delegation_id: "del-xxi",
    zone_id: "zone-pb",
    name: "Mueble A (Hilera Norte)",
    description: "Bloque metálico de 4 filas × 6 columnas",
    rows: 4,
    columns: 6,
    sort_order: 1,
    orientation: "horizontal",
    active: true,
  },
  {
    id: "bank-b",
    delegation_id: "del-xxi",
    zone_id: "zone-pb",
    name: "Mueble B (Hilera Sur)",
    description: "Bloque metálico de 4 filas × 6 columnas",
    rows: 4,
    columns: 6,
    sort_order: 2,
    orientation: "horizontal",
    active: true,
  },
];

// Generate lockers for Bank A (4x6 = 24 slots, with 2 empty slots / holes)
const sampleLockers: LockerMapItem[] = [];

for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 6; c++) {
    const num = 101 + r * 6 + c;
    const isHole = (r === 1 && c === 2) || (r === 3 && c === 4);
    const isOccupied = !isHole && num % 3 !== 0;
    const isDamaged = num === 114;

    sampleLockers.push({
      id: `loc-${num}`,
      locker_number: String(num),
      zone_id: "zone-pb",
      bank_id: "bank-a",
      zone_name: "Vestidores Planta Baja",
      bank_name: "Mueble A (Hilera Norte)",
      row_position: r,
      column_position: c,
      status: isDamaged ? "maintenance" : isOccupied ? "assigned" : "available",
      condition: isDamaged ? "maintenance" : "ok",
      maintenance_reason: isDamaged ? "Cerradura forzada / puerta vencida" : null,
      is_empty_slot: isHole,
      occupant_name: isOccupied ? (num % 2 === 0 ? "Dr. García Morales Roberto" : "Lic. Elena Soto Rodríguez") : null,
      occupant_employee_number: isOccupied ? String(98120000 + num) : null,
      occupant_category: isOccupied ? "MÉDICO NO FAMILIAR" : null,
      occupant_turn: isOccupied ? "MATUTINO" : null,
      active_assignment: isOccupied ? {
        id: `asg-${num}`,
        worker_id: `w-${num}`,
        worker_name: num % 2 === 0 ? "Dr. García Morales Roberto" : "Lic. Elena Soto Rodríguez",
        employee_number: String(98120000 + num),
        assigned_at: "2026-02-15T00:00:00Z",
      } : null,
      effective_state: isHole
        ? {
            kind: "empty_slot",
            label: "Espacio Vacío",
            description: "Hueco físico en la retícula",
            isAvailable: false,
            isAssigned: false,
            hasAttention: false,
            hasDiscrepancy: false,
            discrepancyMessage: null,
            badge: { singular: "Hueco", plural: "Huecos", description: "Hueco", bg: "transparent", color: "var(--muted)", border: "transparent", dotColor: "transparent" },
          }
        : isDamaged
        ? {
            kind: "damaged",
            label: "Dañado",
            description: "Cerradura forzada",
            isAvailable: false,
            isAssigned: false,
            hasAttention: true,
            hasDiscrepancy: false,
            discrepancyMessage: null,
            badge: { singular: "Dañado", plural: "Dañados", description: "Dañado", bg: "#fef2f2", color: "#991b1b", border: "#fecaca", dotColor: "#ef4444" },
          }
        : isOccupied
        ? {
            kind: "assigned",
            label: "Asignado",
            description: "Ocupado",
            isAvailable: false,
            isAssigned: true,
            hasAttention: false,
            hasDiscrepancy: false,
            discrepancyMessage: null,
            occupantSummary: { name: "Dr. García Morales", employeeNumber: "98120101" },
            badge: { singular: "Asignado", plural: "Asignados", description: "Ocupado", bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe", dotColor: "#2563eb" },
          }
        : {
            kind: "available",
            label: "Disponible",
            description: "Libre para asignación",
            isAvailable: true,
            isAssigned: false,
            hasAttention: false,
            hasDiscrepancy: false,
            discrepancyMessage: null,
            badge: { singular: "Disponible", plural: "Disponibles", description: "Libre", bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", dotColor: "#16a34a" },
          },
    });
  }
}

async function run(): Promise<void> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const content = React.createElement(
    "div",
    {
      style: {
        maxWidth: 1280,
        margin: "0 auto",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      },
    },
    React.createElement(RepresentationSectionHeader, {
      title: "Lockers — Delegación XXI",
      subtitle: "Centro visual y operativo de casilleros. Mapa digital del inventario físico, asignaciones y estado en tiempo real.",
      secondaryAction: React.createElement(
        "div",
        { style: { display: "flex", gap: "0.5rem" } },
        React.createElement("button", { style: { padding: "0.45rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--card)", fontSize: "0.8125rem", fontWeight: 600 } }, "Descargar CSV"),
        React.createElement("button", { style: { padding: "0.45rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--card)", fontSize: "0.8125rem", fontWeight: 600 } }, "Actualizar base"),
        React.createElement("button", { style: { padding: "0.45rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--accent)", color: "var(--fg)", fontSize: "0.8125rem", fontWeight: 600 } }, "⚙ Zonas y Muebles")
      ),
      primaryAction: React.createElement("button", { style: { padding: "0.45rem 0.875rem", borderRadius: "0.375rem", border: "none", background: "var(--primary)", color: "#fff", fontSize: "0.8125rem", fontWeight: 700 } }, "+ Asignar casillero"),
    }),
    React.createElement(LockerMetrics, {
      metrics: {
        total: 1199,
        assigned: 357,
        available: 842,
        attention: 14,
        maintenance: 6,
        unlocated: 1199,
        waitlistCount: 3,
      },
    }),
    React.createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" } },
      React.createElement(LockerViewSwitcher, {
        currentView: "map",
        onViewChange: () => {},
        pendingCount: 14,
        waitlistCount: 3,
      }),
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
        React.createElement("input", {
          type: "search",
          placeholder: "Buscar casillero # o trabajador...",
          value: "",
          readOnly: true,
          style: { padding: "0.45rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--card)", fontSize: "0.8125rem", minWidth: 260 },
        })
      )
    ),
    React.createElement(LockerZoneNavigator, {
      zones: sampleZones,
      selectedZoneId: "zone-pb",
      unlocatedCount: 1199,
      totalLockersCount: 1199,
      onSelectZone: () => {},
      isAdmin: true,
    }),
    React.createElement(LockerZoneMap, {
      zones: sampleZones,
      banks: sampleBanks,
      lockers: sampleLockers,
      selectedZoneId: "zone-pb",
      highlightedLockerId: "loc-108",
      onLockerClick: () => {},
      isAdmin: true,
    })
  );

  const contentHtml = ReactDOMServer.renderToString(content);

  const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lockers 2.0 - Centro Visual y Operativo</title>
  <style>
    :root {
      --bg: #f8fafc;
      --fg: #0f172a;
      --primary: #2563eb;
      --primary-fg: #ffffff;
      --border: #e2e8f0;
      --muted: #64748b;
      --card: #ffffff;
      --accent: #f1f5f9;
      --radius: 0.375rem;
      --radius-lg: 0.5rem;
    }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    * {
      box-sizing: border-box;
    }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.6); }
      50% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); }
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>`;

  const previewHtmlPath = path.resolve(OUTPUT_DIR, "preview-lockers-v2.html");
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

    const outPng = path.join(OUTPUT_DIR, `union_lockers_v2_${vp.name}.png`);
    const artifactPng = path.join(ARTIFACT_DIR, `union_lockers_v2_${vp.name}.png`);

    await page.screenshot({ path: outPng, fullPage: true });
    fs.copyFileSync(outPng, artifactPng);

    console.log(`Captura ${vp.name} guardada en:`, outPng);
    console.log(`Copia en artefactos:`, artifactPng);
    await page.close();
  }

  await browser.close();
  console.log("Capturas de Lockers 2.0 generadas exitosamente.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
