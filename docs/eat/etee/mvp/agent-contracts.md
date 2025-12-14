# Agent Contracts (PROFILE + MATCH + CONFIDENCE)

This document captures deterministic inputs/outputs and logging expectations for the core agent loop used in Batch 2 audits.

## Common requirements
- **Deterministic input snapshot:** All agent runs persist the raw input payload and normalized snapshot to `agentRunLog` for replayability.
- **Deterministic output schema:** Responses are structured JSON objects with stable keys for downstream consumers.
- **Persistence strategy:** Agent runs write metadata to `agentRunLog` with DB timestamps; MATCH additionally persists `matchResult`/`match` rows, while PROFILE persists `candidate` and `candidateSkill` records. Prompts include timestamped run IDs for traceability where LLMs are invoked (MATCH explanations).
- **Decision Stream logging hooks:** The shared agent middleware records `agentRunId`, status, latency, and error details in `agentRunLog` for every invocation.

## PROFILE (Resume parser)
- **Run path:** `POST /api/agents/profile` → RINA resume parser helper.
- **Input JSON schema:** `{ rawResumeText: string, sourceType?: string, sourceTag?: string }` (requires `rawResumeText`).
- **Output JSON schema:** `{ candidateId: string, agentRunId: string }` with the parsed candidate profile and `candidateSkill` rows persisted.
- **Determinism notes:** Input text snapshot is trimmed and stored; output identifiers are deterministic DB IDs; no LLM randomness in parsing.
- **Logging:** `agentRunLog` stores payload snapshot, normalized candidate profile, status, duration, and error (if any).

## MATCH (Deterministic scorer)
- **Run path:** `POST /api/agents/match` → deterministic scorer + optional LLM explanation.
- **Input JSON schema:** `{ jobReqId: string, candidateIds?: string[], limit?: number }` (`limit` defaults to 50 when `candidateIds` is omitted).
- **Output JSON schema:** `[{ matchResultId: string, matchId: string, score: number, confidence: { category: "HIGH"|"MEDIUM"|"LOW", reasons: string[], breakdown: object }, explanation?: string, deterministicSignals: object }]`.
- **Determinism notes:** Scores/confidence are derived from DB facts (skills overlap, recency) and cached job/candidate snapshots; explanations use a fixed prompt and include the deterministic breakdown to constrain variance.
- **Logging:** `agentRunLog` stores input snapshot, deterministic signal breakdown, generated explanation (or fallback text), status, and timing. MATCH writes `matchResult`/`match` rows with timestamps for persistence.

## CONFIDENCE (Confidence helper inside MATCH)
- **Run path:** Internal helper `computeMatchConfidence` invoked by MATCH (no public API endpoint).
- **Input JSON schema:** Candidate + jobReq objects with skills arrays `{ name, normalizedName?, required? }`.
- **Output JSON schema:** `{ score: number, category: "HIGH"|"MEDIUM"|"LOW", reasons: string[], breakdown: { dataCompleteness: object, skillCoverage: object, recency: object } }`.
- **Determinism notes:** Purely deterministic calculations based on structured skill overlap and recency thresholds (75/50 splits); no randomness or external calls.
- **Logging:** Confidence outputs are embedded in the MATCH run log and returned with each match record for downstream review.
