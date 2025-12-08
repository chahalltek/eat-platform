# MVP readiness checklist

Use this checklist to define when the MVP is shippable. Every item must be confirmed before promoting the build to production.

## Functional validation
- [ ] **UI operable**: Core user journeys complete without blockers in the deployed UI, with manual smoke tests covering create/edit/search flows.
- [ ] **Admin access verified**: Admin roles can sign in, reach restricted tooling, and perform governance tasks without permission errors.
- [ ] **No fatal errors**: Logs and monitoring show zero uncaught exceptions or 5xx spikes during smoke testing and background tasks.

## Quality gates
- [ ] **Test coverage**: Automated tests run in CI with coverage collected; thresholds meet the agreed minimum and the report is published for review.
- [ ] **Data load works**: Seed or migration scripts run end-to-end against a production-like database without data corruption or missing references.
- [ ] **LLM configured**: Required LLM providers are set with valid keys, rate limits, and safety filters, and environment variables are documented for deployment.

## Sign-off
- [ ] Stakeholders have reviewed the above checkpoints and explicitly approve release for the MVP.
