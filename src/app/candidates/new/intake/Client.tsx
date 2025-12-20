"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { CandidateProfile, CandidateSkill } from "@/types/candidateIntake";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";

type ProfileResponse = {
  profile: CandidateProfile;
  tenantId: string;
};

function SkillBadge({ skill }: { skill: CandidateSkill }) {
  return (
    <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-800">
      <span>{skill.name}</span>
      {skill.yearsOfExperience != null && (
        <span className="ml-2 text-gray-500">{skill.yearsOfExperience} yrs</span>
      )}
      {skill.proficiency && <span className="ml-2 text-gray-500">{skill.proficiency}</span>}
    </div>
  );
}

export default function CandidateIntakeClient({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [resumeText, setResumeText] = useState("");
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleRunProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaveError(null);
    setIsRunning(true);
    setProfile(null);

    try {
      const response = await fetch("/api/agents/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-eat-tenant-id": tenantId,
        },
        body: JSON.stringify({ rawResumeText: resumeText, tenantId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Unable to run profile" }));
        throw new Error(body.error || "Unable to run profile");
      }

      const data: ProfileResponse = await response.json();
      setProfile(data.profile);
    } catch (err) {
      console.error("Failed to run profile", err);
      setError(err instanceof Error ? err.message : "Unable to run profile");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSaveCandidate() {
    if (!profile) {
      setSaveError("Run profile before saving");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-eat-tenant-id": tenantId,
        },
        body: JSON.stringify({ profile, tenantId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Unable to save candidate" }));
        throw new Error(body.error || "Unable to save candidate");
      }

      const candidate = await response.json();
      router.push(`/candidates/${candidate.id}`);
    } catch (err) {
      console.error("Failed to save candidate", err);
      setSaveError(err instanceof Error ? err.message : "Unable to save candidate");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
        <p className="text-sm text-gray-600">Candidate Intake</p>
        <h1 className="text-3xl font-semibold text-gray-900">Paste resume text</h1>
        <p className="mt-2 text-gray-600">
          Paste a candidate resume to generate a structured profile. Support for file uploads will be added later.
        </p>
        </div>
        <BackToConsoleButton />
      </div>

      <form onSubmit={handleRunProfile} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="resume">
            Resume text
          </label>
          <textarea
            id="resume"
            required
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            rows={10}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Paste the resume text here"
          />
        </div>

        {error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isRunning || !resumeText.trim()}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isRunning ? "Generating..." : "Generate profile"}
          </button>
          <p className="text-xs text-gray-500">Recruiter and admin roles only. Tenant scoped.</p>
        </div>
      </form>

      {profile && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-600">Profile Preview</p>
              <h2 className="text-2xl font-semibold text-gray-900">Review the parsed details</h2>
            </div>
            <button
              type="button"
              onClick={handleSaveCandidate}
              disabled={isSaving}
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSaving ? "Saving..." : "Add to candidates"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Name</div>
              <div className="text-lg font-medium text-gray-900">{profile.fullName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Current title</div>
              <div className="text-lg font-medium text-gray-900">{profile.currentTitle ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Location</div>
              <div className="text-lg font-medium text-gray-900">{profile.location ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Seniority</div>
              <div className="text-lg font-medium text-gray-900">{profile.seniorityLevel ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Experience</div>
              <div className="text-lg font-medium text-gray-900">
                {profile.totalExperienceYears != null ? `${profile.totalExperienceYears} years` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Confidence</div>
              <div className="text-lg font-medium text-gray-900">
                {profile.parsingConfidence != null ? `${Math.round(profile.parsingConfidence * 100)}%` : "—"}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Summary</div>
            <p className="mt-2 text-sm text-gray-700">{profile.summary || "No summary provided."}</p>
          </div>

          <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Skills</div>
            {profile.skills.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No skills identified.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <SkillBadge key={skill.name} skill={skill} />
                ))}
              </div>
            )}
          </div>

          {saveError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
          )}
        </div>
      )}
    </div>
  );
}
