/// <reference types="vitest/globals" />

import { classifyRoleFamily, __testing } from "./roleFamilyClassifier";

describe("classifyRoleFamily", () => {
  it("maps engineering titles with strong title cues", () => {
    const result = classifyRoleFamily({ title: "Senior Backend Engineer", skills: ["Node.js", "AWS"] });

    expect(result.family).toBe("Engineering");
    expect(result.scores[0]).toEqual(
      expect.objectContaining({
        family: "Engineering",
        titleMatches: expect.arrayContaining(["engineer", "backend"]),
      }),
    );
  });

  it("uses skills when title is ambiguous", () => {
    const result = classifyRoleFamily({ title: "Specialist", skills: ["SQL", "Tableau", "Snowflake"] });

    expect(result.family).toBe("Data");
    expect(result.scores[0].skillMatches).toEqual(expect.arrayContaining(["sql", "tableau", "snowflake"]));
  });

  it("differentiates product from operations", () => {
    const product = classifyRoleFamily({ title: "Principal Product Manager", skills: ["Roadmaps", "Discovery"] });
    const ops = classifyRoleFamily({ title: "People Operations Lead", skills: ["Benefits", "Payroll"] });

    expect(product.family).toBe("Product");
    expect(ops.family).toBe("Operations");
  });

  it("covers go-to-market roles", () => {
    const result = classifyRoleFamily({ title: "Account Executive, Mid-Market", skills: ["Quota", "Salesforce", "Pipeline"] });

    expect(result.family).toBe("Sales");
    expect(result.scores[0].score).toBeGreaterThan(0);
  });

  it("falls back to Custom when no rules match", () => {
    const result = classifyRoleFamily({ title: "Choreographer", skills: ["Ballet", "Studio Management"] });

    expect(result.family).toBe("Custom");
  });

  it("allows a caller-provided fallback family", () => {
    const result = classifyRoleFamily({ title: "Regional Hardware Lead", skills: ["Supply chain"], fallbackFamily: "Operations" });

    expect(result.family).toBe("Operations");
  });
});

describe("scoreRule", () => {
  it("weights title matches heavier than skills", () => {
    const rule = __testing.ROLE_FAMILY_RULES.find((entry) => entry.family === "Engineering");
    const result = __testing.scoreRule({ title: "QA Lead", skills: ["automation", "python"] }, rule!);

    expect(result.titleMatches).toEqual(expect.arrayContaining(["qa"]));
    expect(result.score).toBeGreaterThan(result.skillMatches.length);
  });
});
