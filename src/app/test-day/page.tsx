import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";

export default function TestDayPage() {
  return (
    <ETEClientLayout contentClassName="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">EDGE Talent Engine™ Test Day</h1>
          <p className="text-sm text-slate-500">One-day validation checklist for MVP readiness</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-slate-200 px-4 py-1.5 text-sm hover:bg-slate-50"
        >
          Back to Console
        </Link>
      </div>

      <div className="prose prose-slate max-w-none">
        <h2>Objective</h2>
        <p>In one day, validate that the EDGE Talent Engine™ works end-to-end for a single tenant:</p>
        <ul>
          <li>Tenant access &amp; diagnostics</li>
          <li>Resume ingestion (RINA)</li>
          <li>Job intake (RUA)</li>
          <li>Job &amp; candidate persistence</li>
          <li>Agent Runs logging</li>
          <li>Navigation consistency</li>
          <li>Empty and failure states</li>
        </ul>

        <h2>Morning Block 1 – Sanity &amp; Access (9:00–10:00)</h2>
        <h3>✅ Test 1: Home Console</h3>
        <p>Go to / (main console)</p>
        <p>Confirm:</p>
        <ul>
          <li>System Status panel loads.</li>
          <li>
            Cards grouped under:
            <ul>
              <li>CORE WORKFLOWS</li>
              <li>DATA &amp; CONTROLS</li>
            </ul>
          </li>
          <li>“System Map” link exists.</li>
          <li>Styling and spacing match other pages.</li>
        </ul>

        <h3>✅ Test 2: System Map</h3>
        <p>Go to /system-map (or /ete/system-map)</p>
        <p>Confirm:</p>
        <ul>
          <li>Pipeline displayed: INTAKE → PROFILE → MATCH → CONFIDENCE → EXPLAIN → SHORTLIST</li>
          <li>Each agent responsibility is stated plainly.</li>
          <li>Page uses the EDGE header layout.</li>
          <li>Back to Console works.</li>
        </ul>

        <h3>✅ Test 3: Tenant Diagnostics</h3>
        <p>Go to:</p>
        <p>/admin/tenant/default-tenant/diagnostics</p>
        <p>Confirm:</p>
        <ul>
          <li>No “Admin required” message.</li>
          <li>Health dashboard loads.</li>
          <li>If blocked, stop testing and fix RBAC.</li>
        </ul>

        <h2>Morning Block 2 – Ingestion &amp; Persistence (10:00–12:00)</h2>
        <h3>✅ Test 4: Resume Ingestion (RINA)</h3>
        <p>Go to /rina-test.</p>
        <p>Paste a sample resume.</p>
        <p>Source type: manual</p>
        <p>Source tag: test-rina</p>
        <p>Run.</p>
        <p>Confirm:</p>
        <ul>
          <li>Agent returns structured output.</li>
          <li>No visible error.</li>
        </ul>

        <h3>✅ Test 5: Candidate stored</h3>
        <p>Open Prisma Studio.</p>
        <p>Confirm:</p>
        <ul>
          <li>Candidate row exists.</li>
          <li>Skills or normalized fields exist.</li>
          <li>Agent run logged.</li>
        </ul>

        <h3>✅ Test 6: Job Intake (RUA)</h3>
        <p>Go to /rua-test.</p>
        <p>Paste a job description.</p>
        <p>Source type: manual</p>
        <p>Source tag: rua-test</p>
        <p>Run.</p>

        <h3>✅ Test 7: Job stored</h3>
        <p>Open Prisma Studio.</p>
        <p>Confirm:</p>
        <ul>
          <li>New job record exists.</li>
          <li>Job skills present.</li>
          <li>Agent run record logged.</li>
        </ul>

        <h2>Lunch – Notes &amp; Pattern Review (12:00–1:00)</h2>
        <p>Do not fix yet. Only log issues.</p>

        <h2>Afternoon Block 3 – UI Validation (1:00–3:00)</h2>
        <h3>✅ Test 8: Jobs Page</h3>
        <p>Go to /jobs.</p>
        <p>Confirm:</p>
        <ul>
          <li>Job from RUA appears.</li>
          <li>Back to Console button visible.</li>
          <li>Table renders cleanly.</li>
        </ul>

        <h3>✅ Test 9: Candidates Page</h3>
        <p>Go to /candidates.</p>
        <p>Confirm:</p>
        <ul>
          <li>No “database updating” message.</li>
        </ul>
        <p>Either:</p>
        <ul>
          <li>Your candidate appears</li>
          <li>OR</li>
          <li>A real empty state is shown.</li>
        </ul>

        <h3>✅ Test 10: Agent Runs</h3>
        <p>Go to /agent-runs.</p>
        <p>Confirm:</p>
        <ul>
          <li>RINA and RUA runs appear.</li>
          <li>Status shown clearly (Success / Failed).</li>
          <li>Clicking entries opens detail.</li>
        </ul>

        <h3>✅ Test 11: Failure surface</h3>
        <p>Trigger one failure:</p>
        <p>Submit an empty resume.</p>
        <p>Confirm:</p>
        <ul>
          <li>FAILED run logged.</li>
          <li>Error message is meaningful.</li>
        </ul>

        <h2>Afternoon Block 4 – UX Consistency (3:00–5:00)</h2>
        <h3>✅ Test 12: Navigation Consistency</h3>
        <p>Open each page:</p>
        <ul>
          <li>Home</li>
          <li>About</li>
          <li>Jobs</li>
          <li>Candidates</li>
          <li>Agent Runs</li>
          <li>Feature Flags</li>
          <li>RINA Test</li>
          <li>RUA Test</li>
        </ul>
        <p>Confirm:</p>
        <ul>
          <li>Same background + container.</li>
          <li>Titles look consistent.</li>
          <li>Back to Console present.</li>
        </ul>

        <h3>✅ Test 13: Status Language</h3>
        <p>Check all places where status is shown.</p>
        <p>Confirm:</p>
        <ul>
          <li>Messages are truthful.</li>
          <li>No placeholder wording.</li>
          <li>Ambiguous states are clearly labeled.</li>
        </ul>

        <h3>✅ Test 14: Mobile Sanity</h3>
        <p>Resize browser:</p>
        <ul>
          <li>Cards stack.</li>
          <li>No cut-off buttons.</li>
          <li>Tables scroll reasonably.</li>
        </ul>

        <h2>Done When</h2>
        <p>Testing is complete when:</p>
        <ul>
          <li>All agents write to DB.</li>
          <li>Diagnostics loads.</li>
          <li>No page lies about system state.</li>
          <li>Navigation works everywhere.</li>
          <li>Agent Runs show history.</li>
          <li>No UI suggests fake errors.</li>
        </ul>
      </div>
    </ETEClientLayout>
  );
}
