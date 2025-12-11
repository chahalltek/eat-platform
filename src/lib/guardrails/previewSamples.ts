export type GuardrailPreviewSignals = {
  senior: number;
  remote: number;
  flagged: number;
};

export type GuardrailPreviewCandidate = {
  id: string;
  name: string;
  title: string;
  baseMatch: number;
  baseConfidence: number;
  candidateSignals: GuardrailPreviewSignals;
  note?: string;
};

export type GuardrailPreviewScenario = {
  sampleShortlist: string;
  label: string;
  description: string;
  jobTitle: string;
  seniority: string;
  location: string;
  skillMatch: number;
  candidates: GuardrailPreviewCandidate[];
};

const SAMPLE_SHORTLISTS: Record<string, GuardrailPreviewScenario> = {
  sample5: {
    sampleShortlist: "sample5",
    label: "Sample shortlist (5 candidates)",
    description:
      "Mid-market AE role with a balanced slate of candidates and one flagged profile. Useful for checking how flags and signal weights impact shortlist decisions.",
    jobTitle: "Account Executive",
    seniority: "Senior",
    location: "Hybrid - Seattle",
    skillMatch: 85,
    candidates: [
      {
        id: "candidate-a",
        name: "Jordan Blake",
        title: "Senior AE, SaaS",
        baseMatch: 86,
        baseConfidence: 82,
        candidateSignals: { senior: 8, remote: 4, flagged: -15 },
        note: "Strong enterprise track record, but flagged for reference follow-up.",
      },
      {
        id: "candidate-b",
        name: "Casey Lin",
        title: "Enterprise Sales Lead",
        baseMatch: 72,
        baseConfidence: 65,
        candidateSignals: { senior: 12, remote: -3, flagged: 0 },
        note: "Deep security sales background with global accounts.",
      },
      {
        id: "candidate-c",
        name: "Morgan Patel",
        title: "Account Manager",
        baseMatch: 68,
        baseConfidence: 59,
        candidateSignals: { senior: 8, remote: 8, flagged: -8 },
        note: "Relationship-driven seller with strong renewals record.",
      },
      {
        id: "candidate-d",
        name: "Avery Chen",
        title: "Commercial AE",
        baseMatch: 66,
        baseConfidence: 62,
        candidateSignals: { senior: 5, remote: 2, flagged: 0 },
        note: "Excels in velocity deals and cross-sell motions.",
      },
      {
        id: "candidate-e",
        name: "Riley Brooks",
        title: "Regional Sales Manager",
        baseMatch: 74,
        baseConfidence: 71,
        candidateSignals: { senior: 10, remote: -6, flagged: 0 },
        note: "Hybrid seller-coach with experience in fast-paced teams.",
      },
    ],
  },
  sample3: {
    sampleShortlist: "sample3",
    label: "Sample shortlist (3 candidates)",
    description:
      "Hands-on IC role with fewer signals. Helpful for checking how match/confidence gates behave when data is sparse.",
    jobTitle: "Implementation Specialist",
    seniority: "Mid-level",
    location: "Remote",
    skillMatch: 78,
    candidates: [
      {
        id: "candidate-f",
        name: "Taylor Woods",
        title: "Implementation Consultant",
        baseMatch: 75,
        baseConfidence: 68,
        candidateSignals: { senior: 5, remote: 10, flagged: 0 },
        note: "Strong async collaborator; thrives in remote onboarding.",
      },
      {
        id: "candidate-g",
        name: "Jamie Rivera",
        title: "Solutions Analyst",
        baseMatch: 64,
        baseConfidence: 57,
        candidateSignals: { senior: 6, remote: -4, flagged: 0 },
        note: "Technical orientation with solid customer empathy.",
      },
      {
        id: "candidate-h",
        name: "Parker Lee",
        title: "Customer Success Engineer",
        baseMatch: 70,
        baseConfidence: 63,
        candidateSignals: { senior: 7, remote: 2, flagged: -10 },
        note: "CS + delivery hybrid with occasional red flags on timelines.",
      },
    ],
  },
};

export function getGuardrailPreviewSample(sampleShortlist: string): GuardrailPreviewScenario | null {
  return SAMPLE_SHORTLISTS[sampleShortlist] ?? null;
}

export function listGuardrailPreviewSamples() {
  return Object.values(SAMPLE_SHORTLISTS).map((sample) => ({
    sampleShortlist: sample.sampleShortlist,
    label: sample.label,
    description: sample.description,
  }));
}
