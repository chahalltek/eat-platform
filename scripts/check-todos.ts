import { scanForTodos } from "../src/lib/ci/todoScanner";

const TARGET_DIRECTORIES = ["src/lib/auth", "src/lib/billing", "src/lib/tenant"];

const findings = scanForTodos(TARGET_DIRECTORIES);

if (findings.length) {
  console.error("TODO/FIXME markers are not allowed in protected domains:\n");
  findings.forEach((finding) => {
    console.error(`- ${finding.file}:${finding.line} — ${finding.match}`);
  });
  process.exit(1);
}

console.log("No TODO/FIXME markers found in auth, billing, or tenant code.");
