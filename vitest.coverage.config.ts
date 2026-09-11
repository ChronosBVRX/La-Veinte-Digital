import { defineConfig } from "vitest/config"
import path from "path"

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
      "src/features/tarjeton/__tests__/**/*.test.ts",
      "src/features/calculators/__tests__/calculators.test.ts",
      "src/shared/server/__tests__/**/*.test.ts",
      "src/features/normativa/__tests__/core.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/features/tarjeton/lib/**",
        "src/features/calculators/lib/**",
        "src/shared/server/worker-context-builder.ts",
        "src/features/normativa/core/**",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/types.ts",
        "**/index.ts",
      ],
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 80,
        lines: 75,
      },
    },
  },
})
