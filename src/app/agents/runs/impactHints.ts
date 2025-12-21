export function getImpactHint(agentName: string): string {
  const normalized = agentName.toUpperCase();

  if (normalized.includes("RINA")) {
    return "Impact: resume normalization may degrade downstream matching and scoring.";
  }

  if (normalized.includes("RUA")) {
    return "Impact: role normalization may degrade scoring and matching quality.";
  }

  if (normalized.includes("MATCH")) {
    return "Impact: rankings and shortlist inputs may be incomplete or stale.";
  }

  if (normalized.includes("CONFIDENCE")) {
    return "Impact: uncertainty signals may be missing, increasing review risk.";
  }

  if (normalized.includes("EXPLAIN")) {
    return "Impact: rationale may be unavailable for stakeholder communication.";
  }

  if (normalized.includes("SHORTLIST")) {
    return "Impact: recommended submits may be unavailable or outdated.";
  }

  return "Impact: downstream workflow may be affected until rerun succeeds.";
}
