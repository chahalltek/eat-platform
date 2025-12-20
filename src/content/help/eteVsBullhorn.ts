export type HelpContentSection = {
  heading: string;
  bullets?: string[];
  paragraphs?: string[];
};

export type HelpEntry = {
  key: string;
  title: string;
  intro: string[];
  sections: HelpContentSection[];
  closing: string[];
};

export const eteVsBullhornContent: HelpEntry = {
  key: "ete_vs_bullhorn",
  title: "Did we reinvent Bullhorn?",
  intro: [
    "No. And we’re very intentionally not trying to.",
    "Bullhorn is the system of record for recruiting. It stores candidates, jobs, submissions, activity, and now uses AI to help recruiters move faster inside the ATS.",
    "ETE exists for a different reason.",
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
        "Explains why one candidate is recommended over another",
        "Captures confidence, risk, and tradeoffs at decision time",
        "Creates a memory of why decisions were made, not just what happened",
      ],
    },
    {
      heading: "How they work together:",
      bullets: [
        "Bullhorn for sourcing, outreach, submissions, and tracking",
        "Step into ETE at key moments to reason, decide, and explain",
        "Push outcomes back into Bullhorn as the system of record",
      ],
    },
    {
      heading: "The short version:",
      bullets: [
        "Bullhorn’s AI accelerates recruiting activity.",
        "ETE strengthens recruiting judgment.",
        "Bullhorn helps you move fast.",
        "ETE helps you choose well.",
      ],
    },
  ],
  closing: [],
};

export function buildEteVsBullhornFullText(entry: HelpEntry = eteVsBullhornContent) {
  const lines: string[] = [];

  lines.push(entry.title);
  lines.push("");

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

  return lines.join("\n").trim();
}
