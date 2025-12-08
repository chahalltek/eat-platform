# Deployment health gates

To fail before production does, deployments now run an explicit set of health gates:

- **Pipeline completeness**: The CI workflow must include linting, coverage-enforced tests, the deployment health gate itself, and a production-like build.
- **Migration validation**: Every Prisma migration must include SQL and be free of merge conflict markers or empty files.
- **Test completeness**: Coverage data must exist, remain fresh (less than 24 hours old), and meet minimum coverage thresholds.
- **Environment validation**: Configuration must satisfy production-grade requirements via `npm run ci:config-validate`.
- **Prisma readiness**: The generated Prisma client must exist and match the checked-in schema.
- **Failure injection**: Pass `--inject-failure` or set `FAIL_DEPLOYMENT_HEALTH=true` to verify the gate halts when expected.

Run the gate locally with:

```bash
npm test
npm run predeploy
```

The CI pipeline executes the same checks before building to mirror production deploys.
