import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
<<<<<<< ours
      reporter: ["text", "json", "lcov"],
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
=======
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
>>>>>>> theirs
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
