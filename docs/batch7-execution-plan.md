# BATCH 7 — Execution Plan (Bullhorn-First)

## What Batch 7 is
Strategic, predictive, executive-grade intelligence that sits on top of Bullhorn.

## What Batch 7 is not
- A workflow engine
- A stage manager
- A candidate CRM
- A competing ATS

> If a ticket smells like Bullhorn, we cut it.

---

## 🚦 Batch 7 Entry Rules (lock these)
Before writing a single ticket, these rules apply to every Batch 7 item:
1. Bullhorn remains the system of record.
2. ETE only reads facts and writes back insights.
3. No ticket may:
   - Create new candidate states
   - Change stages
   - Replace recruiter actions
4. All outputs must be:
   - Advisory
   - Explainable
   - Optional

---

## 🧭 Batch 7 — reordered into 3 safe waves
We do forecast → recommendations → authority, in that order.

### 🌊 Wave 1 — Predictive intelligence (safe to start now)
This wave is 100% internal to ETE and 100% Bullhorn-compatible.

🎟️ **Start here**

#### ✅ Ticket 34 (revised) — ETE-FORECAST-2101-A
**Bullhorn-aware talent demand forecasting**

**Goal**
Forecast hiring pressure using Bullhorn signals, not replacing them.

**Inputs (read only)**
- Bullhorn job creation timestamps
- Bullhorn stage velocity
- Bullhorn outcome stages
- ETE market scarcity signals
- ETE MQI trends

**Outputs**
```json
{
  "jobId": "string",
  "roleFamily": "string",
  "horizonDays": 30 | 60 | 90,
  "riskLevel": "low" | "medium" | "high",
  "explanation": ["string"]
}
```

**Hard rule**
- ❌ No candidate-level forecasts
- ❌ No stage predictions
- ✅ Job-level risk only

### 🌊 Wave 2 — Strategic recommendations (exec-grade, not ops)
This wave only starts **after** Wave 1 forecasts are live and trusted by stakeholders.

🎟️ **Ticket 36 (revised) — ETE-STRAT-2201-A**
**Hiring strategy recommendations (Bullhorn-additive)**

**Goal**
Turn job-level forecasts into executive-ready decisions leaders can approve. Recommendations remain advisory and cannot change Bullhorn stages or candidate records.

**Inputs (read only)**
- Wave 1 job-level risk forecasts
- Bullhorn req metadata (job family, location, priority)
- Historical close velocity benchmarks by role family
- Market scarcity signals and MQI trends

**Outputs (advisory only)**
- 🧭 Strategic actions leaders can approve, not operational steps recruiters perform
- 📄 Recommendation packet per job with rationale, expected impact window (30/60/90 days), and confidence
- 🔒 No mutations to Bullhorn states, candidates, or workflows

**Examples**
- "Consider opening sourcing earlier for this req"
- "Recommend relaxing must-have Terraform certification; market scarcity high"
- "High likelihood of delayed close based on market benchmarks; suggest executive escalation" 

**Explicitly not**
- "Move candidate to stage X"
- "Email candidate"
- "Change workflow"

**Guardrails**
- Must be explainable and cite which forecast or benchmark drives each recommendation
- Default to opt-in: leaders approve recommendations before recruiters see them
- Provide confidence levels and impact horizon; avoid prescriptive sequencing
