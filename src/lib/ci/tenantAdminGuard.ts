import fs from "node:fs";
import path from "node:path";

export type GuardFinding = {
  file: string;
  guard: string;
  line: number;
  match: string;
};

function walkFiles(root: string) {
  const entries: string[] = [];

  if (!fs.existsSync(root)) return entries;

  const queue = [root];

  while (queue.length) {
    const current = queue.pop()!;
    const stat = fs.statSync(current);

    if (stat.isDirectory()) {
      const children = fs
        .readdirSync(current)
        .map((child) => path.join(current, child));
      queue.push(...children);
    } else if (stat.isFile()) {
      entries.push(current);
    }
  }

  return entries;
}

export function scanForForbiddenGuards(paths: string[], forbiddenGuards: string[]) {
  const findings: GuardFinding[] = [];

  paths.forEach((inputPath) => {
    walkFiles(inputPath).forEach((filePath) => {
      const contents = fs.readFileSync(filePath, "utf8");
      const lines = contents.split(/\r?\n/);

      lines.forEach((line, index) => {
        forbiddenGuards.forEach((guard) => {
          if (line.includes(guard)) {
            findings.push({
              file: path.relative(process.cwd(), filePath),
              guard,
              line: index + 1,
              match: line.trim(),
            });
          }
        });
      });
    });
  });

  return findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.guard.localeCompare(b.guard),
  );
}
