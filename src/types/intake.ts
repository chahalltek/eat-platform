export type IntakeSkill = {
  name: string;
  required?: boolean;
  weight?: number;
};

export type MarketSignal = {
  title: string;
  description: string;
  tone?: "info" | "caution";
};

export type JobIntakeProfile = {
  title: string | null;
  customer: string | null;
  skills: IntakeSkill[];
  mustHaves: string[];
  ambiguities: string[];
  rawDescription: string;
  frictionLevel?: "low" | "medium" | "high";
  candidatePoolImpact?: number | null;
  estimatedTimeToFillDays?: number | null;
  marketAverageTimeToFillDays?: number | null;
  marketSignals?: MarketSignal[];
};

export type JobIntakeRequest = {
  description: string;
  title?: string | null;
  customer?: string | null;
};

export type JobIntakeResponse = {
  profile: JobIntakeProfile;
};
