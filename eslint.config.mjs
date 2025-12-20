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
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          name: "openai",
          message:
            "Direct OpenAI client imports are restricted; use the shared adapter instead.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='PrismaClient']",
          message:
            "Instantiate PrismaClient only in src/server/db/prisma.ts to ensure consistent mocking.",
        },
      ],
    },
  },
  {
    files: ["src/server/ai/openaiClient.ts", "src/server/ai/gateway.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["src/server/db/prisma.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
]);

export default eslintConfig;
