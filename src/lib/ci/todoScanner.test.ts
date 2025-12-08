import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanForTodos } from "./todoScanner";

const tmpRoots: string[] = [];

afterEach(() => {
  while (tmpRoots.length) {
    const dir = tmpRoots.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createFixture(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-scan-"));
  tmpRoots.push(dir);

  Object.entries(files).forEach(([relative, contents]) => {
    const filePath = path.join(dir, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
  });

  return dir;
}

describe("scanForTodos", () => {
  it("reports TODO and FIXME markers with file and line numbers", () => {
    const root = createFixture({
      "src/lib/auth/service.ts": "// TODO tighten validation\nexport const x = 1;",
      "src/lib/billing/index.ts": "/* FIXME billing flow */\nexport const y = 2;",
      "src/lib/tenant/readme.md": "No issues here",
    });

    const results = scanForTodos([
      path.join(root, "src/lib/auth"),
      path.join(root, "src/lib/billing"),
      path.join(root, "src/lib/tenant"),
    ]);

    expect(results).toEqual([
      {
        file: path.relative(process.cwd(), path.join(root, "src/lib/auth/service.ts")),
        line: 1,
        match: "// TODO tighten validation",
      },
      {
        file: path.relative(process.cwd(), path.join(root, "src/lib/billing/index.ts")),
        line: 1,
        match: "/* FIXME billing flow */",
      },
    ]);
  });

  it("ignores missing target paths", () => {
    const missing = path.join(os.tmpdir(), "does-not-exist", `${Date.now()}`);

    expect(scanForTodos([missing])).toEqual([]);
  });
});
