import { NextResponse } from "next/server";

import { runOutreach, type OutreachInput } from "@/lib/agents/outreach";
import { runIntake, type IntakeInput } from "@/server/agents/intake";
import { runRina, type RinaInput } from "@/lib/agents/rina";
import { runRua, type RuaInput } from "@/lib/agents/rua";
import { type IdentityUser } from "@/lib/auth/identityProvider";
import { runConfidenceAssessment, type ConfidenceAgentInput } from "@/server/agents/confidence";

export type AgentRunContext = {
  currentUser: IdentityUser;
  req?: Request;
};

export type AgentRegistryEntry<Input, Result> = {
  key: string;
  displayName: string;
  description: string;
  run: (options: { input: Input; ctx: AgentRunContext }) => Promise<Result>;
};

function requireString(field: string, value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw NextResponse.json({ error: `${field} is required` }, { status: 400 });
  }

  return value.trim();
}

export const AgentRegistry: Record<string, AgentRegistryEntry<unknown, any>> = {
  "ETE-TS.RINA": {
    key: "ETE-TS.RINA",
    displayName: "Resume Intelligence Agent (RINA)",
    description: "Parses resumes into structured candidates.",
    run: async ({ input }) => {
      const { rawResumeText, sourceType, sourceTag } = (input ?? {}) as Partial<RinaInput>;
      const normalizedText = requireString("rawResumeText", rawResumeText);

      return runRina({ rawResumeText: normalizedText, sourceType, sourceTag });
    },
  },
  "ETE-TS.RUA": {
    key: "ETE-TS.RUA",
    displayName: "Recruiter Upload Agent (RUA)",
    description: "Transforms job descriptions into job requisitions.",
    run: async ({ input }) => {
      const { recruiterId, rawJobText, sourceType, sourceTag } = (input ?? {}) as Partial<RuaInput>;
      const normalizedJobText = requireString("rawJobText", rawJobText);

      return runRua({ recruiterId: recruiterId ?? undefined, rawJobText: normalizedJobText, sourceType, sourceTag });
    },
  },
  "ETE-TS.OUTREACH": {
    key: "ETE-TS.OUTREACH",
    displayName: "Outreach Agent",
    description: "Drafts tailored outreach messages to candidates.",
    run: async ({ input, ctx }) => {
      const { recruiterId, candidateId, jobReqId } = (input ?? {}) as Partial<OutreachInput>;
      const trimmedCandidateId = requireString("candidateId", candidateId);
      const trimmedJobReqId = requireString("jobReqId", jobReqId);

      return runOutreach({
        recruiterId: recruiterId ?? ctx.currentUser.id,
        candidateId: trimmedCandidateId,
        jobReqId: trimmedJobReqId,
      });
    },
  },
<<<<<<< ours
  "ETE-TS.INTAKE": {
    key: "ETE-TS.INTAKE",
    displayName: "Intake Agent",
    description: "Extracts intent from existing job descriptions.",
    run: async ({ input, ctx }) => {
      const { jobId, sourceType, sourceTag } = (input ?? {}) as Partial<IntakeInput>;
      const trimmedJobId = requireString("jobId", jobId);

      return runIntake({ jobId: trimmedJobId, recruiterId: ctx.currentUser.id, sourceType, sourceTag });
=======
  "ETE-TS.CONFIDENCE": {
    key: "ETE-TS.CONFIDENCE",
    displayName: "Confidence Agent",
    description: "Scores trust for a job-candidate pair using profile and market signals.",
    run: async ({ input, ctx }) => {
      const { jobCandidateId, marketSignals } = (input ?? {}) as Partial<ConfidenceAgentInput>;
      const normalizedJobCandidateId = requireString("jobCandidateId", jobCandidateId);

      return runConfidenceAssessment({
        jobCandidateId: normalizedJobCandidateId,
        marketSignals: marketSignals ?? null,
        requestedBy: ctx.currentUser,
      });
>>>>>>> theirs
    },
  },
};
