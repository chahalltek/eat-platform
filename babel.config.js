module.exports = {
  presets: ["next/babel"],
  env: {
    coverage_e2e: {
      plugins: [
        [
          "istanbul",
          {
            exclude: [
              "**/*.test.*",
              "**/*.spec.*",
              "e2e/**",
              "src/test-helpers/**",
              "**/*.d.ts",
              ".next/**",
              "node_modules/**",
            ],
          },
        ],
      ],
    },
  },
};
