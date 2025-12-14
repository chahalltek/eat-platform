export type JobIntentRequirement = {
  id: string;
  type: 'skill' | 'location' | 'seniority' | 'employmentType' | 'summary' | 'other';
  label: string;
  normalizedLabel?: string | null;
  weight: number;
  confidence: number;
  required?: boolean;
  metadata?: Record<string, unknown>;
};

export type JobIntentMetadata = {
  sourceDescription?: string | null;
  createdFrom?: string | null;
};

export type JobIntentPayload = {
  summary?: string | null;
  requirements: JobIntentRequirement[];
  weightings?: Record<string, number>;
  confidenceLevels?: Record<string, number>;
  metadata?: JobIntentMetadata;
};
