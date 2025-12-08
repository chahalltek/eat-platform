import fs from "node:fs";
import path from "node:path";

export type TodoFinding = {
  file: string;
  line: number;
  match: string;
};

const KEYWORDS = [/\bTODO\b/i, /\bFIXME\b/i];
const SKIP_FOLDERS = new Set(["node_modules", ".git", ".next", "coverage", "dist"]);

function shouldSkip(entryPath: string, stat: fs.Stats) {
  if (!stat.isDirectory()) return false;
  const base = path.basename(entryPath);
  return SKIP_FOLDERS.has(base);
}

function readLines(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.split(/\r?\n/);
}

function matchesKeywords(line: string) {
  return KEYWORDS.some((pattern) => pattern.test(line));
}

function walkFiles(root: string) {
  const entries: string[] = [];
  const queue: string[] = [root];

  while (queue.length) {
    const current = queue.pop()!;
    const stat = fs.statSync(current);

    if (shouldSkip(current, stat)) continue;

    if (stat.isDirectory()) {
      const children = fs.readdirSync(current).map((child) => path.join(current, child));
      queue.push(...children);
    } else if (stat.isFile()) {
      entries.push(current);
    }
  }

  return entries;
}

export function scanForTodos(paths: string[]) {
  const findings: TodoFinding[] = [];

  paths.forEach((inputPath) => {
    if (!fs.existsSync(inputPath)) return;

    walkFiles(inputPath).forEach((filePath) => {
      readLines(filePath).forEach((line, index) => {
        if (!matchesKeywords(line)) return;

        findings.push({
          file: path.relative(process.cwd(), filePath),
          line: index + 1,
          match: line.trim(),
        });
      });
    });
  });

  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
