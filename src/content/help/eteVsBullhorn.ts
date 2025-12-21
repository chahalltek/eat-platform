export type HelpContentSection = {
  heading: string;
  bullets?: string[];
  paragraphs?: string[];
};

export type HelpEntry = {
  key: string;
  title: string;
  eyebrow?: string;
  description?: string;
  intro: string[];
  sections: HelpContentSection[];
  closing: string[];
  links?: { label: string; href: string }[];
};

export const decisionSopContent: HelpEntry = {
  key: "decision_sop",
  title: "How decisions are made here",
  eyebrow: "Help / FAQ",
  description: "Where to find the decision SOP and the exact language we expect teams to use.",
  intro: [
    "Use this when teammates ask how decisions are made and recorded inside ETE.",
    "ETE is used intentionally at decision moments, not for every action or workflow step. The SOP keeps behavior, judgment, and execution clearly separated and replaces undocumented reasoning with structured judgment.",
  ],
  sections: [
    {
      heading: "SOP (exact language)",
      bullets: [
        "SOPs define behavior.",
        "ETE supports judgment.",
        "Bullhorn executes outcomes.",
        "No overlap.",
        "No ambiguity.",
        "No future re-litigation.",
      ],
    },
    {
      heading: "How to apply it in ETE",
      bullets: [
        "Specialized agents reason over structured inputs to replace undocumented, implicit judgment.",
        "Use ETE to capture rationale, confidence, risk, and tradeoffs behind every decision.",
        "ETE preserves decision rationale as durable system memory, not transient explanation.",
        "Push approved outcomes back into Bullhorn so the system of record remains authoritative.",
      ],
    },
  ],
  closing: [
    "Share this SOP verbatim. If someone needs the source document, send them the link below.",
  ],
  links: [
    { label: "Read the SOP", href: "/sop/how-decisions-are-made.txt" },
  ],
};

export const sopLanguage = {
  systemOfRecord:
    "Bullhorn remains the recruiting system of record—jobs, candidates, submissions, and activity stay authoritative there.",
  decisionSupport:
    "ETE is an agentic decision-support system that owns interpretation, comparison, confidence, explanation, and memory at key decision moments.",
  bullhornSync: "Outcomes and rationale flow back into Bullhorn so governance and history stay centralized.",
} as const;

export const eteVsBullhornContent: HelpEntry = {
  key: "ete_vs_bullhorn",
  title: "Did we reinvent Bullhorn?",
  eyebrow: "FAQ",
  description:
    "A quick positioning explainer you can share when teammates ask how ETE relates to Bullhorn. Copy the text or skim the bullets below.",
  intro: [
    "No. And we’re very intentionally not trying to.",
    sopLanguage.systemOfRecord,
    sopLanguage.decisionSupport,
  ],
  sections: [
    {
      heading: "What Bullhorn’s AI does well:",
      bullets: [
        "Drafting emails, outreach, and job content",
        "Searching and ranking large candidate pools",
        "Automating tasks like enrichment, updates, and workflows",
        "Speeding up first-pass shortlists and submissions",
      ],
    },
    {
      heading: "What ETE does that Bullhorn doesn’t:",
      bullets: [
        "Clarifies intake when requirements are vague or conflicting",
        "Compares candidates explicitly, not just by score",
        "Explains why one option is recommended over another, with explicit confidence, tradeoffs, and rationale",
        sopLanguage.decisionSupport,
        "Creates a memory of why decisions were made, not just what happened",
      ],
    },
    {
      heading: "How they work together:",
      bullets: [
        "Bullhorn for sourcing, outreach, submissions, and tracking as the system of record",
        "Step into ETE at key decision moments to reason, decide, and explain",
        sopLanguage.bullhornSync,
      ],
    },
    {
      heading: "The short version:",
      bullets: [
        "Bullhorn’s AI accelerates recruiting activity as the system of record.",
        "ETE strengthens recruiting judgment with explainable decision support.",
        "Bullhorn helps you move fast.",
        "ETE helps you choose well.",
      ],
    },
  ],
  closing: [],
};

export function buildHelpEntryFullText(entry: HelpEntry = eteVsBullhornContent) {
  const lines: string[] = [];

  lines.push(entry.title);
  lines.push("");

  if (entry.description) {
    lines.push(entry.description);
    lines.push("");
  }

  for (const paragraph of entry.intro) {
    lines.push(paragraph);
    lines.push("");
  }

  for (const section of entry.sections) {
    lines.push(section.heading);
    if (section.paragraphs) {
      for (const paragraph of section.paragraphs) {
        lines.push(paragraph);
      }
    }
    if (section.bullets) {
      for (const bullet of section.bullets) {
        lines.push(`- ${bullet}`);
      }
    }
    lines.push("");
  }

  for (const paragraph of entry.closing) {
    lines.push(paragraph);
    lines.push("");
  }

  if (entry.links?.length) {
    lines.push("Links:");
    for (const link of entry.links) {
      lines.push(`${link.label}: ${link.href}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
