function resolveDatabaseUrl(env) {
  return (
    env.DATABASE_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.POSTGRES_URL_NON_POOLING ||
    env.POSTGRES_URL
  );
}

module.exports = { resolveDatabaseUrl };
