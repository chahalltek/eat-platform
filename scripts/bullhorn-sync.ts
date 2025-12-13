import { BullhornClient } from '@/lib/integrations/bullhorn/client';
import { InMemorySyncStore, syncBullhorn } from '@/lib/integrations/bullhorn/sync';
import { createBullhornSyncLogger } from '@/lib/integrations/bullhorn/syncLogger';

const systemMode = process.env.SYSTEM_MODE?.toLowerCase();
if (systemMode === 'demo') {
  console.log('Skipping Bullhorn sync: demo mode enforces read-only guardrails.');
  process.exit(0);
}

async function main() {
  const client = new BullhornClient({
    clientId: process.env.BULLHORN_CLIENT_ID ?? 'demo-client',
    clientSecret: process.env.BULLHORN_CLIENT_SECRET ?? 'demo-secret',
    redirectUri: process.env.BULLHORN_REDIRECT_URI ?? 'https://example.com/oauth/callback',
    testMode: process.env.NODE_ENV !== 'production',
  });

  // In production, tokens would be persisted. For the script we exchange a mocked code.
  await client.exchangeCodeForToken(process.env.BULLHORN_AUTH_CODE ?? 'mock-code');

  const store = new InMemorySyncStore();
  const tenantId = process.env.BULLHORN_TENANT_ID ?? 'default-tenant';
  const summary = await syncBullhorn({
    fetchJobs: () => client.getJobs(),
    fetchCandidates: () => client.getCandidates(),
    fetchPlacements: () => client.getPlacements(),
    store,
    tenantId,
    logger: createBullhornSyncLogger({ tenantId }),
  });

  // eslint-disable-next-line no-console
  console.log('Bullhorn sync complete', summary);
  // eslint-disable-next-line no-console
  console.log('Synced entities (in-memory)', {
    jobs: Array.from(store.jobs.values()),
    candidates: Array.from(store.candidates.values()),
    placements: Array.from(store.placements.values()),
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Bullhorn sync failed', error);
  process.exit(1);
});
