import Ajv, { JSONSchemaType } from 'ajv';

export type RuaLLMSkill = {
  name: string;
  normalizedName: string;
  isMustHave: boolean;
};

export type RuaLLMResponse = {
  clientName: string | null;
  title: string;
  seniorityLevel: string | null;
  location: string | null;
  remoteType: string | null;
  employmentType: string | null;
  responsibilitiesSummary: string | null;
  teamContext: string | null;
  priority: string | null;
  status: string | null;
  ambiguityScore: number | null;
  skills: RuaLLMSkill[];
};

export const RUA_PROMPT_VERSION = 'v1.0.0';

export const RUA_SYSTEM_PROMPT = `
You are RUA (Role Understanding Agent) for a recruiting platform.
PROMPT_VERSION: ${RUA_PROMPT_VERSION}

Your job is to read a raw job description and produce a STRICT JSON object describing the job requirements.

Rules:
- Output ONLY valid JSON. No prose, no markdown.
- Be conservative with seniority and requirements.
- Normalize skills where possible (React.js and ReactJS -> React).
- ambiguityScore should be between 0 and 1 reflecting how unclear the description is.

JSON shape:
{
  "clientName": string | null,
  "title": string,
  "seniorityLevel": string | null,
  "location": string | null,
  "remoteType": string | null,
  "employmentType": string | null,
  "responsibilitiesSummary": string | null,
  "teamContext": string | null,
  "priority": string | null,
  "status": string | null,
  "ambiguityScore": number | null,
  "skills": [
    {
      "name": string,
      "normalizedName": string,
      "isMustHave": boolean
    }
  ]
}`;

const ruaResponseSchema: JSONSchemaType<RuaLLMResponse> = {
  $id: 'https://schemas.eat-ts/rua-response.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'clientName',
    'title',
    'seniorityLevel',
    'location',
    'remoteType',
    'employmentType',
    'responsibilitiesSummary',
    'teamContext',
    'priority',
    'status',
    'ambiguityScore',
    'skills',
  ],
  properties: {
    clientName: { type: ['string', 'null'], nullable: true },
    title: { type: 'string', minLength: 1 },
    seniorityLevel: { type: ['string', 'null'], nullable: true },
    location: { type: ['string', 'null'], nullable: true },
    remoteType: { type: ['string', 'null'], nullable: true },
    employmentType: { type: ['string', 'null'], nullable: true },
    responsibilitiesSummary: { type: ['string', 'null'], nullable: true },
    teamContext: { type: ['string', 'null'], nullable: true },
    priority: { type: ['string', 'null'], nullable: true },
    status: { type: ['string', 'null'], nullable: true },
    ambiguityScore: { type: ['number', 'null'], nullable: true, minimum: 0, maximum: 1 },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'normalizedName', 'isMustHave'],
        properties: {
          name: { type: 'string', minLength: 1 },
          normalizedName: { type: 'string', minLength: 1 },
          isMustHave: { type: 'boolean' },
        },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(ruaResponseSchema);

export function assertValidRuaResponse(payload: unknown): RuaLLMResponse {
  if (validate(payload)) {
    return payload;
  }

  const errors = validate.errors
    ?.map((err) => `${err.instancePath || '/'} ${err.message ?? 'is invalid'}`)
    .join('; ');

  throw new Error(`RUA response failed schema validation: ${errors ?? 'Unknown validation error'}`);
}
