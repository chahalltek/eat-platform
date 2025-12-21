module.exports = {
  presets: ["next/babel"],
  env: {
    coverage_e2e: {
<<<<<<< ours
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
=======
      plugins: ["istanbul"],
>>>>>>> theirs
    },
  },
};
