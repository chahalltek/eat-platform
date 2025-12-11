export type SystemModeName = "pilot" | "production" | "sandbox" | "fire_drill";

export const SYSTEM_MODES: Record<
  SystemModeName,
  { guardrailsPreset: string; agentsEnabled: string[] }
> = {
  pilot: {
    guardrailsPreset: "conservative",
    agentsEnabled: ["RUA", "RINA", "MATCH", "SHORTLIST"],
  },
  production: {
    guardrailsPreset: "balanced",
    agentsEnabled: ["RUA", "RINA", "MATCH", "CONFIDENCE", "EXPLAIN", "SHORTLIST"],
  },
  sandbox: {
    guardrailsPreset: "aggressive",
    agentsEnabled: ["RUA", "RINA", "MATCH", "CONFIDENCE", "EXPLAIN", "SHORTLIST"],
  },
  fire_drill: {
    guardrailsPreset: "conservative",
    agentsEnabled: ["RUA", "RINA", "MATCH", "SHORTLIST"], // CONFIDENCE/EXPLAIN forced off
  },
};
