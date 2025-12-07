# MSA candidate ↔ job scoring v1

Goal: produce a 0–100 score reflecting how well a candidate matches a job requisition. Score is a weighted blend of skills, seniority, and location flexibility; weights intentionally simple for the first version.

## Weights
- Skills: 70%
- Seniority: 20%
- Location: 10%

## Skill scoring (70%)
- Input: normalized skill names.
- Separate required vs nice-to-have (preferred) skills on the job.
- Scoring:
  - Required skills coverage (60% of skill score): for each required job skill, assign 1 when the candidate has it, 0 otherwise. Required skill coverage = matched_required / total_required.
  - Nice-to-have coverage (40% of skill score): for each preferred job skill, assign 1 when the candidate has it, 0 otherwise. Preferred coverage = matched_preferred / total_preferred (0 when no preferred skills).
- Skill score = 0.6 * required_coverage + 0.4 * preferred_coverage.
- Edge cases: if a bucket is empty (e.g., no preferred skills), treat its coverage as 0 but still respect the weight. Required skills missing will cap coverage and clearly lower the final score.

## Seniority scoring (20%)
- Compare candidate.seniority vs job.seniority (normalized enums or numeric levels).
- Exact match: 1.0.
- Candidate one level above required: 0.9 (slight discount for overqualification risk).
- Candidate one level below required: 0.6 (possible ramp-up).
- Otherwise: 0.3 when gap is two levels or more.
- If either seniority is missing, default to 0.5 until data improves.

## Location scoring (10%)
- Inputs: job location type (onsite/hybrid/remote), job country/city (if applicable), candidate location, candidate remote openness (boolean/enum), candidate relocation willingness.
- Scoring table:
  - Job remote: 1.0 if candidate accepts remote; else 0.4.
  - Job hybrid/onsite with specified city/region: 1.0 if candidate is in same metro/commute region; 0.7 if willing to relocate; 0.4 if willing to commute occasionally (for hybrid); else 0.2.
  - Missing location data on either side: 0.5.

## Final score
`final_score = 100 * (0.70 * skill_score + 0.20 * seniority_score + 0.10 * location_score)`

## MatchResult model (suggested fields)
- ids: `id`, `candidateId`, `jobReqId`.
- `score`: number (0–100).
- Component scores: `skillScore`, `seniorityScore`, `locationScore` (0–1 each) plus optional raw counts (`requiredMatched`, `requiredTotal`, `preferredMatched`, `preferredTotal`).
- Per-skill breakdown: array of objects `{skillName, jobTag: "required"|"preferred", candidateHas: boolean}`.
- Reasons (strings) for explainability, e.g.:
  - "Matched 5/6 required skills; missing Kubernetes"
  - "Candidate seniority one level below requirement"
  - "Candidate open to relocation; job is onsite in Berlin"
- Metadata: `computedAt` timestamp, scoring `version` (e.g., "msa-v1") for compatibility, and optional `notes`/`debug` JSON for upstream pipelines.
