import { expect } from 'vitest';

type SnapshotFn = (value: unknown, hint?: string) => void;

export type AgentBDDClauses = {
  given: string;
  when: string;
  then: string;
};

export type AgentBehaviorSpec<GIVEN, RESULT> = {
  /**
   * Human readable BDD clauses for the test title.
   */
  clauses: AgentBDDClauses;
  /**
   * Input to the agent under test.
   */
  given: GIVEN;
  /**
   * Invoke the agent under test.
   */
  when: (input: GIVEN) => Promise<RESULT>;
  /**
   * Assertions on the final system state.
   */
  then: (context: {
    given: GIVEN;
    result: RESULT;
    snapshot: SnapshotFn;
  }) => Promise<void> | void;
  /**
   * Optional structured payload to snapshot (e.g. agent output).
   */
  snapshot?: (result: RESULT) => unknown;
};

export function formatBDDTitle({
  given,
  when,
  then,
}: AgentBDDClauses): string {
  return `GIVEN ${given} WHEN ${when} THEN ${then}`;
}

export async function runAgentBehavior<GIVEN, RESULT>(
  spec: AgentBehaviorSpec<GIVEN, RESULT>,
): Promise<RESULT> {
  const result = await spec.when(spec.given);

  const snapshot = (value: unknown, hint?: string) =>
    expect(value).toMatchSnapshot(hint);

  if (spec.snapshot) {
    snapshot(spec.snapshot(result), `${spec.clauses.then} :: snapshot`);
  }

  await spec.then({
    given: spec.given,
    result,
    snapshot,
  });

  return result;
}
