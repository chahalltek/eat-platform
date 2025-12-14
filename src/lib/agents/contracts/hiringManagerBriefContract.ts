import Ajv from "ajv";

export type BriefCandidateSummary = {
  candidateId: string;
  name: string;
  headline: string | null;
  matchSummary: string;
  risks: string[];
  confidence: "low" | "medium" | "high";
};

export type BriefConfidence = {
  overall: "low" | "medium" | "high";
  reasons: string[];
};

export type BriefRoleSummary = {
  title: string;
  seniorityLevel: string | null;
  location: string | null;
  responsibilitiesSummary: string | null;
  teamContext: string | null;
};

export type BriefNextStep = {
  step: string;
  confidence: "low" | "medium" | "high";
};

export type HiringManagerBriefPayload = {
  roleSummary: BriefRoleSummary;
  topCandidates: BriefCandidateSummary[];
  confidence: BriefConfidence;
  openQuestions: string[];
  recommendedNextSteps: BriefNextStep[];
};

export const HIRING_MANAGER_BRIEF_PROMPT_VERSION = "v1.0.0";

export const HIRING_MANAGER_BRIEF_SYSTEM_PROMPT = `
You are creating a structured hiring manager brief that can be shared externally.
PROMPT_VERSION: ${HIRING_MANAGER_BRIEF_PROMPT_VERSION}

Your job is to combine the role intent, top candidate signals, and pipeline confidence into a concise JSON artifact.

Rules:
- Output ONLY valid JSON. No prose or markdown.
- Always include at most 3 candidates; if fewer are provided, just use what you have.
- Keep matchSummary focused on why the candidate fits the role; keep risks succinct.
- confidence fields must be "low", "medium", or "high".
- If data is missing, add a clarifying item to openQuestions instead of guessing.

JSON shape:
{
  "roleSummary": {
    "title": string,
    "seniorityLevel": string | null,
    "location": string | null,
    "responsibilitiesSummary": string | null,
    "teamContext": string | null
  },
  "topCandidates": [
    {
      "candidateId": string,
      "name": string,
      "headline": string | null,
      "matchSummary": string,
      "risks": string[],
      "confidence": "low" | "medium" | "high"
    }
  ],
  "confidence": {
    "overall": "low" | "medium" | "high",
    "reasons": string[]
  },
  "openQuestions": string[],
  "recommendedNextSteps": [
    { "step": string, "confidence": "low" | "medium" | "high" }
  ]
}`;

const hiringManagerBriefSchema: object = {
  $id: "https://schemas.eat-ts/hiring-manager-brief.json",
  type: "object",
  additionalProperties: false,
  required: ["roleSummary", "topCandidates", "confidence", "openQuestions", "recommendedNextSteps"],
  properties: {
    roleSummary: {
      type: "object",
      additionalProperties: false,
      required: ["title", "seniorityLevel", "location", "responsibilitiesSummary", "teamContext"],
      properties: {
        title: { type: "string", minLength: 1 },
        seniorityLevel: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
        responsibilitiesSummary: { type: ["string", "null"] },
        teamContext: { type: ["string", "null"] },
      },
    },
    topCandidates: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["candidateId", "name", "headline", "matchSummary", "risks", "confidence"],
        properties: {
          candidateId: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          headline: { type: ["string", "null"] },
          matchSummary: { type: "string", minLength: 1 },
          risks: { type: "array", items: { type: "string" } },
          confidence: { enum: ["low", "medium", "high"] },
        },
      },
    },
    confidence: {
      type: "object",
      additionalProperties: false,
      required: ["overall", "reasons"],
      properties: {
        overall: { enum: ["low", "medium", "high"] },
        reasons: { type: "array", items: { type: "string" } },
      },
    },
    openQuestions: { type: "array", items: { type: "string" } },
    recommendedNextSteps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step", "confidence"],
        properties: {
          step: { type: "string", minLength: 1 },
          confidence: { enum: ["low", "medium", "high"] },
        },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(hiringManagerBriefSchema);

export function assertValidHiringManagerBrief(
  payload: unknown,
): HiringManagerBriefPayload {
  if (validate(payload)) {
    return payload as HiringManagerBriefPayload;
  }

  const errors = validate.errors
    ?.map((err) => {
      const path = (err as { instancePath?: string; dataPath?: string }).instancePath ??
        (err as { instancePath?: string; dataPath?: string }).dataPath ??
        "/";

      return `${path || "/"} ${err.message ?? "is invalid"}`;
    })
    .join("; ");

  throw new Error(`Hiring manager brief failed schema validation: ${errors ?? "Unknown validation error"}`);
}
