export type RoleFamily = "Engineering" | "Data" | "Product" | "Sales" | "Operations" | "Custom";

type RoleFamilyRule = {
  family: RoleFamily;
  titleKeywords: string[];
  skillKeywords: string[];
};

type ClassifierInput = {
  title: string;
  skills?: string[];
  fallbackFamily?: RoleFamily;
};

export type RoleFamilyScore = {
  family: RoleFamily;
  titleMatches: string[];
  skillMatches: string[];
  score: number;
};

const ROLE_FAMILY_RULES: RoleFamilyRule[] = [
  {
    family: "Engineering",
    titleKeywords: ["engineer", "developer", "engineering", "sre", "qa", "devops", "platform", "architect", "backend", "frontend", "front-end", "full stack", "full-stack"],
    skillKeywords: ["typescript", "javascript", "java", "python", "go", "react", "node", "aws", "docker", "kubernetes", "ci/cd"],
  },
  {
    family: "Data",
    titleKeywords: ["data", "analytics", "machine learning", "ml", "scientist", "bi", "business intelligence"],
    skillKeywords: ["sql", "python", "pandas", "r", "dbt", "snowflake", "tableau", "power bi", "experimentation", "statistics"],
  },
  {
    family: "Product",
    titleKeywords: ["product", "pm", "program manager", "producer"],
    skillKeywords: ["roadmap", "prd", "story", "ux", "design", "research", "discovery", "stakeholder", "prioritization"],
  },
  {
    family: "Sales",
    titleKeywords: ["sales", "account", "ae", "bdr", "sdr", "go-to-market", "gtm", "partnership"],
    skillKeywords: ["quotas", "pipeline", "crm", "salesforce", "outreach", "territory", "renewals", "demo", "closing"],
  },
  {
    family: "Operations",
    titleKeywords: ["operations", "people", "hr", "finance", "controller", "compliance", "office", "business operations"],
    skillKeywords: ["payroll", "benefits", "process", "audit", "policy", "controls", "sox", "erp", "netsuite", "workday"],
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function scoreRule({ title, skills = [] }: ClassifierInput, rule: RoleFamilyRule): RoleFamilyScore {
  const normalizedTitle = normalize(title);
  const normalizedSkills = skills.map(normalize);

  const titleMatches = rule.titleKeywords.filter((keyword) => normalizedTitle.includes(keyword));
  const skillMatches = rule.skillKeywords.filter((keyword) => normalizedSkills.some((skill) => skill.includes(keyword)));

  const score = titleMatches.length * 3 + skillMatches.length;

  return { family: rule.family, titleMatches, skillMatches, score };
}

export function classifyRoleFamily({
  title,
  skills = [],
  fallbackFamily = "Custom",
}: ClassifierInput): { family: RoleFamily; scores: RoleFamilyScore[] } {
  const scores = ROLE_FAMILY_RULES.map((rule) => scoreRule({ title, skills }, rule)).sort((a, b) => b.score - a.score);
  const best = scores.find((score) => score.score > 0);

  if (!best) {
    return { family: fallbackFamily, scores };
  }

  return { family: best.family, scores };
}

export const __testing = { ROLE_FAMILY_RULES, scoreRule };
