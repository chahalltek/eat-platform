# BATCH 6 — Network Intelligence, Market Power & Productization

## 1) ETE-NET-1601 – Privacy-safe cross-tenant learning framework

**Goal:** Enable cross-tenant learning without sharing raw data or violating privacy.

**Core principle:**
- No resumes, no names, no jobs cross tenants.
- Only aggregated, anonymized signals.

**Tasks**
1. Introduce a `LearningAggregate` model capturing privacy-safe dimensions:
   ```
   {
     roleFamily,
     industry,
     geo,
     seniority?,
     seqlen?,
     vector?, // "skill_scarcity", "candidate_listing", "market_demand"
     sampleSize,
     window,
   }
   ```
2. Aggregate signals from tenant-level learning:
   - Bin inputs by minimum sample sizes (k-anonymity) and by time window.
   - Store aggregate snapshots separately from tenant models.
   - Use only aggregated/anonymous inputs for new tenants.

## 2) ETE-MARKET-1602 — Talent Market Signals Engine

Turn ETE into a market intelligence engine.

**Signals**
- Supply/demand across candidate flow by role family.
- Ratio of active to inactive by title.
- Skilled candidates by skill density.
- Skills emergence and rarity detection.
- Geo/band/density for total addressable market (TAM), skills, and competition.
- Percent of market in activation or currently reachable.

**Approach**
1. Bind market aggregates to business intelligence and pricing models.
2. Use regions as the primary boundary for availability/activation/competition.
3. Leverage two internal APIs:
   - `GET /api/v2/market/signals?toTierFamily&dataRegion=US`
   - `GET /api/v2/talent/census`
4. Cache aggressively while preserving recency.
5. Mock signals initially without performance penalty.
6. Clear labeling: “Market benchmark (aggregated)”.
