import { createDefaultNodeHealth, normalizeNodeHealthResponse } from "@/app/system-map/opsImpact";

describe("normalizeNodeHealthResponse", () => {
  it("ignores unknown keys", () => {
    const result = normalizeNodeHealthResponse({
      nodes: {
        intake: { status: "fault" },
        unknown: { status: "fault" },
      },
    });

    expect(result.intake.status).toBe("fault");
    // @ts-expect-error unknown should not be mapped
    expect(result.unknown).toBeUndefined();
  });

  it("defaults missing nodes to healthy", () => {
    const result = normalizeNodeHealthResponse({
      nodes: {
        intake: { status: "fault" },
      },
    });

    expect(result.intake.status).toBe("fault");
    expect(result.database.status).toBe("healthy");
  });

  it("returns a healthy baseline when provided junk input", () => {
    const result = normalizeNodeHealthResponse("not-an-object");
    const baseline = createDefaultNodeHealth();

    expect(result).toEqual(baseline);
  });
});
