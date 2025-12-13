export const HIRING_OUTCOME_STATUSES = [
  "screened",
  "interviewed",
  "offered",
  "hired",
  "rejected",
] as const;

export type HiringOutcomeStatus = (typeof HIRING_OUTCOME_STATUSES)[number];

export const HIRING_OUTCOME_SOURCES = ["recruiter", "hiring_manager", "ats"] as const;

export type HiringOutcomeSource = (typeof HIRING_OUTCOME_SOURCES)[number];
