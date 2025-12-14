import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = join(process.cwd(), "src", "app", "api");
const DOC_PATH = join(process.cwd(), "docs", "architecture", "api-map.md");
const START_MARKER = "<!-- START:route-inventory -->";
const END_MARKER = "<!-- END:route-inventory -->";
const SUPPORTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;

type HttpMethod = (typeof SUPPORTED_METHODS)[number];

type RouteInfo = {
  path: string;
  methods: HttpMethod[];
  description: string;
};

function walk(dir: string): string[] {
  return readdirSync(dir)
    .map((entry) => join(dir, entry))
    .flatMap((entryPath) => {
      if (statSync(entryPath).isDirectory()) {
        return walk(entryPath);
      }

      return [entryPath];
    });
}

function formatRoutePath(filePath: string): string {
  const relativePath = relative(join(process.cwd(), "src", "app"), filePath).replace(/\\/g, "/");
  const withoutRouteFile = relativePath.replace(/\/route\.ts$/, "");
  return `/${withoutRouteFile}`;
}

function extractDescription(content: string): string {
  const match = /\/\*\*([\s\S]*?)\*\/\s*export\s+(?:async\s+function|const)\s+[A-Z]+\b/.exec(content);

  if (!match) return "";

  const cleaned = match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

function extractMethods(content: string): HttpMethod[] {
  const methods = new Set<HttpMethod>();
  const declarationRegex = /export\s+(?:async\s+function|const)\s+([A-Z]+)\b/g;
  const reExportRegex = /export\s*{\s*([^}]+)}/g;
  let match: RegExpExecArray | null;

  while ((match = declarationRegex.exec(content)) !== null) {
    const method = match[1];
    if (SUPPORTED_METHODS.includes(method as HttpMethod)) {
      methods.add(method as HttpMethod);
    }
  }

  while ((match = reExportRegex.exec(content)) !== null) {
    const tokens = match[1].split(",").map((token) => token.trim().split(/\s+as\s+/i)[0]);
    tokens.forEach((token) => {
      if (SUPPORTED_METHODS.includes(token as HttpMethod)) {
        methods.add(token as HttpMethod);
      }
    });
  }

  return Array.from(methods).sort();
}

function buildTable(routes: RouteInfo[]): string {
  const header = ["| Path | Methods | Description |", "| --- | --- | --- |"];
  const rows = routes.map((route) => {
    const methods = route.methods.length ? route.methods.join(", ") : "—";
    const description = route.description || "—";
    return `| ${route.path} | ${methods} | ${description} |`;
  });

  const timestamp = new Date().toISOString();
  const footer = [``, `_Generated ${timestamp} via \`npm run docs:api-map\`._`, ``];

  return [...header, ...rows, ...footer].join("\n");
}

function ensureMarkersPresent(doc: string) {
  if (!doc.includes(START_MARKER) || !doc.includes(END_MARKER)) {
    throw new Error("api-map.md is missing route inventory markers.");
  }
}

function main() {
  const files = walk(API_ROOT).filter((filePath) => filePath.endsWith("route.ts"));
  const routes: RouteInfo[] = files
    .map((filePath) => {
      const content = readFileSync(filePath, "utf8");
      return {
        path: formatRoutePath(filePath),
        methods: extractMethods(content),
        description: extractDescription(content),
      } satisfies RouteInfo;
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const table = buildTable(routes);
  const doc = readFileSync(DOC_PATH, "utf8");
  ensureMarkersPresent(doc);

  const sectionRegex = new RegExp(`${START_MARKER}[\n\r]*[\\s\\S]*?${END_MARKER}`);
  const updated = doc.replace(sectionRegex, `${START_MARKER}\n${table}\n${END_MARKER}`);
  writeFileSync(DOC_PATH, updated);
}

main();
