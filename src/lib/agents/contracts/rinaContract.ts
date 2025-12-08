import Ajv, { JSONSchemaType } from 'ajv';

export type RinaLLMResponseSkill = {
  name: string;
  normalizedName: string;
  proficiency: string | null;
  yearsOfExperience: number | null;
};

export type RinaLLMResponse = {
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  totalExperienceYears: number | null;
  seniorityLevel: string | null;
  summary: string | null;
  skills: RinaLLMResponseSkill[];
  parsingConfidence: number;
  warnings: string[];
};

export const RINA_PROMPT_VERSION = 'v1.0.0';

export const RINA_SYSTEM_PROMPT = `
You are RINA (Resume Intake Agent) for a recruiting platform.
PROMPT_VERSION: ${RINA_PROMPT_VERSION}

Your job is to read a raw resume and produce a STRICT JSON object describing the candidate.

Rules:
- Output ONLY valid JSON. No prose, no markdown.
- Do not invent contact details if they are not present.
- Be conservative with seniority and years of experience.
- Normalize skills where possible (React.js and ReactJS -> React).
- parsingConfidence should be between 0 and 1.
- warnings is an array of human-readable messages about any ambiguity.

JSON shape:
{
  "fullName": string,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "currentTitle": string | null,
  "currentCompany": string | null,
  "totalExperienceYears": number | null,
  "seniorityLevel": string | null,
  "summary": string | null,
  "skills": [
    {
      "name": string,
      "normalizedName": string,
      "proficiency": string | null,
      "yearsOfExperience": number | null
    }
  ],
  "parsingConfidence": number,
  "warnings": string[]
}`;

const rinaResponseSchema: JSONSchemaType<RinaLLMResponse> = {
  $id: 'https://schemas.eat-ts/rina-response.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'fullName',
    'email',
    'phone',
    'location',
    'currentTitle',
    'currentCompany',
    'totalExperienceYears',
    'seniorityLevel',
    'summary',
    'skills',
    'parsingConfidence',
    'warnings',
  ],
  properties: {
    fullName: { type: 'string', minLength: 1 },
    email: { type: ['string', 'null'], nullable: true },
    phone: { type: ['string', 'null'], nullable: true },
    location: { type: ['string', 'null'], nullable: true },
    currentTitle: { type: ['string', 'null'], nullable: true },
    currentCompany: { type: ['string', 'null'], nullable: true },
    totalExperienceYears: { type: ['number', 'null'], nullable: true },
    seniorityLevel: { type: ['string', 'null'], nullable: true },
    summary: { type: ['string', 'null'], nullable: true },
    skills: {
      type: 'array',
      minItems: 0,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'normalizedName', 'proficiency', 'yearsOfExperience'],
        properties: {
          name: { type: 'string', minLength: 1 },
          normalizedName: { type: 'string', minLength: 1 },
          proficiency: { type: ['string', 'null'], nullable: true },
          yearsOfExperience: { type: ['number', 'null'], nullable: true },
        },
      },
    },
    parsingConfidence: { type: 'number', minimum: 0, maximum: 1 },
    warnings: { type: 'array', items: { type: 'string' } },
  },
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(rinaResponseSchema);

export function assertValidRinaResponse(payload: unknown): RinaLLMResponse {
  if (validate(payload)) {
    return payload;
  }

  const errors = validate.errors
    ?.map((err) => `${err.instancePath || '/'} ${err.message ?? 'is invalid'}`)
    .join('; ');

  throw new Error(`RINA response failed schema validation: ${errors ?? 'Unknown validation error'}`);
}
