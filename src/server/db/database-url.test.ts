import { describe, expect, it } from "vitest";

import { describeDatabaseUrl } from "./database-url";

describe("describeDatabaseUrl", () => {
  it("redacts host and database name details", () => {
    expect(describeDatabaseUrl("postgres://user:pass@db.prisma.io:5432/main-db")).toBe(
      "postgres://<redacted-host>:<redacted-port>/<redacted-db>",
    );
  });

  it("handles missing database name gracefully", () => {
    expect(describeDatabaseUrl("postgres://db.prisma.io")).toBe("postgres://<redacted-host>/unknown-db");
  });

  it("handles missing host gracefully", () => {
    expect(describeDatabaseUrl("postgres:///main-db")).toBe("postgres://unknown-host/<redacted-db>");
  });

  it("returns a readable fallback for invalid URLs", () => {
    expect(describeDatabaseUrl("not a url")).toBe("an invalid DATABASE_URL");
  });
});
