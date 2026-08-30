import { defineConfig } from "vitest/config"
import path from "path"

// Suite de INTEGRACIÓN opcional: requiere infraestructura local (corpus normativo y/o LLM local).
// Se ejecuta bajo demanda con `npm run test:integration`; NO forma parte de `npm test` (CI sin infra).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/shared/server/worker-profile/__tests__/server-only-stub.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "**/*.integration.test.ts",
      "src/features/normativa/__tests__/rag-questions.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
})
