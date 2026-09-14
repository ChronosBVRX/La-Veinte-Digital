import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Aislamiento Estructural de Representación Sindical", () => {
  const rootDir = process.cwd();
  const unionAppDir = path.join(rootDir, "src", "app", "(union)");
  const dashboardRepresentacionDir = path.join(rootDir, "src", "app", "(dashboard)", "representacion");

  it("NO deben existir rutas de representacion duplicadas en (dashboard)", () => {
    expect(fs.existsSync(dashboardRepresentacionDir)).toBe(false);
  });

  it("todas las 10 páginas sindicales deben residir exclusivamente en src/app/(union)/representacion", () => {
    const requiredPages = [
      "page.tsx",
      path.join("trabajadores", "page.tsx"),
      path.join("maternidad", "page.tsx"),
      path.join("lactancia", "page.tsx"),
      path.join("lockers", "page.tsx"),
      path.join("pasajes", "page.tsx"),
      path.join("licencias", "page.tsx"),
      path.join("expedientes", "page.tsx"),
      path.join("administracion", "page.tsx"),
      path.join("aviso-privacidad", "page.tsx"),
    ];

    const repDir = path.join(unionAppDir, "representacion");
    for (const pageRel of requiredPages) {
      const fullPath = path.join(repDir, pageRel);
      expect(fs.existsSync(fullPath), `Falta la página ${pageRel}`).toBe(true);
    }
  });

  it("src/app/(union)/layout.tsx debe incluir metadata noindex, nofollow", () => {
    const layoutPath = path.join(unionAppDir, "layout.tsx");
    expect(fs.existsSync(layoutPath)).toBe(true);
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toMatch(/index:\s*false/);
    expect(content).toMatch(/follow:\s*false/);
  });

  it("src/app/(union)/layout.tsx debe verificar membresía en servidor y redirigir a no miembros", () => {
    const layoutPath = path.join(unionAppDir, "layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("getUnionMemberships");
    expect(content).toContain('redirect("/")');
    expect(content).toContain('redirect("/login")');
  });

  it("el layout sindical NO debe montar DashboardShell, MobileValueBar, PushTokenSync ni PayslipGlobalInvalidation", () => {
    const layoutPath = path.join(unionAppDir, "layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).not.toContain("DashboardShell");
    expect(content).not.toContain("MobileValueBar");
    expect(content).not.toContain("PushTokenSync");
    expect(content).not.toContain("PayslipGlobalInvalidation");
  });

  it("ningún archivo en src/app/(union) debe importar componentes ni utilidades de tarjetón, agenda, radio o escritos", () => {
    function scanFiles(dir: string): string[] {
      const results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const item of list) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          results.push(...scanFiles(full));
        } else if (/\.(ts|tsx)$/.test(item)) {
          results.push(full);
        }
      }
      return results;
    }

    const files = scanFiles(unionAppDir);
    expect(files.length).toBeGreaterThan(0);

    const forbiddenImports = [
      "@/features/tarjeton",
      "@/features/agenda-laboral",
      "@/features/escritos",
      "@/shared/components/layout/DashboardShell",
      "@/shared/components/app/MobileValueBar",
      "@/shared/components/app/DesktopSidebar",
      "@/shared/components/app/QuickActions",
      "@/shared/components/layout/PayslipGlobalInvalidation",
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      for (const forbidden of forbiddenImports) {
        expect(content).not.toContain(forbidden);
      }
    }
  });
});
