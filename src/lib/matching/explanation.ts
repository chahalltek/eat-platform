import Ajv, { JSONSchemaType } from "ajv";

export type SkillOverlap = {
  skill: string;
  status: "matched" | "missing";
  importance: "required" | "preferred";
  weight: number;
  note: string;
};

export type MatchExplanation = {
  topReasons: string[];
  allReasons: string[];
  skillOverlapMap: SkillOverlap[];
  riskAreas: string[];
  exportableText: string;
};

const skillOverlapSchema: JSONSchemaType<SkillOverlap> = {
  type: "object",
  properties: {
    skill: { type: "string" },
    status: { type: "string", enum: ["matched", "missing"] },
    importance: { type: "string", enum: ["required", "preferred"] },
    weight: { type: "number" },
    note: { type: "string" },
  },
  required: ["skill", "status", "importance", "weight", "note"],
  additionalProperties: false,
};

export const matchExplanationSchema: JSONSchemaType<MatchExplanation> = {
  type: "object",
  properties: {
    topReasons: {
      type: "array",
      items: { type: "string" },
      default: [],
    },
    allReasons: {
      type: "array",
      items: { type: "string" },
      default: [],
    },
    skillOverlapMap: {
      type: "array",
      items: skillOverlapSchema,
      default: [],
    },
    riskAreas: {
      type: "array",
      items: { type: "string" },
      default: [],
    },
    exportableText: { type: "string" },
  },
  required: ["topReasons", "allReasons", "skillOverlapMap", "riskAreas", "exportableText"],
  additionalProperties: false,
};

const ajv = new Ajv({ allErrors: true, removeAdditional: "failing" });

const compiledValidator = ajv.compile(matchExplanationSchema);

export function validateMatchExplanation(payload: unknown): payload is MatchExplanation {
  return compiledValidator(payload) as boolean;
}

function coerceReasons(reasons: string[]): MatchExplanation {
  const topReasons = reasons.slice(0, 5);
  return {
    topReasons,
    allReasons: reasons,
    skillOverlapMap: [],
    riskAreas: [],
    exportableText: `Top reasons: ${topReasons.join("; ") || "None"}. No additional skill overlap map available.`,
  };
}

export function normalizeMatchExplanation(raw: unknown): MatchExplanation {
  if (validateMatchExplanation(raw)) {
    return raw;
  }

  if (Array.isArray(raw) && raw.every((entry) => typeof entry === "string")) {
    return coerceReasons(raw);
  }

  return coerceReasons([]);
}
