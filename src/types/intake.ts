export type IntakeSkill = {
  name: string;
  required?: boolean;
  weight?: number;
};

export type JobIntakeProfile = {
  title: string | null;
  customer: string | null;
  skills: IntakeSkill[];
  mustHaves: string[];
  ambiguities: string[];
  rawDescription: string;
};

export type JobIntakeRequest = {
  description: string;
  title?: string | null;
  customer?: string | null;
};

export type JobIntakeResponse = {
  profile: JobIntakeProfile;
};
