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
