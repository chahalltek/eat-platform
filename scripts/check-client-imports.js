#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(process.cwd(), "src");
const bannedImports = ["@/server/", "@prisma/client"];
const violations = [];

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules") continue;

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.name.match(/\.(t|j)sx?$/)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/);
    const header = lines.slice(0, 5).join("\n");

    if (!header.includes("use client")) continue;

    lines.forEach((line, index) => {
      bannedImports.forEach((token) => {
        if (line.includes("import") && line.includes(token)) {
          violations.push({ file: fullPath, line: index + 1, snippet: line.trim() });
        }
      });
    });
  }
}

walk(ROOT);

if (violations.length) {
  console.error("Client components must not import server-only modules or Prisma:");
  violations.forEach((violation) => {
    console.error(`- ${path.relative(process.cwd(), violation.file)}:${violation.line} → ${violation.snippet}`);
  });
  process.exit(1);
}

console.log("Client import guard passed");
