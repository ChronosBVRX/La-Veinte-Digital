import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = "C:\\Users\\Axel Rosete\\.gemini\\antigravity\\brain\\82710181-5d4a-4245-b75a-46d395c7f4db";
const OUTPUT_DIR = path.resolve(process.cwd(), "artifacts", "screenshots");

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const envContent = fs.readFileSync(".env.local", "utf-8");
  const env = {};
  for (const line of envContent.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx > 0) {
      let v = t.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[t.slice(0, idx).trim()] = v;
    }
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: env.E2E_USER_EMAIL,
  });

  if (linkErr) {
    throw new Error(`Error generateLink: ${linkErr.message}`);
  }

  let capturedCookies = [];
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return []; },
      setAll(c) { capturedCookies = c; }
    }
  });

  const { data: verifyData, error: verifyErr } = await ssr.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyErr) {
    throw new Error(`Error verifyOtp: ${verifyErr.message}`);
  }

  console.log("Sesión autenticada para:", verifyData.user?.email);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Agregar cookies al contexto del navegador
  const playwrightCookies = capturedCookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: "la20.com.mx",
    path: "/",
    httpOnly: c.options?.httpOnly ?? true,
    secure: true,
    sameSite: "Lax",
  }));

  await context.addCookies(playwrightCookies);

  const page = await context.newPage();
  console.log("Navegando directamente a https://la20.com.mx/representacion...");
  await page.goto("https://la20.com.mx/representacion", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log("URL final en producción:", currentUrl);

  const bodyText = await page.innerText("body");
  const checks = {
    hasHero: bodyText.includes("Centro de Representación Sindical"),
    hasSituacion: bodyText.includes("Situación actual"),
    hasAcciones: bodyText.includes("¿Qué quieres hacer?"),
    hasAtencion: bodyText.includes("Requiere tu atención"),
    hasActividad: bodyText.includes("Actividad reciente"),
  };

  console.log("Comprobación literal en producción:", JSON.stringify(checks, null, 2));

  const outDesktop = path.join(OUTPUT_DIR, "production_current_desktop.png");
  const artDesktop = path.join(ARTIFACT_DIR, "production_current_desktop.png");
  await page.screenshot({ path: outDesktop, fullPage: true });
  fs.copyFileSync(outDesktop, artDesktop);
  console.log("Screenshot guardado en:", outDesktop);

  await browser.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
