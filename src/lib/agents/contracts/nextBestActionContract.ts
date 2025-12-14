import Ajv from "ajv";

export type NextBestActionRecommendation = {
  actionId: string;
  title: string;
  owner: "recruiter" | "sales" | "ops" | "automation";
  urgency: "low" | "medium" | "high";
  rationale: string;
  expectedImpact: string;
  playbook: string[];
  successMetric: string;
  confidence: "low" | "medium" | "high";
};

export type NextBestActionLLMResponse = {
  recommendation: NextBestActionRecommendation;
  supportingSignals: string[];
  warning: string | null;
};

export const NEXT_BEST_ACTION_PROMPT_VERSION = "v1.0.0";

export const NEXT_BEST_ACTION_SYSTEM_PROMPT = `
You are the Next Best Action (NBA) agent for job-level orchestration.
PROMPT_VERSION: ${NEXT_BEST_ACTION_PROMPT_VERSION}

Your job is to read pipeline health, confidence distribution, and ETE market signals to pick exactly ONE next action.

Rules:
- Output ONLY valid JSON. No prose, no markdown.
- Always return a single recommendation object (never an array).
- Make the action owner explicit and keep the playbook steps actionable.
- Confidence must be "low", "medium", or "high" and urgency must be "low", "medium", or "high".
- Keep rationale and expectedImpact concise (1-2 sentences each).

JSON shape:
{
  "recommendation": {
    "actionId": string,
    "title": string,
    "owner": "recruiter" | "sales" | "ops" | "automation",
    "urgency": "low" | "medium" | "high",
    "rationale": string,
    "expectedImpact": string,
    "playbook": string[],
    "successMetric": string,
    "confidence": "low" | "medium" | "high"
  },
  "supportingSignals": string[],
  "warning": string | null
}`;

const nextBestActionResponseSchema: object = {
  $id: "https://schemas.eat-ts/next-best-action-response.json",
  type: "object",
  additionalProperties: false,
  required: ["recommendation", "supportingSignals", "warning"],
  properties: {
    recommendation: {
      type: "object",
      additionalProperties: false,
      required: [
        "actionId",
        "title",
        "owner",
        "urgency",
        "rationale",
        "expectedImpact",
        "playbook",
        "successMetric",
        "confidence",
      ],
      properties: {
        actionId: { type: "string", minLength: 1 },
        title: { type: "string", minLength: 1 },
        owner: { enum: ["recruiter", "sales", "ops", "automation"] },
        urgency: { enum: ["low", "medium", "high"] },
        rationale: { type: "string", minLength: 1 },
        expectedImpact: { type: "string", minLength: 1 },
        playbook: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
        successMetric: { type: "string", minLength: 1 },
        confidence: { enum: ["low", "medium", "high"] },
      },
    },
    supportingSignals: { type: "array", items: { type: "string", minLength: 1 } },
    warning: { type: ["string", "null"] },
  },
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(nextBestActionResponseSchema);

export function assertValidNextBestActionResponse(payload: unknown): NextBestActionLLMResponse {
  if (validate(payload)) {
    return payload as NextBestActionLLMResponse;
  }

  const errors = validate.errors
    ?.map((err) => {
      const path = (err as { instancePath?: string; dataPath?: string }).instancePath ??
        (err as { instancePath?: string; dataPath?: string }).dataPath ??
        "/";

      return `${path || "/"} ${err.message ?? "is invalid"}`;
    })
    .join("; ");

  throw new Error(`Next Best Action response failed schema validation: ${errors ?? "Unknown validation error"}`);
}
