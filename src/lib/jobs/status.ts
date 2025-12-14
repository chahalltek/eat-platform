export const JOB_CANDIDATE_STATUSES = [
  "POTENTIAL",
  "SHORTLISTED",
  "SUBMITTED",
  "INTERVIEWING",
  "HIRED",
  "REJECTED",
] as const;

export type JobCandidateStatus = (typeof JOB_CANDIDATE_STATUSES)[number];
