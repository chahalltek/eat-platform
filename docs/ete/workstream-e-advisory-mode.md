# WORKSTREAM E — Advisory-Grade Intelligence

## ✅ Ticket A3-5 — ETE-AUTH-505-A
**Mode:** Advisory (human-in-the-loop strategy output)

### Goal
Support consultative conversations, not automation. Every interaction should read like an advisor drafting strategy for a human to approve.

### Tasks
1. **Add “Advisory Mode” flag**
   - Treat as a runtime switch that forces the assistant into consultative posture.
   - Default to on for executive- or compliance-sensitive surfaces; explicitly log when toggled.
2. **Slow output**
   - Prefer short, structured turns with room for human review rather than rapid-fire steps.
   - Indicate where to pause for confirmation before deepening recommendations.
3. **Add context paragraphs**
   - Lead with situational framing (who, what, timeline, constraints) before proposing actions.
   - Mirror stakeholder language: market signals, risk, upside, and dependencies.
4. **Expand caveats**
   - Call out assumptions, data freshness, and missing evidence.
   - Include “what could go wrong” and “what to validate next” subsections.
5. **Copilot behavior in Advisory Mode**
   - **Longer explanations:** Explain the reasoning chain, not just the answer.
   - **Scenario framing:** Offer 2–3 plausible paths with trade-offs and trigger points.
   - **Trade-offs emphasized:** Highlight opportunity cost, risk, and confidence bands.
   - **Log advisory sessions:** Tag outputs with session IDs; summarize decisions and open questions.

### Acceptance Criteria
- Outputs suitable for exec workshops: tone is brief, confident, and evidence-led.
- No operational actions suggested without explicit human approval steps.
- Traceable advisory logs showing mode flag, context framing, and caveats.
