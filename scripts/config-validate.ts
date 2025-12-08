import { validateConfig } from "../src/lib/config/configValidator";

try {
  validateConfig();
  console.log("Configuration validation passed.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown configuration error";
  console.error("Configuration validation failed:", message);
  process.exit(1);
}
