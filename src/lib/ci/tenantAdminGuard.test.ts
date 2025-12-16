import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";

describe("admin tenant routes avoid strict tenant-admin checks", () => {
  const TARGET_FOLDERS = [
    path.join(process.cwd(), "src/app/api/admin/tenant"),
    path.join(process.cwd(), "src/app/admin/tenant"),
  ];

  function walkFiles(root: string) {
    const entries: string[] = [];

    if (!fs.existsSync(root)) return entries;

    const queue = [root];

    while (queue.length) {
      const current = queue.pop()!;
      const stat = fs.statSync(current);

      if (stat.isDirectory()) {
        const children = fs.readdirSync(current).map((child) => path.join(current, child));
        queue.push(...children);
      } else if (stat.isFile()) {
        entries.push(current);
      }
    }

    return entries;
  }

  it("forbids requireTenantAdmin usage", () => {
    const offenders: string[] = [];

    TARGET_FOLDERS.forEach((root) => {
      walkFiles(root).forEach((filePath) => {
        const contents = fs.readFileSync(filePath, "utf8");

        if (contents.includes("requireTenantAdmin")) {
          offenders.push(path.relative(process.cwd(), filePath));
        }
      });
    });

    if (offenders.length) {
      const listing = offenders.map((file) => ` - ${file}`).join("\n");
      throw new Error(`Use requireGlobalOrTenantAdmin for Option A behavior.\nFound requireTenantAdmin in:\n${listing}`);
    }
  });
});
