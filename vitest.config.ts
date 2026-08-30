import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // En vitest (entorno node), server-only se reemplaza por un noop.
      // En builds de Next.js, server-only lanza (protección real).
      "server-only": path.resolve(__dirname, "./src/shared/server/worker-profile/__tests__/server-only-stub.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // `.integration.test.ts` (corpus/LLM-dependent) runs only via `npm run test:integration`
    // (vitest.integration.config.ts), so the default CI suite stays green without local infra.
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["**/e2e/**", "**/node_modules/**", "**/*.integration.test.ts"],
  },
})
