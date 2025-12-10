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
<<<<<<< ours
      reporter: ["text", "json", "lcov", "html"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
=======
=======
>>>>>>> theirs
      reporter: ["text", "json", "lcov"],
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
