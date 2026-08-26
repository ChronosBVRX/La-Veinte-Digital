import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendor assets descargados (workers de PDF.js/Tesseract).
    "public/vendor/**",
    // Supabase local stack temporales (generados por supabase start).
    "supabase/.temp/**",
    // Artefactos generados por Playwright (reportes/traces minificados).
    "playwright-report/**",
    "test-results/**",
    // Artefacto empaquetado del sidecar del estudio (esbuild).
    "apps/radio-studio/sidecar/dist/**",
    "apps/radio-studio/dist/**",
    "apps/radio-studio/src-tauri/target/**",
    // Herramientas vendadas y entornos Python locales (nunca se lintan).
    "tools/**",
    "**/.venv*/**",
    "data/tts/venv/**",
  ]),
]);

export default eslintConfig;
