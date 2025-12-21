# Playwright coverage strategy

TS-### Ticket 6 asks us to make sure E2E traffic from Playwright meaningfully helps coverage instead of only providing confidence vibes. We are adopting the pragmatic approach from the ticket: treat Playwright as the coverage source for route entrypoints while keeping Vitest coverage focused on logic.

## What changed
- `src/app/**/page.tsx` files are excluded from Vitest coverage calculations. These files are thin route shells whose correctness is validated through Playwright runs.
- The Playwright suites (`npm run e2e:admin-layout` and `npm run e2e:visual`) remain the way we exercise routes. Add or update Playwright flows whenever you add a new page.

## How to keep coverage green
1. **Logic stays unit-tested.** Extract meaningful work out of `page.tsx` into `src/lib/**`, server actions, or shared components. Those files remain under 100% coverage thresholds.
2. **Routes stay E2E-tested.** Create or extend Playwright specs for new or modified routes. Playwright is the enforcement mechanism for page rendering and navigation.
3. **Run both locally when changing routes.**
   ```bash
   npm test
   npm run e2e:admin-layout # or npm run e2e:visual for visual regressions
   ```

## Why this helps reported coverage
- Route entrypoints rarely contain reusable logic but counted heavily against coverage. Excluding them from Vitest coverage prevents them from dragging the percentages down.
- Playwright provides the route-level verification, so route coverage is still enforced—just via E2E rather than unit coverage.
